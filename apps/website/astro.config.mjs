// @ts-check
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://www.builtwithhabit.com",
  integrations: [svelte(), sitemap()],
  adapter: vercel(),
  server: {
    port: 4321,
  },
});
