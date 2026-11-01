// Motion shared by every page: the pill that slides between segments, the page arrows leaning toward the pointer,
// things rising into view as the page scrolls, counts that run up, and the home cover's opening. It is a mushaf:
// everything moves slowly and settles, nothing bounces or springs for show. Everything here is decoration over a page
// that already works without it; under reduced motion only the static parts run (the pill still moves, instantly).
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ar } from "../lib/arabic";

declare global {
  interface Window { __motion?: boolean }
}
window.__motion = true;
gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
export const moving = () => root.classList.contains("motion") && !reduce.matches;

// ---------- segmented controls: one pill slides to the pressed segment ----------
function pill(seg: HTMLElement) {
  const p = document.createElement("i");
  p.className = "seg-pill";
  p.setAttribute("aria-hidden", "true");
  seg.prepend(p);
  seg.classList.add("pilled");
  let shown = false;
  const place = (animate: boolean) => {
    const on = seg.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!on || !seg.offsetWidth) return;
    const to = { x: on.offsetLeft, width: on.offsetWidth };
    if (animate && shown && !reduce.matches) gsap.to(p, { ...to, duration: 0.42, ease: "power3.out", overwrite: true });
    else gsap.set(p, to);
    shown = true;
  };
  new MutationObserver(() => place(true)).observe(seg, { attributes: true, subtree: true, attributeFilter: ["aria-pressed"] });
  // a segment that was hidden (a closed panel) is placed without a slide when it shows; a slide under way is left to
  // finish rather than snapped
  new ResizeObserver(() => gsap.isTweening(p) || place(false)).observe(seg);
  place(false);
}
document.querySelectorAll<HTMLElement>(".seg").forEach(pill);

// ---------- the page arrows lean a little toward the pointer, slowly, and settle back when it leaves ----------
if (fine.matches && moving()) {
  document.querySelectorAll<HTMLElement>("[data-lean]").forEach((area) => {
    const el = (area.firstElementChild as HTMLElement | null) ?? area;
    const x = gsap.quickTo(el, "x", { duration: 0.9, ease: "power2.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.9, ease: "power2.out" });
    area.addEventListener("pointermove", (e) => {
      const r = area.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.14);
      y((e.clientY - (r.top + r.height / 2)) * 0.18);
    });
    area.addEventListener("pointerleave", () => (x(0), y(0)));
  });
}

// ---------- counts run up when they come into view ----------
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  if (!moving()) return void (el.textContent = ar(to));
  const n = { v: 0 };
  el.textContent = ar(0);
  ScrollTrigger.create({
    trigger: el, start: "top 90%", once: true,
    onEnter: () => gsap.to(n, { v: to, duration: 1.6, ease: "power3.out", onUpdate: () => { el.textContent = ar(Math.round(n.v)); } }),
  });
}
document.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);

// ---------- things rise into view ----------
const reveal = (els: Element[]) => {
  els.forEach((el) => el.classList.add("in"));
  gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.045, overwrite: true, clearProps: "transform" });
};
if (moving()) {
  const items = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  if (items.length) {
    gsap.set(items, { y: 28 });
    ScrollTrigger.batch(items, { start: "top 92%", once: true, onEnter: reveal });
  }
} else {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
}

