import { createServer } from "vite";
import { sharedConfig } from "./vite-config.mjs";

const server = await createServer({
  ...sharedConfig,
  server: {
    host: "127.0.0.1"
  }
});

await server.listen();
server.printUrls();
