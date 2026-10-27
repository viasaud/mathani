// The cover's gilt lattice: a field of eight-pointed stars (the rub' al-hizb, two squares turned 45° to each other)
// tied by fine rules, drawn in one fragment shader. It lies dark until light reaches it: a lamp that follows the
// pointer (or drifts on its own when there is none), a slow sheen crossing the field, and a faint twinkle in each
// star, like gold leaf turning in the light. WebGL 2 only; anything less keeps the still pattern from home.css.
const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 res;
uniform vec2 lamp;
uniform float t;
uniform float cell;
uniform vec3 gold;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// a thin line along the zero of d, anti-aliased by its own screen-space slope
float rule(float d, float w) { float f = fwidth(d); return 1.0 - smoothstep(w, w + f * 1.2, abs(d)); }

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / cell + vec2(t * 0.012, t * 0.007);
  vec2 id = floor(uv);
  vec2 g = fract(uv) - 0.5;
  vec2 a = abs(g);
  const float R2 = 0.70710678;
  float s = 0.24;
  float sq = max(a.x, a.y) - s;                 // the upright square
  float dm = (a.x + a.y) * R2 - s;              // the square turned 45°
  float ring = length(g) - 0.34;                // a circle around the star
  float tip = s / R2;                           // where the turned square's points reach
  // rules from each point of the star to the next star's
  float ties = max(rule(g.y, 0.010) * step(tip, a.x), rule(g.x, 0.010) * step(tip, a.y));
  // small diamonds where four cells meet
  vec2 c = abs(fract(uv + 0.5) - 0.5);
  float knot = (c.x + c.y) * R2 - 0.075;
  float lines = max(max(rule(sq, 0.012), rule(dm, 0.012)), max(rule(ring, 0.008) * 0.55, max(ties * 0.8, rule(knot, 0.010) * 0.9)));

  // light: the lamp, a sheen crossing the field, and a twinkle per star
  vec2 dl = px - lamp;
  float r = 0.2 * max(res.x, res.y);
  float lit = exp(-dot(dl, dl) / (r * r));
  float sweep = mod(t * 0.07, 2.6) - 0.8;
  float band = exp(-pow((px.x / res.x) * 0.7 + (px.y / res.y) * 0.5 - sweep, 2.0) / 0.008);
  float tw = 0.5 + 0.5 * sin(t * 0.8 + hash(id) * 6.2832);
  float glow = 0.035 + 0.9 * lit + 0.16 * band + 0.25 * tw * lit;
  vec3 col = mix(gold, vec3(1.0, 0.95, 0.82), clamp(lit * 0.6, 0.0, 1.0));
  float alpha = clamp(lines * glow, 0.0, 1.0) * 0.6;
  o = vec4(col * alpha, alpha);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
  return sh;
}

const rgb = (css: string): [number, number, number] => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(css.trim());
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.86, 0.72, 0.4];
};

export function start(canvas: HTMLCanvasElement, host: HTMLElement) {
  const context = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!context) return void canvas.classList.add("off");
  const gl = context;
  const prog = gl.createProgram()!;
  try {
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch {
    return void canvas.classList.add("off");
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const [uRes, uLamp, uT, uCell, uGold] = ["res", "lamp", "t", "cell", "gold"].map(u);

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dpr = 1, w = 0, h = 0;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    w = Math.round(canvas.clientWidth * dpr);
    h = Math.round(canvas.clientHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    if (still) draw(performance.now());
  };
  // the gold follows the theme (each has its own cover gold)
  let gold = rgb(getComputedStyle(host).getPropertyValue("--cover-gold"));
  new MutationObserver(() => {
    gold = rgb(getComputedStyle(host).getPropertyValue("--cover-gold"));
    if (still) draw(performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // the lamp: eased toward the pointer, or wandering slowly while the pointer is elsewhere
  const lamp = { x: 0.3, y: 0.5 }, aim = { x: 0.3, y: 0.5 };
  let lastMove = -1e9;
  host.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    aim.x = (e.clientX - r.left) / r.width;
    aim.y = (e.clientY - r.top) / r.height;
    lastMove = performance.now();
  }, { passive: true });

  const t0 = performance.now();
  function draw(now: number) {
    const t = (now - t0) / 1000;
    if (now - lastMove > 2500) {
      aim.x = 0.3 + 0.22 * Math.sin(t * 0.21);
      aim.y = 0.5 + 0.25 * Math.sin(t * 0.17 + 1.3);
    }
    const k = still ? 1 : 0.06;
    lamp.x += (aim.x - lamp.x) * k;
    lamp.y += (aim.y - lamp.y) * k;
    gl.uniform2f(uRes, w, h);
    gl.uniform2f(uLamp, lamp.x * w, (1 - lamp.y) * h);
    gl.uniform1f(uT, still ? 4 : t);
    gl.uniform1f(uCell, 92 * dpr);
    gl.uniform3f(uGold, ...gold);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  new ResizeObserver(size).observe(canvas);
  size();
  if (still) return;
  // only runs while the cover is on screen and the tab is visible
  let raf = 0, visible = true;
  const loop = (now: number) => {
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  const run = () => {
    cancelAnimationFrame(raf);
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => ((visible = e.isIntersecting), run())).observe(canvas);
  document.addEventListener("visibilitychange", run);
  canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1800, easing: "ease-out" });
}
