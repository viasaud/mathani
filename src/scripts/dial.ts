// The phone's wheel: the 114 surahs as a ring set in the dock's glass capsule, one line each and all alike, turned under
// the thumb and seen from its edge. The lines close up and fade as the ring curves away; the gold needle stays still, and
// the surah under it is the one chosen. Drag it, flick it and let it run on and slow to a stop, or tap a line to go there.
// It never overshoots and never springs back, and the mushaf turns only once it has come to rest. Drawn on a canvas.
import { gsap } from "gsap";
import { moving } from "./motion";

const SURAHS = 114;
const SPACE = 14; // how far a surah moves under the thumb, and the gap between lines at the needle
const CLEAR = 6; // left at either end, so the ring curves out of sight just short of the capsule's dividers
const COAST = 325; // ms: how quickly a flick dies away
const MAX_SPEED = 3; // px per ms: what a thumb can do
const LINE = { height: 20, width: 1.25, strength: 0.62 };

const clamp = (n: number) => Math.min(SURAHS, Math.max(1, n));

export function initDial(el: HTMLElement, names: string[], surah: number, onLand: (surah: number) => void) {
  const canvas = el.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const tag = el.querySelector<HTMLElement>(".dial-tag")!;

  const s = { at: surah }; // where the ring stands, a surah and a fraction
  let aim = surah; // the surah it is on its way to
  let shown = 0;
  let held = false; // under the thumb
  let busy = false; // on its way to a surah of the reader's choosing: the pages turning don't move it meanwhile
  let opening = false; // turning into place as the page opens: names nothing on the way
  let tween: gsap.core.Tween | null = null;

  let width = 0, height = 0, dpr = 1, ink = "#000";
  const tones = () => { ink = getComputedStyle(el).getPropertyValue("--ink").trim(); };

  function draw() {
    if (!width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const mid = width / 2;
    const radius = mid - CLEAR;
    const turnPerSurah = SPACE / radius;
    const reach = Math.ceil(Math.PI / 2 / turnPerSurah);
    ctx.fillStyle = ink;
    for (let n = Math.max(1, Math.ceil(s.at - reach)); n <= Math.min(SURAHS, Math.floor(s.at + reach)); n++) {
      const turn = (n - s.at) * turnPerSurah;
      if (Math.abs(turn) >= Math.PI / 2) continue;
      const near = Math.cos(turn); // 1 at the needle, 0 where the ring turns out of sight
      const x = mid - radius * Math.sin(turn); // onwards lies to the left
      const tall = LINE.height * (0.3 + 0.7 * near ** 2); // the lines fall away with the curve, so the ring shows in its outline
      ctx.globalAlpha = LINE.strength * near ** 1.2;
      ctx.fillRect(x - (LINE.width * near) / 2, (height - tall) / 2, LINE.width * near, tall);
    }
    ctx.globalAlpha = 1;
  }

  function label(n: number) {
    if (n === shown) return;
    shown = n;
    const text = `سورة ${names[n - 1]}`;
    tag.textContent = text;
    el.setAttribute("aria-valuenow", String(n));
    el.setAttribute("aria-valuetext", text);
  }
  function paint() {
    draw();
    if (!opening) label(Math.round(s.at));
  }

  function run(to: number, duration: number, done?: () => void) {
    aim = to;
    tween?.kill();
    tween = null;
    if (!moving() || duration <= 0) {
      s.at = to;
      paint();
      return done?.();
    }
    tween = gsap.to(s, { at: to, duration, ease: "power3.out", onUpdate: paint, onComplete: () => { tween = null; done?.(); } });
  }
  // The reader has chosen: the ring runs to the surah, and the mushaf turns when it arrives.
  function landOn(to: number, duration: number) {
    busy = true;
    run(to, duration, () => {
      busy = false;
      onLand(to);
    });
  }
  // A touch during the opening turn ends it at once: the ring must never be taken up short of where the reader is, or a
  // tap there would lead somewhere else.
  function endOpening() {
    if (!opening) return;
    opening = false;
    s.at = aim;
  }
  // Keys and the mouse wheel move it in steps, and the mushaf follows when they pause.
  let pause = 0;
  function stepTo(to: number) {
    tween?.kill();
    endOpening();
    busy = true;
    s.at = clamp(to);
    paint();
    clearTimeout(pause);
    pause = window.setTimeout(() => landOn(Math.round(s.at), 0.35), 380);
  }

  // ---------- under the thumb ----------
  let startX = 0, startAt = 0, startT = 0, moved = false;
  let trail: [t: number, x: number][] = [];
  el.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    tween?.kill();
    tween = null;
    clearTimeout(pause);
    moved = false;
    endOpening();
    held = true;
    busy = true;
    startX = e.clientX;
    startAt = s.at;
    startT = e.timeStamp;
    trail = [[e.timeStamp, e.clientX]];
    el.setPointerCapture(e.pointerId);
    el.classList.add("held");
    paint();
  });
  el.addEventListener("pointermove", (e) => {
    if (!held) return;
    if (Math.abs(e.clientX - startX) > 5) moved = true;
    if (!moved) return;
    s.at = clamp(startAt + (e.clientX - startX) / SPACE); // the thumb pulling right brings on the surahs to the left
    trail.push([e.timeStamp, e.clientX]);
    if (trail.length > 6) trail.shift();
    paint();
  });
  function letGo(e: PointerEvent) {
    if (!held) return;
    held = false;
    el.classList.remove("held");
    if (!moved && e.timeStamp - startT < 400) return tapAt(e.clientX);
    // how fast the thumb was going over its last tenth of a second; a jerk over a few ms is no flick
    const recent = trail.filter(([t]) => e.timeStamp - t < 100);
    const [t0, x0] = recent[0] ?? [0, 0];
    const [t1, x1] = recent[recent.length - 1] ?? [0, 0];
    const speed = t1 - t0 >= 16 ? Math.min(MAX_SPEED, Math.max(-MAX_SPEED, (x1 - x0) / (t1 - t0))) : 0; // to the right is onwards
    if (Math.abs(speed) < 0.08) return landOn(Math.round(s.at), 0.45);
    const to = clamp(Math.round(s.at + (speed * COAST) / SPACE));
    // power3.out sets off at three times its average speed: this length starts the ring at the thumb's own speed
    const duration = (3 * Math.abs(to - s.at) * SPACE) / Math.abs(speed) / 1000;
    landOn(to, Math.min(2.6, Math.max(0.45, duration)));
  }
  el.addEventListener("pointerup", letGo);
  el.addEventListener("pointercancel", letGo);
  // A tap goes to the line under it.
  function tapAt(clientX: number) {
    const r = canvas.getBoundingClientRect();
    const radius = r.width / 2 - CLEAR;
    const sin = (r.left + r.width / 2 - clientX) / radius;
    if (Math.abs(sin) >= 1) return landOn(Math.round(s.at), 0.3);
    landOn(clamp(Math.round(s.at + (Math.asin(sin) * radius) / SPACE)), 0.7);
  }
  el.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: aim + 1, ArrowRight: aim - 1, Home: 1, End: SURAHS }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // these move the ring, not the pages
    aim = clamp(to);
    stepTo(aim);
  });
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    endOpening();
    stepTo(s.at + (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : -e.deltaX) / SPACE);
  }, { passive: false });

  // ---------- its size and tone ----------
  new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    tones();
    draw();
  }).observe(canvas);
  new MutationObserver(() => { tones(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  tones();

  // ---------- opening: the ring comes round to the surah, slowly ----------
  label(surah);
  if (moving()) {
    opening = true;
    s.at = surah > 12 ? surah - 12 : surah + 12;
    tween = gsap.to(s, { at: surah, duration: 1.8, delay: 0.1, ease: "power3.out", onUpdate: draw, onComplete: () => { tween = null; opening = false; } });
  }

  return {
    // The pages have turned some other way (the arrows, a swipe, history): the ring comes along.
    sync(to: number) {
      if (busy || held || to === aim) return;
      opening = false;
      run(to, Math.min(1.2, 0.6 + Math.abs(to - s.at) * 0.05));
    },
  };
}
