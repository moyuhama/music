import { defineConfig } from "vite";
import { ximalayaProxyPlugin } from "./scripts/ximalaya-proxy.mjs";

export default defineConfig({
  plugins: [ximalayaProxyPlugin()],
  worker: { format: "es" },
  base: process.env.PAGES_BASE_PATH || "/",
});
