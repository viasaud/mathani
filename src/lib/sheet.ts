// The verse sheet: one verse with its tafsir, opened from a mushaf page or a text view.
import { gsap } from "gsap";
import { ar } from "./arabic";
import { $, copyVerse, copyVerseLink, hideScrim, hideToast, showScrim, trapTab } from "./ui";

export type SheetVerse = {
  s: number;
  a: number;
  surahName: string;
  sub?: string; // e.g. the page number
  verse: { html: string; font?: string; glyphs?: boolean } | { text: string; font?: string }; // page glyphs, or Uthmani text markup
  plain: string; // for copying
  label: string;
  tafsir: string;
  marks?: HTMLElement[]; // the verse on the page behind, highlighted while the sheet is open
};

type Handlers = { prev?: () => void; next?: () => void; onClose?: () => void };

const sheet = () => $("vsheet");
let handlers: Handlers = {};
let current: SheetVerse | null = null;
let opener: HTMLElement | null = null;
let marked: HTMLElement[] = [];

// The verse stays in sight above the sheet, tinted, so the tafsir is read beside its words. A short page has no
// room to scroll a low verse above the sheet, so the page is given that room while the sheet is open.
const doc = document.documentElement;
let room = 0;
const setRoom = (px: number) => { room = px; document.body.style.paddingBottom = px ? `${px}px` : ""; };
// The pages view doesn't scroll: there the page itself is lifted clear of the sheet, and set back down after.
let lift = 0;
const lifter = () => document.querySelector<HTMLElement>("[data-fit-shift]");

// Where the marked verse sits: its top and bottom, how far down the room above the sheet reaches, and where the
// top controls end.
function measure(els: HTMLElement[]) {
  const rects = els.map((m) => m.getBoundingClientRect());
  return {
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
    free: innerHeight - sheet().offsetHeight - 16,
    hd: Math.max(document.getElementById("hd")?.getBoundingClientRect().bottom ?? 0, 0),
  };
}

function mark(els: HTMLElement[]) {
  marked.forEach((m) => m.classList.remove("sel"));
  marked = els;
  els.forEach((m) => m.classList.add("sel"));
  const fit = lifter();
  if (fit) {
    if (els.length) {
      const { top, bottom, free, hd } = measure(els);
      // up as far as needed, but never so far that the verse's first line goes under the top controls
      if (bottom > free) lift += Math.min(bottom - free, top - hd - 12);
      else if (top < hd + 8) lift = Math.max(0, lift - (hd + 24 - top));
    } else lift = 0;
    fit.style.transform = lift > 0 ? `translateY(${-lift}px)` : "";
    return;
  }
  if (!els.length) {
    if (!room) return;
    // let the page settle back down as the sheet leaves, then take the extra room away
    const extra = room;
    room = 0;
    const max = doc.scrollHeight - extra - innerHeight;
    if (scrollY > max) window.scrollTo(0, Math.max(0, max));
    setTimeout(() => room || setRoom(0), 450);
    return;
  }
  const { top, bottom, free, hd } = measure(els);
  const by = bottom > free ? Math.min(bottom - free, top - hd - 16) : top < hd + 8 ? top - hd - 24 : 0;
  if (Math.abs(by) <= 4) return;
  // body padding counts inside its min-height, so add room, measure, and add the shortfall
  for (let i = 0; i < 2 && by > doc.scrollHeight - innerHeight - scrollY; i++) {
    setRoom(room + Math.ceil(by - (doc.scrollHeight - innerHeight - scrollY)) + 8);
  }
  window.scrollTo(0, scrollY + by);
}

export const sheetOpen = () => sheet().classList.contains("on");

