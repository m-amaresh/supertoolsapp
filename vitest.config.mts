import { defineConfig } from "vitest/config";

const isCi = process.env.CI === "true";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.ts"],
    globals: true,
    reporters: isCi
      ? [
          "github-actions",
          ["junit", { outputFile: "./test-results/vitest.xml" }],
        ]
      : ["default"],
  },
});
