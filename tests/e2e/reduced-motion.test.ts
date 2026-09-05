import type { Browser } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { type RunningServer, startProductionServer } from "./server";

/**
 * `prefers-reduced-motion` has to be asserted at runtime, not by grepping for
 * the rule. The block existed in globals.css for the whole of this project's
 * life and was completely inert: nested in `@layer base`, it lost to every
 * Tailwind utility, because the utilities layer outranks base regardless of
 * selector specificity. The CSS was present, reviewed, and did nothing.
 */
describe("prefers-reduced-motion", () => {
  let server: RunningServer;
  let browser: Browser;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  async function motionOf(reduced: boolean) {
    const page = await (
      await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      })
    ).newPage();
    await page.goto(`${server.baseUrl}/tools/time/timestamp`, {
      waitUntil: "networkidle",
    });
    const seconds = (v: string) =>
      v.endsWith("ms") ? Number.parseFloat(v) / 1000 : Number.parseFloat(v);
    const result = await page.evaluate(() => {
      const dot = document.querySelector(".animate-pulse");
      const link = document.querySelector<HTMLElement>('a[href="/"]');
      return {
        pulse: dot ? getComputedStyle(dot).animationDuration : null,
        iterations: dot ? getComputedStyle(dot).animationIterationCount : null,
        transition: link ? getComputedStyle(link).transitionDuration : null,
      };
    });
    await page.close();
    return {
      pulse: result.pulse ? seconds(result.pulse) : null,
      iterations: result.iterations,
      transition: result.transition ? seconds(result.transition) : null,
    };
  }

  it("animates normally when no preference is set", async () => {
    const m = await motionOf(false);
    expect(m.pulse, "the live-status dot should pulse").toBeGreaterThan(0.1);
    expect(m.iterations).toBe("infinite");
    expect(m.transition, "links should transition").toBeGreaterThan(0);
  }, 60_000);

  it("stops animation and transitions when reduce is requested", async () => {
    const m = await motionOf(true);
    expect(
      m.pulse,
      "the infinitely-pulsing dot must stop under reduced motion",
    ).toBeLessThan(0.05);
    expect(m.iterations).toBe("1");
    expect(
      m.transition,
      "transitions must be suppressed under reduced motion",
    ).toBeLessThan(0.05);
  }, 60_000);
});
