// Motion shared by every page: the pill that slides between segments, buttons that lean toward the pointer, things
// rising into view as the page scrolls, counts that run up, and the home cover's opening. Everything here is decoration
// over a page that already works without it; under reduced motion only the static parts run (the pill still moves,
// instantly).
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

// ---------- buttons that lean toward the pointer ----------
if (fine.matches && moving()) {
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((own) => {
    const area = own.closest<HTMLElement>("a, button") ?? own;
    // a button that is itself magnetic keeps still (its press shrinks it) and its icon leans instead
    const el = own === area ? (own.firstElementChild as HTMLElement | null) ?? own : own;
    const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    area.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.22);
      y((e.clientY - (r.top + r.height / 2)) * 0.3);
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
  gsap.set(items, { y: 28 });
  ScrollTrigger.batch(items, { start: "top 92%", once: true, onEnter: reveal });
} else {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
}

// ---------- the home cover opens ----------
const cover = document.getElementById("cover");
if (cover && moving()) {
  const title = cover.querySelector<HTMLElement>("[data-hero-title] span")!;
  const rest = [...cover.querySelectorAll<HTMLElement>("[data-hero]")];
  const paths = (sel: string) => cover.querySelectorAll(`${sel} path`);
  const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.1 });
  tl.fromTo(title,
    { opacity: 1, clipPath: "inset(-30% -10% -45% 100%)", filter: "blur(16px)", y: 18 },
    { clipPath: "inset(-30% -10% -45% -10%)", filter: "blur(0px)", y: 0, duration: 1.5, ease: "expo.out", clearProps: "clipPath,filter" })
    .fromTo(rest[0], { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.9 }, 0.15)
    .fromTo(rest.slice(1), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12, clearProps: "transform" }, 0.55)
    .to(paths(".ro-outer"), { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut", stagger: 0.04 }, 0.1)
    .to(paths(".ro-middle"), { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", stagger: 0.05 }, 0.45)
    .to(paths(".ro-inner"), { strokeDashoffset: 0, duration: 2, ease: "power2.inOut", stagger: 0.025 }, 0.8)
    .fromTo(".ro-core", { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 1.4, ease: "elastic.out(1, 0.6)" }, 2);

  // the rosette and its glow drift against the pointer, as if lit from where it is
  if (fine.matches) {
    const art = cover.querySelector<HTMLElement>(".rosette")!;
    const halo = cover.querySelector<HTMLElement>(".halo")!;
    const ax = gsap.quickTo(art, "x", { duration: 1.2, ease: "power3.out" });
    const ay = gsap.quickTo(art, "y", { duration: 1.2, ease: "power3.out" });
    const hx = gsap.quickTo(halo, "x", { duration: 1.6, ease: "power3.out" });
    const hy = gsap.quickTo(halo, "y", { duration: 1.6, ease: "power3.out" });
    cover.addEventListener("pointermove", (e) => {
      const r = cover.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      ax(nx * -22), ay(ny * -22), hx(nx * 40), hy(ny * 40);
    });
  }
  // the cover sinks back a little as the page scrolls over it. Only moved, never faded: an ancestor below full opacity
  // would switch off the console's backdrop blur
  gsap.to(cover.querySelector(".cover-inner"), {
    yPercent: 10, ease: "none",
    scrollTrigger: { trigger: cover, start: "top top", end: "bottom top", scrub: true },
  });
} else if (cover) {
  cover.querySelectorAll<SVGPathElement>(".rosette path").forEach((p) => (p.style.strokeDashoffset = "0"));
}

// late layout (fonts arriving) moves the trigger points
document.fonts?.ready.then(() => ScrollTrigger.refresh());
