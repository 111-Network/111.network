import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests only: plain TS modules (stores, reducers, parsers, copy) and the
// build scripts. No DOM environment; components are verified in the browser.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    passWithNoTests: true,
  },
})
