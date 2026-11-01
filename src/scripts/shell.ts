// Runs on every page: the header that steps aside while reading, the index drawer, the quick-jump palette,
// reading settings and keyboard shortcuts.
import { ar, ayahs, JUZ_NAMES, juzGenitive, normalize, surahCount, westernDigits } from "../lib/arabic";
import { fold, matchRanges, verseIndex } from "../lib/search";
import { warmPage } from "../lib/page-fonts";
import { pageOfVerse, siteIndex, type SiteIndex } from "../lib/site-index";
import { lastReadHref, load, save, type LastRead } from "../lib/storage";
import { $, escapeHtml, hideScrim, hideToast, isTyping, showScrim, STAR_SVG, trapTab, whenIdle } from "../lib/ui";

const root = document.documentElement;
const header = $("hd");
const INDEX_FAILED = `<div class="ix-empty">تعذّر تحميل الفهرس. تحقق من الاتصال وحاول مرة أخرى.</div>`;

// Warm the navigation index while the reader looks at the page; everything below reads from it.
let linkIndex: SiteIndex | undefined;
whenIdle(() => siteIndex().then((index) => {
  linkIndex = index;
  routeAll();
}).catch(() => {}));

// ---------- surah links open the mushaf page itself ----------
// In the page view a /surah/N link would load the text view only to be sent on to the page (surah/[id].astro), and
// hovering it would prefetch that whole text view. Once the index is in, such links point straight at the page, and
// pointing at or pressing one starts its page fonts downloading. Each link keeps its own address in data-surah, so
// switching back to a text view restores it.
const pagesMode = () => (root.dataset.mode || "pages") === "pages";
function toPage(href: string) {
  const m = /^\/surah\/(\d{1,3})(?:#a(\d{1,3}))?$/.exec(href);
  const c = m && linkIndex?.chapters[Number(m[1]) - 1];
  if (!c || !pagesMode()) return null;
  const a = Math.min(Number(m![2] ?? 1), c.n);
  const page = pageOfVerse(linkIndex!, c.id, a);
  return { page, href: `/page/${page}${a > 1 ? `#v${c.id}-${a}` : ""}` };
}
const SURAH_LINK = "a[href^='/surah/'], a[data-surah]";
function route(a: HTMLAnchorElement) {
  const own = (a.dataset.surah ??= a.getAttribute("href")!);
  const to = toPage(own);
  a.setAttribute("href", to ? to.href : own);
  return to?.page;
}
const routeAll = () => document.querySelectorAll<HTMLAnchorElement>(SURAH_LINK).forEach(route);
window.addEventListener("mushaf:mode", routeAll);
// Links drawn later (the drawer, the palette, search results) are routed as they are reached. pointerover comes
// before the mouseenter that Astro's hover prefetch listens for, so that prefetch fetches the page, not the text view.
for (const type of ["pointerover", "focusin", "click"]) {
  document.addEventListener(type, (e) => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>(SURAH_LINK);
    if (!a) return;
    const page = route(a);
    if (page && type !== "click") warmPage(page);
  }, { capture: true, passive: true });
}
// links to a mushaf page; not a page's own next/previous buttons, which turn in place and load their fonts (page.ts)
document.addEventListener("pointerover", (e) => {
  const m = /^\/page\/(\d{1,3})/.exec((e.target as Element).closest?.("a:not(#prev, #next)")?.getAttribute("href") ?? "");
  if (m) warmPage(Number(m[1]));
}, { passive: true });

// ⌘K on a Mac, Ctrl K elsewhere
if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
  document.querySelectorAll("[data-mod-k]").forEach((k) => (k.textContent = "Ctrl K"));
}

// reading settings live only on the reading pages (Base.astro); elsewhere these are null and settings stay closed
const settingsBtn = document.getElementById("settings-btn");
const settings = document.getElementById("settings");

