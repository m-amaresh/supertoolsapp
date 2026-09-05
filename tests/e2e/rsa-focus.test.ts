import type { Browser, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveChromiumPath } from "./chromium";
import { type RunningServer, startProductionServer } from "./server";

/**
 * RSA needs a real PKCS#8 key, so it cannot be driven by the generic fixtures.
 * It gets its own test because the focus defect lived precisely here: keying
 * `useFocusResult` on the signature value meant signing the same input twice
 * produced an identical signature, no state change, and no focus — and a
 * successful Verify changed nothing at all.
 */
describe("rsa focus", () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startProductionServer();
    browser = await chromium.launch({ executablePath: resolveChromiumPath() });
    page = await (
      await browser.newContext({ viewport: { width: 1280, height: 1000 } })
    ).newPage();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  async function signOnce() {
    await page.getByRole("button", { name: "Sign" }).last().click();
    await page.waitForTimeout(900);
    return page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return a ? a.id || a.tagName.toLowerCase() : "none";
    });
  }

  it("focuses the signature on every Sign, including a repeat", async () => {
    await page.goto(`${server.baseUrl}/tools/encode/rsa`, {
      waitUntil: "networkidle",
    });

    const pem = await page.evaluate(async () => {
      const pair = await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
      );
      const raw = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
      return `-----BEGIN PRIVATE KEY-----\n${(b64.match(/.{1,64}/g) ?? []).join("\n")}\n-----END PRIVATE KEY-----`;
    });

    await page.locator("#rsa-message").fill("hello");
    await page.locator("#rsa-key").fill(pem);

    expect(await signOnce(), "first Sign should focus the signature").toBe(
      "rsa-signature",
    );

    // Signing identical input yields an identical signature. Focus must still
    // move — this is the exact case the value-keyed hook missed.
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    expect(
      await signOnce(),
      "repeat Sign should focus the signature again",
    ).toBe("rsa-signature");
  }, 90_000);

  it("focuses the verdict after a *successful* Verify", async () => {
    await page.goto(`${server.baseUrl}/tools/encode/rsa`, {
      waitUntil: "networkidle",
    });

    // A real public key and a real signature over the same message. Filling
    // only the message reaches "Public key PEM is required" — an error path
    // that focuses the same wrapper, so the test would pass without ever
    // verifying anything.
    const { publicPem, signatureB64 } = await page.evaluate(async () => {
      const pair = await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
      );
      const pem = (label: string, buf: ArrayBuffer) => {
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        return `-----BEGIN ${label}-----\n${(b64.match(/.{1,64}/g) ?? []).join("\n")}\n-----END ${label}-----`;
      };
      const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
      const sig = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        pair.privateKey,
        new TextEncoder().encode("hello"),
      );
      return {
        publicPem: pem("PUBLIC KEY", spki),
        signatureB64: btoa(String.fromCharCode(...new Uint8Array(sig))),
      };
    });

    await page.getByRole("radio", { name: "Verify" }).click();
    await page.locator("#rsa-message").fill("hello");
    await page.locator("#rsa-key").fill(publicPem);
    await page.locator("#rsa-signature").fill(signatureB64);
    await page.getByRole("button", { name: "Verify" }).last().click();
    await page.waitForTimeout(1200);

    // The verification must actually have succeeded.
    const verdict = await page.evaluate(
      () =>
        document.querySelector('[data-slot="tool-status-stack"]')
          ?.textContent ?? "",
    );
    expect(verdict, "Verify did not succeed").toContain("Signature is valid");

    const focused = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body) return "body";
      // In Verify mode the signature box is an input the user pasted into, so
      // focusing it would be wrong — the verdict is the result.
      if (a.id === "rsa-signature") return "signature-input";
      return a.contains(
        document.querySelector('[data-slot="tool-status-stack"]')?.firstChild ??
          null,
      ) || a.closest('[data-slot="tool-status-stack"]')
        ? "verdict"
        : a.tagName.toLowerCase();
    });
    expect(focused).toBe("verdict");
  }, 90_000);

  it("leaves focus alone when Sign fails", async () => {
    await page.goto(`${server.baseUrl}/tools/encode/rsa`, {
      waitUntil: "networkidle",
    });
    // Sign with empty fields: the operation fails, so focus must not land on
    // the empty signature output as though a result had been produced.
    await page.getByRole("button", { name: "Sign" }).last().click();
    await page.waitForTimeout(900);

    const state = await page.evaluate(() => ({
      focused: (document.activeElement as HTMLElement | null)?.id ?? "",
      signature: (
        document.querySelector("#rsa-signature") as HTMLTextAreaElement | null
      )?.value,
      status:
        document.querySelector('[data-slot="tool-status-stack"]')
          ?.textContent ?? "",
    }));
    expect(state.status, "Sign should have failed").toContain("required");
    expect(state.signature, "no signature should exist").toBe("");
    expect(
      state.focused,
      "focus must not move to the empty signature output on failure",
    ).not.toBe("rsa-signature");
  }, 90_000);
});
