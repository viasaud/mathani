import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Vercel exposes the production domain at build time; SITE_URL overrides it (e.g. a custom domain).
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:4321");

export default defineConfig({
  site,
  integrations: [sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Small fonts would otherwise be inlined into the stylesheet every page loads, even for subsets no page uses.
  vite: { build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) } },
});
