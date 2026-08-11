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
      const runtimeDirectories = [
        ["assets/icons/flaticon", "dist/assets/icons/flaticon"],
        ["assets/vendor", "dist/assets/vendor"],
      ];
      runtimeDirectories.forEach(([sourcePath, targetPath]) => {
        const source = rootFile(sourcePath);
        const target = rootFile(targetPath);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(source, target, { recursive: true });
      });
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
