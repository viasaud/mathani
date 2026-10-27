# مثاني — Mathani

The name comes from the Quran's description of itself: «كِتَابًا مُّتَشَابِهًا مَّثَانِيَ» (az-Zumar 39:23), a book read and returned to again and again.

A clean Quran reading site: all 114 surahs in Uthmani script with Tafsir al-Muyassar, built with [Astro](https://astro.build) as a fully static site. All data is bundled in `/data`, so the deployed site has no server and makes no API calls.

## Features

- **Mushaf pages** (the default view, `/page/1` … `/page/604`): every page of the printed Madinah mushaf (1421 H edition), line for line, drawn with the King Fahd Complex "V2" page fonts, on a paper sheet in a gilt double rule; the two-page view is bound at a spine like an open book. Tap a word to open its verse and tafsir in a sheet that rises from the bottom (with next/previous verse, copy, and copy link).
- **Page turns**: turn with the page arrows, ← / →, or a swipe; the old page slides away as the new one comes in from the reading direction. Where the screen leaves room beside the pages the arrows stand either side of them, half way down, each captioned with its direction and the page it turns to. Along the bottom runs a line of the whole mushaf across the full width: all 114 surahs at once, one line each, all alike but the surah being read, whose line is gold with its name in a pill joined to it, and the page being read and the last page at either end like an audio player's time. Pointing at the lines names the surah there; drag along them (the gold and its pill follow) and let go, tap a line, or step with ← → or the wheel, and the mushaf turns to that surah.
- **Quick-jump palette** (⌘K, Ctrl+K or /, from any page): a surah name, a page number, «٢:٢٥٥», «جزء ٣», «حزب ١٠», or any word from the Quran, with the matching verses shown as you type.
- **Two text views** beside the pages: continuous text with page breaks, or verse by verse with the tafsir under each verse. A surah link opens in whichever view the reader chose last.
- **Search page** (`/search`): ignores diacritics, tatweel and hamza / ta-marbuta forms, so «الصلاة» finds «ٱلصَّلَوٰةَ».
- **Tajweed colors** with a color key in the text views, laid over the same Uthmani text, so the letters never change.
- **Index drawer**: every surah with its page, filterable by name, Makki / Madani, or grouped by juz.
- **Settings**: view, one slider for the text size (it also scales the mushaf page), four themes (automatic, light, sepia, dark), tajweed. Remembered per browser, applied before the first paint.
- **Home**: a dark gilded cover with a live WebGL lattice of eight-pointed stars lit by a lamp that follows the pointer, a self-drawing rosette, a continue-reading card whose ring fills to how far into the mushaf you are, six places to begin, the 30 juz (the one you are in is marked), and the 114 surahs, filtered Makki / Madani, the chosen surahs settling into view from a soft blur.
- **Motion**: GSAP for the cover's opening, scroll reveals, count-ups, the page turn and the surah filter; CSS spring easings for the drawer, palette, settings, sheet and toasts; native View Transitions for page-to-page fades and a circular reveal when the theme changes. Under `prefers-reduced-motion` all of it stands down. The reading header and page dock step away while you scroll down and return when you scroll up.
- Fonts: the 604 King Fahd Complex page fonts (free to use and distribute, not to sell or modify), loaded per page from jsDelivr; self-hosted Scheherazade New (OFL) for the Quran in the text views, and Thmanyah Serif (Text for the interface and tafsir, Display for titles and surah names) for everything else, in `public/fonts/thmanyah/`. Plus sitemap and robots.txt.

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve the built site
```

## Deploy to Vercel

1. Push this folder to a new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Mathani"
   git branch -M main
   git remote add origin https://github.com/<you>/mathani.git
   git push -u origin main
   ```
2. In Vercel, choose **Add New → Project**, import the repository, and press **Deploy**. Vercel detects Astro automatically (build command `astro build`, output `dist`). No environment variables are needed.

Or deploy from the terminal with the Vercel CLI: `npx vercel` (preview) and `npx vercel --prod`.

The sitemap and canonical links use Vercel's production domain automatically. If you add a custom domain, set `SITE_URL` (for example `https://quran.example.com`) in the project's environment variables and redeploy.

## Project layout

```
data/                    Quran text, tafsir, tajweed and search text: one JSON file per surah, plus chapters.json
data/layout/             Where every word sits in the printed mushaf: glyph code, page, line
scripts/fetch-quran.mjs  Re-downloads data/ from the quran.com API
src/
  pages/index.astro      Home: hero, continue reading, juz grid, surah grid
  pages/page/[n].astro   One static page per mushaf page (604 pages)
  pages/surah/[id].astro One static page per surah (114 pages), for the two text views
  pages/search.astro     Verse search; reads /search.json (built from data/)
  pages/index.json.ts    Surah list and the first verse of every page, juz and quarter, for the drawer, palette and scrubber
  layouts/Base.astro     Shell: header, settings, index drawer, palette; saved settings applied before first paint
  components/            Star mark, verse sheet, surah text (both views), tajweed key
  lib/                   Data access and page layout (quran.ts), the shared index, verse sheet, search folding, helpers
  scripts/shell.ts       Every page: header, drawer, palette, settings (theme reveal), shortcuts
  scripts/motion.ts      Every page: segment pill, card spotlight, magnetic buttons, scroll reveals, count-ups, the cover's opening
  scripts/home.ts        Home page: the cover's header tone, the continue-reading ring, current juz, surah filter, back to top
  scripts/cover-gl.ts    Home page: the WebGL gilt lattice behind the cover (WebGL 2, with a still fallback)
  scripts/page.ts        Mushaf page: verse sheet, page turning and its animation, the surah ruler, line balancing, last-read memory
  scripts/reader.ts      Text views: verse sheet, copy, header page/juz, last-read memory
  styles/global.css      Design tokens for the four themes and the cover, motion tokens, tajweed colors, shared components
  styles/home.css        The home page
  styles/reader.css      The mushaf page and the two text views
```

The verse row format is documented in `VerseRow` in `src/lib/quran.ts`. Some details:

- Some tafsir entries explain several verses together; the later verses in such a group hold the index of the verse that carries the text, and the site shows the tafsir once with its verse range.
- A few words in the page-layout data sit one line too early (pages 27 and 177, for example). The page script spots a line that overflows next to a short one and moves the word back, and it centers the lines that are short by design, such as the last surahs on page 604.
- The page fonts come from jsDelivr (`cdn.jsdelivr.net/gh/nuqayah/qpc-fonts@<commit>/mushaf-v2/`), pinned to one commit and cached for a year, so they add nothing to the deployment. Each page preloads its own font and prefetches the next page's. To self-host instead, put the 604 files in `public/` and change `fontUrl` in `src/pages/page/[n].astro`.
- The API's own tajweed text uses slightly different code points from the Uthmani text (for example ٲ for the dagger alef), so the data script aligns the two and stores each rule as a character range on the Uthmani text.

## Refresh the data

```bash
npm run fetch-data
```
