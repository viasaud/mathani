// The King Fahd Complex "V2" page fonts, one per mushaf page, served by jsDelivr from github.com/nuqayah/qpc-fonts
// at a pinned commit (brotli, cached a year).
export const pageFontUrl = (p: number) =>
  `https://cdn.jsdelivr.net/gh/nuqayah/qpc-fonts@8a4f39d563ea69c994416a1692827e38156c548d/mushaf-v2/QCF2${String(p).padStart(3, "0")}.ttf`;

// Whether a mushaf page opens as a two-page spread here: the same test as the inline script in page/[n].astro.
const spreadOn = () => document.documentElement.dataset.spread !== "off" && innerWidth >= 900 && innerWidth > innerHeight;

// Start downloading the fonts of a page about to be opened (and its facing page in the two-page view), so it draws
// as soon as it arrives instead of waiting blank for them. A prefetch carries on through the navigation, and the
// fonts are then read from the cache.
const warmed = new Set<number>();
export function warmPage(p: number) {
  const pages = spreadOn() ? [p, p % 2 ? p + 1 : p - 1] : [p];
  for (const q of pages) {
    if (q < 1 || q > 604 || warmed.has(q)) continue;
    warmed.add(q);
    document.head.append(Object.assign(document.createElement("link"), { rel: "prefetch", as: "font", crossOrigin: "anonymous", href: pageFontUrl(q) }));
  }
}
