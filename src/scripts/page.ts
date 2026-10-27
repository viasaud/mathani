// Interactions on a mushaf page: verse sheet, page turning (buttons, arrows, swipes), the surah strip, line balancing, last-read memory. Pages turn in place: the next page is fetched and swapped into this one,
// so the controls stay put and every press counts, however quickly they come.
import { gsap } from "gsap";
import { ar, ayahs, normalize, westernDigits } from "../lib/arabic";
import { closeSheet, initSheet, openSheet, sheetOpen } from "../lib/sheet";
import { siteIndex } from "../lib/site-index";
import { load, save } from "../lib/storage";
import { $, flash, isTyping, STAR_SVG, toast } from "../lib/ui";
import { moving } from "./motion";

type PageData = { verses: Record<string, [text: string, label: string, tafsir: string]>; names: Record<string, string> };
let data = JSON.parse($("page-data").textContent!) as PageData;
const root = $("mushaf");
let pageNo = Number(root.dataset.page);
// The stage holds this page and its facing page; the facing one shows only in the two-page view (reader.css).
const stage = root.querySelector<HTMLElement>(".stage")!;
let articles = [...stage.querySelectorAll<HTMLElement>(".mpage")];
const fontOf = (a: Element) => (a as HTMLElement).style.getPropertyValue("--pf");
const pageOf = (el: Element) => Number(el.closest<HTMLElement>(".mpage")!.dataset.page);
let [firstS, firstA] = root.dataset.first!.split(":").map(Number);

const shown = () => articles.filter((a) => a.getClientRects().length);
const spreadOn = () => shown().length === 2;
const glyphsOf = (key: string) => shown().flatMap((a) => [...a.querySelectorAll<HTMLElement>(`.g[data-v="${key}"]`)]);
// the verses on screen, in reading order (the right page first)
const keys = () => [...new Set(shown().flatMap((a) => [...a.querySelectorAll<HTMLElement>(".g")].map((g) => g.dataset.v!)))];
const keyOf = (el: Element | null) => el?.closest<HTMLElement>(".g")?.dataset.v ?? null;
const remember = (s: number, a: number, p = pageNo) => save("last", { s, a, p });

// Until a page font has loaded the lines are blank; a faint placeholder shows (see .mpage:not(.ready) in reader.css).
// The facing page's font is only fetched once that page is on screen.
const loadFont = (a: HTMLElement) => {
  if (a.dataset.loading) return;
  a.dataset.loading = "1";
  // a turn waits for the new page's fonts (see ready()), so the page shows in the same frame, not one later
  if (document.fonts.check(`24px ${fontOf(a)}`)) {
    a.classList.add("ready");
    return balance(a);
  }
  document.fonts.load(`24px ${fontOf(a)}`).catch(() => {}).finally(() => {
    a.classList.add("ready");
    balance(a);
  });
};

// Lines are justified edge to edge like the printed page; short lines (the last surahs on the final page, for
// instance) are centered. The layout data also files a few words one line too early (pages 27 and 177, for
// example), making a line overflow next to a short one; such a word is moved back to where it belongs.
function balance(page: HTMLElement) {
  const lines = [...page.querySelectorAll<HTMLElement>(".ml")].filter((l) => l.querySelector(".g"));
  const fill = (line: HTMLElement) => {
    let width = 0;
    line.querySelectorAll(".g").forEach((g) => (width += g.getBoundingClientRect().width));
    return width / line.clientWidth;
  };
  const fills = lines.map(fill).sort((x, y) => x - y);
  const typical = fills[Math.floor(fills.length / 2)];
  for (let i = 0; i + 1 < lines.length; i++) {
    const [line, next] = [lines[i], lines[i + 1]];
    if (line.nextElementSibling !== next) continue; // a title band sits between them
    for (let moves = 0; moves < 3 && fill(line) > typical + 0.05 && fill(next) < typical - 0.05; moves++) {
      next.prepend(line.lastElementChild!);
    }
  }
  lines.forEach((line) => line.classList.toggle("short", fill(line) < typical * 0.85));
}

