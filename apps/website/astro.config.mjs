// @ts-check
import svelte from "@astrojs/svelte";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  adapter: vercel(),
  server: {
    port: 4321,
  },
});
