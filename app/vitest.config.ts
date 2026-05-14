/// <reference types="vitest" />
import path from "node:path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
    exclude: ["node_modules", "dist", "e2e"],
  },
})
