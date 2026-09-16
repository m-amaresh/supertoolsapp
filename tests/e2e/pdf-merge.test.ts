import { createRequire } from "node:module";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { makePdf } from "./make-pdf";
import { readPageLabels } from "./read-pdf";
import { type RunningServer, startProductionServer } from "./server";

/**
 * Drives the PDF merger to a real result.
 *
 * The tool is listed as `cannotDrive` in `fixtures.ts` because that fixture
 * only types text into inputs and cannot set files, so the guarantees the
 * filled-state suite provides — a real result, a live-region mutation, focus
 * leaving the action button — have to be made here instead.
 *
 * It runs the whole path end to end: the WASM engine, the worker, the argv and
 * the interpretation on the main thread. That matters because the qpdf
 * invocation is version-sensitive — qpdf 11 dropped the bare-filename form of
 * `--pages` that older documentation still shows — and a merger that silently
 * produced nothing would pass every unit test in the suite.
 */

/**
 * A PDF that opens with **no password** but forbids printing and editing.
 *
 * Built with the same qpdf the app ships, because this is precisely the input
 * that used to break the tool: it authenticates with an empty user password,
 * so the merge succeeds, and qpdf then carried its encryption into the output
 * — silently applying one document's restrictions to every other page.
 */
async function makeRestrictedPdf(): Promise<Buffer> {
  const require = createRequire(import.meta.url);
  const initQpdf = require("@neslinesli93/qpdf-wasm");
  const qpdf = await initQpdf({ noInitialRun: true });
  qpdf.FS.writeFile("src.pdf", new Uint8Array(makePdf("R", 2)));
  const code = qpdf.callMain([
    "--encrypt",
    "--user-password=",
    "--owner-password=boss",
    "--bits=256",
    "--print=none",
    "--modify=none",
    "--",
    "src.pdf",
    "restricted.pdf",
  ]);
  if (code !== 0 && code !== 3) {
    throw new Error(`could not build the restricted fixture (exit ${code})`);
  }
  return Buffer.from(qpdf.FS.readFile("restricted.pdf"));
}

const ROUTE = "/tools/pdf/merge";

/**
 * Records every Blob the page hands to `URL.createObjectURL`.
 *
 * The merged bytes cannot be fetched back from the `blob:` URL: the app serves
 * a strict `connect-src 'self'`, which blocks fetch and XHR against blob URLs.
 * Reading the Blob object itself goes nowhere near the network, so this keeps
 * the assertion on real output without relaxing the policy under test.
 */
async function recordBlobs(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function record(object: Blob | MediaSource) {
      if (object instanceof Blob) {
        (window as unknown as { __lastBlob?: Blob }).__lastBlob = object;
      }
      return original.call(URL, object);
    };
  });
}

/**
 * The labels stamped on each page of the merged file, in order.
 *
 * Checking the page *count* is not enough: a regression that reversed the
 * documents, or duplicated one page while dropping another, keeps the count
 * intact. qpdf re-compresses content streams on write, so each one is inflated
 * before its text operators are read back — in page-tree order, because that
 * is the order qpdf writes the page objects out in.
 */
async function mergedPageLabels(target: Page): Promise<string[]> {
  const base64 = await target.evaluate(async () => {
    const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob;
    if (!blob) throw new Error("the page produced no blob");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });

  return readPageLabels(Buffer.from(base64, "base64"));
}

/** Generous: the first attempt pays for downloading and instantiating qpdf. */
const MERGE_TIMEOUT = 60_000;

