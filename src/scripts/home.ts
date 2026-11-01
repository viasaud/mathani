// The home page: the cover (its live gilt and the header's tone over it), the continue button and the line under it
// saying where the reader stopped, the juz they are in, the surah filter and the back-to-top button.
import { gsap } from "gsap";
import { ar } from "../lib/arabic";
import { warmPage } from "../lib/page-fonts";
import { lastReadHref, load, type LastRead } from "../lib/storage";
import { whenIdle } from "../lib/ui";
import { moving } from "./motion";

const root = document.documentElement;

// ---------- the cover ----------
// The header turns to dark glass while it floats over the cover, and back to paper once the cover has scrolled away.
const cover = document.getElementById("cover")!;
const header = document.getElementById("hd")!;
const tone = () => root.classList.toggle("on-cover", cover.getBoundingClientRect().bottom > header.offsetHeight * 0.6);
addEventListener("scroll", tone, { passive: true });
tone();

// ---------- the tones ----------
// The tones' capsule in the header is wired in shell.ts. On a phone it shows only the tone in use, and a tap on it turns
// to the next. Whenever the tone changes, from there or anywhere else, the rosette answers with a slow turn of one notch,
// back to the same figure.
const rosette = document.getElementById("rosette")!;
const narrow = matchMedia("(max-width: 640px)");
const toneButtons = [...document.querySelectorAll<HTMLButtonElement>(".cap-tone")];
let turning = false; // the next tone's own click must not turn again
toneButtons.forEach((b, i) =>
  b.addEventListener("click", () => {
    if (turning || !narrow.matches || b.getAttribute("aria-pressed") !== "true") return;
    turning = true;
    toneButtons[(i + 1) % toneButtons.length].click();
    turning = false;
  }),
);
new MutationObserver(() => {
  if (moving()) gsap.to(rosette, { rotation: "+=45", duration: 2.8, ease: "sine.inOut" });
}).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- continue reading ----------
// One pill: for a new reader «ابدأ القراءة, من سورة الفاتحة» with a star; for a returning one «تابع القراءة» over
// the place they stopped, with a ring showing how far into the mushaf that is.
// The place is read again whenever the page is shown: coming Back restores this page as it was when left, and the
// reader may have moved on in another tab since.
const card = document.getElementById("continue") as HTMLAnchorElement;
const names: string[] = JSON.parse(card.dataset.names!);
const startPages: number[] = JSON.parse(card.dataset.pages!);
const juzPages: number[] = JSON.parse(card.dataset.juzPages!);
const ring = card.querySelector<HTMLElement>(".resume-ring")!;
const ringBar = document.getElementById("ring-bar")!;
const ringPct = document.getElementById("ring-pct")!;
const cta = document.getElementById("continue-cta")!;
const whereName = document.getElementById("where-name")!;
const tiles = document.querySelectorAll<HTMLElement>(".juz-tile");
let shownKey = "";
let fill: gsap.core.Tween | undefined;

function paintContinue(animate: boolean) {
  const last = load<LastRead | null>("last", null);
  const key = JSON.stringify(last);
  if (key === shownKey) return;
  shownKey = key;
  fill?.kill();
  tiles.forEach((t) => t.classList.remove("here"));
  if (!last || !names[last.s - 1]) {
    card.href = "/page/1";
    cta.textContent = "ابدأ القراءة";
    whereName.textContent = "من سورة الفاتحة";
    card.setAttribute("aria-label", "ابدأ القراءة من سورة الفاتحة");
    ring.classList.remove("on");
    return;
  }
  const page = last.p ?? startPages[last.s - 1];
  const juz = Math.max(0, juzPages.findLastIndex((p) => p <= page)); // 0-based
  const pct = Math.max(1, Math.round((page / 604) * 100));
  card.href = lastReadHref(last);
  cta.textContent = "تابع القراءة";
  whereName.textContent = `سورة ${names[last.s - 1]}، الآية ${ar(last.a)}`;
  card.setAttribute("aria-label", `تابع القراءة: سورة ${names[last.s - 1]}، الآية ${ar(last.a)}، ${ar(pct)}٪ من المصحف`);
  ring.classList.add("on");
  // the ring fills and the percentage counts up with it
  const run = { p: animate && moving() ? 0 : 1 };
  const paint = () => {
    ringBar.style.strokeDashoffset = String(100 - run.p * pct);
    ringPct.textContent = `${ar(Math.round(run.p * pct))}٪`;
  };
  paint();
  if (run.p < 1) fill = gsap.to(run, { p: 1, duration: 1.6, ease: "power3.inOut", delay: shownOnce ? 0.2 : 1.2, onUpdate: paint });
  // the juz the reader is in, and how far into it
  const to = (juzPages[juz + 1] ?? 605) - 1;
  const here = tiles[juz];
  here.classList.add("here");
  here.style.setProperty("--f", Math.min(1, (page - juzPages[juz] + 1) / (to - juzPages[juz] + 1)).toFixed(3));
}
let shownOnce = false;
paintContinue(true);
shownOnce = true;
addEventListener("pageshow", (e) => e.persisted && paintContinue(true));
addEventListener("storage", (e) => e.key === "mushaf:last" && paintContinue(true));
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && paintContinue(true));
// the likeliest next tap: once the home page is idle, the continue-reading page's fonts download
whenIdle(() => {
  const m = /^\/page\/(\d{1,3})/.exec(card.getAttribute("href")!);
  if (m) warmPage(Number(m[1]));
});

// ---------- surah filter: the chosen surahs settle into view ----------
const grid = document.getElementById("surah-grid")!;
const cards = [...grid.querySelectorAll<HTMLElement>(".surah-card")];
const count = document.getElementById("surah-count")!;
// The grid takes its new shape at once; the cards on screen then come into focus from a soft blur, one after another.
// Nothing slides across the grid (with so many cards changing places that cannot look calm), and nothing fades. A
// press finishes the previous settle first, every card is let in at rest (some may still be waiting to rise into
// view), and the cards' own CSS transitions stand aside meanwhile (.settling), so the two never pull against each other.
let settle: gsap.core.Tween | null = null;
document.querySelectorAll<HTMLElement>("[data-filter]").forEach((chip) =>
  chip.addEventListener("click", () => {
    const want = chip.dataset.filter;
    if (chip.getAttribute("aria-pressed") === "true") return;
    document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    settle?.progress(1).kill();
    gsap.killTweensOf(cards);
    gsap.set(cards, { opacity: 1, clearProps: "transform,filter" });
    cards.forEach((c) => c.classList.add("in"));
    cards.forEach((c) => (c.hidden = !!want && c.dataset.place !== want));
    if (moving()) {
      const inView = cards.filter((c) => {
        if (c.hidden) return false;
        const r = c.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
      });
      grid.classList.add("settling");
      settle = gsap.fromTo(inView, { y: 10, scale: 0.97, filter: "blur(8px)" }, {
        y: 0, scale: 1, filter: "blur(0px)", duration: 0.45, ease: "power3.out", stagger: 0.018, clearProps: "transform,filter",
        onComplete: () => grid.classList.remove("settling"),
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
