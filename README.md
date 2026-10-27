# مثاني — Mathani

The name comes from the Quran's description of itself: «كِتَابًا مُّتَشَابِهًا مَّثَانِيَ» (az-Zumar 39:23), a book read and returned to again and again.

A clean Quran reading site: all 114 surahs in Uthmani script with Tafsir al-Muyassar, built with [Astro](https://astro.build) as a fully static site. All data is bundled in `/data`, so the deployed site has no server and makes no API calls.

## Features

- **Mushaf pages** (the default view, `/page/1` … `/page/604`): every page of the printed Madinah mushaf (1421 H edition), line for line, drawn with the King Fahd Complex "V2" page fonts, in an illuminated frame. Tap a word to open its verse and tafsir in a sheet that rises from the bottom (with next/previous verse, copy, and copy link).
- **Page turns**: turn with the side arrows, ← / →, a swipe, or the **page scrubber** at the bottom, which shows the page and surah as you drag and marks where each juz begins.
- **Quick-jump palette** (⌘K, Ctrl+K or /, from any page): a surah name, a page number, «٢:٢٥٥», «جزء ٣», «حزب ١٠», or any word from the Quran, with the matching verses shown as you type.
- **Two text views** beside the pages: continuous text with page breaks, or verse by verse with the tafsir under each verse. A surah link opens in whichever view the reader chose last.
- **Search page** (`/search`): ignores diacritics, tatweel and hamza / ta-marbuta forms, so «الصلاة» finds «ٱلصَّلَوٰةَ».
- **Tajweed colors** with a color key in the text views, laid over the same Uthmani text, so the letters never change.
- **Index drawer**: every surah with its page, filterable by name, Makki / Madani, or grouped by juz.
- **Settings**: view, one slider for the text size (it also scales the mushaf page), four themes (automatic, light, sepia, dark), tajweed. Remembered per browser, applied before the first paint.
- **Home**: an eight-fold rosette in gold, a continue-reading card with a ring showing how far into the mushaf you are, the 30 juz, and the 114 surahs with a Makki / Madani filter.
- The reading header and page dock step away while you scroll down and return when you scroll up. Nothing on the site animates.
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
  scripts/shell.ts       Every page: header, drawer, palette, settings, shortcuts
  scripts/home.ts        Home page: the continue-reading ring, surah filter, back to top
  scripts/page.ts        Mushaf page: verse sheet, page turning, scrubber, line balancing, last-read memory
  scripts/reader.ts      Text views: verse sheet, copy, header page/juz, last-read memory
  styles/global.css      Design tokens for the four themes, tajweed colors, all styles
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
