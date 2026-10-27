import type { APIRoute } from "astro";
import { getChapters, getJuz, getNav, getVerses } from "../lib/quran";

// Everything the browser needs to navigate, in one small cached file: the surah list (with the page each
// starts on), and the first verse of every page, juz and rub' al-hizb. Read by the index drawer, the quick-jump
// palette and the page scrubber.
export const GET: APIRoute = () => {
  const { pages, rubs } = getNav();
  const { starts } = getJuz();
  const chapters = getChapters().map((c) => [c.id, c.name, c.en, c.place === "makkah" ? "m" : "d", c.n, getVerses(c.id)[0][1]]);
  const juz = starts.map((s) => [s.surah, s.ayah]);
  return new Response(JSON.stringify({ chapters, pages, juz, rubs }), { headers: { "Content-Type": "application/json" } });
};
