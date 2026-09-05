import type { Browser, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toolDefinitions } from "../../src/lib/tools";
import { resolveChromiumPath } from "./chromium";
import { type RunningServer, startProductionServer } from "./server";

/**
 * Guards the toolbar-clipping defect described in docs/architecture.md.
 *
 * `ToolCard` is `overflow-hidden`, so anything the toolbar lays out past the
 * card's inner width is hard-clipped: not scrollable, not focusable, not
 * visible. Before the fix this silently removed `Paste` and `Upload` from the
 * AES tool at 375px, which made file encryption unreachable on a phone.
 *
 * The defect is invisible in code review and in desktop QA, and any tool that
 * grows one more toolbar control crosses the same threshold, so the assertion
 * runs over every available tool rather than the five known-bad routes.
 */

// iPhone SE / 13 mini class. The narrowest viewport we claim to support, and
// the one where the original defect was worst.
const VIEWPORT = { width: 375, height: 812 };

const routes = toolDefinitions
  .filter((tool) => tool.available)
  .map((tool) => tool.href)
  .sort();

interface ToolbarMetrics {
  present: boolean;
  clientWidth: number;
  scrollWidth: number;
  clipped: string[];
}

async function measureToolbar(page: Page, baseUrl: string, route: string) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });

  return page.evaluate((): ToolbarMetrics => {
    const toolbar = document.querySelector<HTMLElement>(
      '[data-slot="tool-toolbar"]',
    );
    if (!toolbar) {
      return { present: false, clientWidth: 0, scrollWidth: 0, clipped: [] };
    }

    // The card is the clipping ancestor, so its right edge is where controls
    // actually disappear.
    const cardRight = (
      toolbar.closest('[data-slot="card"]') ?? toolbar
    ).getBoundingClientRect().right;

    // `Upload` renders as <Button asChild><label>, so match labels too, not
    // just buttons.
    const clipped = [
      ...toolbar.querySelectorAll<HTMLElement>(
        "button, select, label, a[href], [role=radio]",
      ),
    ]
      .filter((el) => el.getBoundingClientRect().right > cardRight)
      .map((el) => {
        const name = (
          el.textContent?.trim() ||
          el.getAttribute("aria-label") ||
          el.tagName
        ).slice(0, 32);
        const overhang = Math.round(
          el.getBoundingClientRect().right - cardRight,
        );
        const hidden = el.getBoundingClientRect().left >= cardRight;
        return `${name} (${hidden ? "fully hidden" : `cut ${overhang}px`})`;
      });

    return {
      present: true,
      clientWidth: toolbar.clientWidth,
      scrollWidth: toolbar.scrollWidth,
      clipped,
    };
  });
}

describe(`tool toolbars at ${VIEWPORT.width}px`, () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    page = await context.newPage();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  it("covers every available tool", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes)(
    "%s does not clip its toolbar",
    async (route) => {
      const bar = await measureToolbar(page, server.baseUrl, route);

      // A tool without a toolbar cannot clip one; nothing to assert.
      if (!bar.present) return;

      expect(
        bar.scrollWidth,
        `${route}: toolbar content is ${bar.scrollWidth - bar.clientWidth}px wider ` +
          `than the ${bar.clientWidth}px card, so it is hard-clipped by the card's ` +
          `overflow-hidden. Unreachable: ${bar.clipped.join(", ") || "(none named)"}`,
      ).toBeLessThanOrEqual(bar.clientWidth);

      expect(
        bar.clipped,
        `${route}: controls past the card's right edge`,
      ).toEqual([]);
    },
    30_000,
  );
});
