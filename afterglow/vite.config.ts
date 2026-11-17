import { defineConfig } from "vite";

export default defineConfig({
  worker: { format: "es" },
  base: process.env.PAGES_BASE_PATH || "/",
});
