// The navigation index (/index.json), fetched once per visit and shared by everything that needs it.
import type { VerseRef } from "./quran";

export type ChapterInfo = { id: number; name: string; en: string; makki: boolean; n: number; page: number };
export type SiteIndex = { chapters: ChapterInfo[]; pages: VerseRef[]; juz: VerseRef[]; rubs: VerseRef[] };

let cached: Promise<SiteIndex> | undefined;

export function siteIndex() {
  cached ??= fetch("/index.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((d) => ({
      ...d,
      chapters: d.chapters.map(([id, name, en, place, n, page]: [number, string, string, string, number, number]) => ({
        id, name, en, makki: place === "m", n, page,
      })),
    }));
  cached.catch(() => (cached = undefined));
  return cached;
}

// The surah a page opens with.
export const surahOfPage = (index: SiteIndex, page: number) => index.chapters[index.pages[page - 1][0] - 1];
// The page a verse is on: the last page whose first verse comes at or before it.
export function pageOfVerse(index: SiteIndex, s: number, a: number) {
  let lo = 1, hi = 604;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const [ms, ma] = index.pages[mid - 1];
    if (ms < s || (ms === s && ma <= a)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
