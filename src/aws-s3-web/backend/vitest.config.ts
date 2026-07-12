import { defineConfig } from "vitest/config";

export default defineConfig({
  // Inline (empty) PostCSS config so Vite does not search parent directories and
  // pick up the Next app's postcss.config.mjs, whose Tailwind plugin is not a
  // dependency of this isolated backend package.
  css: { postcss: { plugins: [] } },
  test: { environment: "node" },
});
