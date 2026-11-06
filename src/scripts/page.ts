// Interactions on a mushaf page: verse sheet, page turning (buttons, arrows, swipes), the surah strip, line balancing,
// last-read memory. Pages turn in place: the next page is fetched and swapped into this one, so the controls stay put
// and every press counts, however quickly they come.
import { gsap } from "gsap";
import { ar } from "../lib/arabic";
import { closeSheet, initSheet, openSheet, sheetOpen } from "../lib/sheet";
import { load, save } from "../lib/storage";
import { $, flash, isTyping, toast } from "../lib/ui";
import { initDial } from "./dial";
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
// A facing page comes without its plain text ([n].astro): written here the first time it is on screen, for screen readers.
function writeText(a: HTMLElement) {
  const box = a.querySelector<HTMLElement>(".sr-only")!;
  if (box.childElementCount) return;
  for (const key of new Set([...a.querySelectorAll<HTMLElement>(".g")].map((g) => g.dataset.v!))) {
    const p = document.createElement("p");
    p.append(Object.assign(document.createElement("a"), { href: `/surah/${key.replace(":", "/")}`, tabIndex: -1, textContent: data.verses[key][0] }));
    box.append(p);
  }
}
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
// example), making a line overflow next to a short one; such a word is moved back to where it belongs. The text is
// sized so a typical line is nearly full; the few lines that would still run past the edge are set a little smaller,
// each by just what it needs.
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
  for (const line of lines) {
    line.style.removeProperty("--fit");
    const f = fill(line);
    if (f > 0.995) line.style.setProperty("--fit", (0.99 / f).toFixed(4));
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
const rlName = $("rl-name");
const ruler = $("ruler");
const track = $("rl-track");
const rlLabel = ruler.querySelector<HTMLElement>(".rl-label")!;
const ticks = [...track.querySelectorAll<HTMLElement>("i")];
let rulerAt = 0; // the surah whose line is lit
let chosen = 0; // the surah the reader last picked on the ruler
// on a phone the ruler gives way to the wheel (dial.ts): the same surahs, and choosing one means the same (commit)
const dial = initDial($("dial"), ticks.map((t) => t.dataset.name!), firstS, (s) => commit(s));
// Put the name tag over a surah's line: --tx is the line, which the tag's point aims at, and --lx the tag, kept
// inside the ruler at either end.
function pillTo(s: number) {
  const r = ruler.getBoundingClientRect();
  const b = ticks[s - 1].getBoundingClientRect();
  const x = b.left + b.width / 2 - r.left;
  const half = rlLabel.offsetWidth / 2;
  ruler.style.setProperty("--tx", `${x}px`);
  ruler.style.setProperty("--lx", `${Math.min(Math.max(x, half), r.width - half)}px`);
}
// Light a surah's line in gold, its name on the tag above it.
function rulerTo(s: number) {
  pillTo(s);
  if (s === rulerAt) return;
  ticks[rulerAt - 1]?.classList.remove("now");
  ticks[s - 1].classList.add("now");
  rulerAt = s;
  track.setAttribute("aria-valuenow", String(s));
  track.setAttribute("aria-valuetext", `سورة ${ticks[s - 1].dataset.name}`);
}
// the page a spread opens on (the odd page, on the right), and how far one turn moves
const firstOf = (p: number, two = spreadOn()) => (two && !(p % 2) ? p - 1 : p);
const step = (two = spreadOn()) => (two ? 2 : 1);
// at either end of the mushaf the button stays where it is, dimmed, so the controls never shift; its caption says
// what it does
const CAPTIONS = { next: ["الصفحة التالية", "الصفحتان التاليتان"], prev: ["الصفحة السابقة", "الصفحتان السابقتان"] };
function point(link: HTMLAnchorElement | null, page: number) {
  if (!link) return;
  const off = page < 1 || page > 604;
  link.querySelector(".dcap")!.textContent = CAPTIONS[link.id as "next" | "prev"][spreadOn() ? 1 : 0];
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
  // the facing page is hidden from screen readers only while it is not on screen
  const on = shown();
  on.forEach(writeText);
  articles.forEach((a) => (on.includes(a) ? a.removeAttribute("aria-hidden") : a.setAttribute("aria-hidden", "true")));
  const first = firstOf(pageNo, two);
  point(prevLink, first - step(two));
  point(nextLink, first + step(two));
  const lead = shown()[0];
  // where the pages leave room either side, the page arrows stand beside them, half way down, like turning a book;
  // otherwise they stay at the ends of the dock
  const sr = stage.getBoundingClientRect();
  const side = Math.min(sr.left, innerWidth - sr.right);
  document.documentElement.classList.toggle("side-arrows", side >= 84);
  document.documentElement.style.setProperty("--side", `${side}px`);
  // the ruler stays on a surah the reader chose while it is on screen (a surah often starts part way down a page that
  // opens with the end of the one before); otherwise it follows the surah the pages open with
  const here = new Set(keys().map((k) => Number(k.split(":")[0])));
  const at = chosen && here.has(chosen) ? chosen : Number(lead.dataset.sno);
  rlName.textContent = `سورة ${ticks[at - 1].dataset.name}`;
  rulerTo(at);
  dial.sync(at);
}
layout();
new ResizeObserver(layout).observe(root);
window.addEventListener("mushaf:spread", () => requestAnimationFrame(layout));

// ---------- turning pages in place ----------
// Each page is fetched once (the neighbours ahead of time) and swapped into this document. A press while a page is
// still on its way moves the target on, and only the last one asked for is shown, so a burst of presses is a fast
// flick through the mushaf rather than presses lost to page loads.
const KEEP = 12;
const pages = new Map<number, Promise<Document>>();
function fetchPage(p: number) {
  let doc = pages.get(p);
  if (!doc) {
    doc = fetch(`/page/${p}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((html) => new DOMParser().parseFromString(html, "text/html"));
    doc.catch(() => pages.delete(p));
    pages.set(p, doc);
    // only the latest few pages are kept (each is a whole parsed document), so a long read doesn't pile them up
    if (pages.size > KEEP) {
      const old = pages.keys().next().value!;
      pages.delete(old);
      readied.delete(old);
    }
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
      // Only faces this document lacks are added, one rule each. Defining a face again (the surah heading font comes
      // with every page) would make a fresh, unloaded face the one in use, and everything set in it would blank out
      // until it loaded: the heading bands blinked after each turn onwards, when the next pair is fetched ahead.
      const families = new Set<string>();
      const known = new Set([...document.fonts].map((f) => f.family.replace(/^"|"$/g, "")));
      d.head.querySelectorAll("style").forEach((st) => {
        for (const rule of st.textContent!.match(/@font-face\{[^}]*\}/g) ?? []) {
          const family = /font-family:"([^"]+)"/.exec(rule)?.[1];
          if (!family) continue;
          families.add(family);
          if (known.has(family)) continue;
          known.add(family);
          document.head.append(Object.assign(document.createElement("style"), { textContent: rule }));
        }
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
  to = firstOf(Math.min(604, Math.max(1, to))); // held to the mushaf first, so past the last pair is the last pair itself
  if (to === firstOf(wanted)) return;
  wanted = to;
  if (to === firstOf(pageNo)) return layout(); // turned there and back before the page arrived
  // the bar answers at once, before the page arrives
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
  const from = pageNo;
  const before = moving() ? snapshot() : null;
  root.dataset.page = next.dataset.page;
  root.dataset.first = next.dataset.first;
  stage.innerHTML = next.querySelector(".stage")!.innerHTML;
  data = JSON.parse(json.textContent!) as PageData;
  $("page-data").textContent = json.textContent;
  pageNo = Number(next.dataset.page);
  articles = [...stage.querySelectorAll<HTMLElement>(".mpage")];
  [firstS, firstA] = root.dataset.first!.split(":").map(Number);
  hovered = null;
  document.title = doc.title;
  // the page's heading in words and its link to the text ([n].astro), and what the head says about it
  for (const sel of [":scope > h1", ":scope > h1 + p"]) root.querySelector(sel)?.replaceWith(next.querySelector(sel)!.cloneNode(true));
  for (const sel of ['link[rel="canonical"]', 'meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'script[type="application/ld+json"]']) {
    const fresh = doc.head.querySelectorAll(sel);
    document.head.querySelectorAll(sel).forEach((el, i) => fresh[i] && el.replaceWith(document.importNode(fresh[i], true)));
  }
  if (push) history.pushState({ page: pageNo }, "", `/page/${pageNo}`);
  layout();
  if (before) flip(before, pageNo > from ? 1 : -1);
  remember(firstS, firstA);
  afterShown(prefetch);
}

// ---------- the turn itself ----------
// In the open pair a page turns like the printed book's: onwards (the next page lies to the left in a right-to-left
// mushaf) the left page lifts at the spine and turns over onto the right, its back the new right page, uncovering
// the new left page beneath it; back, the right page turns over onto the left. A single page has no spine to turn
// on, so it moves like a sheet off a stack: onwards it slides away to the right and the next rises from just beneath
// it; back, the one before slides in from the right over it and the page being left settles into the stack. Nothing
// fades and no light or shadow moves with it. A turn pressed while one is running finishes it at once, so a fast
// flick never queues.
type Shot = HTMLElement[];
// The pages on screen, copied before they are replaced, each with its size, padding and edges fixed so a copy lays out
// and looks exactly as the page did: the padding is a share of the pair's width, not of its own, and in the pair a
// page has no rule and square corners at the spine.
function copyOf(a: HTMLElement) {
  const c = a.cloneNode(true) as HTMLElement;
  const cs = getComputedStyle(a);
  c.classList.remove("facing");
  c.classList.add("ready"); // a turn waits for the new page's fonts, so its copy shows its words, not the placeholder
  c.dataset.side = a === a.parentElement!.firstElementChild ? "right" : "left"; // its edges follow its side, not its place in the turn
  c.removeAttribute("aria-label");
  c.setAttribute("aria-hidden", "true");
  c.querySelectorAll(".hover, .sel").forEach((g) => g.classList.remove("hover", "sel"));
  Object.assign(c.style, {
    width: `${a.offsetWidth}px`, height: `${a.offsetHeight}px`, padding: cs.padding, borderWidth: cs.borderWidth, borderRadius: cs.borderRadius,
  });
  return c;
}
const snapshot = (): Shot => shown().map(copyOf);

let flipEnd: (() => void) | null = null;
function flip(old: Shot, dir: 1 | -1) {
  flipEnd?.();
  const now = shown(); // reading order: in the pair, the right page first
  const box = root.getBoundingClientRect();
  const place = (el: HTMLElement, at: HTMLElement) => {
    const r = at.getBoundingClientRect();
    Object.assign(el.style, { left: `${r.left - box.left}px`, top: `${r.top - box.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    return el;
  };
  const layer = document.createElement("div");
  layer.className = "flip";
  layer.setAttribute("aria-hidden", "true");
  root.append(layer);

  const pair = now.length === 2 && old.length === 2;
  if (!pair) return slide(old[0], now[0], dir, layer, place);
  layer.append(Object.assign(place(document.createElement("i"), stage), { className: "flip-spine" }));
  // which side turns: onwards the left page (index 1), back the right (index 0)
  const side = dir > 0 ? 1 : 0;
  const leaf = place(document.createElement("div"), now[side]);
  leaf.className = "leaf";
  // the page being left on the other side stays until the leaf lands on it
  layer.append(place(Object.assign(old[1 - side], { className: old[1 - side].className + " still" }), now[1 - side]));
  const back = copyOf(now[1 - side]);
  back.classList.add("back");
  leaf.append(old[side], back);
  layer.append(leaf);
  gsap.set(leaf, { transformOrigin: dir > 0 ? "100% 50%" : "0% 50%", rotationY: 0 }); // hinged at the spine
  const tween = gsap.to(leaf, { rotationY: dir > 0 ? 180 : -180, duration: 0.9, ease: "power2.inOut", onComplete: () => flipEnd?.() });
  flipEnd = () => {
    tween.kill();
    layer.remove();
    flipEnd = null;
  };
}

// One page, a sheet off the stack. The sheet on top moves the width of the screen; the one beneath sits a little
// smaller, as if lower in the stack, and comes up to full size.
function slide(old: HTMLElement, now: HTMLElement, dir: 1 | -1, layer: HTMLElement, place: (el: HTMLElement, at: HTMLElement) => HTMLElement) {
  const away = innerWidth - now.getBoundingClientRect().left + 24; // clear of the screen's right edge
  const depth = 0.97;
  let top: gsap.core.Tween, beneath: gsap.core.Tween;
  if (dir > 0) {
    // the page being left slides off to the right; the new one, already in place, rises beneath it
    layer.append(place(old, now));
    top = gsap.to(old, { x: away, rotation: 1.2, transformOrigin: "0% 100%", duration: 0.7, ease: "power2.inOut" });
    beneath = gsap.fromTo(now, { scale: depth }, { scale: 1, duration: 0.7, ease: "power1.inOut", clearProps: "transform" }); // rising as it is uncovered
  } else {
    // the page before slides in from the right over the page being left, which settles back beneath it
    const leaving = place(Object.assign(old, { className: old.className + " still" }), now);
    const coming = place(copyOf(now), now);
    layer.append(leaving, coming);
    beneath = gsap.to(leaving, { scale: depth, duration: 0.7, ease: "power2.out" });
    top = gsap.fromTo(coming, { x: away, rotation: 1.2, transformOrigin: "0% 100%" }, { x: 0, rotation: 0, duration: 0.75, ease: "power3.out" });
  }
  top.eventCallback("onComplete", () => flipEnd?.());
  flipEnd = () => {
    top.kill();
    beneath.kill();
    gsap.set(now, { clearProps: "transform" });
    layer.remove();
    flipEnd = null;
  };
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
  // ⌘← and ⌥← are the browser's own; the index and settings panels keep their keys too (a panel just closed may still
  // hold focus for a moment, but it is aria-hidden by then and its keys are no longer its own)
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || (e.target as Element).closest?.('[role="dialog"]:not([aria-hidden="true"])') || document.querySelector("dialog[open], .drawer.on") || sheetOpen()) return;
  if (e.key === "ArrowLeft") go("next");
  if (e.key === "ArrowRight") go("prev");
});
let touch: { x: number; y: number } | null = null;
stage.addEventListener("touchstart", (e) => (touch = e.touches.length > 1 ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true }); // a pinch is no swipe
stage.addEventListener("touchend", (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? "next" : "prev");
});