export function openSheet(v: SheetVerse, h: Handlers) {
  // moving to the next or previous verse slides the new one in from its side (RTL: onwards comes from the left)
  const step = current && sheetOpen() ? Math.sign(v.s - current.s || v.a - current.a) : 0;
  current = v;
  handlers = h;
  $("vs-ref").innerHTML = `<span class="r-s">سورة ${v.surahName}</span> <span class="nowrap">الآية ${ar(v.a)}</span>${v.sub ? ` <small class="nowrap">${v.sub}</small>` : ""}`;
  const box = $("vs-verse");
  box.className = "vs-verse" + ("html" in v.verse && !v.verse.glyphs ? "" : " glyphs");
  box.style.fontFamily = v.verse.font ?? "";
  if ("html" in v.verse) box.innerHTML = v.verse.html;
  else box.textContent = v.verse.text;
  $("vs-label").textContent = v.label;
  $("vs-taf").textContent = v.tafsir || "لا يتوفر تفسير لهذه الآية.";
  $<HTMLButtonElement>("vs-prev").disabled = !h.prev;
  $<HTMLButtonElement>("vs-next").disabled = !h.next;
  const el = sheet();
  if (!sheetOpen()) {
    opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    el.classList.add("on");
    el.setAttribute("aria-hidden", "false");
    hideToast();
    showScrim(closeSheet);
    el.focus({ preventScroll: true }); // so a keyboard user continues inside the sheet, not behind it
  }
  const body = el.querySelector<HTMLElement>(".vs-body")!;
  body.scrollTop = 0;
  if (step && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.fromTo(body.children, { x: -step * 28, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.06, overwrite: true, clearProps: "transform,opacity" });
  }
  mark(v.marks ?? []);
}

export function closeSheet() {
  if (!sheetOpen()) return;
  const el = sheet();
  el.classList.remove("on");
  el.setAttribute("aria-hidden", "true");
  hideScrim();
  mark([]);
  handlers.onClose?.();
  current = null;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}

// wiring, once per page
export function initSheet() {
  $("vs-close").addEventListener("click", closeSheet);
  $("vs-prev").addEventListener("click", () => handlers.prev?.());
  $("vs-next").addEventListener("click", () => handlers.next?.());
  $("vs-copy").addEventListener("click", (e) => current && copyVerse(current.plain, current.surahName, current.a, e.currentTarget as Element));
  $("vs-link").addEventListener("click", (e) => current && copyVerseLink(current.s, current.a, e.currentTarget as Element));
  document.addEventListener("keydown", (e) => {
    // a dialog over the sheet (the search, the shortcuts) keeps its own keys: Esc, the caret, Tab
    if (!sheetOpen() || document.querySelector("dialog[open]")) return;
    if (e.key === "Escape") closeSheet();
    trapTab(sheet(), e);
    // RTL: the next verse is to the left
    if (e.key === "ArrowLeft" && handlers.next) { e.preventDefault(); e.stopImmediatePropagation(); handlers.next(); }
    if (e.key === "ArrowRight" && handlers.prev) { e.preventDefault(); e.stopImmediatePropagation(); handlers.prev(); }
  }, true);

  // drag the handle (or the header) down to dismiss: far enough, or a quick flick, lets it go; otherwise it springs
  // back. Pulled upwards it gives a little and resists.
  const el = sheet();
  let startY = 0, dy = 0, dragging = false, lastY = 0, lastT = 0, speed = 0;
  const start = (y: number) => { dragging = true; startY = lastY = y; lastT = performance.now(); dy = speed = 0; el.classList.add("dragging"); };
  const move = (y: number) => {
    if (!dragging) return;
    const now = performance.now();
    speed = (y - lastY) / Math.max(1, now - lastT);
    lastY = y;
    lastT = now;
    const raw = y - startY;
    dy = raw > 0 ? raw : raw * 0.18;
    el.style.transform = `translate(-50%, ${dy}px)`;
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("dragging");
    el.style.transform = "";
    if (dy > 110 || (dy > 24 && speed > 0.6)) closeSheet();
  };
  for (const target of [$("vs-handle"), el.querySelector(".vs-head")!]) {
    target.addEventListener("touchstart", (e) => start((e as TouchEvent).touches[0].clientY), { passive: true });
  }
  el.addEventListener("touchmove", (e) => move(e.touches[0].clientY), { passive: true });
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}