describe("pdf merge", () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await recordBlobs(context);
    page = await context.newPage();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  async function addFiles(
    target: Page,
    files: { name: string; buffer: Buffer }[],
  ): Promise<void> {
    await target.locator('input[type="file"]').setInputFiles(
      files.map((file) => ({
        name: file.name,
        mimeType: "application/pdf",
        buffer: file.buffer,
      })),
    );
  }

  const mergeButton = (target: Page) =>
    target.getByRole("button", { name: /^Merg/ });
  const downloadLink = (target: Page) =>
    target.getByRole("link", { name: "Download" });
  /**
   * The visible result summary. Scoped to the span `ToolMeta` renders: the
   * live region repeats the same sentence, and matching page text at large
   * would resolve to both.
   */
  const resultSummary = (target: Page) =>
    target.locator("span").filter({ hasText: /^\d+ files · \d+ pages/ });
  const liveText = (target: Page) =>
    target.evaluate(
      () => document.querySelector("[aria-live]")?.textContent ?? "",
    );

  it("merges two PDFs, in order, into one document", async () => {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });

    // The action is unavailable until there is more than one document, since
    // merging a single file would be a no-op.
    await addFiles(page, [{ name: "alpha.pdf", buffer: makePdf("A", 2) }]);
    expect(
      await mergeButton(page).isDisabled(),
      "one file is not a merge",
    ).toBe(true);

    // Files queue up rather than replacing each other.
    await addFiles(page, [{ name: "beta.pdf", buffer: makePdf("B", 3) }]);
    expect(await mergeButton(page).isDisabled()).toBe(false);
    expect(await page.getByText("alpha.pdf").count()).toBe(1);
    expect(await page.getByText("beta.pdf").count()).toBe(1);

    await mergeButton(page).click();
    await downloadLink(page).waitFor({
      state: "visible",
      timeout: MERGE_TIMEOUT,
    });

    // 2 pages + 3 pages, counted by qpdf itself rather than assumed.
    const summary = await resultSummary(page).textContent();
    expect(summary, "every page of both inputs should survive").toContain(
      "2 files · 5 pages",
    );
    expect(await downloadLink(page).getAttribute("download")).toBe(
      "alpha-merged.pdf",
    );

    // The actual page sequence, not just how many pages there are.
    expect(
      await mergedPageLabels(page),
      "all of alpha's pages must come before all of beta's",
    ).toEqual(["A1", "A2", "B1", "B2", "B3"]);

    // Focus must leave the action button: before `useFocusResult` was wired
    // in, the next Tab went back through the toolbar instead of to the result.
    const focused = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? "",
    );
    expect(focused, "focus should land on the result").toContain("Download");

    const announced = await liveText(page);
    expect(announced, "the result must be announced").toContain("merged");
    expect(announced).toContain("alpha-merged.pdf");
  }, 120_000);

  it("reorders the documents and merges in the new order", async () => {
    await page.getByRole("button", { name: "Move beta.pdf up" }).click();

    // Editing the list invalidates the result it was built from.
    await downloadLink(page).waitFor({ state: "detached", timeout: 10_000 });

    await mergeButton(page).click();
    await downloadLink(page).waitFor({
      state: "visible",
      timeout: MERGE_TIMEOUT,
    });

    // The merged file is named after whichever document now leads the list.
    expect(await downloadLink(page).getAttribute("download")).toBe(
      "beta-merged.pdf",
    );

    // And the pages genuinely follow the new order — the filename alone would
    // still be right if the page sequence had not moved at all.
    expect(
      await mergedPageLabels(page),
      "beta's pages must now lead the document",
    ).toEqual(["B1", "B2", "B3", "A1", "A2"]);
  }, 120_000);

  it("shows a cover thumbnail and page count for each queued file", async () => {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });

    await addFiles(page, [
      { name: "contract.pdf", buffer: makePdf("A", 4) },
      { name: "appendix.pdf", buffer: makePdf("B", 2) },
    ]);

    // One cover per file, each drawn on a real canvas. Distinct pixel values
    // rather than canvas dimensions: the component sizes the frame itself
    // before rendering, so a size check would pass over a blank placeholder.
    const covers = page.locator("li canvas");
    await expect.poll(() => covers.count(), { timeout: MERGE_TIMEOUT }).toBe(2);
    await expect
      .poll(
        () =>
          covers.first().evaluate((element) => {
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
        { timeout: MERGE_TIMEOUT },
      )
      .toBeGreaterThan(1);

    // The count belongs to the file, so it has to follow the row when the
    // order changes rather than staying put at a position.
    await expect
      .poll(() => page.getByText(/4 pages/).count())
      .toBeGreaterThan(0);
    await expect
      .poll(() => page.getByText(/2 pages/).count())
      .toBeGreaterThan(0);

    const rowText = async () =>
      page.locator("li").filter({ hasText: ".pdf" }).allInnerTexts();
    const before = await rowText();
    expect(before[0]).toContain("contract.pdf");
    expect(before[0]).toContain("4 pages");

    await page.getByRole("button", { name: "Move appendix.pdf up" }).click();
    const after = await rowText();
    expect(after[0]).toContain("appendix.pdf");
    expect(after[0]).toContain("2 pages");
  });

  it("never opens a file too large to merge", async () => {
    // Regression: a cover was mounted for every queued file, and opening one
    // reads the whole document into memory. The size ceilings were checked
    // only when Merge was pressed, so an oversized file was loaded — and could
    // freeze the tab — long before anything refused it.
    //
    // What this watches is the read itself, because nothing else distinguishes
    // the two builds: 101 MB of padding fails to parse either way, so the
    // unfixed page also ends with no canvas and no surviving worker. Only the
    // arrayBuffer() call says whether the file was pulled into memory at all.
    await page.addInitScript(() => {
      const sizes: number[] = [];
      (window as unknown as { __reads: number[] }).__reads = sizes;
      const original = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function patched(this: Blob) {
        sizes.push(this.size);
        return original.call(this);
      };
    });

    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });

    // Comfortably past MAX_PDF_BYTES, with a real header so nothing else
    // rejects it first. Written to disk rather than passed as a buffer:
    // Playwright refuses in-memory payloads over 50 MB, well under the limit
    // being tested.
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = await mkdtemp(join(tmpdir(), "supertools-merge-"));
    const hugePath = join(directory, "huge.pdf");
    const hugeSize = 101 * 1024 * 1024;
    await writeFile(
      hugePath,
      Buffer.concat([
        Buffer.from("%PDF-1.4\n", "latin1"),
        Buffer.alloc(hugeSize, 0x20),
      ]),
    );

    const reads = () =>
      page.evaluate(
        () => (window as unknown as { __reads: number[] }).__reads ?? [],
      );

    try {
      // Two calls because the queue accumulates, and Playwright will not mix
      // a path with an in-memory payload in one call.
      await page.locator('input[type="file"]').setInputFiles([hugePath]);
      await expect
        .poll(() => page.getByText("huge.pdf").count())
        .toBeGreaterThan(0);

      // The small file that follows *is* read, which is what proves the
      // harness is watching the right thing rather than watching nothing.
      const small = makePdf("B", 2);
      await addFiles(page, [{ name: "small.pdf", buffer: small }]);
      await expect
        .poll(() => page.locator("li canvas").count(), {
          timeout: MERGE_TIMEOUT,
        })
        .toBe(1);
      await expect
        .poll(async () => (await reads()).includes(small.length))
        .toBe(true);

      // Nothing the size of the oversized file was ever pulled into memory.
      const sizes = await reads();
      expect(
        sizes.filter((size) => size >= hugeSize),
        `oversized file was read: ${JSON.stringify(sizes)}`,
      ).toEqual([]);

      // And it reports no page count, having never been opened.
      const rows = await page
        .locator("li")
        .filter({ hasText: "huge.pdf" })
        .allInnerTexts();
      expect(rows.join(" ")).not.toMatch(/\d+ pages/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("names the file at fault when one cannot be read", async () => {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });
    await addFiles(page, [
      { name: "good.pdf", buffer: makePdf("A", 1) },
      {
        name: "broken.pdf",
        buffer: Buffer.from("%PDF-1.4\nnot really a pdf", "utf8"),
      },
    ]);

    await mergeButton(page).click();
    const alert = page.locator('[data-slot="tool-status-stack"]');
    await alert.waitFor({ state: "visible", timeout: MERGE_TIMEOUT });

    // Naming the file is the whole point: with several inputs, "merge failed"
    // does not tell the reader which one to take out.
    const message = (await alert.textContent()) ?? "";
    expect(message, "the failing input must be named").toContain("broken.pdf");
    expect(await downloadLink(page).count()).toBe(0);
  }, 120_000);

  it("can be driven entirely from the keyboard", async () => {
    // A <label> is not focusable and the file input is display:none, so before
    // this was fixed there was no way to reach the picker with Tab at all —
    // the tool could not be started without a mouse.
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });

    const reachable = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return [];
      return [
        ...main.querySelectorAll<HTMLElement>(
          'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ]
        .filter((el) => getComputedStyle(el).display !== "none")
        .map((el) => (el.textContent ?? "").trim());
    });

    expect(
      reachable,
      "the file picker must be reachable without a mouse",
    ).toContain("Add PDFs");
  }, 120_000);

  it("says on screen when files are dropped for being over the limit", async () => {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });
    const many = Array.from({ length: 51 }, (_, i) => ({
      name: `doc${i}.pdf`,
      buffer: makePdf("A", 1),
    }));
    await addFiles(page, many);

    // The overflow used to exist only in the visually hidden live region, so a
    // sighted reader could download an incomplete merge none the wiser.
    const status = page.locator('[data-slot="tool-status-stack"]');
    await status.waitFor({ state: "visible", timeout: 10_000 });
    const text = (await status.textContent()) ?? "";
    expect(text, "the overflow must be visible, not just announced").toContain(
      "not added",
    );
    expect(text, "the dropped file must be named").toContain("doc50.pdf");
  }, 120_000);

  it("does not let a restricted input lock down the merged output", async () => {
    await page.goto(`${server.baseUrl}${ROUTE}`, { waitUntil: "networkidle" });
    await addFiles(page, [
      { name: "restricted.pdf", buffer: await makeRestrictedPdf() },
      { name: "open.pdf", buffer: makePdf("B", 1) },
    ]);

    await mergeButton(page).click();
    await downloadLink(page).waitFor({
      state: "visible",
      timeout: MERGE_TIMEOUT,
    });

    // The merged file must carry no encryption dictionary at all. Without
    // --decrypt this came back AES-256 encrypted, and open.pdf's page inherited
    // a "printing not allowed" flag it never had.
    const bytes = await page.evaluate(async () => {
      const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob;
      if (!blob) throw new Error("the page produced no blob");
      return [...new Uint8Array(await blob.arrayBuffer())];
    });
    const text = Buffer.from(bytes).toString("latin1");
    expect(text, "the merged output must not be encrypted").not.toContain(
      "/Encrypt",
    );

    // And the change must be reported rather than made silently.
    const status =
      (await page.locator('[data-slot="tool-status-stack"]').textContent()) ??
      "";
    expect(status, "the stripped restriction must be surfaced").toContain(
      "Restrictions were removed",
    );
    expect(status).toContain("restricted.pdf");
  }, 120_000);

  it("recovers when the list changes mid-merge", async () => {
    // The race needs a slow read to be observable, so `File.arrayBuffer` is
    // delayed in this context only. That is the only seam patched — everything
    // after it is the real implementation.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await recordBlobs(context);
    await context.addInitScript(() => {
      const original = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = function slowRead(this: File) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(original.call(this)), 2000);
        });
      };
    });
    const slow = await context.newPage();

    try {
      await slow.goto(`${server.baseUrl}${ROUTE}`, {
        waitUntil: "networkidle",
      });
      await addFiles(slow, [
        { name: "one.pdf", buffer: makePdf("A", 1) },
        { name: "two.pdf", buffer: makePdf("B", 1) },
        { name: "three.pdf", buffer: makePdf("C", 1) },
      ]);

      await mergeButton(slow).click();
      await slow.waitForTimeout(300);
      expect(
        await mergeButton(slow).isDisabled(),
        "should be working while the reads are pending",
      ).toBe(true);

      // Abandon the attempt while arrayBuffer() is still pending. Bumping the
      // attempt counter alone would leave every callback returning early, so
      // nothing would clear `isWorking` and the tool would sit on "Merging…"
      // with the button disabled and no recovery but a reload.
      await slow.getByRole("button", { name: "Remove three.pdf" }).click();
      await slow.waitForTimeout(400);

      expect(
        await mergeButton(slow).isDisabled(),
        "editing the list must end the abandoned attempt, not leave the tool " +
          "stuck on Merging… with the button disabled forever",
      ).toBe(false);

      // The abandoned attempt must not publish its outcome afterwards either.
      await slow.waitForTimeout(2200);
      expect(await downloadLink(slow).count()).toBe(0);
      expect(await liveText(slow)).not.toContain("please wait");

      // And a fresh attempt must still succeed, over the edited list.
      await mergeButton(slow).click();
      await downloadLink(slow).waitFor({
        state: "visible",
        timeout: MERGE_TIMEOUT,
      });
      const summary = await resultSummary(slow).textContent();
      expect(summary, "the removed file must not be in the result").toContain(
        "2 files · 2 pages",
      );
      expect(
        await mergedPageLabels(slow),
        "the removed document's page must be absent",
      ).toEqual(["A1", "B1"]);
    } finally {
      await context.close();
    }
  }, 120_000);
});
