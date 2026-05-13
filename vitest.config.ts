import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules", "dist"],
    globalSetup: "./src/__tests__/global-setup.ts",
    testTimeout: 60_000,
  },
});