// ---------- the home cover opens ----------
const cover = document.getElementById("cover");
if (cover && moving()) {
  const title = cover.querySelector<HTMLElement>("[data-hero-title] span")!;
  const rest = [...cover.querySelectorAll<HTMLElement>("[data-hero]")];
  const paths = (sel: string) => cover.querySelectorAll(`${sel} path:not(.tr)`);
  const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.1 });
  tl.fromTo(title,
    { opacity: 1, clipPath: "inset(-30% -10% -45% 100%)", filter: "blur(16px)", y: 18 },
    { clipPath: "inset(-30% -10% -45% -10%)", filter: "blur(0px)", y: 0, duration: 1.5, ease: "expo.out", clearProps: "clipPath,filter" })
    .fromTo(rest[0], { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.9 }, 0.15)
    .fromTo(rest.slice(1), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12, clearProps: "transform" }, 0.55);

  // The rosette unfolds from its heart: the star turns up out of a soft light, a faint ring of light passes outward to
  // where the pattern will reach, and the rings are drawn from the centre out, each sweeping round into place as it is
  // drawn and settling without overshoot. Then the light comes up on the gold and begins to travel its lines. Both
  // copies (the drawing and its lit twin) move together.
  const q = (sel: string) => cover.querySelectorAll(sel);
  const O = { svgOrigin: "300 300" };
  tl.fromTo(q(".ro-core"), { opacity: 0, scale: 0.4, rotation: -90, ...O }, { opacity: 1, scale: 1, rotation: 0, duration: 2.2, ease: "expo.out" }, 0.1)
    .fromTo(q(".ro-glow"), { opacity: 0, scale: 0.4, ...O }, { opacity: 1, scale: 1, duration: 2.2, ease: "expo.out" }, 0.1)
    .fromTo(q(".ro-wave"), { opacity: 0.8, scale: 0.6, ...O }, { opacity: 0, scale: 7.4, duration: 2.4, ease: "power2.out" }, 0.35);
  ([["inner", -75, 0.35, 1.6, 0.012], ["middle", 50, 0.6, 1.8, 0.02], ["outer", -30, 0.85, 2, 0.004]] as const).forEach(([ring, from, at, d, each]) => {
    tl.fromTo(q(`.ro-${ring}`), { rotation: from, scale: 0.9, ...O }, { rotation: 0, scale: 1, duration: d + 1.2, ease: "expo.out" }, at)
      .to(paths(`.ro-${ring}`), { strokeDashoffset: 0, duration: d, ease: "power2.inOut", stagger: each }, at);
  });
  tl.to(q(".ro-lit"), { opacity: 1, duration: 2, ease: "power1.inOut" }, 1.9)
    .to(q(".rosette .tr"), { opacity: 0.9, duration: 2.4, ease: "power1.inOut" }, 2.6);

  // At rest the whole rosette turns very slowly (home.css) while light travels its lines; every few seconds the two
  // inner rings turn one notch of the pattern against each other and come to rest in the same figure. The heart's light
  // rises and falls like breath. All of it sleeps while the cover is off screen.
  const idle = [
    gsap.timeline({ paused: true, repeat: -1, defaults: { duration: 3.2, ease: "sine.inOut" } })
      .to(q(".ro-inner"), { rotation: "+=45" }, 6) // six seconds at rest first, every time round
      .to(q(".ro-middle"), { rotation: "-=45" }, 6),
    gsap.to(q(".ro-glow"), { paused: true, scale: 1.12, opacity: 0.75, duration: 4.5, ease: "sine.inOut", yoyo: true, repeat: -1 }),
  ];
  let awake = true;
  tl.call(() => idle.forEach((t) => awake && t.play()), [], 3.2);
  ScrollTrigger.create({
    trigger: cover, start: "top bottom", end: "bottom top",
    onToggle: ({ isActive }) => {
      awake = isActive;
      cover.classList.toggle("asleep", !isActive);
      if (tl.progress() === 1) idle.forEach((t) => (isActive ? t.play() : t.pause()));
    },
  });

  // the rosette and its glow drift a little against the pointer, as if lit from where it is
  if (fine.matches) {
    const to = (el: Element, prop: string, duration: number) => gsap.quickTo(el, prop, { duration, ease: "power2.out" });
    const stage = cover.querySelector(".ro-stage")!, halo = cover.querySelector(".halo")!;
    const ax = to(stage, "x", 2), ay = to(stage, "y", 2), hx = to(halo, "x", 2.6), hy = to(halo, "y", 2.6);
    cover.addEventListener("pointermove", (e) => {
      const r = cover.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      ax(nx * -14), ay(ny * -14), hx(nx * 24), hy(ny * 24);
    });
  }
  // the cover sinks back a little as the page scrolls over it. Only moved, never faded: an ancestor below full opacity
  // would switch off the console's backdrop blur
  gsap.to(cover.querySelector(".cover-inner"), {
    yPercent: 10, ease: "none",
    scrollTrigger: { trigger: cover, start: "top top", end: "bottom top", scrub: true },
  });
} else if (cover) {
  cover.querySelectorAll<SVGPathElement>(".rosette path:not(.tr)").forEach((p) => (p.style.strokeDashoffset = "0"));
}

// late layout (fonts arriving) moves the trigger points
document.fonts?.ready.then(() => ScrollTrigger.refresh());
