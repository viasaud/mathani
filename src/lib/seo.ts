// What the pages tell search engines and link previews beyond their own text: the site's names, the share card for
// each page, and the schema.org descriptions (JSON-LD) that Base.astro writes into the head.
export const SITE_NAME = "مثاني";
export const SITE_NAME_EN = "Mathani";
export const HOME_TITLE = "مثاني · القرآن الكريم بمصحف المدينة مع التفسير الميسّر";
export const DEFAULT_DESCRIPTION =
  "اقرأ القرآن الكريم كاملًا في صفحات مصحف المدينة النبوية كما طُبعت، مع التفسير الميسّر لكل آية، والبحث في الآيات بلا تشكيل، وألوان التجويد. بلا إعلانات ولا حسابات.";

// The share cards, rendered once by scripts/og.mjs into public/og/: one for the site, one per surah.
export const OG_SIZE = { width: 1200, height: 630 };
export const ogHome = "/og/home.jpg";
export const ogSurah = (id: number) => `/og/surah-${id}.jpg`;

// A description cut at a word boundary, so a search result never ends on half a word.
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).replace(/[\s،,.:؛]+$/, "") + "…";
}

export type Crumb = { name: string; path: string };
type Thing = Record<string, unknown>;

export const quranBook = (site: URL): Thing => ({
  "@type": "Book",
  "@id": new URL("/#quran", site).href,
  name: "القرآن الكريم",
  alternateName: "The Holy Quran",
  inLanguage: "ar",
  bookFormat: "https://schema.org/EBook",
  numberOfPages: 604,
  bookEdition: "مصحف المدينة النبوية، طبعة ١٤٢١ هـ",
  publisher: { "@type": "Organization", name: "مجمع الملك فهد لطباعة المصحف الشريف" },
});

export const website = (site: URL): Thing => ({
  "@type": "WebSite",
  "@id": new URL("/#website", site).href,
  url: new URL("/", site).href,
  name: SITE_NAME,
  alternateName: [SITE_NAME_EN, "مثاني: القرآن الكريم والتفسير الميسّر"],
  description: DEFAULT_DESCRIPTION,
  inLanguage: "ar",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${new URL("/search", site).href}?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

export const breadcrumbs = (site: URL, crumbs: Crumb[]): Thing => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: new URL(c.path, site).href })),
});

// Several descriptions in one script, as a graph whose parts can point at each other by @id.
export const graph = (things: Thing[]) => JSON.stringify({ "@context": "https://schema.org", "@graph": things }).replace(/</g, "\\u003c");
