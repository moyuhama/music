import {bundledLibraryPlugin} from "./scripts/bundled-library.mjs";
import { defineConfig } from "vite";
import { localSourceProxyPlugin } from "./scripts/local-proxy.mjs";

export default defineConfig({
  plugins: [localSourceProxyPlugin(), bundledLibraryPlugin()],
  // Keep hashed files used by already-open local tabs during incremental rebuilds.
  build: { emptyOutDir: !!process.env.CI },
  worker: { format: "es" },
  base: process.env.PAGES_BASE_PATH || "/",
});
