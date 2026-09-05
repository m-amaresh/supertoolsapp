import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright-core";

/**
 * Resolve a Chromium binary for playwright-core.
 *
 * playwright-core ships no browsers of its own, and a browser cache populated by
 * some other project is usually built for a different playwright revision, so
 * `chromium.executablePath()` frequently points at a directory that does not
 * exist. Fall back to whatever Chromium the cache actually holds and pass it
 * explicitly, rather than requiring a version-matched download.
 */
export function resolveChromiumPath(): string {
  const fromEnv = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(
        `CHROMIUM_EXECUTABLE_PATH is set to "${fromEnv}", which does not exist.`,
      );
    }
    return fromEnv;
  }

  const declared = chromium.executablePath();
  if (declared && existsSync(declared)) return declared;

  const cacheRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    join(homedir(), ".cache/ms-playwright");
  if (existsSync(cacheRoot)) {
    // Highest build number first; prefer full chromium over the headless shell
    // so the probe measures the same engine a real phone browser would use.
    const candidates = readdirSync(cacheRoot)
      .filter((entry) => /^chromium(_headless_shell)?-\d+$/.test(entry))
      .sort((a, b) => {
        const shell =
          Number(a.startsWith("chromium_")) - Number(b.startsWith("chromium_"));
        if (shell !== 0) return shell;
        return Number(b.split("-")[1]) - Number(a.split("-")[1]);
      })
      .flatMap((entry) => [
        join(cacheRoot, entry, "chrome-linux64/chrome"),
        join(cacheRoot, entry, "chrome-linux/chrome"),
        join(
          cacheRoot,
          entry,
          "chrome-headless-shell-linux64/chrome-headless-shell",
        ),
      ]);

    const found = candidates.find((path) => existsSync(path));
    if (found) return found;
  }

  throw new Error(
    [
      "No Chromium binary found for playwright-core.",
      `Looked at "${declared || "(none declared)"}" and under "${cacheRoot}".`,
      "Install one with `pnpm exec playwright-core install chromium`,",
      "or point CHROMIUM_EXECUTABLE_PATH at an existing Chromium build.",
    ].join(" "),
  );
}
