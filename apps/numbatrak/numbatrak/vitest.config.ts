import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import viteConfig from "./vite.config";

// The ui/ components import version-pinned specifiers ("@radix-ui/react-dialog@1.1.6")
// that only resolve through the app's alias map. Reuse it rather than keeping a
// second copy in sync. Tailwind is left out - these tests assert behaviour, not styling.
const alias = (viteConfig as { resolve?: { alias?: Record<string, string> } }).resolve?.alias ?? {};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
