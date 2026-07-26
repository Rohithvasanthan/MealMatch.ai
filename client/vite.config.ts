/// <reference types="vitest/config" />
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into its own chunk so browsers
        // can cache it across deploys instead of re-downloading it every
        // time app code changes, and so it can load in parallel with the
        // app bundle instead of one large blocking chunk.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined
          if (id.includes("framer-motion")) return "vendor-motion"
          if (id.includes("@tanstack")) return "vendor-query"
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react"
          return "vendor"
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
})
