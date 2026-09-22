/**
 * PDF encryption worker.
 *
 * This file is deliberately served as a static asset rather than bundled with
 * the app, for two reasons:
 *
 * 1. A dedicated worker takes its Content-Security-Policy from the response
 *    headers of its own script URL, not from the page that created it.
 *    Instantiating WebAssembly needs 'wasm-unsafe-eval', and serving the worker
 *    from a fixed path (`/pdf/`) means that relaxation can be scoped to this
 *    one file instead of every bundled chunk in the application.
 * 2. The qpdf Emscripten glue contains an unreachable Node.js branch that
 *    references `fs` and `path`. Keeping it out of the bundler avoids having to
 *    stub Node built-ins for the browser build.
 *
 * It is intentionally a thin runner. It executes qpdf and reports raw exit
 * codes and output; every decision about what that means lives in
 * `src/lib/pdf-encrypt.ts`, where it is unit tested. The argument list is built
 * there too and passed in whole, so the flag contract with qpdf has test
 * coverage rather than living in this untyped file.
 *
 * `qpdf.js` and `qpdf.wasm` sit next to this file and are copied from
 * node_modules by `scripts/copy-qpdf-wasm.mjs`.
 *
 * This is a classic worker rather than a module worker: the qpdf glue is a UMD
 * bundle, not an ES module, so it has to be pulled in with importScripts. It
 * assigns the Emscripten factory to the global `Module`.
 */

importScripts("/pdf/qpdf.js");

const initQpdf = self.Module;

const INPUT_PATH = "in.pdf";
const OUTPUT_PATH = "out.pdf";

// qpdf captures console methods at factory startup; patch them first to collect output.
let captured = [];
console.log = (...args) => {
  captured.push(args.map(String).join(" "));
};
console.error = (...args) => {
  captured.push(args.map(String).join(" "));
};

function drainOutput() {
  const text = captured.join("\n");
  captured = [];
  return text;
}

// Exit 3 means success with warnings; keep this in sync with isQpdfSuccess.
function succeeded(exitCode) {
  return exitCode === 0 || exitCode === 3;
}

function post(stage, exitCode, output, bytes) {
  const message = { stage, exitCode, output, bytes };
  self.postMessage(message, bytes ? { transfer: [bytes] } : undefined);
}

/**
 * The paths are appended by `buildEncryptArgs`, so a caller cannot redirect
 * the run at files this worker does not own. Verifying it here keeps that
 * guarantee local to the process that writes the filesystem.
 */
function argsAreWellFormed(args) {
  if (!Array.isArray(args) || args.length < 3) return false;
  if (!args.every((arg) => typeof arg === "string")) return false;
  return (
    args[0] === "--encrypt" &&
    args[args.length - 2] === INPUT_PATH &&
    args[args.length - 1] === OUTPUT_PATH
  );
}

self.onmessage = async (event) => {
  // Dedicated worker messages have an empty origin.
  if (event.origin !== "" && event.origin !== self.location.origin) {
    return;
  }

  const data = event.data;
  if (!data || !(data.bytes instanceof ArrayBuffer)) {
    post("startup", -1, "Invalid request payload", null);
    return;
  }

  if (!argsAreWellFormed(data.args)) {
    post("startup", -1, "Invalid encryption arguments", null);
    return;
  }

  try {
    const qpdf = await initQpdf({
      locateFile: () => "/pdf/qpdf.wasm",
      noInitialRun: true,
    });

    drainOutput(); // discard any startup chatter
    qpdf.FS.writeFile(INPUT_PATH, new Uint8Array(data.bytes));

    // Pass 1: confirm there is no protection already in place.
    //
    // qpdf cannot add encryption to a file it cannot read, and an already
    // protected file would otherwise fail later with a bare "invalid password",
    // which reads as though the *new* password were at fault. Checking first
    // lets the real cause be reported. It also refuses to silently replace
    // protection the reader may not know is there.
    const inspectCode = qpdf.callMain(["--show-encryption", "--", INPUT_PATH]);
    const inspectOutput = drainOutput();

    if (
      !succeeded(inspectCode) ||
      !/file is not encrypted/i.test(inspectOutput)
    ) {
      post("inspect", inspectCode, inspectOutput, null);
      return;
    }

    const encryptCode = qpdf.callMain(data.args);
    const encryptOutput = drainOutput();

    if (!succeeded(encryptCode)) {
      post("encrypt", encryptCode, encryptOutput, null);
      return;
    }

    // Copy out of WASM memory so the transferred buffer is standalone.
    const result = qpdf.FS.readFile(OUTPUT_PATH);
    const copy = new Uint8Array(result.length);
    copy.set(result);

    post("encrypt", encryptCode, encryptOutput, copy.buffer);
  } catch (error) {
    const detail = drainOutput();
    const message = error?.message ? error.message : String(error);
    post("startup", -1, detail ? `${message}\n${detail}` : message, null);
  }
};
