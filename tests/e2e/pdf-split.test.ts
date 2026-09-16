import type { Browser, BrowserContext, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { makePdf } from "./make-pdf";
import { readPageLabels } from "./read-pdf";
import { type RunningServer, startProductionServer } from "./server";

/**
 * Drives the PDF splitter to a real result.
 *
 * The tool is listed as `cannotDrive` in `fixtures.ts` because that fixture
 * only types text into inputs and cannot set files, so the guarantees the
 * filled-state suite provides — a real result, a live-region mutation — have
 * to be made here instead.
 *
 * `pdf-split-engine.test.ts` already proves the argv and the range parser
 * agree with qpdf. What is only provable in a browser is the rest: that the
 * worker loads under the production Content-Security-Policy, that the page
 * count arrives before the reader can type a range, and — the reason this file
 * exists at all — that building the ZIP works. JSZip's bundle carries a
 * setImmediate polyfill containing `new Function`, and the app serves
 * `script-src 'self' 'unsafe-inline'` with no `unsafe-eval` in production. If
 * that branch were ever reached the archive would fail here and nowhere else.
 */

const ROUTE = "/tools/pdf/split";

/** Generous: the first attempt pays for downloading and instantiating qpdf. */
const SPLIT_TIMEOUT = 60_000;

/**
 * Records every Blob the page hands to `URL.createObjectURL`, keyed in order.
 *
 * The produced bytes cannot be fetched back from the `blob:` URL: the app
 * serves a strict `connect-src 'self'`, which blocks fetch and XHR against
 * blob URLs. Reading the Blob objects themselves goes nowhere near the
 * network, so this keeps the assertions on real output without relaxing the
 * policy under test.
 */
async function recordBlobs(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const store: Blob[] = [];
    (window as unknown as { __blobs: Blob[] }).__blobs = store;
    const original = URL.createObjectURL;
    URL.createObjectURL = function record(object: Blob | MediaSource) {
      if (object instanceof Blob) store.push(object);
      return original.call(URL, object);
    };
  });
}

/** Every Blob the page has created since the last reset, as buffers. */
async function recordedBlobs(target: Page): Promise<Buffer[]> {
  const encoded = await target.evaluate(async () => {
    const blobs = (window as unknown as { __blobs?: Blob[] }).__blobs ?? [];
    const out: string[] = [];
    for (const blob of blobs) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      out.push(btoa(binary));
    }
    return out;
  });
  return encoded.map((value) => Buffer.from(value, "base64"));
}

/**
 * Empties the record in place.
 *
 * Assigning a fresh array here would quietly stop recording: the init script
 * closed over the array it created, so `URL.createObjectURL` would keep
 * pushing into that one while `__blobs` pointed at a new, forever-empty
 * replacement.
 */
async function resetBlobs(target: Page): Promise<void> {
  await target.evaluate(() => {
    const store = (window as unknown as { __blobs?: Blob[] }).__blobs;
    if (store) store.length = 0;
  });
}