// ---------- the surah ruler ----------
// The mushaf as a row of lines: all 114 surahs at once, one line each, all alike but for the one being read, which is
// gold; the first on the right. Press anywhere on the row and drag: the gold moves with the pointer, naming each surah
// it passes, and letting go turns the mushaf there (a tap is a drag that never moved). ← → and the mouse wheel step one
// surah at a time and turn once the stepping pauses. Turning pages moves the gold along (layout).
const surahAt = (x: number) => {
  const r = track.getBoundingClientRect();
  return Math.min(114, Math.max(1, Math.floor(((r.right - x) / r.width) * 114) + 1)); // RTL: the first on the right
};
// the surah the reader is choosing, lit, with its name
function preview(s: number) {
  rlName.textContent = `سورة ${ticks[s - 1].dataset.name}`;
  rulerTo(s);
}
// Choosing a surah goes to where it starts. Only when that page is already showing do the pages stay put (the gold
// line just moves to it): a surah that merely continues on these pages is still turned back to its beginning.
function commit(s: number) {
  chosen = s;
  const start = Number(ticks[s - 1].dataset.p);
  if (shown().some((a) => Number(a.dataset.page) === start)) layout();
  else turn(start);
}
let dragging = false;
track.addEventListener("pointerdown", (e) => {
  if (!e.isPrimary || e.button !== 0) return; // a real press only
  dragging = true;
  peeking = 0;
  ruler.classList.remove("pointing");
  track.setPointerCapture(e.pointerId);
  ruler.classList.add("dragging");
  preview(surahAt(e.clientX));
});
track.addEventListener("pointermove", (e) => {
  if (dragging) preview(surahAt(e.clientX));
});
// pointing (a mouse, not dragging): the label above moves to the line under the pointer and names it, quieter, until
// the pointer leaves
let peeking = 0;
track.addEventListener("pointermove", (e) => {
  if (dragging || e.pointerType !== "mouse") return;
  const s = surahAt(e.clientX);
  if (s === peeking) return;
  peeking = s;
  if (s === rulerAt) return void (ruler.classList.remove("pointing"), layout());
  rlName.textContent = `سورة ${ticks[s - 1].dataset.name}`;
  pillTo(s);
  ruler.classList.add("pointing");
});
track.addEventListener("pointerleave", () => {
  peeking = 0;
  if (!ruler.classList.contains("pointing")) return;
  ruler.classList.remove("pointing");
  layout(); // the label goes back to the surah being read
});
const release = () => {
  if (!dragging) return;
  dragging = false;
  ruler.classList.remove("dragging");
  commit(rulerAt);
};
track.addEventListener("pointerup", release);
track.addEventListener("pointercancel", release);
// stepping: each press moves the light at once, the mushaf follows when the presses stop
let stepTimer = 0;
const stepBy = (d: number) => {
  preview(Math.min(114, Math.max(1, rulerAt + d)));
  clearTimeout(stepTimer);
  stepTimer = window.setTimeout(() => commit(rulerAt), 450);
};
// ← → (left is onwards), Home and End; the page-turning arrows are not touched
track.addEventListener("keydown", (e) => {
  const d = { ArrowLeft: 1, ArrowRight: -1, Home: 1 - rulerAt, End: 114 - rulerAt }[e.key];
  if (d === undefined) return;
  e.preventDefault();
  e.stopPropagation();
  stepBy(d);
});
// the wheel steps too (scrolling down moves on through the mushaf)
let wheelSum = 0;
ruler.addEventListener("wheel", (e) => {
  e.preventDefault();
  wheelSum += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : -e.deltaX;
  if (Math.abs(wheelSum) < 40) return;
  stepBy(Math.sign(wheelSum));
  wheelSum = 0;
}, { passive: false });

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

// ---------- the first visit: say that every word opens its verse, once for good ----------
if (!load("tapped", false)) {
  stage.addEventListener("click", () => save("tapped", true), { once: true });
  // not over the index or the settings, which the hint would cover on a phone
  setTimeout(() => {
    if (load("tapped", false) || sheetOpen() || document.querySelector(".drawer.on, #settings:not([hidden])")) return;
    save("tapped", true); // having been said, it is not said again, whether or not a word was tapped
    toast("اضغط أي كلمة لتقرأ آيتها وتفسيرها", 4200);
  }, 1400);
}
