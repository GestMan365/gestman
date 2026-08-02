import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { cpSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const rootFile = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url));

function copyClassicUiRuntime() {
  return {
    name: "copy-classic-ui-runtime",
    closeBundle() {
      const source = rootFile("assets/icons/flaticon");
      const target = rootFile("dist/assets/icons/flaticon");
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target, { recursive: true });
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
