import type { APIRoute } from "astro";
import { getSearchIndex } from "../lib/quran";

// Every verse in simple (imla'i) spelling as [surah, ayah, text]; the search page loads it on demand.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(getSearchIndex()), { headers: { "Content-Type": "application/json" } });
