// The home page: the continue-reading card and its ring, the surah filter and the back-to-top button.
import { ar } from "../lib/arabic";
import { warmPage } from "../lib/page-fonts";
import { lastReadHref, load, type LastRead } from "../lib/storage";
import { whenIdle } from "../lib/ui";

// ---------- continue reading ----------
const card = document.getElementById("continue") as HTMLAnchorElement;
const names: string[] = JSON.parse(card.dataset.names!);
const startPages: number[] = JSON.parse(card.dataset.pages!);
const last = load<LastRead | null>("last", null);
let progress = 0;
if (last && names[last.s - 1]) {
  const page = last.p ?? startPages[last.s - 1];
  progress = page / 604;
  card.href = lastReadHref(last);
  document.getElementById("continue-eyebrow")!.textContent = "تابع من حيث توقفت";
  document.getElementById("continue-title-text")!.textContent = `سورة ${names[last.s - 1]}`;
  document.getElementById("continue-sub")!.textContent = `الآية ${ar(last.a)}، الصفحة ${ar(page)} من ٦٠٤`;
  document.getElementById("continue-cta")!.textContent = "تابع القراءة";
  // a returning reader sees the percentage; a new one keeps the star
  document.getElementById("ring-pct")!.hidden = false;
  card.querySelector(".ring-star")?.remove();
}
// the likeliest next tap: once the home page is idle, the continue-reading page's fonts download
whenIdle(() => {
  const m = /^\/page\/(\d{1,3})/.exec(card.getAttribute("href")!);
  if (m) warmPage(Number(m[1]));
});
const pct = Math.round(progress * 100);
const ringBar = document.getElementById("ring-bar")!;
const ringPct = document.getElementById("ring-pct")!;
if (last) {
  ringBar.closest(".ring")?.classList.add("on");
  ringPct.textContent = `${ar(pct)}٪`;
}
ringBar.style.strokeDashoffset = String(100 - Math.max(progress * 100, last ? 1.5 : 0));

// ---------- surah filter ----------
const grid = document.getElementById("surah-grid")!;
const cards = [...grid.querySelectorAll<HTMLElement>(".surah-card")];
const count = document.getElementById("surah-count")!;
document.querySelectorAll<HTMLElement>("[data-filter]").forEach((chip) =>
  chip.addEventListener("click", () => {
    const want = chip.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    cards.forEach((c) => (c.hidden = !!want && c.dataset.place !== want));
    const shown = cards.filter((c) => !c.hidden).length;
    const label = chip.firstChild!.textContent!.trim();
    count.textContent = want ? `${label}: ${ar(shown)} سورة` : `${ar(shown)} سورة`;
  }),
);

// ---------- back to top: offered once the reader has rested at the very bottom for five seconds ----------
// It goes away again when pressed or scrolled off screen, and the five seconds start over on the next visit.
const toTop = document.getElementById("to-top")!;
let restTimer = 0;
const watchBottom = () => {
  const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  if (atBottom && !restTimer && !toTop.classList.contains("on")) {
    restTimer = window.setTimeout(() => {
      restTimer = 0;
      toTop.classList.add("on");
    }, 5000);
  } else if (!atBottom && restTimer) {
    clearTimeout(restTimer);
    restTimer = 0;
  }
};
addEventListener("scroll", watchBottom, { passive: true });
addEventListener("resize", watchBottom);
watchBottom();
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) toTop.classList.remove("on");
}).observe(toTop);
toTop.addEventListener("click", () => {
  toTop.classList.remove("on");
  scrollTo({ top: 0 });
  // keyboard focus follows the reader back up to the first control
  document.querySelector<HTMLElement>(".hd a, .hd button")?.focus({ preventScroll: true });
});
