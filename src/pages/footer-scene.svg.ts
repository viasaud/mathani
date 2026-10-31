import type { APIRoute } from "astro";
import { sceneSvg } from "../lib/scene";

// The footer's engraving of Madinah, one file for every page (src/lib/scene.ts)
export const GET: APIRoute = () => new Response(sceneSvg(), { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
