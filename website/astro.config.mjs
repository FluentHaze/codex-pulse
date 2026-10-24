import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: process.env.SITE_URL || "https://fluenthaze.github.io",
  base: process.env.BASE_PATH || "/",
  output: "static",
  trailingSlash: "always",
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
