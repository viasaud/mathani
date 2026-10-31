// Re-downloads the Quran data from the quran.com API:
//   data/chapters.json      surah list
//   data/NNN.json           one row per verse (see VerseRow in src/lib/quran.ts)
//   data/layout/NNN.json    where each word sits in the printed Madinah mushaf (1421 H / "V2"): glyph, page, line
// The site reads these files at build time, so run this only when you want to refresh the data.
//   npm run fetch-data
import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.quran.com/api/v4";
const TAFSIR_MUYASSAR = 16;
const DATA = new URL("../data/", import.meta.url);
const LAYOUT = new URL("../data/layout/", import.meta.url);

// Tajweed rule names from the API → short codes used as CSS classes (see global.css).
const RULES = {
  ham_wasl: "hw", slnt: "sl", laam_shamsiyah: "ls",
  madda_normal: "mn", madda_permissible: "mp", madda_obligatory: "mo", madda_necessary: "mx",
  qalaqah: "qq", ikhafa: "ik", ikhafa_shafawi: "is", iqlab: "iq",
  idgham_ghunnah: "dg", idgham_wo_ghunnah: "dw", idgham_shafawi: "ds",
  idgham_mutajanisayn: "dj", idgham_mutaqaribayn: "dq", ghunnah: "gh",
};

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function paged(path, key) {
  const items = [];
  for (let page = 1; page; ) {
    const d = await get(`${API}${path}${path.includes("?") ? "&" : "?"}per_page=50&page=${page}`);
    items.push(...d[key]);
    page = d.pagination?.next_page ?? null;
  }
  return items;
}

// The API spells a few surah names the old way (الإنفطار, سبإ); these are the names as the mushaf prints them.
const NAMES = { 14: "إبراهيم", 34: "سبأ", 76: "الإنسان", 78: "النبأ", 82: "الانفطار", 84: "الانشقاق" };

const clean = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// ---------- tajweed ----------
// The API's tajweed text uses slightly different code points from text_uthmani (e.g. ٲ for ٰ),
// so we read which characters each rule covers there and carry those ranges over to text_uthmani
// through a character alignment. The displayed text stays exactly text_uthmani.
function parseTajweed(html) {
  const body = html.replace(/<span class=end>.*?<\/span>/g, "");
  let plain = "";
  const spans = [];
  const stack = [];
  for (const m of body.matchAll(/<tajweed class=([a-z_]+)>|<\/tajweed>|[^<]+/g)) {
    if (m[1]) stack.push({ rule: m[1], start: plain.length });
    else if (m[0] === "</tajweed>") {
      const open = stack.pop();
      if (open) spans.push({ ...open, end: plain.length });
    } else plain += m[0];
  }
  return { plain: plain.trimEnd(), spans };
}

// Edit-distance alignment; returns, for each index of a, the aligned index in b (or -1).
function align(a, b) {
  const n = a.length, m = b.length, w = m + 1;
  const d = new Int32Array((n + 1) * w);
  for (let i = 0; i <= n; i++) d[i * w] = i;
  for (let j = 0; j <= m; j++) d[j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i * w + j] = Math.min(d[(i - 1) * w + j] + 1, d[i * w + j - 1] + 1, d[(i - 1) * w + j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const map = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const here = d[i * w + j];
    if (here === d[(i - 1) * w + j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) map[--i] = --j;
    else if (here === d[(i - 1) * w + j] + 1) i--;
    else j--;
  }
  return map;
}

let lostRules = 0;
function tajweedRanges(text, tajweedHtml) {
  const { plain, spans } = parseTajweed(tajweedHtml);
  const map = align(plain, text);
  const ranges = [];
  for (const s of spans) {
    const code = RULES[s.rule];
    if (!code) continue;
    const hit = map.slice(s.start, s.end).filter((x) => x >= 0);
    if (!hit.length) { lostRules++; continue; }
    ranges.push([Math.min(...hit), Math.max(...hit) + 1, code]);
  }
  return ranges;
}

async function surah(c) {
  const verses = await paged(
    `/verses/by_chapter/${c.id}?words=true&fields=text_uthmani,text_imlaei,text_uthmani_tajweed&word_fields=code_v2,v2_page,line_v2`,
    "verses",
  );
  const tafsir = new Map(
    (await paged(`/tafsirs/${TAFSIR_MUYASSAR}/by_chapter/${c.id}`, "tafsirs")).map((t) => [t.verse_key, clean(t.text)]),
  );
  if (verses.length !== c.n) throw new Error(`Surah ${c.id}: expected ${c.n} verses, got ${verses.length}`);

  // A tafsir entry can cover several verses; the verses after the first point back to it by index.
  let start = 0;
  const rows = [];
  const layout = [];
  verses.forEach((v, i) => {
    // Every glyph of the verse in mushaf order, the verse-end marker last.
    layout.push(v.words.map((w) => [w.code_v2, w.v2_page, w.line_v2]));
    const text = tafsir.get(v.verse_key);
    if (text) start = i;
    rows.push([
      v.text_uthmani, v.page_number, v.juz_number, v.rub_el_hizb_number, v.sajdah_number ? 1 : 0,
      text || start, v.text_imlaei, tajweedRanges(v.text_uthmani, v.text_uthmani_tajweed),
    ]);
  });
  const file = `${String(c.id).padStart(3, "0")}.json`;
  await writeFile(new URL(file, DATA), JSON.stringify(rows));
  await writeFile(new URL(file, LAYOUT), JSON.stringify(layout));
}

await mkdir(DATA, { recursive: true });
await mkdir(LAYOUT, { recursive: true });
const { chapters } = await get(`${API}/chapters?language=ar`);
const index = chapters.map((c) => ({
  id: c.id,
  name: NAMES[c.id] ?? c.name_arabic,
  en: c.name_simple,
  place: c.revelation_place,
  n: c.verses_count,
  bism: c.bismillah_pre,
}));
await writeFile(new URL("chapters.json", DATA), JSON.stringify(index));

// A few surahs at a time keeps the API happy.
for (let i = 0; i < index.length; i += 6) {
  await Promise.all(index.slice(i, i + 6).map(surah));
  process.stdout.write(`\r${Math.min(i + 6, index.length)}/114 surahs`);
}
console.log(`\nDone. Tajweed rules that could not be placed: ${lostRules}.`);