// ---------- the controls recede while reading ----------
// Scrolling down folds them away (html.recede); scrolling up, reaching an end, or tapping what is left brings them
// back.
{
  const dock = document.getElementById("dock");
  let last = scrollY;
  let ticking = false;
  const recede = (on: boolean) => root.classList.toggle("recede", on);
  const receded = () => root.classList.contains("recede");
  // a tap on a folded control unfolds the controls first and does nothing else
  const restore = (e: MouseEvent) => {
    // only a real tap: keyboard shortcuts click these controls from code (detail 0) and must still work
    if (!receded() || !e.isTrusted || e.detail === 0) return;
    e.preventDefault();
    e.stopPropagation();
    recede(false);
  };
  for (const el of [header, dock]) {
    el?.addEventListener("click", restore, true);
    // keyboard focus must never land on a hidden control
    el?.addEventListener("focusin", (e) => (e.target as Element).matches(":focus-visible") && recede(false));
  }
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    const nearEnd = y + innerHeight > document.documentElement.scrollHeight - 80;
    if (y < 80 || nearEnd || y < last - 8) recede(false);
    else if (y > last + 8 && !settingsOpen && !document.querySelector(".vsheet.on, .drawer.on")) recede(true);
    last = y;
  };
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });
}

// ---------- settings ----------
// ← → belong to an open panel (a slider, the index rows); they must not also turn the page or go to the next surah
// behind it (page.ts and reader.ts listen on the document)
const stepAside = (e: KeyboardEvent) => (e.key === "ArrowLeft" || e.key === "ArrowRight") && e.stopPropagation();
let settingsOpen = false;
const setSettings = (open: boolean, restoreFocus = false) => {
  if (!settings || !settingsBtn) return;
  const wasOpen = settingsOpen;
  settingsOpen = open;
  settingsBtn.setAttribute("aria-expanded", String(open));
  if (open && !wasOpen) {
    settings.hidden = false;
    hideToast(); // the panel and the tap hint would share the bottom of a phone's screen
  }
  if (!open && wasOpen) settings.hidden = true;
  if (open && !wasOpen) settings.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
  if (!open && wasOpen && (restoreFocus || settings.contains(document.activeElement))) settingsBtn.focus({ preventScroll: true });
};
if (settings && settingsBtn) {
  // The header's backdrop blur would trap a fixed panel inside it, so the panel lives at the end of the page.
  document.body.append(settings);
  // the panel sits at the end of the page, so Tab at its edges goes back to the button instead of wandering off
  settings.addEventListener("keydown", (e) => {
    trapTab(settings, e, settingsBtn);
    stepAside(e);
  });
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSettings(!settingsOpen);
  });
  document.addEventListener("click", (e) => {
    if (settingsOpen && !(e.target as Element).closest("#settings, #settings-btn")) setSettings(false);
  });
}

// view: the open page decides what a switch means (another kind of page, or the other text view)
const modeButtons = document.querySelectorAll<HTMLElement>("[data-mode-btn]");
const syncMode = () => modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeBtn === (root.dataset.mode || "pages"))));
syncMode();
modeButtons.forEach((b) =>
  b.addEventListener("click", () => {
    if (b.dataset.modeBtn === root.dataset.mode) return;
    window.dispatchEvent(new Event("mushaf:beforemode"));
    root.dataset.mode = b.dataset.modeBtn;
    save("mode", b.dataset.modeBtn);
    syncMode();
    window.dispatchEvent(new Event("mushaf:mode"));
  }),
);

// size: one slider scales the Quran text, and the mushaf page with it
const size = document.getElementById("size") as HTMLInputElement | null;
if (size) {
  const currentSize = () => parseFloat(getComputedStyle(root).getPropertyValue("--qsize")) || 28;
  const paintSize = () => size.style.setProperty("--fill", `${((+size.value - +size.min) / (+size.max - +size.min)) * 100}%`);
  size.value = String(currentSize());
  paintSize();
  size.addEventListener("input", () => {
    root.style.setProperty("--qsize", `${size.value}px`);
    paintSize();
  });
  size.addEventListener("change", () => save("size", Number(size.value)));
}

// one page or two, in the pages view
const spreadButtons = document.querySelectorAll<HTMLElement>("[data-spread-btn]");
const syncSpread = () => spreadButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.spreadBtn === (root.dataset.spread || "on"))));
syncSpread();
spreadButtons.forEach((b) =>
  b.addEventListener("click", () => {
    root.dataset.spread = b.dataset.spreadBtn;
    save("spread", b.dataset.spreadBtn);
    syncSpread();
    window.dispatchEvent(new Event("mushaf:spread"));
  }),
);

