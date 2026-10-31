// Renders the link-preview cards and the app icons into public/, from the bundled data and the site's own fonts:
//   public/og/home.jpg, public/og/surah-1.jpg … surah-114.jpg  (1200 × 630, see src/lib/seo.ts)
//   public/icons/apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png, favicon-48.png
// The images are committed, so a deployment needs none of this. Run it again after changing the cards or the data:
//   npm run og
// It needs a headless Chromium for playwright-core: `npx playwright-core install chromium-headless-shell` once, or set
// CHROMIUM_PATH to any Chromium or Chrome binary. A Playwright browser already downloaded for another version is
// used as it is.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(import.meta.dirname, "..");
const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const ar = (n) => String(n).replace(/\d/g, (d) => DIGITS[+d]);
const ayahs = (n) => (n === 1 ? "آية واحدة" : n === 2 ? "آيتان" : `${ar(n)} ${n <= 10 ? "آيات" : "آية"}`);
const place = (p) => (p === "makkah" ? "مكية" : "مدنية");
const pad = (n) => String(n).padStart(3, "0");
const font = (path) => pathToFileURL(join(ROOT, path)).href;

const chapters = JSON.parse(readFileSync(join(ROOT, "data/chapters.json"), "utf8"));
// a verse's page is where its first word sits in the printed mushaf (src/lib/quran.ts)
const pagesOf = (id) => JSON.parse(readFileSync(join(ROOT, `data/layout/${pad(id)}.json`), "utf8")).map((v) => v[0][1]);
// the first words of the surah, with an ellipsis only when the verse goes on past them
const openingOf = (id, words = 5) => {
  const all = JSON.parse(readFileSync(join(ROOT, `data/${pad(id)}.json`), "utf8"))[0][0].trim().split(/\s+/);
  return all.slice(0, words).join(" ") + (all.length > words ? "…" : "");
};

// The eight-pointed star of the rub' al-hizb, as in src/components/Star.astro.
const star = (stroke, width, dot) => `<svg viewBox="0 0 48 48"><g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"><rect x="10.5" y="10.5" width="27" height="27"/><rect x="10.5" y="10.5" width="27" height="27" transform="rotate(45 24 24)"/></g>${dot ? `<circle cx="24" cy="24" r="5.5" fill="${dot}"/>` : ""}</svg>`;
// The cover's rosette in miniature: rings, the two squares, and spokes, all in gilt hairlines.
const rosette = () => {
  const C = 300, pt = (r, deg) => { const t = ((deg - 90) * Math.PI) / 180; return `${(C + r * Math.cos(t)).toFixed(1)} ${(C + r * Math.sin(t)).toFixed(1)}`; };
  const sq = (r, rot) => "M" + [0, 90, 180, 270].map((d) => pt(r, d + 45 + rot)).join(" L") + " Z";
  const oct = (r, step, off) => "M" + Array.from({ length: 8 }, (_, i) => pt(r, off + ((i * step) % 8) * 45)).join(" L") + " Z";
  const ring = (r) => `<circle cx="${C}" cy="${C}" r="${r}"/>`;
  const spokes = (r1, r2, n, off = 0) => Array.from({ length: n }, (_, k) => `<path d="M${pt(r1, off + (k * 360) / n)} L${pt(r2, off + (k * 360) / n)}"/>`).join("");
  return `<svg viewBox="0 0 600 600" class="rosette">
    <g class="i">${ring(292)}${ring(214)}${spokes(214, 292, 8)}${`<path d="${sq(120, 22.5)}"/><path d="${sq(120, 67.5)}"/>`}</g>
    <g class="g">${ring(250)}<path d="${sq(250, 0)}"/><path d="${sq(250, 45)}"/><path d="${oct(196, 3, 22.5)}"/>${ring(120)}${ring(64)}${spokes(64, 120, 16)}</g>
    <path class="core" d="${sq(26, 0)} ${sq(26, 45)}"/>
  </svg>`;
};

