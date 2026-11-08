import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.png", "**/*.jpg", "**/*.gif"],
  test: {
    environment: "jsdom",
    globals: true,
    // The default `threads` pool loses the runner context for suites that use
    // `vi.resetModules()` / `vi.mock()`, causing "Cannot read properties of
    // undefined (reading 'config')" during collection. `vmThreads` keeps the
    // runner context intact for those suites.
    pool: "vmThreads",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,vue}", "lib/**/*.ts", "server.ts"],
    },
  },
});