// Hovering any word tints its whole verse, the way a finger follows a line in the mushaf.
let hovered: string | null = null;
stage.addEventListener("mouseover", (e) => {
  const key = keyOf(e.target as Element);
  if (key === hovered) return;
  if (hovered) glyphsOf(hovered).forEach((g) => g.classList.remove("hover"));
  hovered = key;
  if (key) glyphsOf(key).forEach((g) => g.classList.add("hover"));
});
stage.addEventListener("mouseleave", () => {
  if (hovered) glyphsOf(hovered).forEach((g) => g.classList.remove("hover"));
  hovered = null;
});

// ---------- verse sheet ----------
initSheet();
function show(key: string) {
  const [s, a] = key.split(":").map(Number);
  const [text, label, tafsir] = data.verses[key];
  const glyphs = glyphsOf(key);
  // A verse can start on the previous page or run on to the next one; in the two-page view it can cross the spine,
  // and then each part is drawn in its own page's font.
  const startsHere = glyphs.some((g) => g.dataset.w === "0");
  const endsHere = glyphs.some((g) => g.classList.contains("e"));
  const parts = shown()
    .map((pg) => glyphs.filter((g) => pg.contains(g)))
    .filter((part) => part.length)
    .map((part) => `<span style='font-family:${fontOf(part[0].closest(".mpage")!)}'>${part.map((g) => g.textContent).join(" ")}</span>`);
  const list = keys();
  const i = list.indexOf(key);
  const page = pageOf(glyphs[0]);
  openSheet(
    {
      s, a, surahName: data.names[s], sub: `صفحة ${ar(page)}`,
      verse: { html: (startsHere ? "" : "… ") + parts.join(" ") + (endsHere ? "" : " …"), glyphs: true },
      plain: text, label, tafsir, marks: glyphs,
    },
    {
      prev: i > 0 ? () => show(list[i - 1]) : undefined,
      next: i < list.length - 1 ? () => show(list[i + 1]) : undefined,
    },
  );
  remember(s, a, page);
}
stage.addEventListener("click", (e) => {
  const key = keyOf(e.target as Element);
  if (key) show(key);
});

// ---------- one page or two: the turns move a whole spread, and the page number names both pages ----------
const prevLink = document.getElementById("prev") as HTMLAnchorElement | null;
const nextLink = document.getElementById("next") as HTMLAnchorElement | null;
const dockNum = $("dock-num");
const dockSub = $("dock-sub");
const dockSno = $("dock-sno");
// the page a spread opens on (the odd page, on the right), and how far one turn moves
const firstOf = (p: number, two = spreadOn()) => (two && !(p % 2) ? p - 1 : p);
const step = (two = spreadOn()) => (two ? 2 : 1);
const labelFor = (page: number, two = spreadOn()) => {
  const right = firstOf(page, two);
  return two ? `صفحة ${ar(right)}–${ar(Math.min(right + 1, 604))}` : `صفحة ${ar(page)}`;
};
// at either end of the mushaf the button stays where it is, dimmed, so the controls never shift
function point(link: HTMLAnchorElement | null, page: number) {
  if (!link) return;
  const off = page < 1 || page > 604;
  if (off) {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
  } else {
    link.href = `/page/${page}`;
    link.removeAttribute("aria-disabled");
  }
  link.tabIndex = off ? -1 : 0;
}
function layout() {
  const two = spreadOn();
  shown().forEach(loadFont);
  document.documentElement.classList.toggle("spread", two);
  const first = firstOf(pageNo, two);
  point(prevLink, first - step(two));
  point(nextLink, first + step(two));
  // where the reader is: the surah of the first page on screen, and the page (or pair) and its juz
  const label = labelFor(pageNo, two);
  const lead = shown()[0];
  const metaPage = document.querySelector<HTMLElement>("#ctx-meta span");
  if (metaPage) metaPage.textContent = label;
  dockNum.textContent = `سورة ${lead.dataset.surah}`;
  dockSno.textContent = ar(Number(lead.dataset.sno));
  dockSub.textContent = `${label} · الجزء ${ar(Number(lead.dataset.juz))}`;
  $("dock-prog").style.setProperty("--p", (firstOf(pageNo, two) / 604).toFixed(4));
}
layout();
new ResizeObserver(layout).observe(root);
window.addEventListener("mushaf:spread", () => requestAnimationFrame(layout));

