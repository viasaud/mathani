<p align="center">
  <img src="public/favicon.svg" alt="Mathani" width="72">
</p>

<h1 align="center">مثاني · Mathani</h1>

<p align="center">
  The printed Madinah mushaf, page for page, with Tafsir al-Muyassar for every verse.<br>
  <sub>Fully static. No server, no accounts, no tracking.</sub>
</p>

<p align="center"><b>﴿كِتَٰبٗا مُّتَشَٰبِهٗا مَّثَانِيَ﴾</b><br><sub>az-Zumar 39:23</sub></p>

<br>

- **All 604 pages as printed**, line for line, in the King Fahd Complex page fonts. Two pages open as a spread on wide screens.
- **Tafsir at a touch.** Tap any word to read its verse and tafsir.
- **Two text views**, continuous and verse by verse, with optional tajweed colors.
- **Search and jump** from anywhere with <kbd>⌘K</kbd>: a surah, page, juz, verse or any word, with diacritics ignored.
- **Four themes**, remembered reading place, keyboard shortcuts, and reduced-motion support.

<br>

## Run

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

Requires Node.js 22.12 or newer. Bun works too.

## Deploy

Import the repository into Vercel and deploy. It needs no configuration.

| Variable | Purpose |
|---|---|
| `SITE_URL` | Your custom domain, used in canonical links, share cards and the sitemap |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console verification code |
| `PUBLIC_BING_SITE_VERIFICATION` | Bing Webmaster Tools verification code |

## Built with

[Astro](https://astro.build), GSAP and WebGL. The Quran data is bundled in `data/` (refresh with `npm run fetch-data`). Share cards and icons are drawn by `npm run og`.

## Credits

- **Page fonts** (V2) and **surah header font** by the King Fahd Glorious Quran Printing Complex, served from [nuqayah/qpc-fonts](https://github.com/nuqayah/qpc-fonts). Free to use and distribute, not to sell or modify.
- **Quran text, tajweed and Tafsir al-Muyassar** from the [quran.com](https://quran.com) API.
- **Thmanyah Serif** by Thmanyah, and **Scheherazade New** by SIL International (OFL).
