import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  buildEncryptArgs,
  DEFAULT_PERMISSIONS,
  type PdfEncryptOptions,
} from "../../src/lib/pdf-encrypt";
import { makePdf } from "./make-pdf";

/**
 * Runs `buildEncryptArgs` against the real qpdf the app ships.
 *
 * The unit suite proves the function emits the flags it intends to. It cannot
 * prove qpdf *accepts* them, and that is the half that breaks: the argument
 * grammar is version-sensitive — qpdf 11.9 replaced the positional
 * `--encrypt user owner bits` form with named options, and `--use-aes` is
 * rejected outright at 256 bits — so a wrong flag produces a non-zero exit and
 * no output at all, which every unit test in the suite would still pass.
 *
 * This lives in the e2e suite rather than beside the unit tests because it
 * instantiates the 1.3 MB WASM engine. It needs no browser and no server.
 */

const require = createRequire(import.meta.url);

type Qpdf = {
  callMain: (args: string[]) => number;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
  };
};

/** qpdf exits 0 on success and 3 when it succeeded but printed warnings. */
const succeeded = (code: number) => code === 0 || code === 3;

/**
 * A fresh engine per call.
 *
 * Emscripten's MEMFS persists across `callMain` invocations, so a shared
 * instance would let one case read another's `out.pdf` and pass on a file it
 * never wrote.
 */
