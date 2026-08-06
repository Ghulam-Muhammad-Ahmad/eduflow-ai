import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the `@/*` -> `src/*` alias from tsconfig.json so tests can import app modules.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
