import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const rootFile = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url));

function copyClassicUiRuntime() {
  return {
    name: "copy-classic-ui-runtime",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url || "/", "http://localhost").pathname;
        const match = path.match(/^(?:\/nadirteste)?\/assets\/vendor\/(asset-qr-scanner|tenant-realtime)\.js$/);
        if (!match) return next();
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(readFileSync(rootFile(`assets/vendor/${match[1]}.js`)));
      });
    },
    closeBundle() {
      const runtimeDirectories = [
        ["assets/premium-ui.css", "dist/assets/premium-ui.css"],
        ["assets/premium-ui.js", "dist/assets/premium-ui.js"],
        ["assets/fonts", "dist/assets/fonts"],
        ["assets/icons/flaticon", "dist/assets/icons/flaticon"],
        ["assets/vendor", "dist/assets/vendor"],
        ["assets/work-order-desktop-alerts.js", "dist/assets/work-order-desktop-alerts.js"],
        ["assets/work-order-desktop-alerts.css", "dist/assets/work-order-desktop-alerts.css"],
        ["assets/preventive-year.js", "dist/assets/preventive-year.js"],
        ["assets/preventive-year-ui.js", "dist/assets/preventive-year-ui.js"],
        ["assets/maintenance-charts.js", "dist/assets/maintenance-charts.js"],
        ["assets/operational-planning.js", "dist/assets/operational-planning.js"],
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
