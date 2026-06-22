import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync } from "node:fs";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
    },
  },
  plugins: [{
    name: "copy-manifest",
    closeBundle() { copyFileSync(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist/manifest.json")); },
  }],
  test: { environment: "node", globals: true },
});
