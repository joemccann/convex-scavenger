import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      enabled: false,
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*"],
      exclude: [
        "**/next-env.d.ts",
        "**/layout.tsx",
      ],
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