const page = (body) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  @font-face { font-family: Display; src: url("${font("public/fonts/thmanyah/thmanyahserifdisplay-Regular.woff2")}"); }
  @font-face { font-family: Text; src: url("${font("public/fonts/thmanyah/thmanyahseriftext-Regular.woff2")}"); }
  @font-face { font-family: Text; font-weight: 500; src: url("${font("public/fonts/thmanyah/thmanyahseriftext-Medium.woff2")}"); }
  @font-face { font-family: Quran; src: url("${font("node_modules/@fontsource/scheherazade-new/files/scheherazade-new-arabic-400-normal.woff2")}"); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative; font-family: Text; color: #f4ecd8; -webkit-font-smoothing: antialiased;
    background: radial-gradient(760px 520px at 24% 50%, #241a0d, transparent 72%), #0d0a06;
  }
  .rosette { position: absolute; left: 36px; top: 50%; width: 500px; height: 500px; translate: 0 -50%; fill: none; stroke-width: 1.4; }
  .rosette .g { stroke: #dcb767; }
  .rosette .i { stroke: #f4ecd8; opacity: 0.2; }
  .rosette .core { fill: #dcb767; stroke: none; }
  .edge { position: absolute; inset: auto 0 0; height: 2px; background: #dcb767; opacity: 0.35; }
  .copy { position: absolute; right: 80px; top: 64px; bottom: 64px; width: 560px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; font-family: Display; font-size: 34px; line-height: 1; color: #f4ecd8; }
  .brand svg { width: 40px; height: 40px; }
  .brand small { font-family: Text; font-size: 22px; color: #bcb09a; margin-inline-start: 6px; }
  .main { margin-block: auto; display: grid; gap: 14px; }
  .kicker { font-size: 28px; font-weight: 500; color: #dcb767; }
  h1 { font-family: Display; font-weight: 400; font-size: 132px; line-height: 1.25; color: #dcb767; white-space: nowrap; padding-bottom: 0.1em; }
  .verse { font-family: Quran; font-size: 44px; line-height: 1.9; color: #e9d7a6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 26px; color: #bcb09a; }
</style></head><body>${rosette()}<div class="edge"></div>${body}</body></html>`;

const brand = `<div class="brand">${star("#dcb767", 2.6, "#dcb767")}مثاني<small>القرآن الكريم والتفسير الميسّر</small></div>`;
const cards = [
  {
    file: "og/home.jpg",
    html: page(`<div class="copy">${brand}<div class="main">
      <h1 style="font-size:190px">مثاني</h1>
      <p class="verse">﴿كِتَٰبٗا مُّتَشَٰبِهٗا مَّثَانِيَ﴾</p>
      <p class="meta">مصحف المدينة كما طُبع، مع التفسير الميسّر لكل آية</p>
    </div></div>`),
  },
  ...chapters.map((c) => {
    const pages = pagesOf(c.id);
    const [first, last] = [pages[0], pages[pages.length - 1]];
    const where = first === last ? `الصفحة ${ar(first)} من مصحف المدينة` : `الصفحات ${ar(first)}–${ar(last)} من مصحف المدينة`;
    return {
      file: `og/surah-${c.id}.jpg`,
      html: page(`<div class="copy">${brand}<div class="main">
        <p class="kicker">السورة ${ar(c.id)} في المصحف، ${place(c.place)}، ${ayahs(c.n)}</p>
        <h1>سورة ${c.name}</h1>
        <p class="verse">﴿${openingOf(c.id)}﴾</p>
        <p class="meta">${where}، مع التفسير الميسّر</p>
      </div></div>`),
    };
  }),
];

// The icons: the star in gilt on the cover's black, the maskable one with room for the launcher's crop.
const icon = (size, scale) => `<!doctype html><html><head><style>*{margin:0}html,body{width:${size}px;height:${size}px;background:#0d0a06;display:grid;place-items:center}svg{width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px}</style></head><body>${star("#dcb767", 2.4, "#dcb767")}</body></html>`;
const icons = [
  { file: "icons/apple-touch-icon.png", size: 180, html: icon(180, 0.78) },
  { file: "icons/icon-192.png", size: 192, html: icon(192, 0.78) },
  { file: "icons/icon-512.png", size: 512, html: icon(512, 0.78) },
  { file: "icons/icon-maskable-512.png", size: 512, html: icon(512, 0.56) },
];

const work = join(tmpdir(), "mathani-og");
mkdirSync(work, { recursive: true });
mkdirSync(join(ROOT, "public/og"), { recursive: true });
mkdirSync(join(ROOT, "public/icons"), { recursive: true });

// the newest headless shell or Chromium in Playwright's download folder, whichever version downloaded it
function downloaded() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  if (!existsSync(cache)) return undefined;
  const bins = ["chrome-mac/headless_shell", "chrome-linux/headless_shell", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-linux/chrome"];
  return readdirSync(cache)
    .filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()))
    .flatMap((d) => bins.map((b) => join(cache, d, b)))
    .find(existsSync);
}
const executablePath = process.env.CHROMIUM_PATH ?? downloaded();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
async function render(html, file, size, type) {
  const at = join(work, "card.html");
  writeFileSync(at, html);
  if (size) await tab.setViewportSize({ width: size, height: size });
  await tab.goto(pathToFileURL(at).href);
  await tab.evaluate(async () => {
    await document.fonts.ready;
    // a long surah name is set a little smaller rather than run past the card's edge
    const h1 = document.querySelector("h1");
    const room = document.querySelector(".copy")?.clientWidth ?? 0;
    for (let px = parseFloat(getComputedStyle(h1 ?? document.body).fontSize); h1 && h1.scrollWidth > room && px > 60; px -= 4) h1.style.fontSize = `${px}px`;
  });
  await tab.screenshot({ path: join(ROOT, "public", file), type, ...(type === "jpeg" ? { quality: 80 } : {}) });
}
for (const c of cards) await render(c.html, c.file, 0, "jpeg");
for (const i of icons) await render(i.html, i.file, i.size, "png");
// the small favicon is the SVG one itself, drawn for a light page (the colours it uses outside dark mode)
await tab.setViewportSize({ width: 48, height: 48 });
await tab.goto(pathToFileURL(join(ROOT, "public/favicon.svg")).href);
await tab.screenshot({ path: join(ROOT, "public/icons/favicon-48.png"), omitBackground: true });
await browser.close();
console.log(`${cards.length} cards and ${icons.length + 1} icons written to public/`);
