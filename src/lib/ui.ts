// Small browser helpers shared by every page: a toast, copying, and the dimmed backdrop behind panels.
import { ar } from "./arabic";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Run once the browser is idle (Safari has no requestIdleCallback).
export const whenIdle = (f: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(f) : setTimeout(f, 800));

// Keys pressed in a field belong to the field, not to the page's shortcuts.
export const isTyping = (e: Event) => (e.target as HTMLElement).matches("input, textarea, select");

export function toast(message: string, ms = 1800) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast glass glass-panel";
    t.setAttribute("role", "status");
    document.body.append(t);
  }
  t.textContent = message;
  t.hidden = false;
  clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(setTimeout(() => (t!.hidden = true), ms));
}

// A toast still up when a panel takes over the screen (the tap hint, as the verse sheet opens) is put away at once.
export function hideToast() {
  const t = document.getElementById("toast");
  if (!t) return;
  clearTimeout(Number(t.dataset.timer));
  t.hidden = true;
}

// the button pressed shows a check for a moment (.ib.done in global.css)
export function copyText(text: string, done = "نُسخت الآية", button?: Element | null) {
  const fail = () => toast("تعذّر النسخ، حدّد النص وانسخه يدويًا");
  if (!navigator.clipboard) return fail();
  navigator.clipboard.writeText(text).then(() => {
    toast(done);
    if (!button) return;
    button.classList.add("done");
    clearTimeout(Number((button as HTMLElement).dataset.doneTimer));
    (button as HTMLElement).dataset.doneTimer = String(setTimeout(() => button.classList.remove("done"), 1400));
  }, fail);
}

export const copyVerse = (text: string, surahName: string, a: number, button?: Element | null) =>
  copyText(`${text} ﴿${ar(a)}﴾\n[سورة ${surahName}: ${ar(a)}]`, undefined, button);

export const copyVerseLink = (s: number, a: number, button?: Element | null) =>
  copyText(`${location.origin}/surah/${s}#a${a}`, "نُسخ رابط الآية", button);

// A verse a link pointed to is marked in gold for a moment when the page opens on it.
export function flash(els: Element[]) {
  els.forEach((el) => el.classList.add("flash"));
  setTimeout(() => els.forEach((el) => el.classList.remove("flash")), 1200);
}

// One backdrop serves the index drawer and the verse sheet; whoever opened it is told when it is tapped.
let onScrimTap: (() => void) | null = null;
export function showScrim(onTap: () => void) {
  const scrim = document.getElementById("scrim")!;
  onScrimTap = onTap;
  scrim.classList.add("on");
  scrim.onclick = () => onScrimTap?.();
  document.body.style.overflow = "hidden";
}
export function hideScrim() {
  document.getElementById("scrim")?.classList.remove("on");
  onScrimTap = null;
  document.body.style.overflow = "";
}

// Keep Tab inside an open panel (the drawer, the verse sheet, the settings): the last control wraps to the first.
export function trapTab(panel: HTMLElement, e: KeyboardEvent, wrapTo?: HTMLElement) {
  if (e.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); (wrapTo ?? last).focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); (wrapTo ?? first).focus(); }
}

export const STAR_SVG =
  '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="10.5" y="10.5" width="27" height="27"/><rect x="10.5" y="10.5" width="27" height="27" transform="rotate(45 24 24)"/></g></svg>';

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
