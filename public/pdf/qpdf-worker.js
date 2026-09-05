/**
 * PDF decryption worker.
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
 * `src/lib/pdf-unlock.ts`, where it is unit tested.
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

// The qpdf build binds console.log/console.error by value when its factory
// runs, so its output cannot be redirected through Module options. Patch the
// worker's own console up front and collect the lines instead. This worker
// exists only to run qpdf, so nothing else is affected.
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

// qpdf exits 0 on success and 3 when it succeeded but printed warnings, such
// as a cross-reference table it had to repair. A file that warns is still
// perfectly decryptable, so both codes continue. Mirrors `isQpdfSuccess` in
// src/lib/pdf-unlock.ts, which classifies the codes for the UI.
function succeeded(exitCode) {
  return exitCode === 0 || exitCode === 3;
}

function post(stage, exitCode, output, inspectOutput, bytes) {
  const message = { stage, exitCode, output, inspectOutput, bytes };
  self.postMessage(message, bytes ? { transfer: [bytes] } : undefined);
}

self.onmessage = async (event) => {
  // Dedicated workers only receive messages from their creator, so `origin` is
  // the empty string. Reject anything else as defense in depth.
  if (event.origin !== "" && event.origin !== self.location.origin) {
    return;
  }

  const data = event.data;
  if (
    !data ||
    !(data.bytes instanceof ArrayBuffer) ||
    typeof data.password !== "string"
  ) {
    post("startup", -1, "Invalid request payload", "", null);
    return;
  }

  try {
    const qpdf = await initQpdf({
      locateFile: () => "/pdf/qpdf.wasm",
      noInitialRun: true,
    });

    drainOutput(); // discard any startup chatter
    qpdf.FS.writeFile(INPUT_PATH, new Uint8Array(data.bytes));

    // Pass 1: authenticate and identify the protection in place.
    const inspectCode = qpdf.callMain([
      `--password=${data.password}`,
      "--show-encryption",
      INPUT_PATH,
    ]);
    const inspectOutput = drainOutput();

    if (
      !succeeded(inspectCode) ||
      /file is not encrypted/i.test(inspectOutput)
    ) {
      post("inspect", inspectCode, inspectOutput, inspectOutput, null);
      return;
    }

    // Pass 2: write the decrypted copy.
    const decryptCode = qpdf.callMain([
      `--password=${data.password}`,
      "--decrypt",
      INPUT_PATH,
      OUTPUT_PATH,
    ]);
    const decryptOutput = drainOutput();

    if (!succeeded(decryptCode)) {
      post("decrypt", decryptCode, decryptOutput, inspectOutput, null);
      return;
    }

    // Copy out of WASM memory so the transferred buffer is standalone.
    const result = qpdf.FS.readFile(OUTPUT_PATH);
    const copy = new Uint8Array(result.length);
    copy.set(result);

    post("decrypt", decryptCode, decryptOutput, inspectOutput, copy.buffer);
  } catch (error) {
    const detail = drainOutput();
    const message = error?.message ? error.message : String(error);
    post("startup", -1, detail ? `${message}\n${detail}` : message, "", null);
  }
};
