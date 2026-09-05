import type { Browser, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { TOOL_FIXTURES } from "./fixtures";
import { type RunningServer, startProductionServer } from "./server";

/**
 * Behavioural guards for the state a tool is in once it has produced a result.
 *
 * The toolbar-overflow test only ever loaded pristine routes and only inspected
 * the toolbar. That is why it stayed green through a duplicated `CopyButton` on
 * three tools, a Color field squeezed to 26px at 375px, live regions that never
 * announced a second result, and focus that never moved. Every assertion here
 * covers one of those blind spots.
 */

/** Fixtures this suite can drive. Anything excluded says why, in fixtures.ts. */
const DRIVABLE = TOOL_FIXTURES.filter((f) => !f.cannotDrive);

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 1000 };

async function fill(page: Page, f: (typeof TOOL_FIXTURES)[number]) {
  for (const pre of f.prefill ?? []) {
    await page.locator(pre.selector).fill(pre.value);
  }
  if (f.fill) {
    await page
      .locator(f.selector ?? "textarea, input[type=text]")
      .first()
      .fill(f.fill);
  }
  if (f.action) {
    await page.getByRole("button", { name: f.action }).first().click();
  }
  await page.waitForTimeout(900);
}

describe("filled-state guards", () => {
  let server: RunningServer;
  let browser: Browser;
  let desktop: Page;
  let mobile: Page;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
    desktop = await (await browser.newContext({ viewport: DESKTOP })).newPage();
    mobile = await (
      await browser.newContext({
        viewport: MOBILE,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      })
    ).newPage();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  // --- one Copy per copyable region -------------------------------------
  it.each(DRIVABLE)(
    "$route renders no duplicate Copy button",
    async (f) => {
      await desktop.goto(`${server.baseUrl}${f.route}`, {
        waitUntil: "networkidle",
      });
      await fill(desktop, f);

      const labels = await desktop.evaluate(() =>
        [...document.querySelectorAll('[data-slot="card"] button')]
          .filter((b) => /^(Copy|Copied)$/.test(b.textContent?.trim() ?? ""))
          .map((b) => {
            // Identify the region a Copy belongs to by its row, so two Copies
            // for two different outputs stay legal.
            const row = b.parentElement;
            return (row?.textContent ?? "").replace(/\s+/g, " ").trim();
          }),
      );
      const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
      expect(dupes, `${f.route}: duplicate Copy in the same row`).toEqual([]);
    },
    45_000,
  );

  // --- nothing overflows the card at 375px ------------------------------
  it.each(DRIVABLE)(
    "$route fits 375px when filled",
    async (f) => {
      await mobile.goto(`${server.baseUrl}${f.route}`, {
        waitUntil: "networkidle",
      });
      await fill(mobile, f);

      const overflow = await mobile.evaluate(() => {
        const card = document.querySelector('[data-slot="card"]');
        if (!card) return [];
        const out: string[] = [];
        for (const el of card.querySelectorAll<HTMLElement>("*")) {
          if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
            const cs = getComputedStyle(el);
            // Clipped or scrolled by design: sr-only live regions are a 1px
            // box, `truncate` ellipsises on purpose, and code blocks scroll.
            if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
            if (cs.textOverflow === "ellipsis") continue;
            if (el.classList.contains("sr-only")) continue;
            if (el.tagName === "TEXTAREA" || el.tagName === "PRE") continue;
            out.push(
              `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ` +
                `(${el.scrollWidth} > ${el.clientWidth})`,
            );
          }
        }
        return out;
      });
      expect(overflow, `${f.route}: content wider than its container`).toEqual(
        [],
      );
    },
    45_000,
  );

  // --- a second, different result is announced --------------------------
  it.each(DRIVABLE.filter((f) => f.refill && !f.action))(
    "$route announces a second, different result",
    async (f) => {
      await desktop.goto(`${server.baseUrl}${f.route}`, {
        waitUntil: "networkidle",
      });
      const target = f.selector ?? "textarea, input[type=text]";
      for (const pre of f.prefill ?? []) {
        await desktop.locator(pre.selector).fill(pre.value);
      }

      await desktop
        .locator(target)
        .first()
        .fill(f.fill ?? "");
      await desktop.waitForTimeout(900);
      await desktop.evaluate(() => {
        const region = document.querySelector("[aria-live]");
        // biome-ignore lint/suspicious/noExplicitAny: test-only bridge
        (window as any).__mutations = 0;
        if (!region) return;
        new MutationObserver(() => {
          // biome-ignore lint/suspicious/noExplicitAny: test-only bridge
          (window as any).__mutations++;
        }).observe(region, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });

      await desktop
        .locator(target)
        .first()
        .fill(f.refill ?? "");
      await desktop.waitForTimeout(1100);

      const mutations = await desktop.evaluate(
        // biome-ignore lint/suspicious/noExplicitAny: test-only bridge
        () => (window as any).__mutations as number,
      );
      expect(
        mutations,
        `${f.route}: the live region did not change for a different result, ` +
          `so a screen reader announces nothing. Pass a change token to useAnnouncement.`,
      ).toBeGreaterThan(0);
    },
    45_000,
  );

  // --- manual tools move focus to their result --------------------------
  it.each(DRIVABLE.filter((f) => f.action))(
    "$route moves focus to the result after $action",
    async (f) => {
      await desktop.goto(`${server.baseUrl}${f.route}`, {
        waitUntil: "networkidle",
      });
      // Must drive the tool to a real result first: clicking the action on an
      // empty tool only produces an error, and there is nothing to focus.
      await fill(desktop, f);
      await desktop.waitForTimeout(400);

      // Asserting merely "not a button" would pass on <body>, which is what
      // focus falls back to when nothing is focused at all.
      const focused = await desktop.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return { tag: "body", inCard: false };
        return {
          tag: a.tagName.toLowerCase(),
          inCard: Boolean(a.closest('[data-slot="card"]')),
        };
      });
      expect(
        focused,
        `${f.route}: focus must land on the result inside the card, not stay on ` +
          `the button and not fall back to <body>`,
      ).toEqual({ tag: focused.tag, inCard: true });
      expect(focused.tag, `${f.route}: focus stayed on the action`).not.toBe(
        "button",
      );
    },
    45_000,
  );

  // --- every interactive target clears 24px -----------------------------
  it.each(DRIVABLE)(
    "$route has no target under 24px",
    async (f) => {
      await mobile.goto(`${server.baseUrl}${f.route}`, {
        waitUntil: "networkidle",
      });
      await fill(mobile, f);

      const small = await mobile.evaluate(() => {
        // Deliberately includes tabIndex=-1: excluding it is what hid the hash
        // tooltip badges, which were 34x16 and keyboard-unreachable.
        // Bare <label> is excluded: it is a convenience target beside a
        // control that is itself large enough. tooltip triggers are included
        // explicitly, because excluding tabIndex=-1 is what hid the 34x16
        // hash badges from the original probe.
        const sel =
          'button,a[href],input,select,textarea,[role=radio],[role=button],[data-slot="tooltip-trigger"]';
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          `[data-slot="card"] ${sel}`,
        )) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          const pb = getComputedStyle(el, "::before");
          let w = b.width;
          let h = b.height;
          if (
            pb.content &&
            pb.content !== "none" &&
            pb.position === "absolute"
          ) {
            w = Math.max(w, Number.parseFloat(pb.width) || 0);
            h = Math.max(h, Number.parseFloat(pb.height) || 0);
          }
          if (w < 24 || h < 24) {
            out.push(
              `${Math.round(w)}x${Math.round(h)} ${el.tagName.toLowerCase()} ` +
                `"${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}"`,
            );
          }
        }
        return out;
      });
      expect(small, `${f.route}: targets under 24x24 (WCAG 2.5.8)`).toEqual([]);
    },
    45_000,
  );
});
