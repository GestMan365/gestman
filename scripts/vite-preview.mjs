import { preview } from "vite";
import { sharedConfig } from "./vite-config.mjs";

const server = await preview({
  ...sharedConfig,
  plugins: [],
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
});

server.printUrls();
