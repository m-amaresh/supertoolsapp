import type { Browser, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { type RunningServer, startProductionServer } from "./server";

/**
 * The PDF tool's attempt lifecycle.
 *
 * Abandoning an in-flight attempt used to bump the attempt counter without
 * clearing `isWorking` or terminating the worker, so every stale-return path
 * exited leaving the tool stuck on "Unlocking…" with the button disabled and
 * no recovery but a reload.
 *
 * The race needs a slow read to be observable, so `File.prototype.arrayBuffer`
 * is delayed in the page. That is the only seam patched — everything after it
 * is the real implementation.
 */
const A_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

describe("pdf unlock attempt lifecycle", () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    // Hold the read open long enough to abandon the attempt mid-flight.
    await context.addInitScript(() => {
      const original = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = function slowRead(this: File) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(original.call(this)), 2500);
        });
      };
    });
    page = await context.newPage();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  async function unlockButton() {
    return page.getByRole("button", { name: /Unlock|Unlocking/ }).last();
  }

  it("recovers when the password changes mid-read", async () => {
    await page.goto(`${server.baseUrl}/tools/pdf/unlock`, {
      waitUntil: "networkidle",
    });
    await page.locator('input[type="file"]').setInputFiles({
      name: "a.pdf",
      mimeType: "application/pdf",
      buffer: A_PDF,
    });
    await page.locator('input[type="password"]').fill("first");

    await (await unlockButton()).click();
    await page.waitForTimeout(300);
    expect(
      await (await unlockButton()).isDisabled(),
      "should be working while the read is pending",
    ).toBe(true);

    // Abandon the attempt while arrayBuffer() is still pending.
    await page.locator('input[type="password"]').fill("second");
    await page.waitForTimeout(400);

    expect(
      await (await unlockButton()).isDisabled(),
      "changing the password must end the abandoned attempt, not leave the " +
        "tool stuck on Unlocking… with the button disabled forever",
    ).toBe(false);

    const live = await page.evaluate(
      () => document.querySelector("[aria-live]")?.textContent ?? "",
    );
    expect(
      live,
      "the live region must not still say it is working",
    ).not.toContain("please wait");

    // And a fresh attempt must still be startable.
    await (await unlockButton()).click();
    await page.waitForTimeout(300);
    expect(
      await (await unlockButton()).isDisabled(),
      "a new attempt should be able to start",
    ).toBe(true);
  }, 90_000);

  it("recovers when Clear is pressed mid-read", async () => {
    await page.goto(`${server.baseUrl}/tools/pdf/unlock`, {
      waitUntil: "networkidle",
    });
    await page.locator('input[type="file"]').setInputFiles({
      name: "a.pdf",
      mimeType: "application/pdf",
      buffer: A_PDF,
    });
    await page.locator('input[type="password"]').fill("first");
    await (await unlockButton()).click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Clear" }).first().click();
    await page.waitForTimeout(2600);

    const live = await page.evaluate(
      () => document.querySelector("[aria-live]")?.textContent ?? "",
    );
    expect(
      live,
      "an abandoned attempt must not publish its outcome after Clear",
    ).not.toContain("please wait");
  }, 90_000);
});
