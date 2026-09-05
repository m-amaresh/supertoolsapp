import { defineConfig } from "vitest/config";

const isCi = process.env.CI === "true";

/**
 * Browser-driven layout tests. Kept out of `vitest.config.ts` so the unit suite
 * stays fast and dependency-free: these need a production build and a Chromium
 * binary, and they drive one shared page serially.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    globals: true,
    // One server, one browser, one page, shared across the suite.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: isCi
      ? [
          "github-actions",
          ["junit", { outputFile: "./test-results/vitest-e2e.xml" }],
        ]
      : ["default"],
  },
});
