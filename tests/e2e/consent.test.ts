import type { Browser, BrowserContext, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { type RunningServer, startProductionServer } from "./server";

/**
 * Google Analytics cookie consent and preference controls.
 *
 * The invariant worth guarding is an ordering one, and it is invisible in code
 * review: gtag.js replays whatever is already on `dataLayer`, so if the
 * property is configured before the consent defaults are queued, a visitor who
 * never agreed is measured anyway. Nothing about that shows up as an error.
 *
 * Requests to googletagmanager.com are blocked throughout, so the suite makes
 * no Google calls. These assertions verify the consent commands the app queues
 * and the real banner UI; they do not verify Google delivery or reporting.
 */

const BANNER = "#stcm-banner";
const MODAL = "#stcm-modal";
const ICON = "#stcm-icon";

/**
 * Banner controls are addressed by the vendored markup's own classes rather
 * than by accessible name.
 *
 * Two reasons. The visible labels are ours to reword, and a copy change should
 * not quietly turn these assertions into no-ops — it already did once, when
 * "Accept all" became "Accept" and the query simply timed out. And the banner's
 * own "Preferences" control carries the accessible name "Change cookie
 * preferences", which a substring match on "Cookie preferences" also hits, so
 * name-based lookups cannot tell it apart from the footer link.
 */
const ACCEPT = `${BANNER} .stcm-accept-all`;
const REJECT = `${BANNER} .stcm-reject-all`;

interface ConsentCall {
  command: string;
  action: string;
  payload: Record<string, string | number>;
}

/** Every `gtag('consent', …)` call the page has queued, in order. */
async function consentCalls(page: Page): Promise<ConsentCall[]> {
  return page.evaluate(() => {
    const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    if (!Array.isArray(layer)) return [];
    return layer
      .map((entry) => Array.from(entry as ArrayLike<unknown>))
      .filter((args) => args[0] === "consent")
      .map((args) => ({
        command: String(args[0]),
        action: String(args[1]),
        payload: (args[2] ?? {}) as Record<string, string | number>,
      }));
  });
}

/** True when the build under test actually has a measurement ID compiled in. */
async function analyticsEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer),
  );
}

