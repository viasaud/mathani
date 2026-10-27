// The home page: the cover (its live gilt and the header's tone over it), the continue-reading card and its ring,
// the juz the reader is in, the surah filter and the back-to-top button.
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ar } from "../lib/arabic";
import { warmPage } from "../lib/page-fonts";
import { lastReadHref, load, type LastRead } from "../lib/storage";
import { whenIdle } from "../lib/ui";
import { moving } from "./motion";

gsap.registerPlugin(Flip);
const root = document.documentElement;

// ---------- the cover ----------
// The header turns to dark glass while it floats over the cover, and back to paper once the cover has scrolled away.
const cover = document.getElementById("cover")!;
const header = document.getElementById("hd")!;
const tone = () => root.classList.toggle("on-cover", cover.getBoundingClientRect().bottom > header.offsetHeight * 0.6);
addEventListener("scroll", tone, { passive: true });
tone();
// the gilt lattice is drawn by WebGL; it loads after everything else, and a still pattern stands in until then
import("./cover-gl").then((m) => m.start(document.getElementById("cover-gl") as HTMLCanvasElement, cover)).catch(() => {});

// ---------- continue reading ----------
const card = document.getElementById("continue") as HTMLAnchorElement;
const names: string[] = JSON.parse(card.dataset.names!);
const startPages: number[] = JSON.parse(card.dataset.pages!);
const juzPages: number[] = JSON.parse(card.dataset.juzPages!);
const last = load<LastRead | null>("last", null);
let progress = 0;
let page = 0;
if (last && names[last.s - 1]) {
  page = last.p ?? startPages[last.s - 1];
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
const target = 100 - Math.max(progress * 100, last ? 1.5 : 0);
if (last) ringBar.closest(".ring")?.classList.add("on");
if (last && moving()) {
  // the ring fills and the percentage counts up with it, once the card has risen
  const fill = { p: 0 };
  const paint = () => {
    ringBar.style.strokeDashoffset = String(100 - fill.p * (100 - target));
    ringPct.textContent = `${ar(Math.round(fill.p * pct))}٪`;
  };
  paint();
  gsap.to(fill, { p: 1, duration: 1.8, ease: "power3.inOut", delay: 1.1, onUpdate: paint });
} else {
  if (last) ringPct.textContent = `${ar(pct)}٪`;
  ringBar.style.strokeDashoffset = String(target);
}

// the juz the reader is in
if (page) {
  const j = juzPages.findLastIndex((p) => p <= page);
  document.querySelectorAll(".juz-tile")[j]?.classList.add("here");
}

// ---------- surah filter: the cards that stay glide to their new places ----------
const grid = document.getElementById("surah-grid")!;
const cards = [...grid.querySelectorAll<HTMLElement>(".surah-card")];
const count = document.getElementById("surah-count")!;
document.querySelectorAll<HTMLElement>("[data-filter]").forEach((chip) =>
  chip.addEventListener("click", () => {
    const want = chip.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    // only the cards near the screen take part; the rest just move
    const near = cards.filter((c) => {
      if (c.hidden) return true;
      const r = c.getBoundingClientRect();
      return r.bottom > -innerHeight && r.top < innerHeight * 2;
    });
    const state = moving() ? Flip.getState(near, { props: "opacity" }) : null;
    cards.forEach((c) => (c.hidden = !!want && c.dataset.place !== want));
    if (state) {
      Flip.from(state, {
        targets: near, duration: 0.65, ease: "power3.inOut", stagger: 0.006, absolute: false, nested: false,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.15, ease: "power3.out", clearProps: "transform" }),
      });
    }
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
  scrollTo({ top: 0, behavior: moving() ? "smooth" : "auto" });
  // keyboard focus follows the reader back up to the first control
  document.querySelector<HTMLElement>(".hd a, .hd button")?.focus({ preventScroll: true });
});
