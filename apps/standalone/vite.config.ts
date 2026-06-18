import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Single self-contained HTML file that runs from file:// with zero network
// access. Everything (JS, CSS) is inlined so the artifact is fully auditable.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    // Everything is inlined into one file, so there is nothing to preload.
    // Disabling the polyfill removes its (dead) fetch() call, keeping the
    // "zero network egress" guarantee verifiable by inspecting the bundle.
    modulePreload: false,
  },
});
