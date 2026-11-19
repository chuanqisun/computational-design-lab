import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/computational-design-lab/",
  test: {
    // Live spot tests hit the Gemini API; run them explicitly with `npm run test:live`.
    exclude: [...configDefaults.exclude, "**/*.live.test.ts"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        canvas: resolve(__dirname, "canvas.html"),
        wizard: resolve(__dirname, "wizard.html"),
        studio: resolve(__dirname, "studio.html"),
      },
    },
  },
});
