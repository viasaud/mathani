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
  // one address per page: /surah/18, never /surah/18/, matching every link on the site, the canonical links and the
  // sitemap (vercel.json redirects the slashed form)
  trailingSlash: "never",
  // the search page is a tool with no text of its own: kept out of the index (search.astro), so out of the sitemap too
  integrations: [sitemap({ filter: (page) => !/\/search\/?$/.test(page) })],
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Small fonts would otherwise be inlined into the stylesheet every page loads, even for subsets no page uses.
  vite: { build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) } },
});
