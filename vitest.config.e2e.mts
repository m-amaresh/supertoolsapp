import { defineConfig } from "vitest/config";

const isCi = process.env.CI === "true";

/** Browser tests need a production build and Chromium, and share one page. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    globals: true,
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
