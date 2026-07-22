import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Without this, a stray `dist/` from `npm run build` gets picked up
    // alongside `src/`, silently double-running every test against the
    // compiled output as well as the source.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
})