describe("pdf split", () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      acceptDownloads: true,
    });
    await recordBlobs(context);
    page = await context.newPage();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  async function addFile(target: Page, name: string, buffer: Buffer) {
    await target
      .locator('input[type="file"]')
      .setInputFiles([{ name, mimeType: "application/pdf", buffer }]);
  }

  const splitButton = (target: Page) =>
    target.getByRole("button", { name: /^Split/ });
  const rangeField = (target: Page) => target.locator("#pdf-split-range");
  const sizeField = (target: Page) => target.locator("#pdf-split-size");
  const downloadLinks = (target: Page) =>
    target.getByRole("link", { name: "Download" });
  /** The tool's own error alert, not any text on the page that resembles one. */
  const errorAlert = (target: Page) => target.locator('[role="presentation"]');
  const liveText = (target: Page) =>
    target.evaluate(
      () => document.querySelector("[aria-live]")?.textContent ?? "",
    );

  const thumbnails = (target: Page) =>
    target.locator('[data-slot="pdf-page-preview"] li[data-page]');
  const selectedPages = async (target: Page) =>
    target
      .locator('[data-slot="pdf-page-preview"] li[data-selected="true"]')
      .evaluateAll((items) =>
        items.map((item) => Number(item.getAttribute("data-page"))),
      );

  /** Load the route fresh, with a document of the given length. */
  async function open(pages: number, name = "report.pdf") {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });
    await resetBlobs(page);
    await addFile(page, name, makePdf("P", pages));
    // The page count comes from the engine, so the range field stays disabled
    // until the worker answers.
    await expect
      .poll(async () => rangeField(page).isDisabled(), {
        timeout: SPLIT_TIMEOUT,
      })
      .toBe(false);
  }

  it("reads the page count before a range can be typed", async () => {
    await open(10);
    await expect
      .poll(() => page.getByText("10 pages").count())
      .toBeGreaterThan(0);
    expect(await liveText(page)).toContain("10 pages");
  });

  it("extracts a page selection into one document", async () => {
    await open(10);
    await rangeField(page).fill("2-4");

    // The count *and* the pages are promised before the run, from the same
    // helper that builds the arguments — so the sentence cannot disagree with
    // the file that comes out.
    await expect
      .poll(() =>
        page.getByText("Produces 3 pages into one PDF: 2, 3, 4.").count(),
      )
      .toBeGreaterThan(0);

    await resetBlobs(page);
    await splitButton(page).click();
    await downloadLinks(page)
      .first()
      .waitFor({ state: "visible", timeout: SPLIT_TIMEOUT });

    expect(await downloadLinks(page).count()).toBe(1);
    const blobs = await recordedBlobs(page);
    expect(blobs).toHaveLength(1);
    // The pages that arrived, not merely how many.
    expect(readPageLabels(blobs[0])).toEqual(["P2", "P3", "P4"]);
  });

  it("names the extracted file after the selection", async () => {
    await open(10);
    await rangeField(page).fill("1-3");
    await splitButton(page).click();
    await downloadLinks(page)
      .first()
      .waitFor({ state: "visible", timeout: SPLIT_TIMEOUT });

    expect(await downloadLinks(page).first().getAttribute("download")).toBe(
      "report-pages-1-3.pdf",
    );
  });

  it("keeps the order asked for, rather than sorting it", async () => {
    await open(10);
    await rangeField(page).fill("4-2");

    // A backwards range is the case the hint's disclosure calls out, so the
    // preview has to show it going backwards too.
    await expect
      .poll(() =>
        page.getByText("Produces 3 pages into one PDF: 4, 3, 2.").count(),
      )
      .toBeGreaterThan(0);

    await resetBlobs(page);
    await splitButton(page).click();
    await downloadLinks(page)
      .first()
      .waitFor({ state: "visible", timeout: SPLIT_TIMEOUT });

    const blobs = await recordedBlobs(page);
    expect(readPageLabels(blobs[0])).toEqual(["P4", "P3", "P2"]);
  });

  it("reports a bad range on screen and refuses to run", async () => {
    await open(10);
    await rangeField(page).fill("11");

    await expect
      .poll(() => page.getByText(/page 11 does not exist/).count())
      .toBeGreaterThan(0);
    expect(await splitButton(page).isDisabled()).toBe(true);
  });

  it("cuts a document into chunks and offers each one", async () => {
    await open(10);
    await page.getByRole("radio", { name: "Split into files" }).click();
    await sizeField(page).fill("3");

    await expect
      .poll(() => page.getByText(/Produces 4 files/).count())
      .toBeGreaterThan(0);

    await resetBlobs(page);
    await splitButton(page).click();
    await expect
      .poll(() => downloadLinks(page).count(), { timeout: SPLIT_TIMEOUT })
      .toBe(4);

    // Named after the reader's file, and ordered.
    const names = await downloadLinks(page).evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("download")),
    );
    expect(names).toEqual([
      "report-01-03.pdf",
      "report-04-06.pdf",
      "report-07-09.pdf",
      "report-10-10.pdf",
    ]);

    const blobs = await recordedBlobs(page);
    expect(blobs.map(readPageLabels)).toEqual([
      ["P1", "P2", "P3"],
      ["P4", "P5", "P6"],
      ["P7", "P8", "P9"],
      ["P10"],
    ]);
  });

  /**
   * The CSP question, answered by doing it rather than by reading the bundle.
   * A blocked `new Function` inside JSZip would reject here.
   */
  it("builds a ZIP of every piece under the production CSP", async () => {
    const violations: string[] = [];
    const onConsole = (message: { text: () => string }) => {
      const text = message.text();
      if (/content security policy/i.test(text)) violations.push(text);
    };
    page.on("console", onConsole);

    try {
      await open(6);
      await page.getByRole("radio", { name: "Split into files" }).click();
      await sizeField(page).fill("2");
      await splitButton(page).click();
      await expect
        .poll(() => downloadLinks(page).count(), { timeout: SPLIT_TIMEOUT })
        .toBe(3);

      const download = page.waitForEvent("download", {
        timeout: SPLIT_TIMEOUT,
      });
      await page.getByRole("button", { name: /Download all/ }).click();
      const archive = await download;

      expect(archive.suggestedFilename()).toBe("report-split.zip");

      // A real archive, not an empty or half-written one: check the local file
      // header magic and that it names the pieces.
      const path = await archive.path();
      const { readFileSync } = await import("node:fs");
      const bytes = readFileSync(path);
      expect(bytes.subarray(0, 4)).toEqual(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      );
      const asText = bytes.toString("latin1");
      // Six pages, so qpdf pads its numbering to a single digit — the width
      // tracks the page count, which is why the ten-page case above reads
      // "report-01-03.pdf" and this one does not.
      expect(asText).toContain("report-1-2.pdf");
      expect(asText).toContain("report-5-6.pdf");
      // Stored, not deflated, so each PDF sits in the archive intact.
      expect(asText).toContain("%PDF-");

      expect(violations, violations.join("\n")).toEqual([]);
    } finally {
      page.off("console", onConsole);
    }
  });

  it("renders a thumbnail per page, drawn on a real canvas", async () => {
    await open(10);
    await expect
      .poll(() => thumbnails(page).count(), { timeout: SPLIT_TIMEOUT })
      .toBe(10);

    // Count the distinct pixel values rather than the canvas dimensions: the
    // component sets width and height itself before rendering, so a size
    // assertion would pass over a blank frame that pdf.js never drew into.
    await expect
      .poll(
        () =>
          page
            .locator('[data-slot="pdf-page-preview"] canvas')
            .first()
            .evaluate((element) => {
              const canvas = element as HTMLCanvasElement;
              const context = canvas.getContext("2d");
              if (!context || canvas.width === 0) return 0;
              const { data } = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const seen = new Set<number>();
              for (let i = 0; i < data.length; i += 4) {
                seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
              }
              return seen.size;
            }),
        { timeout: SPLIT_TIMEOUT },
      )
      // Page text on white: more than one colour means something was painted.
      .toBeGreaterThan(1);
  });

  it("lights up exactly the pages the typed range selects", async () => {
    await open(10);
    expect(await selectedPages(page)).toEqual([]);

    await rangeField(page).fill("1-3, 8");
    await expect.poll(() => selectedPages(page)).toEqual([1, 2, 3, 8]);

    // An exclusion is the case that is hardest to picture from the spec, so
    // it is the one most worth showing.
    await rangeField(page).fill("1-z,x4,x7");
    await expect
      .poll(() => selectedPages(page))
      .toEqual([1, 2, 3, 5, 6, 8, 9, 10]);
  });

  it("highlights nothing while splitting into chunks, where every page is kept", async () => {
    await open(6);
    await rangeField(page).fill("1-3");
    await expect.poll(() => selectedPages(page)).toEqual([1, 2, 3]);

    await page.getByRole("radio", { name: "Split into files" }).click();
    await expect.poll(() => selectedPages(page)).toEqual([]);
  });

  it("loads the pdf.js worker from its own strict-CSP path", async () => {
    const requested: string[] = [];
    const onRequest = (request: { url: () => string }) => {
      const url = request.url();
      if (url.includes("pdf.worker")) requested.push(new URL(url).pathname);
    };
    page.on("request", onRequest);

    const violations: string[] = [];
    const onConsole = (message: { text: () => string }) => {
      if (/content security policy/i.test(message.text())) {
        violations.push(message.text());
      }
    };
    page.on("console", onConsole);

    try {
      await open(4);
      await expect
        .poll(() => thumbnails(page).count(), { timeout: SPLIT_TIMEOUT })
        .toBe(4);

      // public/pdfjs/, not public/pdf/ — the latter carries the relaxed policy
      // qpdf needs, and pdf.js has no business inheriting it.
      expect(requested).toContain("/pdfjs/pdf.worker.min.mjs");
      expect(requested.every((path) => !path.startsWith("/pdf/"))).toBe(true);
      expect(violations, violations.join("\n")).toEqual([]);
    } finally {
      page.off("request", onRequest);
      page.off("console", onConsole);
    }
  });

  it("refuses a password-protected PDF instead of silently unprotecting it", async () => {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });
    await resetBlobs(page);

    // Built with the same qpdf the app ships. An owner-password-only file
    // opens with no prompt, so this is exactly the input that would otherwise
    // split silently into unprotected pieces.
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const initQpdf = require("@neslinesli93/qpdf-wasm");
    const qpdf = await initQpdf({ noInitialRun: true });
    qpdf.FS.writeFile("src.pdf", new Uint8Array(makePdf("R", 3)));
    const code = qpdf.callMain([
      "--encrypt",
      "--user-password=",
      "--owner-password=boss",
      "--bits=256",
      "--print=none",
      "--",
      "src.pdf",
      "locked.pdf",
    ]);
    if (code !== 0 && code !== 3) {
      throw new Error(`could not build the protected fixture (exit ${code})`);
    }
    const locked = Buffer.from(qpdf.FS.readFile("locked.pdf"));

    await addFile(page, "locked.pdf", locked);

    // Scoped to the alert, not to page text. The footnote below the tool
    // permanently says "A password-protected PDF is refused rather than
    // split", so a page-wide match passed whether or not anything was
    // actually refused — which is exactly how this test used to pass while
    // asserting nothing.
    await expect
      .poll(() => errorAlert(page).count(), { timeout: SPLIT_TIMEOUT })
      .toBe(1);
    expect(await errorAlert(page).innerText()).toMatch(/password-protected/i);
    expect(await downloadLinks(page).count()).toBe(0);

    // The refusal has to *hold*. Asserting straight away passed over a race:
    // the renderer was still handed the file, opened it — pdf.js reads an
    // owner-password document quite happily — and reported a page count that
    // re-enabled every field a moment later. Give it well past the time that
    // took, then check nothing has come back to life.
    await page.waitForTimeout(3000);
    expect(
      await rangeField(page).isDisabled(),
      "a refused document must not become selectable",
    ).toBe(true);
    expect(await splitButton(page).isDisabled()).toBe(true);
    // And no thumbnail grid, because the renderer was never given the file.
    expect(await thumbnails(page).count()).toBe(0);
    expect(await errorAlert(page).count()).toBe(1);
  });
});