const themeButtons = document.querySelectorAll<HTMLElement>("[data-theme-btn]");
// one of the three tones is always set (Base.astro); the browser's own bar takes its ground
const themeMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
const syncTheme = () => {
  themeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeBtn === root.dataset.theme)));
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  themeMetas.forEach((m) => (m.content = bg));
};
syncTheme();
// until a tone is chosen, the page follows the system between light and dark as it changes
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (load<string | null>("theme", null)) return;
  root.dataset.theme = e.matches ? "dark" : "light";
  syncTheme();
});
// the page passes slowly from the old tone into the new (a view transition; global.css), where supported
themeButtons.forEach((b) =>
  b.addEventListener("click", () => {
    const t = b.dataset.themeBtn!;
    const apply = () => {
      root.dataset.theme = t;
      syncTheme();
    };
    save("theme", t);
    if (root.dataset.theme === t) return;
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    root.classList.add("theme-vt");
    const vt = document.startViewTransition(apply);
    vt.ready.catch(() => {}); // skipped (a hidden tab, say): the theme still changes
    vt.finished.finally(() => root.classList.remove("theme-vt"));
  }),
);

const tajweed = document.getElementById("opt-tajweed") as HTMLInputElement | null;
if (tajweed) {
  tajweed.checked = root.dataset.tajweed === "on";
  tajweed.addEventListener("change", () => {
    root.dataset.tajweed = tajweed.checked ? "on" : "off";
    save("tajweed", root.dataset.tajweed);
  });
}

// ---------- index drawer ----------
const drawer = $("drawer");
const ixList = $("ix-list");
const ixQ = $<HTMLInputElement>("ix-q");
const current = Number(drawer.dataset.current);
let ixView: "surah" | "juz" = "surah";
let ixPlace: "" | "m" | "d" = "";

const ixCount = $("ix-count");

// One row per surah: its number in the star, the name, what it is, and the page it opens on. The surah being read is
// tinted gold. --i staggers the rows in when the drawer opens (.ix-list.fresh in global.css).
const surahRow = (c: SiteIndex["chapters"][number], i: number) =>
  `<a class="ix-item" href="/surah/${c.id}" style="--i:${i}"${c.id === current ? ' aria-current="page"' : ""}>
    <span class="ix-num">${STAR_SVG}<b>${ar(c.id)}</b></span>
    <span class="ix-main"><span class="ix-name">${c.name}</span>
    <span class="ix-sub">${c.makki ? "مكية" : "مدنية"} · ${ayahs(c.n)}</span></span>
    <span class="ix-page">ص ${ar(c.page)}</span></a>`;

