import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.js";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: "es2022",
    // No remote module preloading — removes Vite's polyfill fetch() so the
    // shipped bundle has zero network-egress symbols (verifiable by inspection).
    modulePreload: false,
    rollupOptions: {
      input: {
        devtools: "src/devtools.html",
        panel: "src/panel.html",
      },
    },
  },
  server: { port: 5174 },
});
