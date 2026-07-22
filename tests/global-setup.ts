import { preview } from "vite";
import { sharedConfig } from "../scripts/vite-config.mjs";

export default async function globalSetup() {
  const server = await preview({
    ...sharedConfig,
    plugins: [],
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true
    }
  });

  return async () => {
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve());
    });
  };
}
