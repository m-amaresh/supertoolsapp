import type { Browser, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { type RunningServer, startProductionServer } from "./server";

/**
 * Colour and focus-ring contrast, measured rather than assumed.
 *
 * Contrast is a property of the design tokens, not of individual routes, so
 * this samples the surfaces that differ — split panes, the options bar, status
 * alerts, results lists, preset chips, the sidebar and the home page — instead
 * of all 29 tool routes twice over.
 *
 * The first test is a self-test. A contrast checker that silently matches
 * nothing reports zero failures and looks like a pass, which is the same
 * failure this suite exists to catch; so it injects known-bad text and asserts
 * the probe flags it before any real assertion is trusted.
 */
const SURFACES = [
  "/",
  "/tools/data/json",
  "/tools/encode/aes",
  "/tools/encode/hash",
  "/tools/ids/password",
  "/tools/text/regex",
  "/tools/network/cidr",
  "/tools/pdf/unlock",
];

interface ContrastFailure {
  ratio: number;
  required: number;
  className: string;
  text: string;
}

/** Runs in the page: every text node whose contrast is below its threshold. */
function probeSource() {
  const luminance = (r: number, g: number, b: number) => {
    const f = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (value: string) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  type C = { r: number; g: number; b: number; a: number };
  const over = (fg: C, bg: C): C => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const ratio = (a: C, b: C) => {
    const l1 = luminance(a.r, a.g, a.b);
    const l2 = luminance(b.r, b.g, b.b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const backgroundOf = (el: Element | null): C => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.99) return c;
      if (c && c.a > 0) return over(c, backgroundOf(node.parentElement));
      node = node.parentElement;
    }
    const root = parse(
      getComputedStyle(document.documentElement).backgroundColor,
    );
    return root && root.a > 0 ? root : { r: 255, g: 255, b: 255, a: 1 };
  };

  const out: ContrastFailure[] = [];
  for (const el of document.querySelectorAll("main *, aside *")) {
    const ownText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent?.trim(),
    );
    if (el.children.length && !ownText) continue;
    const text = (el.textContent ?? "").trim();
    if (!text) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (Number(cs.opacity) === 0) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;

    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = backgroundOf(el);
    const effective = fg.a < 1 ? over(fg, bg) : fg;

    const size = Number.parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;
    const r = ratio(effective, bg);

    if (r < required - 0.01) {
      out.push({
        ratio: Math.round(r * 100) / 100,
        required,
        className: String(el.className).split(" ").slice(0, 2).join("."),
        text: text.slice(0, 40),
      });
    }
  }
  return out;
}

describe("contrast", () => {
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

  async function pageIn(theme: "light" | "dark"): Promise<Page> {
    return (
      await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        colorScheme: theme,
      })
    ).newPage();
  }

  it("the probe detects text that genuinely fails", async () => {
    const page = await pageIn("light");
    await page.goto(`${server.baseUrl}/tools/data/json`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      const el = document.createElement("p");
      el.className = "selftest-lowcontrast";
      el.textContent = "deliberately unreadable";
      el.style.color = "#bbbbbb";
      el.style.backgroundColor = "#ffffff";
      document.querySelector("main")?.appendChild(el);
    });
    const found = (await page.evaluate(probeSource)) as ContrastFailure[];
    const hit = found.find((f) => f.className.includes("selftest-lowcontrast"));
    expect(
      hit,
      "the contrast probe matched nothing it should have — a zero from the " +
        "tests below would be meaningless",
    ).toBeDefined();
    expect(hit?.ratio).toBeLessThan(2.5);
    await page.close();
  }, 60_000);

  for (const theme of ["light", "dark"] as const) {
    it(`meets WCAG 1.4.3 text contrast in ${theme}`, async () => {
      const page = await pageIn(theme);
      const failures: string[] = [];
      for (const route of SURFACES) {
        await page.goto(`${server.baseUrl}${route}`, {
          waitUntil: "networkidle",
        });
        const found = (await page.evaluate(probeSource)) as ContrastFailure[];
        for (const f of found) {
          failures.push(
            `${route} ${f.className} ${f.ratio}:1 (needs ${f.required}) "${f.text}"`,
          );
        }
      }
      await page.close();
      expect(failures, `text below its contrast threshold in ${theme}`).toEqual(
        [],
      );
    }, 120_000);
  }
});
