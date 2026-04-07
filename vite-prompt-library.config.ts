import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/computational-design-lab/",
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "prompt-library.html"),
      },
    },
  },
});
