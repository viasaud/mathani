import type { APIRoute } from "astro";

// Everything is open to crawlers, the data files too: the pages fetch /index.json while they render, and a crawler
// that renders them needs it. Those files are kept out of the index by a noindex header instead (vercel.json).
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap-index.xml", site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
