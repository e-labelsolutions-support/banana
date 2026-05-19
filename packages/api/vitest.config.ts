import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "integration-tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@banana/db": resolve(__dirname, "../db/src"),
    },
  },
});
