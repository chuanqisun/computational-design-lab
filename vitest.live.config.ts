import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Live spot tests against the Gemini API. Reads GEMINI_API_KEY from .env; tests skip when it is unset.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    test: {
      include: ["src/**/*.live.test.ts"],
      testTimeout: 180_000,
      env: { GEMINI_API_KEY: env.GEMINI_API_KEY ?? "" },
    },
  };
});
