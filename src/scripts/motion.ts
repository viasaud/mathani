// Motion shared by every page: the pill that slides between segments, the page arrows leaning toward the pointer and
// things rising into view as the page scrolls (the home cover's opening is in home.ts). It is a mushaf:
// everything moves slowly and settles, nothing bounces or springs for show. Everything here is decoration over a page
// that already works without it; under reduced motion only the static parts run (the pill still moves, instantly).
import { gsap } from "gsap";

declare global {
  interface Window { __motion?: boolean }
}
window.__motion = true;

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

// ---------- things rise into view ----------
// Whatever comes into view together rises together, one after another.
const reveal = (els: Element[]) => {
  els.forEach((el) => el.classList.add("in"));
  gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.045, overwrite: true, clearProps: "transform" });
};
const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
if (moving() && items.length) {
  gsap.set(items, { y: 28 });
  const io = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    entering.forEach((el) => io.unobserve(el));
    if (entering.length) reveal(entering);
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add("in"));
}