describe("cookie consent", () => {
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

  /** A fresh visitor: no stored choice, and no calls to Google. */
  async function freshVisit(): Promise<{
    context: BrowserContext;
    page: Page;
  }> {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await context.route("**://*.googletagmanager.com/**", (route) =>
      route.abort(),
    );
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    return { context, page };
  }

  it("denies every tracking signal before Google is configured", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) {
        // A build with no measurement ID must stay completely clean.
        expect(await page.locator(BANNER).count()).toBe(0);
        expect(
          await page
            .getByRole("button", { name: "Cookie preferences" })
            .count(),
        ).toBe(0);
        return;
      }

      const calls = await consentCalls(page);
      const defaults = calls.find((c) => c.action === "default");
      expect(defaults, "consent defaults must be queued").toBeTruthy();
      expect(defaults?.payload.analytics_storage).toBe("denied");
      expect(defaults?.payload.ad_storage).toBe("denied");
      expect(defaults?.payload.ad_user_data).toBe("denied");
      expect(defaults?.payload.ad_personalization).toBe("denied");

      // The ordering that cannot be seen by reading the page source.
      const order = await page.evaluate(() => {
        const layer = (window as unknown as { dataLayer?: unknown[] })
          .dataLayer;
        return (layer ?? [])
          .map((e) => Array.from(e as ArrayLike<unknown>))
          .map((a) => `${a[0]}:${a[1]}`);
      });
      const defaultAt = order.indexOf("consent:default");
      const configAt = order.findIndex((e) => e.startsWith("config:"));
      expect(defaultAt, "defaults must be queued").toBeGreaterThanOrEqual(0);
      expect(
        defaultAt,
        "consent defaults must precede the config call, or gtag.js replays a measured hit from someone who never agreed",
      ).toBeLessThan(configAt);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("shows the banner and hides the floating icon", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;

      await expect(page.locator(BANNER).isVisible()).resolves.toBe(true);
      // The icon is created unconditionally by the vendored banner; the footer
      // link replaces it, so it must not be painted over the tool UI.
      expect(
        await page.locator(ICON).isVisible(),
        "the floating cookie icon must stay suppressed",
      ).toBe(false);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("grants analytics only after the visitor accepts", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;

      const before = await consentCalls(page);
      expect(
        before.some((c) => c.action === "update"),
        "nothing may be granted before a choice is made",
      ).toBe(false);

      await page.locator(ACCEPT).click();
      await page.waitForTimeout(400);

      const updates = (await consentCalls(page)).filter(
        (c) => c.action === "update",
      );
      expect(updates.length, "accepting must update consent").toBeGreaterThan(
        0,
      );
      expect(updates.at(-1)?.payload.analytics_storage).toBe("granted");
      expect(await page.locator(BANNER).isVisible()).toBe(false);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("keeps analytics denied when the visitor rejects", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;

      await page.locator(REJECT).click();
      await page.waitForTimeout(400);

      const granted = (await consentCalls(page)).some(
        (c) =>
          c.action === "update" && c.payload.analytics_storage === "granted",
      );
      expect(granted, "rejecting must never grant analytics storage").toBe(
        false,
      );
      expect(await page.locator(BANNER).isVisible()).toBe(false);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("remembers the choice and lets it be changed from the footer", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;

      await page.locator(ACCEPT).click();
      await page.waitForTimeout(400);

      // Same context, so the stored choice should survive the reload.
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      expect(
        await page.locator(BANNER).isVisible(),
        "a visitor who has already chosen must not be asked again",
      ).toBe(false);

      const replayed = (await consentCalls(page)).filter(
        (c) => c.action === "update",
      );
      expect(
        replayed.at(-1)?.payload.analytics_storage,
        "the stored grant must be replayed on the next page load",
      ).toBe("granted");

      // Consent that cannot be withdrawn as easily as it was given is not
      // consent, so the footer control has to actually reopen the dialog.
      // `exact` matters: the banner's own control is "Change cookie
      // preferences", which a substring match would also select.
      await page
        .getByRole("button", { name: "Cookie preferences", exact: true })
        .click();
      await page.waitForTimeout(400);
      expect(await page.locator(MODAL).isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);
  it("withdraws consent across tabs and deletes existing GA cookies", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      await page.locator(ACCEPT).click();
      const other = await context.newPage();
      await other.goto(server.baseUrl, { waitUntil: "networkidle" });
      expect(
        (await consentCalls(other)).at(-1)?.payload.analytics_storage,
      ).toBe("granted");
      await context.addCookies([
        { name: "_ga", value: "test", url: server.baseUrl },
        { name: "_ga_TEST1234567", value: "test", url: server.baseUrl },
        { name: "unrelated", value: "keep", url: server.baseUrl },
      ]);
      await page
        .getByRole("button", { name: "Cookie preferences", exact: true })
        .click();
      await page.locator('label[for="consent-analytics"]').click();
      await page.locator(".stcm-modal-save").click();
      await expect
        .poll(
          async () =>
            (await consentCalls(other)).at(-1)?.payload.analytics_storage,
        )
        .toBe("denied");
      expect((await consentCalls(page)).at(-1)?.payload.analytics_storage).toBe(
        "denied",
      );
      expect((await context.cookies()).map((cookie) => cookie.name)).toEqual([
        "unrelated",
      ]);
      await page.reload({ waitUntil: "networkidle" });
      expect((await consentCalls(page)).at(-1)?.payload.analytics_storage).toBe(
        "denied",
      );
      expect(await page.locator(BANNER).isVisible()).toBe(false);
      // Clearing storage in another tab must withdraw permission and restore the prompt.
      await other.evaluate(() => localStorage.clear());
      await expect.poll(() => page.locator(BANNER).isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("restores accepted consent before a delayed banner loads", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      await page.locator(ACCEPT).click();
      await context.route("**/consent/silktide-consent-manager.js", (route) =>
        route.abort(),
      );
      await page.reload({ waitUntil: "networkidle" });
      const calls = await consentCalls(page);
      expect(calls[0].action).toBe("default");
      expect(calls[0].payload.analytics_storage).toBe("granted");
    } finally {
      await context.close();
    }
  }, 120_000);

  it("offers preferences on the cookies page", async () => {
    const { context, page } = await freshVisit();
    try {
      const enabled = await analyticsEnabled(page);
      const response = await page.goto(`${server.baseUrl}/cookies`, {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);
      if (!enabled) {
        expect(await page.locator("main").innerText()).toContain(
          "Google Analytics is not enabled",
        );
        return;
      }
      await page.locator(REJECT).click();
      await page
        .locator("main")
        .getByRole("button", { name: "Cookie preferences", exact: true })
        .click();
      expect(await page.locator(MODAL).isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("explains when the preference manager cannot load", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      await context.route("**/consent/silktide-consent-manager.js", (route) =>
        route.abort(),
      );
      await page.reload({ waitUntil: "networkidle" });
      const button = page.getByRole("button", {
        name: "Cookie preferences",
        exact: true,
      });
      await expect
        .poll(() => page.getByRole("status").textContent())
        .toContain("Preferences unavailable");
      expect(await button.getAttribute("aria-disabled")).toBe("true");
    } finally {
      await context.close();
    }
  }, 120_000);
});