async function renderIndex() {
  let index: SiteIndex;
  try {
    index = await siteIndex();
  } catch {
    ixList.innerHTML = INDEX_FAILED;
    return;
  }
  const raw = ixQ.value.trim();
  const q = normalize(raw);
  const num = westernDigits(q);
  const matches = (c: SiteIndex["chapters"][number]) =>
    (!ixPlace || (ixPlace === "m") === c.makki) &&
    (!q || normalize(c.name).includes(q) || c.en.toLowerCase().includes(q) || String(c.id) === num);
  const found = index.chapters.filter(matches);
  ixCount.textContent = raw || ixPlace ? `${surahCount(found.length)}` : ixView === "juz" ? "ثلاثون جزءًا" : "مئة وأربع عشرة سورة";

  if (ixView === "juz" && !q) {
    // each juz under its own header, which stays at the top while its surahs scroll by
    let n = 1;
    ixList.innerHTML = index.juz
      .map(([s, a], i) => {
        const next = index.juz[i + 1];
        const last = next ? (next[1] === 1 ? next[0] - 1 : next[0]) : 114;
        const rows = index.chapters.slice(s - 1, last).filter(matches).map((c) => surahRow(c, n++)).join("");
        return rows
          ? `<section class="ix-group"><div class="ix-juz"><b>${ar(i + 1)}</b><span>الجزء ${JUZ_NAMES[i + 1]}</span><small>من ${index.chapters[s - 1].name} ${ar(a)}</small></div>${rows}</section>`
          : "";
      })
      .join("");
  } else {
    const rows = found.map((c, i) => surahRow(c, i + 1)).join("");
    const typed = escapeHtml(raw);
    const why = raw ? `لا توجد سورة مطابقة لـ «${typed}».` : "لا توجد سور بهذا التصنيف.";
    const hint = ixPlace ? "غيّر الكلمة أو الفلتر." : raw ? "جرّب كلمة أخرى." : "";
    const inVerses = raw ? `<button class="btn btn-ghost" data-ix-verses>ابحث عن «${typed}» في الآيات</button>` : "";
    ixList.innerHTML = rows || `<div class="ix-empty"><p>${why} ${hint}</p>${inVerses}</div>`;
  }
}
let drawerOpener: HTMLElement | null = null;
function openDrawer() {
  setSettings(false);
  hideToast(); // the tap hint rides above the drawer otherwise
  drawerOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  drawer.classList.add("on");
  drawer.setAttribute("aria-hidden", "false");
  showScrim(closeDrawer);
  fresh(ixList);
  renderIndex().then(() => ixList.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "center" }));
  // a keyboard on a phone would cover the list, so only a precise pointer gets the field focused
  if (matchMedia("(pointer: fine)").matches) setTimeout(() => ixQ.focus(), 250);
  else drawer.focus({ preventScroll: true });
}
function closeDrawer() {
  if (!drawer.classList.contains("on")) return;
  const hadFocus = drawer.contains(document.activeElement);
  drawer.classList.remove("on");
  drawer.setAttribute("aria-hidden", "true");
  hideScrim();
  if (hadFocus && drawerOpener?.isConnected) drawerOpener.focus({ preventScroll: true });
  drawerOpener = null;
}
drawer.addEventListener("keydown", (e) => {
  trapTab(drawer, e);
  stepAside(e);
  // ↑ ↓ walk the rows (from the search field too), Enter in the field opens the first one
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && !(e.key === "Enter" && e.target === ixQ)) return;
  const rows = [...ixList.querySelectorAll<HTMLAnchorElement>(".ix-item")];
  if (!rows.length) return;
  e.preventDefault();
  if (e.key === "Enter") return rows[0].click();
  const at = rows.indexOf(document.activeElement as HTMLAnchorElement);
  if (e.key === "ArrowUp" && at <= 0) return ixQ.focus();
  rows[Math.min(rows.length - 1, e.key === "ArrowDown" ? at + 1 : at - 1)].focus({ preventScroll: false });
});
ixQ.addEventListener("input", renderIndex);
ixList.addEventListener("click", (e) => {
  if (!(e.target as Element).closest("[data-ix-verses]")) return;
  const q = ixQ.value.trim();
  closeDrawer();
  openPalette(q);
});
drawer.querySelectorAll<HTMLElement>("[data-ix]").forEach((b) =>
  b.addEventListener("click", () => {
    ixView = b.dataset.ix as "surah" | "juz";
    drawer.querySelectorAll("[data-ix]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderIndex();
  }),
);
drawer.querySelectorAll<HTMLElement>("[data-ix-place]").forEach((b) =>
  b.addEventListener("click", () => {
    const p = b.dataset.ixPlace as "m" | "d";
    ixPlace = ixPlace === p ? "" : p;
    drawer.querySelectorAll<HTMLElement>("[data-ix-place]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.ixPlace === ixPlace)));
    renderIndex();
  }),
);

// A list that has just opened lets its rows rise in one after another; typing afterwards redraws it without that.
function fresh(list: HTMLElement) {
  list.classList.add("fresh");
  clearTimeout(Number(list.dataset.freshTimer));
  list.dataset.freshTimer = String(setTimeout(() => list.classList.remove("fresh"), 900));
}

// ---------- quick-jump palette ----------
const palette = $<HTMLDialogElement>("palette");
const palQ = $<HTMLInputElement>("pal-q");
const palResults = $("pal-results");
const palLive = $("pal-live");
// kind: "resume" is the where-you-stopped card (with its ring), "tile" one of the quick places (shown as a grid);
// n puts a number in the star instead of an icon (a surah's, or a verse's)
type Item = { href: string; icon: string; title: string; sub: string; verse?: boolean; kind?: "resume" | "tile"; n?: number; pct?: number };
type Group = [label: string, items: Item[], layout?: "grid"];
let items: Item[] = [];
let selected = 0;

const ICON = {
  page: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M9 13h6M9 17h4"/></svg>',
  verse: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  juz: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  star: `<span style="width:20px;height:20px;display:block">${STAR_SVG}</span>`,
  resume: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
};

function excerpt(text: string, ranges: [number, number][]) {
  const [a, b] = ranges[0];
  const lead = innerWidth < 640 ? 24 : 40; // a phone shows fewer words, so the match must come early
  const from = Math.max(0, text.lastIndexOf(" ", Math.max(0, a - lead)));
  const to = Math.min(text.length, b + 50);
  return (from > 0 ? "… " : "") + escapeHtml(text.slice(from, a)) + `<mark>${escapeHtml(text.slice(a, b))}</mark>` + escapeHtml(text.slice(b, to)) + (to < text.length ? " …" : "");
}

function setActive() {
  const els = palResults.querySelectorAll(".pal-item");
  els.forEach((el, i) => el.setAttribute("aria-selected", String(i === selected)));
  const on = els[selected];
  if (on) palQ.setAttribute("aria-activedescendant", on.id);
  else palQ.removeAttribute("aria-activedescendant");
}

const medal = (it: Item) => `<span class="pal-medal">${STAR_SVG}${it.n ? `<b>${ar(it.n)}</b>` : ""}</span>`;
function itemHtml(it: Item, i: number) {
  const open = `<a class="pal-item${it.kind ? ` pal-${it.kind}` : ""}${it.verse ? " is-verse" : ""}" role="option" id="pal-opt-${i}" href="${it.href}" data-i="${i}" style="--i:${i}" aria-selected="${i === selected}">`;
  if (it.kind === "resume") {
    // the ring fills clockwise from twelve o'clock to how far into the mushaf the place is
    return open + `<span class="pal-ring" style="--p:${it.pct ?? 0}"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle cx="24" cy="24" r="21" pathLength="100"/></svg><b>${ar(it.pct ?? 0)}٪</b></span>
      <span class="pal-txt"><small>تابع القراءة</small><b>${it.title}</b><span class="pal-sub">${it.sub}</span></span><kbd>↵</kbd></a>`;
  }
  if (it.kind === "tile") return open + `${medal(it)}<b>${it.title}</b><small>${it.sub}</small></a>`;
  const lead = it.n ? medal(it) : `<span class="pi">${it.icon}</span>`;
  return open + `${lead}<span class="pal-txt"><b>${it.title}</b>${it.verse ? `<span class="verse">${it.sub}</span>` : `<small>${it.sub}</small>`}</span><kbd>↵</kbd></a>`;
}

// state: "wait" while the verses are still being searched, "done" when nothing more will come
function renderItems(groups: Group[], state: "wait" | "done" = "done", raw = "") {
  items = groups.flatMap(([, g]) => g);
  selected = Math.min(selected, Math.max(0, items.length - 1));
  let k = 0;
  const list = groups
    .filter(([, g]) => g.length)
    .map(([label, g, layout]) => `<div role="group" class="pal-set${layout ? ` pal-${layout}` : ""}"${label ? ` aria-label="${label}"` : ""}>${label ? `<div class="pal-group" aria-hidden="true">${label}</div>` : ""}` + g.map((it) => itemHtml(it, k++)).join("") + "</div>")
    .join("");
  const tail =
    state === "wait" ? `<div class="pal-status">جارٍ البحث في الآيات…</div>`
    : !items.length ? `<div class="pal-empty"><span class="pal-empty-mark">${STAR_SVG}</span><b>لا توجد نتائج لـ «${escapeHtml(raw)}»</b><p>${/\d/.test(westernDigits(raw)) ? "الصفحات من ١ إلى ٦٠٤، والسور من ١ إلى ١١٤، والأجزاء من ١ إلى ٣٠." : fold(raw).text.length < 2 ? "اكتب حرفين على الأقل للبحث في الآيات." : "جرّب كلمة أخرى، أو اسم سورة، أو رقم صفحة."}</p></div>`
    : "";
  palResults.innerHTML = (items.length ? `<div role="listbox" id="pal-list" aria-label="النتائج">${list}</div>` : "") + tail;
  palQ.setAttribute("aria-expanded", String(items.length > 0));
  setActive();
  palLive.textContent = state === "wait" ? "" : items.length ? `${ar(items.length)} نتيجة` : "لا توجد نتائج";
}

let seq = 0;
async function runPalette() {
  const raw = palQ.value.trim();
  const mine = ++seq;
  selected = 0;
  let index: SiteIndex;
  try {
    index = await siteIndex();
  } catch {
    palResults.innerHTML = INDEX_FAILED;
    return;
  }
  if (mine !== seq) return;
  const name = (s: number) => index.chapters[s - 1].name;

  if (!raw) {
    // before typing: where the reader left off and the most visited places, ready for ↑ ↓ and Enter
    const last = load<LastRead | null>("last", null);
    const page = last ? last.p ?? index.chapters[last.s - 1]?.page : undefined;
    const resume: Item[] = last && index.chapters[last.s - 1]
      ? [{
          kind: "resume", href: lastReadHref(last), icon: ICON.resume,
          title: `سورة ${name(last.s)}`, sub: `الآية ${ar(last.a)}${page ? ` · الصفحة ${ar(page)}` : ""}`,
          pct: page ? Math.max(1, Math.round((page / 604) * 100)) : 0,
        }]
      : [];
    const about = (s: number) => `${index.chapters[s - 1].makki ? "مكية" : "مدنية"} · ${ayahs(index.chapters[s - 1].n)}`;
    const places: Item[] = [
      { kind: "tile", href: "/surah/18", icon: "", n: 18, title: "الكهف", sub: about(18) },
      { kind: "tile", href: "/surah/36", icon: "", n: 36, title: "يس", sub: about(36) },
      { kind: "tile", href: "/surah/67", icon: "", n: 67, title: "الملك", sub: about(67) },
      { kind: "tile", href: "/surah/2#a255", icon: "", n: 255, title: "آية الكرسي", sub: "البقرة · الآية ٢٥٥" },
    ];
    renderItems([["", resume], ["وصول سريع", places, "grid"]]);
    palLive.textContent = "";
    return;
  }

  // «صفحة» on its own (the page dock opens the palette with it): wait for the number
  if (/^(?:ال)?(?:صفحة|ص)$/.test(raw)) {
    items = [];
    palQ.setAttribute("aria-expanded", "false");
    palResults.innerHTML = `<div class="pal-empty"><b>اكتب رقم الصفحة</b><p>من ١ إلى ٦٠٤</p></div>`;
    return;
  }

  const w = westernDigits(raw).replace(/\s+/g, " ");
  const jump: Item[] = [];
  let m: RegExpMatchArray | null;
  if ((m = w.match(/^(\d{1,3})\s*[:：.\/]\s*(\d{1,3})$/))) {
    const s = +m[1], a = +m[2];
    if (s >= 1 && s <= 114 && a >= 1 && a <= index.chapters[s - 1].n) {
      jump.push({ href: `/surah/${s}#a${a}`, icon: ICON.star, n: a, title: `سورة ${name(s)}، الآية ${ar(a)}`, sub: "انتقل إلى الآية" });
      jump.push({ href: `/surah/${s}/${a}`, icon: ICON.page, title: `تفسير الآية ${ar(a)} من سورة ${name(s)}`, sub: "الآية وتفسيرها الميسّر في صفحتها" });
    }
  } else if ((m = w.match(/^(?:ال)?(?:جزء|ج)\s*(\d{1,2})$/))) {
    const j = +m[1];
    if (j >= 1 && j <= 30) {
      const [s, a] = index.juz[j - 1];
      jump.push({ href: `/surah/${s}#a${a}`, icon: ICON.juz, title: `الجزء ${JUZ_NAMES[j]}`, sub: `يبدأ من سورة ${name(s)}، الآية ${ar(a)}` });
      jump.push({ href: `/juz/${j}`, icon: ICON.page, title: `عن الجزء ${juzGenitive(j)}`, sub: "سوره وأرباعه، وأين يبدأ وأين ينتهي" });
    }
  } else if ((m = w.match(/^(?:ال)?(?:حزب|ح)\s*(\d{1,2})$/))) {
    const h = +m[1];
    if (h >= 1 && h <= 60) { const [s, a] = index.rubs[(h - 1) * 4]; jump.push({ href: `/surah/${s}#a${a}`, icon: ICON.juz, title: `الحزب ${ar(h)}`, sub: `يبدأ من سورة ${name(s)}، الآية ${ar(a)}` }); }
  } else if ((m = normalize(w).match(/^(?:ال)?سوره\s*(\d{1,3})$/))) {
    const n = +m[1];
    if (n >= 1 && n <= 114) { const c = index.chapters[n - 1]; jump.push({ href: `/surah/${n}`, icon: ICON.star, n, title: `سورة ${c.name}`, sub: `السورة رقم ${ar(n)} · ${ayahs(c.n)}` }); }
  } else if ((m = w.match(/^(?:ال)?(?:صفحة|ص)?\s*(\d{1,3})$/))) {
    const n = +m[1];
    if (n >= 1 && n <= 604) { const [s] = index.pages[n - 1]; jump.push({ href: `/page/${n}`, icon: ICON.page, title: `الصفحة ${ar(n)}`, sub: `سورة ${name(s)}` }); }
    if (n >= 1 && n <= 114 && !/^(?:ال)?(?:صفحة|ص)/.test(w)) { const c = index.chapters[n - 1]; jump.push({ href: `/surah/${n}`, icon: ICON.star, n, title: `سورة ${c.name}`, sub: `السورة رقم ${ar(n)} · ${ayahs(c.n)}` }); }
  }

  const q = normalize(raw);
  const named = q.replace(/^(?:ال)?سوره\s+/, ""); // «سورة البقرة» finds البقرة
  const surahs: Item[] = /\d/.test(w) ? [] : index.chapters
    .filter((c) => normalize(c.name).includes(named) || c.en.toLowerCase().includes(named.toLowerCase()))
    .slice(0, 5)
    .map((c) => ({ href: `/surah/${c.id}`, icon: ICON.star, n: c.id, title: `سورة ${c.name}`, sub: `${c.makki ? "مكية" : "مدنية"} · ${ayahs(c.n)} · الصفحة ${ar(c.page)}` }));
  const needle = fold(raw).text;
  const searchVerses = needle.length >= 2 && !/^\d+$/.test(w.replace(/\s/g, ""));
  renderItems([["انتقال", jump], ["السور", surahs]], searchVerses ? "wait" : "done", raw);
  if (!searchVerses) return;
  let all;
  try {
    all = await verseIndex();
  } catch {
    renderItems([["انتقال", jump], ["السور", surahs]], "done", raw);
    return;
  }
  if (mine !== seq) return;
  const hits = all.filter((v) => v.folded.text.includes(needle));
  const found: Item[] = hits.slice(0, 6).map((v) => ({
    href: `/surah/${v.s}#a${v.a}`, icon: ICON.verse, verse: true,
    title: `سورة ${name(v.s)}، الآية ${ar(v.a)}`, sub: excerpt(v.text, matchRanges(v.text, v.folded, needle)),
  }));
  if (hits.length > found.length) found.push({ href: `/search?q=${encodeURIComponent(raw)}`, icon: ICON.verse, title: `عرض كل النتائج (${ar(hits.length)})`, sub: `البحث عن «${escapeHtml(raw)}» في الآيات` });
  renderItems([["انتقال", jump], ["السور", surahs], ["في الآيات", found]], "done", raw);
}

function openPalette(prefill = "") {
  setSettings(false);
  if (keys.open) keys.close();
  if (drawer.classList.contains("on")) closeDrawer();
  palQ.value = prefill;
  palette.showModal();
  fresh(palResults);
  runPalette();
  palQ.focus();
}
let palTimer = 0;
palQ.addEventListener("input", () => {
  clearTimeout(palTimer);
  palTimer = window.setTimeout(() => ((palTimer = 0), runPalette()), 90);
});
palQ.addEventListener("keydown", (e) => {
  const move = (d: number) => {
    if (!items.length) return;
    selected = (selected + d + items.length) % items.length;
    setActive();
    palResults.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  };
  // a search field would clear itself on Esc and swallow it, so the palette takes it
  if (e.key === "Escape") { e.preventDefault(); palette.close(); }
  if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
  if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  if (e.key === "Enter") {
    e.preventDefault();
    // typed faster than the results: let them catch up first («صفحة ١٠٠» then Enter goes to the page)
    if (palTimer) {
      clearTimeout(palTimer);
      palTimer = 0;
      runPalette().then(() => palQ.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
      return;
    }
    const it = items[selected];
    if (it) go(it.href);
    else if (palQ.value.trim()) go(`/search?q=${encodeURIComponent(palQ.value.trim())}`);
  }
});
palResults.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>(".pal-item");
  if (a) { e.preventDefault(); go(a.getAttribute("href")!); }
});
palette.addEventListener("click", (e) => {
  if (e.target === palette) return palette.close();
  // an example under the field: typed in for the reader
  const tryIt = (e.target as Element).closest<HTMLElement>("[data-try]");
  if (!tryIt) return;
  palQ.value = tryIt.dataset.try!;
  runPalette();
  palQ.focus();
});
$("pal-close").addEventListener("click", () => palette.close());

// Jumping to a verse on the page already open only needs the hash to change.
function go(href: string) {
  palette.close();
  href = toPage(href)?.href ?? href;
  const url = new URL(href, location.href);
  if (url.pathname === location.pathname && url.hash) {
    if (location.hash === url.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = url.hash;
  } else location.href = href;
}

// ---------- open buttons and keyboard shortcuts ----------
document.querySelectorAll<HTMLElement>("[data-open]").forEach((b) =>
  b.addEventListener("click", () => (b.dataset.open === "drawer" ? openDrawer() : openPalette())),
);
document.querySelectorAll<HTMLElement>("[data-close='drawer']").forEach((b) => b.addEventListener("click", closeDrawer));
window.addEventListener("mushaf:palette", (e) => openPalette((e as CustomEvent<string>).detail ?? ""));

// ---------- the keyboard shortcuts sheet ----------
const keys = $<HTMLDialogElement>("keys");
function toggleKeys() {
  if (keys.open) return keys.close();
  if (palette.open) palette.close();
  closeDrawer();
  setSettings(false, true);
  keys.showModal();
  keys.focus(); // the sheet itself, not its close button, so nothing wears a focus ring unasked
}
keys.addEventListener("click", (e) => e.target === keys && keys.close()); // a press outside the sheet
$("keys-close").addEventListener("click", () => keys.close());

// An Arabic layout types ظ and ن on the slash and K keys: the key itself counts then. A Latin layout that puts another
// character there (Dvorak, German) keeps it, and so do dead keys and Option's ÷: only a single non-ASCII character,
// typed without Alt, stands in.
const keyIs = (e: KeyboardEvent, char: string, code: string) =>
  e.key.toLowerCase() === char || (e.code === code && !e.shiftKey && !e.altKey && /^[^\x00-\x7f]$/u.test(e.key));
document.addEventListener("keydown", (e) => {
  if ((e.key === "?" || e.key === "؟") && !isTyping(e) && (keys.open || !document.querySelector("dialog[open]"))) {
    e.preventDefault();
    toggleKeys();
  } else if ((e.metaKey || e.ctrlKey) && keyIs(e, "k", "KeyK")) {
    e.preventDefault();
    palette.open ? palette.close() : openPalette();
  } else if (keyIs(e, "/", "Slash") && !isTyping(e) && !palette.open) {
    e.preventDefault();
    openPalette();
  } else if (e.key === "Escape") {
    setSettings(false, true);
    if (drawer.classList.contains("on")) closeDrawer();
  }
});
