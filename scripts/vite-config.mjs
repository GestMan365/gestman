import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

export const sharedConfig = {
  root,
  configFile: false,
  base: "/nadirteste/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url))
    }
  }
};
