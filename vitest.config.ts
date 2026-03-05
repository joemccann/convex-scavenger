import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/tools/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