async function loadQpdf(): Promise<{ qpdf: Qpdf; output: () => string }> {
  const initQpdf = require("@neslinesli93/qpdf-wasm");
  let captured: string[] = [];
  // qpdf binds console.log/error by value when its factory runs, so its output
  // cannot be redirected through Module options — patch the console instead.
  const realLog = console.log;
  const realError = console.error;
  console.log = (...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  };
  try {
    const qpdf: Qpdf = await initQpdf({ noInitialRun: true });
    captured = [];
    return {
      qpdf,
      output: () => {
        const text = captured.join("\n");
        captured = [];
        return text;
      },
    };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

const options = (
  overrides: Partial<PdfEncryptOptions> = {},
): PdfEncryptOptions => ({
  userPassword: "hunter2",
  ownerPassword: "",
  strength: "aes256",
  permissions: { ...DEFAULT_PERMISSIONS },
  ...overrides,
});

/** Encrypt a fresh fixture with the given options and hand back the bytes. */
async function encrypt(opts: PdfEncryptOptions): Promise<Uint8Array> {
  const { qpdf, output } = await loadQpdf();
  qpdf.FS.writeFile("in.pdf", new Uint8Array(makePdf("P", 2)));

  const code = qpdf.callMain(buildEncryptArgs(opts, "in.pdf", "out.pdf"));
  if (!succeeded(code)) {
    throw new Error(`qpdf rejected the arguments (exit ${code}): ${output()}`);
  }
  return qpdf.FS.readFile("out.pdf");
}

/** Report what qpdf sees in a file, optionally authenticating first. */
async function showEncryption(
  bytes: Uint8Array,
  password?: string,
): Promise<{ code: number; text: string }> {
  const { qpdf, output } = await loadQpdf();
  qpdf.FS.writeFile("check.pdf", bytes);
  const args = password === undefined ? [] : [`--password=${password}`];
  const code = qpdf.callMain([...args, "--show-encryption", "--", "check.pdf"]);
  return { code, text: output() };
}

describe("pdf-encrypt engine: AES-256", () => {
  it("produces a file qpdf reports as AES-256 revision 6", async () => {
    const bytes = await encrypt(options());
    const { code, text } = await showEncryption(bytes, "hunter2");

    expect(succeeded(code)).toBe(true);
    expect(text).toMatch(/R = 6/);
    expect(text).toMatch(/file encryption method:\s*AESv3/i);
  });

  it("refuses to open with the wrong password", async () => {
    const bytes = await encrypt(options({ userPassword: "correct-horse" }));
    const { code, text } = await showEncryption(bytes, "wrong-horse");

    expect(succeeded(code)).toBe(false);
    expect(text.toLowerCase()).toContain("invalid password");
  });

  it("refuses to open with no password at all", async () => {
    const bytes = await encrypt(options());
    const { code, text } = await showEncryption(bytes);

    expect(succeeded(code)).toBe(false);
    expect(text.toLowerCase()).toContain("invalid password");
  });

  it("authenticates the open password as the owner password when no separate one is set", async () => {
    // This is what `effectiveOwnerPassword` guarantees: both passwords are the
    // same value, so the file is never the insecure user-password-only shape
    // that qpdf would need --allow-insecure to write.
    const bytes = await encrypt(options({ userPassword: "same-for-both" }));
    const { text } = await showEncryption(bytes, "same-for-both");

    expect(text.toLowerCase()).toContain("owner password");
  });

  it("keeps a distinct owner password distinct from the open password", async () => {
    const bytes = await encrypt(
      options({ userPassword: "open-me", ownerPassword: "admin-only" }),
    );

    const asUser = await showEncryption(bytes, "open-me");
    expect(succeeded(asUser.code)).toBe(true);
    expect(asUser.text.toLowerCase()).toContain("user password");

    const asOwner = await showEncryption(bytes, "admin-only");
    expect(succeeded(asOwner.code)).toBe(true);
    expect(asOwner.text.toLowerCase()).toContain("owner password");
  });
});

describe("pdf-encrypt engine: AES-128", () => {
  /**
   * The case that motivated `--use-aes=y`. qpdf documents the flag's default
   * as "n" for compatibility, so `--bits=128` alone writes RC4-128 while the
   * tool's own label promises AES — weak crypto shipped under a strong name.
   */
  it("produces AES-128 rather than the RC4 qpdf defaults to at 128 bits", async () => {
    const bytes = await encrypt(options({ strength: "aes128" }));
    const { code, text } = await showEncryption(bytes, "hunter2");

    expect(succeeded(code)).toBe(true);
    expect(text).toMatch(/R = 4/);
    expect(text).toMatch(/file encryption method:\s*AESv2/i);
    expect(text).not.toMatch(/RC4/i);
  });
});

describe("pdf-encrypt engine: permissions", () => {
  it("grants everything by default", async () => {
    const bytes = await encrypt(options());
    const { text } = await showEncryption(bytes, "hunter2");

    expect(text).toMatch(/print (?:high|low) resolution:\s*allowed/i);
    expect(text).toMatch(/extract for any purpose:\s*allowed/i);
    expect(text).toMatch(/modify document assembly:\s*allowed/i);
  });

  it("applies every restriction when all are cleared", async () => {
    const bytes = await encrypt(
      options({
        permissions: {
          print: false,
          copy: false,
          modify: false,
          annotate: false,
        },
      }),
    );
    const { text } = await showEncryption(bytes, "hunter2");

    expect(text).toMatch(/print (?:high|low) resolution:\s*not allowed/i);
    expect(text).toMatch(/extract for any purpose:\s*not allowed/i);
    expect(text).toMatch(/modify annotations:\s*not allowed/i);
  });

  it("denies commenting even when editing is allowed", async () => {
    // Regression, and the reason buildEncryptArgs emits --annotate=n: the
    // --modify level runs all -> annotate -> none, so `all` grants annotation
    // on the way past. Emitting the level alone produced a document that
    // allowed commenting while the UI listed it as restricted.
    const bytes = await encrypt(
      options({ permissions: { ...DEFAULT_PERMISSIONS, annotate: false } }),
    );
    const { text } = await showEncryption(bytes, "hunter2");

    expect(text).toMatch(/modify annotations:\s*not allowed/i);
    // And form filling, which the UI names in the same breath as commenting.
    // --annotate=n alone left this reading "allowed".
    expect(text).toMatch(/modify forms:\s*not allowed/i);
    // Editing itself is still permitted, which is what makes this distinct
    // from --modify=none.
    expect(text).toMatch(/modify other:\s*allowed/i);
  });

  it("keeps commenting available when only editing is denied", async () => {
    // `modifyOption` collapses this onto `--modify=annotate`; the point is that
    // qpdf accepts the level and that the two permissions really do diverge.
    const bytes = await encrypt(
      options({ permissions: { ...DEFAULT_PERMISSIONS, modify: false } }),
    );
    const { text } = await showEncryption(bytes, "hunter2");

    expect(text).toMatch(/modify annotations:\s*allowed/i);
    expect(text).toMatch(/modify other:\s*not allowed/i);
  });
});

describe("pdf-encrypt engine: round trip", () => {
  it("decrypts back to a readable PDF with the password", async () => {
    const bytes = await encrypt(options({ userPassword: "round-trip" }));

    const { qpdf, output } = await loadQpdf();
    qpdf.FS.writeFile("enc.pdf", bytes);
    const code = qpdf.callMain([
      "--password=round-trip",
      "--decrypt",
      "enc.pdf",
      "dec.pdf",
    ]);
    expect(succeeded(code)).toBe(true);

    const decrypted = Buffer.from(qpdf.FS.readFile("dec.pdf")).toString(
      "latin1",
    );
    expect(decrypted.startsWith("%PDF-")).toBe(true);
    expect(decrypted).not.toContain("/Encrypt");
    // The fixture's two pages survived the trip out and back.
    expect(decrypted).toMatch(/\/Count 2/);
    output();
  });

  it("accepts a password full of characters a shell would mangle", async () => {
    const password = `a b"c'd;$(e)\`f\\g`;
    const bytes = await encrypt(options({ userPassword: password }));
    const { code } = await showEncryption(bytes, password);

    expect(succeeded(code)).toBe(true);
  });

  it("accepts a non-ASCII password at 256 bits", async () => {
    const password = "contraseña-🔒-пароль";
    const bytes = await encrypt(options({ userPassword: password }));
    const { code } = await showEncryption(bytes, password);

    expect(succeeded(code)).toBe(true);
  });
});
