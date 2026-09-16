/**
 * PDF split worker.
 *
 * Served as a static asset rather than bundled, for the same two reasons as
 * the other workers in this directory:
 *
 * 1. A dedicated worker takes its Content-Security-Policy from the response
 *    headers of its own script URL, not from the page that created it.
 *    Instantiating WebAssembly needs 'wasm-unsafe-eval', and serving every
 *    worker from `/pdf/` means that relaxation stays scoped to this one
 *    directory instead of every bundled chunk in the application.
 * 2. The qpdf Emscripten glue contains an unreachable Node.js branch that
 *    references `fs` and `path`. Keeping it out of the bundler avoids having to
 *    stub Node built-ins for the browser build.
 *
 * Like its siblings it is a thin runner: it executes qpdf and reports the raw
 * exit code, the raw output, and whatever files appeared. Every decision about
 * what that means lives in `src/lib/pdf-split.ts`, where it is unit tested.
 * argv is built there too and passed in whole, so the flag contract with qpdf
 * has test coverage rather than living in this untyped file.
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
// as a cross-reference table it had to repair. A file that warns still splits
// perfectly well, so both codes continue. Mirrors `isQpdfSuccess` in
// src/lib/qpdf.ts, which classifies the codes for the UI.
function succeeded(exitCode) {
  return exitCode === 0 || exitCode === 3;
}

function post(stage, exitCode, output, pageCount, files) {
  const message = { stage, exitCode, output, pageCount, files };
  // Each produced file owns its buffer, so they can all be moved rather than
  // copied. A 200-piece split would otherwise duplicate the whole document.
  const transfer = files.map((file) => file.bytes);
  self.postMessage(message, transfer.length > 0 ? { transfer } : undefined);
}

/**
 * The paths are appended by the arg builders in src/lib/pdf-split.ts, so a
 * caller cannot redirect the run at files this worker does not own. Verifying
 * it here keeps that guarantee local to the process that writes the filesystem.
 */
function argsAreWellFormed(args, mode) {
  if (!Array.isArray(args) || args.length < 2) return false;
  if (!args.every((arg) => typeof arg === "string")) return false;

  if (mode === "extract") {
    return (
      args[0] === INPUT_PATH &&
      args[args.length - 1] === OUTPUT_PATH &&
      args.includes("--pages")
    );
  }

  // chunks: --split-pages=N in.pdf out.pdf
  return (
    args[0].startsWith("--split-pages=") &&
    args[1] === INPUT_PATH &&
    args[2] === OUTPUT_PATH
  );
}

/** Read the page count out of a --show-npages run. */
function readPageCount(text) {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

self.onmessage = async (event) => {
  // Dedicated workers only receive messages from their creator, so `origin` is
  // the empty string. Reject anything else as defense in depth.
  if (event.origin !== "" && event.origin !== self.location.origin) {
    return;
  }

  const data = event.data;
  if (!data || !(data.bytes instanceof ArrayBuffer)) {
    post("startup", -1, "Invalid request payload", null, []);
    return;
  }

  const mode = data.mode;
  if (mode !== "count" && mode !== "extract" && mode !== "chunks") {
    post("startup", -1, "Unknown split mode", null, []);
    return;
  }

  if (mode !== "count" && !argsAreWellFormed(data.args, mode)) {
    post("startup", -1, "Invalid split arguments", null, []);
    return;
  }

  try {
    const qpdf = await initQpdf({
      locateFile: () => "/pdf/qpdf.wasm",
      noInitialRun: true,
    });

    drainOutput(); // discard any startup chatter
    qpdf.FS.writeFile(INPUT_PATH, new Uint8Array(data.bytes));

    // Pass 1: refuse a protected document.
    //
    // qpdf cannot read an encrypted file without the password, and one that
    // opens with an empty user password would split silently — handing back
    // pieces whose restrictions had been dropped. That is the defect the merge
    // tool had to fix, so this tool stops rather than repeats it.
    const inspectCode = qpdf.callMain(["--show-encryption", "--", INPUT_PATH]);
    const inspectOutput = drainOutput();

    if (
      !succeeded(inspectCode) ||
      !/file is not encrypted/i.test(inspectOutput)
    ) {
      post("inspect", inspectCode, inspectOutput, null, []);
      return;
    }

    // Pass 2: how long is the document? The main thread needs this to resolve
    // a page range, and to say how many pieces a chunk size will produce.
    const countCode = qpdf.callMain(["--show-npages", INPUT_PATH]);
    const countOutput = drainOutput();
    const pageCount = succeeded(countCode) ? readPageCount(countOutput) : null;

    if (mode === "count" || pageCount === null) {
      post("count", countCode, countOutput, pageCount, []);
      return;
    }

    // Snapshot the filesystem so the chunk files qpdf invents can be told
    // apart from everything already there. qpdf names them itself and the
    // count depends on the document, so there is nothing to predict.
    const before = new Set(qpdf.FS.readdir("/"));

    const exitCode = qpdf.callMain(data.args);
    const output = drainOutput();

    if (!succeeded(exitCode)) {
      post("split", exitCode, output, pageCount, []);
      return;
    }

    const produced = qpdf.FS.readdir("/").filter(
      (name) => !before.has(name) && /\.pdf$/i.test(name),
    );

    // The input is no longer needed; free the MEMFS copy before the outputs
    // are read out into buffers of their own.
    try {
      qpdf.FS.unlink(INPUT_PATH);
    } catch {
      // Already gone, or the build exposes no unlink. Not worth failing for.
    }

    const files = [];
    for (const name of produced) {
      // Copy out of WASM memory so each transferred buffer is standalone.
      const contents = qpdf.FS.readFile(name);
      const copy = new Uint8Array(contents.length);
      copy.set(contents);
      files.push({ name, bytes: copy.buffer });
      try {
        qpdf.FS.unlink(name);
      } catch {
        // See above.
      }
    }

    post("split", exitCode, output, pageCount, files);
  } catch (error) {
    const detail = drainOutput();
    const message = error?.message ? error.message : String(error);
    post("startup", -1, detail ? `${message}\n${detail}` : message, null, []);
  }
};
