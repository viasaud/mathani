// Build-time access to the bundled Quran data in /data (fetched from the quran.com API).
// Only page frontmatter imports this module, so the data never ships to the browser as JS.
import { ar } from "./arabic";
import { escapeHtml } from "./ui";

export type Chapter = {
  id: number;
  name: string;
  en: string;
  place: "makkah" | "madinah";
  n: number;
  pages: [number, number];
  bism: boolean;
};

// One verse, as written by scripts/fetch-quran.mjs.
export type VerseRow = [
  text: string, // Uthmani script
  page: number,
  juz: number,
  rub: number, // rub' al-hizb, 1–240 (hizb = ceil(rub / 4))
  sajdah: 0 | 1,
  tafsir: string | number, // tafsir text, or the index of the verse whose tafsir covers this one
  imlaei: string, // simple spelling, used for search
  tajweed: [start: number, end: number, rule: string][], // character ranges in `text`
];

export type JuzStart = { juz: number; surah: number; ayah: number };
export type VerseRef = [surah: number, ayah: number];

const files = import.meta.glob<unknown>("/data/*.json", { eager: true, import: "default" });
const layouts = import.meta.glob<unknown>("/data/layout/*.json", { eager: true, import: "default" });
const pad = (n: number) => String(n).padStart(3, "0");

// Each verse's glyphs in the printed Madinah mushaf: [glyph, page, line]; the last one is the verse-end marker.
export type Placement = [glyph: string, page: number, line: number];
export const getLayout = (id: number) => layouts[`/data/layout/${pad(id)}.json`] as Placement[][];

export const getChapters = () => files["/data/chapters.json"] as Chapter[];

// A verse's page is where its first word sits in the mushaf, so every view agrees with the page view.
const verseCache = new Map<number, VerseRow[]>();
export function getVerses(id: number) {
  let rows = verseCache.get(id);
  if (!rows) {
    const layout = getLayout(id);
    rows = (files[`/data/${pad(id)}.json`] as VerseRow[]).map((r, i) => {
      const copy = [...r] as VerseRow;
      copy[1] = layout[i][0][1];
      return copy;
    });
    verseCache.set(id, rows);
  }
  return rows;
}

function* allVerses() {
  for (const c of getChapters()) {
    const verses = getVerses(c.id);
    for (let i = 0; i < verses.length; i++) yield { surah: c.id, ayah: i + 1, row: verses[i] };
  }
}

let juzCache: { starts: JuzStart[] } | undefined;
export function getJuz() {
  if (juzCache) return juzCache;
  const starts: JuzStart[] = [];
  for (const { surah, ayah, row } of allVerses()) {
    const juz = row[2];
    starts[juz - 1] ??= { juz, surah, ayah };
  }
  return (juzCache = { starts });
}

// First verse of every page (1–604) and every rub' al-hizb (1–240).
let navCache: { pages: VerseRef[]; rubs: VerseRef[]; rubStarts: Set<string> } | undefined;
export function getNav() {
  if (navCache) return navCache;
  const pages: VerseRef[] = [];
  const rubs: VerseRef[] = [];
  for (const { surah, ayah, row } of allVerses()) {
    const [, page, , rub] = row;
    pages[page - 1] ??= [surah, ayah];
    rubs[rub - 1] ??= [surah, ayah];
  }
  return (navCache = { pages, rubs, rubStarts: new Set(rubs.map(([s, a]) => `${s}:${a}`)) });
}

export function getSearchIndex() {
  return [...allVerses()].map(({ surah, ayah, row }) => [surah, ayah, row[6]] as const);
}

// Some tafsir entries explain several verses at once; find the span each verse belongs to.
export function tafsirSpans(verses: VerseRow[]) {
  return verses.map((v, i) => {
    const start = typeof v[5] === "number" ? v[5] : i;
    let end = start;
    while (end + 1 < verses.length && verses[end + 1][5] === start) end++;
    return { start, end, text: verses[start][5] as string };
  });
}

// the spans of one surah, worked out once for all of its verse pages
const spanCache = new Map<number, ReturnType<typeof tafsirSpans>>();
export function getTafsirSpans(id: number) {
  let spans = spanCache.get(id);
  if (!spans) spanCache.set(id, (spans = tafsirSpans(getVerses(id))));
  return spans;
}

export const tafsirLabel = ({ start, end }: { start: number; end: number }) =>
  "التفسير الميسّر" + (end > start ? `، الآيات ${ar(start + 1)}–${ar(end + 1)}` : "");

// ---------- mushaf pages ----------
export type Glyph = { glyph: string; s: number; a: number; w: number }; // w: word index in the verse, -1 for the end marker
export type MushafLine =
  | { kind: "words"; glyphs: Glyph[] }
  | { kind: "surah"; surah: number }
  | { kind: "bism" };
export type MushafPage = { page: number; lines: MushafLine[]; centered: boolean };

let pagesCache: MushafPage[] | undefined;
export function getMushafPages() {
  if (pagesCache) return pagesCache;
  const lines = Array.from({ length: 605 }, () => new Map<number, MushafLine>());
  for (const c of getChapters()) {
    getLayout(c.id).forEach((verse, i) => {
      verse.forEach(([glyph, page, line], k) => {
        let l = lines[page].get(line);
        if (!l) lines[page].set(line, (l = { kind: "words", glyphs: [] }));
        if (l.kind === "words") l.glyphs.push({ glyph, s: c.id, a: i + 1, w: k === verse.length - 1 ? -1 : k });
      });
    });
    // The surah title band (and the basmala, where the surah has one) fill the lines just before its first word,
    // flowing back onto the previous page when the surah starts at the top of a page.
    let [, page, line] = getLayout(c.id)[0][0];
    for (const kind of c.bism ? (["bism", "surah"] as const) : (["surah"] as const)) {
      if (--line < 1) [page, line] = [page - 1, 15];
      lines[page].set(line, kind === "surah" ? { kind, surah: c.id } : { kind });
    }
  }
  return (pagesCache = lines.slice(1).map((m, i) => ({
    page: i + 1,
    lines: [...m.entries()].sort((x, y) => x[0] - y[0]).map(([, l]) => l),
    centered: i < 2, // Al-Fatiha and the opening of Al-Baqarah are set as short centered lines
  })));
}

// ---------- verse markup: tajweed rules as spans over the Uthmani text ----------
export function verseHtml(row: VerseRow) {
  const [text, , , , , , , tajweed] = row;
  const rule: (string | undefined)[] = new Array(text.length);
  for (const [a, b, r] of tajweed) for (let k = a; k < b; k++) rule[k] = r;
  let out = "";
  for (let k = 0; k < text.length; ) {
    const r = rule[k];
    let e = k + 1;
    while (e < text.length && rule[e] === r) e++;
    const chunk = escapeHtml(text.slice(k, e));
    out += r ? `<span class="tj-${r}">${chunk}</span>` : chunk;
    k = e;
  }
  return out;
}
