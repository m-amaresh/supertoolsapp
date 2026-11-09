import type { Browser, BrowserContext, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ANALYTICS_CONSENT_KEY } from "../../src/lib/analytics-consent";
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

  /** Whether keyboard focus is currently inside the given container. */
  function focusInside(page: Page, selector: string): Promise<boolean> {
    return page.evaluate(
      (sel) =>
        Boolean(document.querySelector(sel)?.contains(document.activeElement)),
      selector,
    );
  }

  it("leaves focus at the top of the page when the banner appears", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      expect(await page.locator(BANNER).isVisible()).toBe(true);
      expect(
        await focusInside(page, BANNER),
        "a non-modal banner must not take focus on load",
      ).toBe(false);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("styles declining exactly like accepting", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      const look = (selector: string) =>
        page.locator(selector).evaluate((el) => {
          const s = getComputedStyle(el);
          return [s.backgroundColor, s.color, s.borderColor, s.fontWeight];
        });
      expect(await look(REJECT)).toEqual(await look(ACCEPT));
      await page.locator(`${BANNER} .stcm-preferences-button`).click();
      expect(await look(`${MODAL} .stcm-modal-reject-all`)).toEqual(
        await look(`${MODAL} .stcm-modal-save`),
      );
    } finally {
      await context.close();
    }
  }, 120_000);

  it("lets keyboard users Tab out of the banner in both directions", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      // The banner blocks nothing, so it must not hold focus until answered.
      // Silktide's own trap wraps last → first and first → last.
      const focusables = `${BANNER} :is(button, a[href], input, [tabindex]:not([tabindex="-1"]))`;
      await page.locator(focusables).last().focus();
      await page.keyboard.press("Tab");
      expect(
        await focusInside(page, BANNER),
        "Tab from the banner's last control must leave the banner",
      ).toBe(false);

      await page.locator(focusables).first().focus();
      await page.keyboard.press("Shift+Tab");
      expect(
        await focusInside(page, BANNER),
        "Shift+Tab from the banner's first control must leave the banner",
      ).toBe(false);
      expect(await page.locator(BANNER).isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("exposes preferences as a named, modal dialog with named controls", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      await page.locator(REJECT).click();
      const opener = page.getByRole("button", {
        name: "Cookie preferences",
        exact: true,
      });
      await opener.click();

      const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
      await expect.poll(() => dialog.isVisible()).toBe(true);
      expect(await dialog.getAttribute("aria-modal")).toBe("true");
      expect(
        await dialog
          .getByRole("button", { name: "Close cookie preferences" })
          .count(),
      ).toBe(1);
      expect(
        await dialog
          .getByRole("checkbox", { name: "Analytics cookies", exact: true })
          .count(),
      ).toBe(1);
      expect(
        await page.locator("main").evaluate((main) => main.closest("[inert]")),
        "the page behind the dialog must be inert",
      ).not.toBeNull();

      // A press outside must not strand focus where Escape goes unheard.
      await page.mouse.click(5, 5);
      expect(await focusInside(page, MODAL)).toBe(true);
      await page.keyboard.press("Escape");
      await expect.poll(() => page.locator(MODAL).isVisible()).toBe(false);
      expect(await page.locator("[inert]").count()).toBe(0);
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.textContent?.trim()),
        )
        .toBe("Cookie preferences");
    } finally {
      await context.close();
    }
  }, 120_000);

  it("brings the banner back when preferences close unanswered", async () => {
    const { context, page } = await freshVisit();
    try {
      if (!(await analyticsEnabled(page))) return;
      await page.locator(`${BANNER} .stcm-preferences-button`).click();
      await expect.poll(() => page.locator(MODAL).isVisible()).toBe(true);
      expect(await page.locator(BANNER).count()).toBe(0);
      await page.locator(`${MODAL} .stcm-modal-close`).click();
      await expect
        .poll(() => focusInside(page, BANNER), {
          message: "closing returns the visitor to the restored banner",
        })
        .toBe(true);
      await expect
        .poll(() =>
          page.getByRole("region", { name: "Cookie consent" }).isVisible(),
        )
        .toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it("does not warn about saving when the browser blocks storage", async () => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    try {
      await context.route("**://*.googletagmanager.com/**", (route) =>
        route.abort(),
      );
      // As with site data blocked: any access to localStorage throws.
      await context.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get() {
            throw new DOMException("Storage blocked", "SecurityError");
          },
        });
      });
      const page = await context.newPage();
      const dialogs: string[] = [];
      page.on("dialog", (dialog) => {
        dialogs.push(dialog.message());
        void dialog.dismiss();
      });
      await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      if (!(await analyticsEnabled(page))) return;

      await page.locator(REJECT).click();
      await page.waitForTimeout(400);
      expect(dialogs).toEqual([]);
      expect(await page.getByText("could not be saved").count()).toBe(0);
      const button = page.getByRole("button", {
        name: "Cookie preferences",
        exact: true,
      });
      expect(await button.getAttribute("aria-disabled")).toBe("false");
    } finally {
      await context.close();
    }
  }, 120_000);

  it("removes an earlier grant when a full quota blocks new writes", async () => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    try {
      await context.route("**://*.googletagmanager.com/**", (route) =>
        route.abort(),
      );
      // A grant saved while there was room, then a full quota: reads and
      // removals still work, every write throws — including Silktide's probe,
      // which therefore reports storage as unavailable.
      await context.addInitScript((key) => {
        const setItem = Storage.prototype.setItem;
        if (!sessionStorage.getItem("seeded")) {
          setItem.call(localStorage, key, "true");
          setItem.call(sessionStorage, "seeded", "1");
        }
        Storage.prototype.setItem = () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        };
      }, ANALYTICS_CONSENT_KEY);
      const page = await context.newPage();
      await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      if (!(await analyticsEnabled(page))) return;
      expect(
        (await consentCalls(page))[0]?.payload.analytics_storage,
        "precondition: the earlier grant is replayed",
      ).toBe("granted");

      await page.locator(REJECT).click();
      await page.waitForTimeout(400);
      expect(
        await page.evaluate(
          (key) => localStorage.getItem(key),
          ANALYTICS_CONSENT_KEY,
        ),
      ).toBeNull();
      expect(await page.getByText("could not be saved").count()).toBe(0);

      await page.reload({ waitUntil: "networkidle" });
      expect(
        (await consentCalls(page))[0]?.payload.analytics_storage,
        "a withdrawal must not be undone by the next load",
      ).toBe("denied");
    } finally {
      await context.close();
    }
  }, 120_000);
});
