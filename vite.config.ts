import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const rootFile = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url));

function copyClassicUiRuntime() {
  return {
    name: "copy-classic-ui-runtime",
    closeBundle() {
      const target = rootFile("dist/assets/ui/icon-registry.js");
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(rootFile("assets/ui/icon-registry.js"), target);
    },
  };
}

export default defineConfig({
  base: "/nadirteste/",
  plugins: [react(), copyClassicUiRuntime()],
  build: {
    rollupOptions: {
      input: {
        index: rootFile("index.html"),
        fallback: rootFile("404.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
