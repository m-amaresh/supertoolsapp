/**
 * PDF merge worker.
 *
 * Served as a static asset rather than bundled, for the same two reasons as
 * `qpdf-worker.js` next to it:
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
 * Like its sibling it is a thin runner: it executes qpdf and reports the raw
 * exit code and output. Every decision about what that means — which file was
 * at fault, whether it was locked or damaged — lives in `src/lib/pdf-merge.ts`,
 * where it is unit tested.
 *
 * This is a classic worker rather than a module worker: the qpdf glue is a UMD
 * bundle, not an ES module, so it has to be pulled in with importScripts. It
 * assigns the Emscripten factory to the global `Module`.
 */

importScripts("/pdf/qpdf.js");

const initQpdf = self.Module;

const OUTPUT_PATH = "out.pdf";

/**
 * Scratch path for the nth input. Mirrors `scratchName` in
 * `src/lib/pdf-merge.ts`, which maps these back to the reader's own filenames
 * when qpdf names one in an error.
 */
function scratchName(index) {
  return `in${index}.pdf`;
}

/**
 * Mirrors `buildMergeArgs` in src/lib/pdf-merge.ts. The first input doubles as
 * the primary input so the result inherits its metadata, and every file is
 * passed as an explicit `--file=` token because qpdf 11+ rejects a bare
 * filename in a `--pages` list with "invalid range syntax".
 *
 * `--decrypt` is required: qpdf carries the primary input's encryption into
 * the output, so without it one restricted document silently locks down every
 * other document's pages.
 */
function buildMergeArgs(count) {
  const files = [];
  for (let i = 0; i < count; i += 1) files.push(`--file=${scratchName(i)}`);
  return [scratchName(0), "--decrypt", "--pages", ...files, "--", OUTPUT_PATH];
}

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

function post(stage, exitCode, output, pageCount, encryptedIndexes, bytes) {
  const message = {
    stage,
    exitCode,
    output,
    pageCount,
    encryptedIndexes,
    bytes,
  };
  self.postMessage(message, bytes ? { transfer: [bytes] } : undefined);
}

self.onmessage = async (event) => {
  // Dedicated worker messages have an empty origin.
  if (event.origin !== "" && event.origin !== self.location.origin) {
    return;
  }

  const data = event.data;
  if (
    !data ||
    !Array.isArray(data.buffers) ||
    data.buffers.length < 2 ||
    !data.buffers.every((buffer) => buffer instanceof ArrayBuffer)
  ) {
    post("startup", -1, "Invalid request payload", null, [], null);
    return;
  }

  try {
    const qpdf = await initQpdf({
      locateFile: () => "/pdf/qpdf.wasm",
      noInitialRun: true,
    });

    drainOutput(); // discard any startup chatter

    const count = data.buffers.length;
    for (let index = 0; index < count; index += 1) {
      qpdf.FS.writeFile(
        scratchName(index),
        new Uint8Array(data.buffers[index]),
      );
      // Drop the transferred copy as soon as MEMFS holds it, so the two do
      // not sit in tab memory together for the whole run. MEMFS keeps file
      // contents on the JS heap, not in WASM linear memory, so this is an
      // ordinary allocation and releasing it actually helps.
      data.buffers[index] = null;
    }
    data.buffers.length = 0;

    // Which inputs carry protection that --decrypt is about to remove. A file
    // with an empty user password merges without ever prompting, so this is
    // the only way the UI can report the change instead of making it silently.
    const encryptedIndexes = [];
    for (let index = 0; index < count; index += 1) {
      try {
        qpdf.callMain(["--show-encryption", scratchName(index)]);
        const inspect = drainOutput().trim();
        if (inspect && !/file is not encrypted/i.test(inspect)) {
          encryptedIndexes.push(index);
        }
      } catch {
        // A file qpdf cannot even inspect will fail the merge below with a
        // message that names it. Nothing useful to report from here.
        drainOutput();
      }
    }

    const exitCode = qpdf.callMain(buildMergeArgs(count));
    const output = drainOutput();

    if (!succeeded(exitCode)) {
      post("merge", exitCode, output, null, encryptedIndexes, null);
      return;
    }

    // The inputs are no longer needed; free the MEMFS copies before the
    // output is read out into a buffer of its own.
    for (let index = 0; index < count; index += 1) {
      try {
        qpdf.FS.unlink(scratchName(index));
      } catch {
        // Ignore failed cleanup; qpdf has already produced the result.
      }
    }

    // Copy out of WASM memory so the transferred buffer is standalone.
    const result = qpdf.FS.readFile(OUTPUT_PATH);
    const copy = new Uint8Array(result.length);
    copy.set(result);

    // Page count is a nicety, not part of the result. Ask for it after the
    // bytes are safely copied out, and report null rather than failing the
    // whole merge if qpdf will not answer.
    let pageCount = null;
    try {
      const countCode = qpdf.callMain(["--show-npages", OUTPUT_PATH]);
      const countOutput = drainOutput().trim();
      if (succeeded(countCode) && /^\d+$/.test(countOutput)) {
        pageCount = Number(countOutput);
      }
    } catch {
      drainOutput();
    }

    post("merge", exitCode, output, pageCount, encryptedIndexes, copy.buffer);
  } catch (error) {
    const detail = drainOutput();
    const message = error?.message ? error.message : String(error);
    post(
      "startup",
      -1,
      detail ? `${message}\n${detail}` : message,
      null,
      [],
      null,
    );
  }
};