// ---------- turning pages in place ----------
// Each page is fetched once (the neighbours ahead of time) and swapped into this document. A press while a page is
// still on its way moves the target on, and only the last one asked for is shown, so a burst of presses is a fast
// flick through the mushaf rather than presses lost to page loads.
const pages = new Map<number, Promise<Document>>();
function fetchPage(p: number) {
  let doc = pages.get(p);
  if (!doc) {
    doc = fetch(`/page/${p}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((html) => new DOMParser().parseFromString(html, "text/html"));
    doc.catch(() => pages.delete(p));
    pages.set(p, doc);
  }
  return doc;
}
// A fetched page with its fonts loaded: its @font-face rules join this document and every face is fetched, so the
// page appears whole instead of blank until its fonts arrive. A font slower than FONT_WAIT is left to load in place.
const FONT_WAIT = 4000;
const readied = new Map<number, Promise<Document>>();
function ready(p: number) {
  let doc = readied.get(p);
  if (!doc) {
    doc = fetchPage(p).then((d) => {
      const families = new Set<string>();
      d.head.querySelectorAll("style").forEach((st) => {
        if (!st.textContent!.includes("@font-face")) return;
        for (const m of st.textContent!.matchAll(/font-family:"([^"]+)"/g)) families.add(m[1]);
        if (![...document.head.querySelectorAll("style")].some((x) => x.textContent === st.textContent)) document.head.append(st.cloneNode(true));
      });
      const fonts = Promise.all([...families].map((f) => document.fonts.load(`24px "${f}"`).catch(() => {})));
      return Promise.race([fonts, new Promise((r) => setTimeout(r, FONT_WAIT))]).then(() => d);
    });
    doc.catch(() => readied.delete(p));
    readied.set(p, doc);
  }
  return doc;
}
let wanted = pageNo;

function turn(to: number, push = true) {
  to = Math.min(604, Math.max(1, firstOf(to)));
  if (to === firstOf(wanted)) return;
  wanted = to;
  if (to === firstOf(pageNo)) return layout(); // turned there and back before the page arrived
  // the bar answers at once, before the page arrives
  dockSub.textContent = labelFor(to);
  ready(to).then(
    (doc) => to === wanted && swap(doc, to, push),
    () => to === wanted && (location.href = `/page/${to}`),
  );
}

function swap(doc: Document, to: number, push: boolean) {
  const next = doc.getElementById("mushaf");
  const json = doc.getElementById("page-data");
  if (!next || !json) return void (location.href = `/page/${to}`);
  closeSheet();
  setStrip(false);
  const from = pageNo;
  const ghost = moving() ? leaving() : null;
  root.dataset.page = next.dataset.page;
  root.dataset.first = next.dataset.first;
  stage.style.transform = "";
  stage.innerHTML = next.querySelector(".stage")!.innerHTML;
  data = JSON.parse(json.textContent!) as PageData;
  $("page-data").textContent = json.textContent;
  pageNo = Number(next.dataset.page);
  articles = [...stage.querySelectorAll<HTMLElement>(".mpage")];
  [firstS, firstA] = root.dataset.first!.split(":").map(Number);
  hovered = null;
  const title = doc.getElementById("ctx-title"), meta = doc.getElementById("ctx-meta");
  if (title) $("ctx-title").textContent = title.textContent;
  if (meta) $("ctx-meta").innerHTML = meta.innerHTML;
  document.title = doc.title;
  if (push) history.pushState({ page: pageNo }, "", `/page/${pageNo}`);
  layout();
  if (ghost) turning(ghost, pageNo > from ? 1 : -1);
  remember(firstS, firstA);
  afterShown(prefetch);
}

// ---------- the turn itself ----------
// The page being left is copied and laid over the new one, then each goes its way: onwards (in a right-to-left
// mushaf, the next page lies to the left) the old page slides off to the right and the new one comes in from the left.
// A turn pressed while one is still running cuts it short, so a fast flick never queues.
let ghostEl: HTMLElement | null = null;
function leaving() {
  ghostEl?.remove();
  gsap.killTweensOf(articles);
  const g = stage.cloneNode(true) as HTMLElement;
  g.classList.add("ghost");
  g.removeAttribute("data-fit-shift");
  g.setAttribute("aria-hidden", "true");
  Object.assign(g.style, { left: `${stage.offsetLeft}px`, top: `${stage.offsetTop}px`, width: `${stage.offsetWidth}px`, height: `${stage.offsetHeight}px`, transform: "" });
  root.append(g);
  return (ghostEl = g);
}
function turning(g: HTMLElement, dir: 1 | -1) {
  const shift = Math.min(90, stage.offsetWidth * 0.12);
  gsap.to(g, {
    x: dir * shift, rotationY: dir * -8, opacity: 0, filter: "blur(3px)", duration: 0.42, ease: "power2.in",
    transformOrigin: dir > 0 ? "100% 50%" : "0% 50%",
    onComplete: () => { g.remove(); if (ghostEl === g) ghostEl = null; },
  });
  gsap.fromTo(articles,
    { x: -dir * shift, opacity: 0, rotationY: dir * 6 },
    { x: 0, opacity: 1, rotationY: 0, duration: 0.6, ease: "power3.out", delay: 0.06, stagger: { each: 0.05, from: dir > 0 ? "end" : "start" }, clearProps: "transform,opacity" });
}

// The neighbours wait until the pages on screen have their fonts, so on a slow connection they never compete with
// the font the reader is waiting for.
const afterShown = (f: () => void) =>
  Promise.all(shown().map((a) => document.fonts.load(`24px ${fontOf(a)}`).catch(() => {}))).then(f);
// The neighbours, so the next press is instant: the page ahead with its fonts, the one behind only its HTML.
function prefetch() {
  const [ahead, behind] = [firstOf(pageNo) + step(), firstOf(pageNo) - step()];
  if (ahead <= 604) ready(ahead).catch(() => {});
  if (behind >= 1) fetchPage(behind).catch(() => {});
}

const go = (id: "next" | "prev") => turn(firstOf(wanted) + (id === "next" ? step() : -step()));
for (const [id, link] of [["next", nextLink], ["prev", prevLink]] as const) {
  link?.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // a new tab still opens the page itself
    e.preventDefault();
    go(id); // turn() stops at either end of the mushaf
  });
}
window.addEventListener("popstate", () => {
  const m = /^\/page\/(\d+)/.exec(location.pathname);
  if (m) turn(Number(m[1]), false);
});
history.replaceState({ page: pageNo }, "");
afterShown(prefetch);

// ---------- arrows and swipes (RTL: the next page is to the left) ----------
document.addEventListener("keydown", (e) => {
  if (isTyping(e) || document.querySelector("dialog[open]") || sheetOpen()) return;
  if (e.key === "ArrowLeft") go("next");
  if (e.key === "ArrowRight") go("prev");
});
let touch: { x: number; y: number } | null = null;
stage.addEventListener("touchstart", (e) => (touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true });
stage.addEventListener("touchend", (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? "next" : "prev");
});

// ---------- the surah strip: the fast way to any surah ----------
// All 114 surahs in one row, the one being read in the middle. A flick runs through them quickly; the card at the
// centre stands out, the others ease back like a dial; a tap on any card opens that surah.
const strip = $("surahs");
const row = $("sx-strip");
// The cards are drawn the first time the strip opens rather than carried in every page's HTML.
let cards: HTMLAnchorElement[] = [];
let filling: Promise<void> | undefined;
const fillStrip = () =>
  (filling ??= siteIndex().then(({ chapters }) => {
    row.innerHTML = chapters
      .map((c) => `<a class="sx-card" role="listitem" href="/page/${c.page}" data-page="${c.page}" data-s="${c.id}" data-name="${c.name}">
        <span class="sx-star" aria-hidden="true">${STAR_SVG}<b>${ar(c.id)}</b></span>
        <strong>${c.name}</strong>
        <small>${c.makki ? "مكية" : "مدنية"} · ${ayahs(c.n)}</small>
        <small class="sx-pg">صفحة ${ar(c.page)}</small></a>`)
      .join("");
    cards = [...row.querySelectorAll<HTMLAnchorElement>(".sx-card")];
  }, (err) => {
    filling = undefined;
    throw err;
  }));
const where = $("dock-page");
const find = $<HTMLInputElement>("sx-q");
let stripOpen = false;
let dialing = false;
function dial() {
  dialing = false;
  const r = row.getBoundingClientRect();
  const mid = r.left + r.width / 2;
  for (const c of cards) {
    if (c.hidden) continue;
    const b = c.getBoundingClientRect();
    if (b.right < r.left - 200 || b.left > r.right + 200) continue;
    const d = Math.min(1, Math.abs(b.left + b.width / 2 - mid) / (r.width / 2));
    c.style.setProperty("--d", d.toFixed(3));
    c.style.setProperty("--side", String(Math.sign(b.left + b.width / 2 - mid) * -28));
  }
}
row.addEventListener("scroll", () => {
  if (!dialing) (dialing = true), requestAnimationFrame(dial);
}, { passive: true });
// a mouse wheel turns the dial too
row.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.preventDefault();
  row.scrollBy({ left: -e.deltaY * 1.4 }); // RTL: scrolling down moves on through the mushaf
}, { passive: false });
const centre = (card: Element) => card.scrollIntoView({ inline: "center", block: "nearest" });
function setStrip(open: boolean) {
  if (open === stripOpen) return;
  stripOpen = open;
  where.setAttribute("aria-expanded", String(open));
  if (!open) {
    strip.hidden = true;
    if (strip.contains(document.activeElement)) where.focus({ preventScroll: true });
    return;
  }
  fillStrip().then(() => {
    if (!stripOpen) return; // closed again while the cards were loading
    strip.hidden = false;
    find.value = "";
    cards.forEach((c) => (c.hidden = false));
    const here = Number(shown()[0].dataset.sno);
    cards.forEach((c) => c.toggleAttribute("aria-current", Number(c.dataset.s) === here));
    centre(cards[here - 1]);
    dial();
    cards[here - 1].focus({ preventScroll: true });
  }, () => {
    stripOpen = false;
    where.setAttribute("aria-expanded", "false");
    toast("تعذّر تحميل قائمة السور. تحقق من الاتصال وحاول مرة أخرى.");
  });
}
where.addEventListener("click", () => setStrip(!stripOpen));
$("sx-close").addEventListener("click", () => setStrip(false));
row.addEventListener("click", (e) => {
  const card = (e.target as Element).closest<HTMLAnchorElement>(".sx-card");
  if (!card || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  setStrip(false);
  turn(Number(card.dataset.page));
});
// typing narrows the strip to matching surahs; Enter opens the first
find.addEventListener("input", () => {
  const q = normalize(westernDigits(find.value.trim()));
  let first: HTMLAnchorElement | undefined;
  for (const c of cards) {
    c.hidden = !!q && !normalize(c.dataset.name!).includes(q) && c.dataset.s !== q;
    if (!c.hidden) first ??= c;
  }
  if (first) centre(first);
  dial();
});
find.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Escape") setStrip(false);
  if (e.key === "Enter") cards.find((c) => !c.hidden)?.click();
});
// arrows step through the cards (RTL: left is onwards)
row.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  e.preventDefault();
  e.stopPropagation();
  const live = cards.filter((c) => !c.hidden);
  const i = live.indexOf(document.activeElement as HTMLAnchorElement);
  const next = live[Math.min(live.length - 1, Math.max(0, i + (e.key === "ArrowLeft" ? 1 : -1)))];
  next?.focus({ preventScroll: true });
  if (next) centre(next);
});
document.addEventListener("pointerdown", (e) => {
  if (stripOpen && !(e.target as Element).closest("#surahs, #dock-page")) setStrip(false);
});
document.addEventListener("keydown", (e) => e.key === "Escape" && setStrip(false));

// ---------- switching to a text view keeps the reader on the same verse ----------
window.addEventListener("mushaf:beforemode", () => closeSheet());
window.addEventListener("mushaf:mode", () => {
  if (document.documentElement.dataset.mode === "pages") return;
  location.href = `/surah/${firstS}#a${firstA}`;
});

// ---------- #v2-255 marks where a link was pointing ----------
function fromHash() {
  const m = /^#v(\d{1,3})-(\d{1,3})$/.exec(location.hash);
  if (!m) return false;
  const marks = glyphsOf(`${m[1]}:${m[2]}`);
  if (!marks.length) return false;
  // the whole page is on screen, so the verse only glows for a moment for the eye to find it
  flash(marks);
  remember(Number(m[1]), Number(m[2]), pageOf(marks[0]));
  return true;
}
window.addEventListener("hashchange", fromHash);
if (!fromHash()) remember(firstS, firstA);

// ---------- the first visit: say once that every word opens its verse ----------
if (!load("tapped", false)) {
  stage.addEventListener("click", () => save("tapped", true), { once: true });
  setTimeout(() => load("tapped", false) || sheetOpen() || toast("اضغط أي كلمة لتقرأ آيتها وتفسيرها", 4200), 1400);
}
