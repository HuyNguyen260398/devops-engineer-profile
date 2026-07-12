import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "backend/**"],
  },
});
