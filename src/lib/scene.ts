// The footer's scene (Footer.astro), drawn at build time into /footer-scene.svg, one file every page shares and the
// browser caches: Madinah engraved in gold, the Prophet's Mosque with its minarets, the Green Dome and the umbrellas of
// its courtyard, date palms and old houses either side, and Uhud behind.
//
// A 2400 × 800 plate, the ground at 700 and a strip of glinting ground below it. Shapes are filled with fine hatching
// and outlined, like an engraving; the centre is kept low so the name has sky to sit in. It is drawn in white on
// black and used as a luminance mask (Footer.astro): white prints in the theme's gold ink on the page's own paper,
// black prints nothing, so openings and anything that must hide what is behind it are filled black.
const INK = "#fff";
const G = 700;
const n = (v: number) => +v.toFixed(1);
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Uhud behind the city: a craggy granite massif, and a fainter range beyond it. Their ridgelines are roughened by
// midpoint displacement, and they are engraved the old way, with hachures: short strokes running down each slope from
// the crest, long and close on the faces turned from the light, short and sparse on those turned toward it.
function crest(pts: number[][], levels: number, rough: number) {
  let line = pts.map(([x, y]) => [x, y]);
  let amp = rough;
  for (let l = 0; l < levels; l++) {
    const next: number[][] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i], [x1, y1] = line[i + 1];
      next.push([x0, y0], [(x0 + x1) / 2 + (rand() - 0.5) * (x1 - x0) * 0.2, (y0 + y1) / 2 + (rand() - 0.5) * amp]);
    }
    next.push(line[line.length - 1]);
    line = next;
    amp *= 0.56;
  }
  return line;
}
const uhud = crest([[0, 566], [170, 524], [320, 544], [470, 486], [640, 514], [800, 468], [980, 498], [1130, 456], [1290, 488], [1440, 450], [1600, 482], [1760, 460], [1920, 502], [2080, 472], [2240, 516], [2400, 534]], 5, 48);
const farRange = crest([[0, 528], [300, 492], [620, 474], [900, 448], [1200, 440], [1500, 452], [1800, 442], [2100, 474], [2400, 494]], 4, 26);
const crestPath = (l: number[][]) => "M" + l.map(([x, y]) => `${n(x)},${n(y)}`).join(" L");
const massPath = (l: number[][]) => `${crestPath(l)} L2400,${G} L0,${G} Z`;
function hachures(l: number[][], scale: number, offset = 0) {
  const out: string[] = [];
  for (let i = 2; i < l.length - 2; i++) {
    const [x, y] = l[i];
    const s = (l[i + 2][1] - l[i - 2][1]) / (l[i + 2][0] - l[i - 2][0]);
    const shaded = s > 0.03;
    if (!shaded && i % 3) continue;
    const steep = Math.min(1, Math.abs(s) * 1.5);
    const len = (shaded ? 20 + 52 * steep : 7 + 16 * steep) * scale * (0.75 + rand() * 0.5);
    const dx = Math.sign(s || 1) * (0.2 + 0.4 * steep), m = Math.hypot(dx, 1);
    const y0 = y + 2 + offset * len;
    out.push(`M${n(x + (dx / m) * offset * len)},${n(y0)} l${n((dx / m) * len * (1 - offset * 0.5))},${n((1 / m) * len * (1 - offset * 0.5))}`);
  }
  return out.join(" ");
}

// ---------- the Prophet's Mosque ----------
// Drawn as layers, back to front, each a list of [class, path] pairs. The light comes from the upper left, so every
// shaft and dome is hatched sparsely on its left and densely on its right ("lit" and "shade").
type Layer = [cls: string, d: string][];
const back: Layer = [], facade: Layer = [], gates: Layer = [], domes: Layer = [], towers: Layer = [];
const box = (cx: number, w: number, y0: number, y1: number) => `M${n(cx - w / 2)},${n(y0)} V${n(y1)} H${n(cx + w / 2)} V${n(y0)} Z`;
// a pointed arch standing on `bottom`, its sides rising to `spring`, meeting at `apex`
const arch = (cx: number, half: number, bottom: number, spring: number, apex: number) => {
  const k = (spring - apex) * 0.62;
  return `M${n(cx - half)},${n(bottom)} V${n(spring)} C${n(cx - half)},${n(spring - k)} ${n(cx - half * 0.32)},${n(apex + (spring - apex) * 0.18)} ${n(cx)},${n(apex)} C${n(cx + half * 0.32)},${n(apex + (spring - apex) * 0.18)} ${n(cx + half)},${n(spring - k)} ${n(cx + half)},${n(spring)} V${n(bottom)}`;
};
// a shaft lit from the left: sparse hatching on the lit side, dense on the shaded side, then its outline
const shaft = (layer: Layer, cx: number, w: number, y0: number, y1: number, split = 0.14) => {
  const xs = cx + w * split;
  layer.push(["lit", `M${n(cx - w / 2)},${n(y0)} V${n(y1)} H${n(xs)} V${n(y0)} Z`], ["shade", `M${n(xs)},${n(y0)} V${n(y1)} H${n(cx + w / 2)} V${n(y0)} Z`], ["edge", box(cx, w, y0, y1)]);
};
// a band of muqarnas under a ledge: rows of small niches stepping out from `wBelow` to `wAbove` over `h`
const muqarnas = (layer: Layer, cx: number, wBelow: number, wAbove: number, top: number, h: number, rows = 2) => {
  layer.push(["mask", `M${n(cx - wBelow / 2)},${n(top + h)} L${n(cx - wAbove / 2)},${n(top)} H${n(cx + wAbove / 2)} L${n(cx + wBelow / 2)},${n(top + h)} Z`]);
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    const yb = top + h - (h / rows) * r;
    const w = wBelow + ((wAbove - wBelow) * r) / rows;
    const count = Math.max(2, Math.round(w / 5));
    const c = w / count;
    for (let i = 0; i < count; i++) {
      const a = cx - w / 2 + i * c;
      cells.push(`M${n(a)},${n(yb)} Q${n(a + c / 2)},${n(yb - (h / rows) * 1.1)} ${n(a + c)},${n(yb)}`);
    }
    cells.push(`M${n(cx - w / 2)},${n(yb)} H${n(cx + w / 2)}`);
  }
  layer.push(["fine", cells.join(" ")], ["edge", `M${n(cx - wBelow / 2)},${n(top + h)} L${n(cx - wAbove / 2)},${n(top)} H${n(cx + wAbove / 2)} L${n(cx + wBelow / 2)},${n(top + h)}`]);
};
// a balcony: a slab on muqarnas, and a railing pierced with small arches
const balcony = (layer: Layer, cx: number, wShaft: number, wOut: number, y: number) => {
  muqarnas(layer, cx, wShaft, wOut, y, 12);
  layer.push(["slab", box(cx, wOut + 2, y, y - 4)], ["edge", box(cx, wOut + 2, y, y - 4)]);
  const rw = wOut - 2, top = y - 14;
  layer.push(["lit", box(cx, rw, y - 4, top)], ["edge", box(cx, rw, y - 4, top)]);
  const holes: string[] = [];
  const count = Math.max(3, Math.floor(rw / 6));
  const step = rw / count;
  for (let i = 0; i < count; i++) holes.push(arch(cx - rw / 2 + step * (i + 0.5), step * 0.26, y - 6, top + 6, top + 3) + " Z");
  layer.push(["hole", holes.join(" ")], ["edge", `M${n(cx - rw / 2 - 1)},${n(top)} H${n(cx + rw / 2 + 1)}`]);
};
// a bulbous dome on `base`, `w` wide and `h` tall, ribbed, with a finial of spheres and a crescent
const onion = (layer: Layer, cx: number, w: number, base: number, h: number, ribs = 2, finial = 26) => {
  const top = base - h, hw = w / 2;
  const outline = `M${n(cx - hw)},${n(base)} C${n(cx - hw * 1.46)},${n(base - h * 0.44)} ${n(cx - hw * 0.42)},${n(base - h * 0.74)} ${n(cx)},${n(top)} C${n(cx + hw * 0.42)},${n(base - h * 0.74)} ${n(cx + hw * 1.46)},${n(base - h * 0.44)} ${n(cx + hw)},${n(base)} Z`;
  const right = `M${n(cx + hw * 0.18)},${n(base - h * 0.86)} C${n(cx + hw * 0.6)},${n(base - h * 0.66)} ${n(cx + hw * 1.46)},${n(base - h * 0.44)} ${n(cx + hw)},${n(base)} L${n(cx + hw * 0.3)},${n(base)} Z`;
  layer.push(["mask", outline], ["shade", right]);
  // engraved by its ribs, closer together the wider the dome, curving with it to the crown
  ribs = Math.max(ribs, Math.round(w / 12));
  const rib: string[] = [];
  for (let i = 1; i <= ribs; i++) {
    for (const s of [-1, 1]) {
      const f = i / (ribs + 1);
      rib.push(`M${n(cx + s * hw * f)},${n(base)} C${n(cx + s * hw * f * 1.46)},${n(base - h * 0.44)} ${n(cx + s * hw * f * 0.42)},${n(base - h * 0.74)} ${n(cx)},${n(top)}`);
    }
  }
  layer.push(["fine", rib.join(" ")], ["edge", outline]);
  const r1 = Math.max(2, w * 0.06);
  layer.push(
    ["edge", `M${n(cx)},${n(top)} V${n(top - finial)}`],
    ["gilt", `M${n(cx - r1)},${n(top - finial * 0.3)} a${n(r1)},${n(r1)} 0 1 0 ${n(2 * r1)},0 a${n(r1)},${n(r1)} 0 1 0 ${n(-2 * r1)},0 M${n(cx - r1 * 0.75)},${n(top - finial * 0.58)} a${n(r1 * 0.75)},${n(r1 * 0.75)} 0 1 0 ${n(1.5 * r1)},0 a${n(r1 * 0.75)},${n(r1 * 0.75)} 0 1 0 ${n(-1.5 * r1)},0`],
    ["gilt", `M${n(cx + r1 * 1.4)},${n(top - finial - r1 * 2.6)} a${n(r1 * 1.6)},${n(r1 * 1.6)} 0 1 0 0,${n(r1 * 3.2)} a${n(r1 * 1.25)},${n(r1 * 1.25)} 0 1 1 0,${n(-r1 * 3.2)} Z`],
  );
};

// A minaret: a plinth and a square base with a recessed panel and an arched window, a muqarnas cornice, an octagonal
// shaft, then two round shafts each narrower than the last, with a balcony between each; at the top an open pavilion
// of slender columns and a ribbed onion dome.
function minaret(x: number, top: number, w: number, layer: Layer = towers) {
  const S = 548 - top;
  const [yB, yC, yD, yE] = [548 - 0.36 * S, 548 - 0.6 * S, 548 - 0.76 * S, 548 - 0.885 * S];
  layer.push(["slab", box(x, w + 12, G, G - 12)], ["edge", box(x, w + 12, G, G - 12)]);
  shaft(layer, x, w, G - 12, 548);
  layer.push(["fine", box(x, w - 10, G - 26, 600)], ["hole", arch(x, 5, 594, 572, 560) + " Z"], ["fine", `M${n(x - w / 2)},${G - 70} H${n(x + w / 2)} M${n(x - w / 2)},${G - 74} H${n(x + w / 2)}`]);
  muqarnas(layer, x, w, w + 10, 540, 8);
  layer.push(["slab", box(x, w + 12, 540, 536)], ["edge", box(x, w + 12, 540, 536)]);
  // the octagon: three faces showing, the right one in shadow
  const wo = w - 4;
  shaft(layer, x, wo, 536, yB, 0.18);
  layer.push(["fine", `M${n(x - wo * 0.28)},536 V${n(yB)} M${n(x + wo * 0.18)},536 V${n(yB)}`]);
  for (let y = 520; y > yB + 24; y -= 46) layer.push(["hole", arch(x - wo * 0.05, 2.6, y, y - 10, y - 15) + " Z"]);
  balcony(layer, x, wo, w + 14, yB);
  const w2 = w - 9;
  shaft(layer, x, w2, yB - 14, yC);
  layer.push(["fine", `M${n(x - w2 / 2)},${n((yB + yC) / 2)} H${n(x + w2 / 2)}`]);
  balcony(layer, x, w2, w + 6, yC);
  const w3 = w - 14;
  shaft(layer, x, w3, yC - 14, yD);
  balcony(layer, x, w3, w - 2, yD);
  // the pavilion: a floor, four slender columns under pointed arches, a roof slab
  const kw = w - 10, ky0 = yD - 14, ky1 = yE;
  layer.push(["hole", box(x, kw, ky0, ky1)]);
  const cols: string[] = [];
  for (let i = 0; i < 4; i++) {
    const cx = x - kw / 2 + 1.2 + (i * (kw - 2.4)) / 3;
    cols.push(box(cx, 2.4, ky0, ky1 + 4));
  }
  layer.push(["lit", cols.join(" ")], ["edge", cols.join(" ")]);
  const spans: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = x - kw / 2 + 1.2 + (i * (kw - 2.4)) / 3, b = x - kw / 2 + 1.2 + ((i + 1) * (kw - 2.4)) / 3;
    spans.push(arch((a + b) / 2, (b - a) / 2, ky1 + 6, ky1 + 6, ky1 + 2));
  }
  layer.push(["fine", spans.join(" ")], ["slab", box(x, kw + 4, ky1, ky1 - 4)], ["edge", box(x, kw + 4, ky1, ky1 - 4)]);
  onion(layer, x, kw + 2, ky1 - 4, ky1 - 4 - top, 1, 24 + w * 0.2);
}

// The facade: a plinth, an arcade of pointed arches on columns with capitals, each arch with a keystone and, in every
// other one, a hanging lamp; a band of eight-pointed stars; a cornice; and a stepped parapet along the top.
const F = { x0: 470, x1: 1930, top: 568, spring: 632, apex: 604 };
const gateAt = [[940, 96, 520], [1200, 140, 498], [1460, 96, 520]] as const;
const minaretAt = [[540, 120, 34], [770, 214, 28], [1770, 214, 28], [1900, 120, 34]] as const;
const blocked = (x: number, pad: number) => gateAt.some(([g, w]) => Math.abs(x - g) < w / 2 + pad) || minaretAt.some(([m, , w]) => Math.abs(x - m) < w / 2 + 8 + pad);

// the back: the older mosque's roofline beyond the court, a row of small domes, and two distant minarets
back.push(["lit", `M560,${F.top} V540 H1840 V${F.top} Z`], ["edge", `M560,540 H1840`]);
{
  const small: string[] = [];
  for (let x = 580; x <= 1820; x += 38) small.push(`M${x - 10},540 C${x - 10},528 ${x - 3},524 ${x},518 C${x + 3},524 ${x + 10},528 ${x + 10},540 Z`);
  back.push(["dome", small.join(" ")], ["edge", small.join(" ")]);
}
minaret(1060, 404, 16, back);
minaret(1340, 404, 16, back);

// the umbrellas of the courtyard, open above the parapet on either side of the central gate
{
  const um: string[] = [];
  for (const x of [1030, 1074, 1118, 1282, 1326, 1370]) {
    const y = 552;
    um.push(`M${x - 20},${y} Q${x - 15},${y - 3} ${x - 10},${y} Q${x - 5},${y - 3} ${x},${y} Q${x + 5},${y - 3} ${x + 10},${y} Q${x + 15},${y - 3} ${x + 20},${y} Q${x + 10},${y - 13} ${x},${y - 16} Q${x - 10},${y - 13} ${x - 20},${y} Z M${x},${y - 16} V${y - 22} M${x - 10},${y} L${x},${y - 16} L${x + 10},${y}`);
  }
  back.push(["umbrella", um.join(" ")]);
}

facade.push(["mask", `M${F.x0},${G} V${F.top - 14} H${F.x1} V${G} Z`]);
facade.push(["wall", `M${F.x0},${G - 14} V${F.top} H${F.x1} V${G - 14} Z`], ["slab", `M${F.x0},${G} V${G - 14} H${F.x1} V${G} Z`], ["edge", `M${F.x0},${G} V${F.top} H${F.x1} V${G} M${F.x0},${G - 14} H${F.x1}`]);
// the band of stars between two rules, and the cornice above it
{
  const stars: string[] = [];
  for (let x = F.x0 + 14; x < F.x1 - 8; x += 22) {
    if (blocked(x, 6)) continue;
    const y = 586, r = 6.5, q = r * 0.71;
    stars.push(`M${n(x - r)},${y} L${n(x)},${n(y - r)} L${n(x + r)},${y} L${n(x)},${n(y + r)} Z M${n(x - q)},${n(y - q)} H${n(x + q)} V${n(y + q)} H${n(x - q)} Z`);
  }
  facade.push(["mask", `M${F.x0},600 V${F.top + 4} H${F.x1} V600 Z`], ["fine", stars.join(" ")], ["edge", `M${F.x0},600 H${F.x1} M${F.x0},${F.top + 4} H${F.x1} M${F.x0},${F.top} H${F.x1}`]);
}
// the arcade
{
  const holes: string[] = [], lines: string[] = [], cols: string[] = [], lamps: string[] = [], deep: string[] = [];
  let k = 0;
  for (let cx = F.x0 + 30; cx < F.x1 - 20; cx += 46) {
    if (blocked(cx, 22)) continue;
    const half = 16;
    holes.push(arch(cx, half, G - 14, F.spring, F.apex) + " Z");
    lines.push(arch(cx, half + 4, F.spring + 2, F.spring, F.apex - 5));
    lines.push(`M${cx - 2.5},${F.apex - 6} L${cx},${F.apex - 11} L${cx + 2.5},${F.apex - 6}`);
    // the columns either side, with capitals and bases
    for (const s of [-1, 1]) {
      const c = cx + s * (half + 2);
      cols.push(box(c, 3.4, G - 14, F.spring + 3), box(c, 7, F.spring + 3, F.spring - 1), box(c, 6, G - 14, G - 18));
    }
    // a second arcade glimpsed deeper inside, and a lamp in every other arch
    deep.push(arch(cx, 10, G - 14, 652, 636));
    if (k++ % 2 === 0) lamps.push(`M${cx},${F.apex + 2} V${F.apex + 18} M${cx - 3},${F.apex + 22} L${cx},${F.apex + 18} L${cx + 3},${F.apex + 22} L${cx},${F.apex + 28} Z`);
  }
  facade.push(["hole", holes.join(" ")], ["faint", deep.join(" ")], ["gilt-fine", lamps.join(" ")], ["edge", holes.join(" ")], ["fine", lines.join(" ")], ["slab", cols.join(" ")], ["edge", cols.join(" ")]);
}
// the parapet: stepped merlons along the top, each rising to a point
{
  const mer: string[] = [];
  for (let x = F.x0 + 2; x + 12 <= F.x1; x += 15) mer.push(`M${x},${F.top} v-5 h2.5 v-4 h2 l1.5,-4 l1.5,4 h2 v4 h2.5 v5`);
  facade.push(["edge-fine", mer.join(" ")]);
}

// A gate: a tall framed block rising above the facade, an inscription band under its parapet, a great pointed arch
// with a muqarnas hood over studded double doors, medallions in the spandrels, and a pinnacle at each corner.
function gate(cx: number, w: number, top: number) {
  gates.push(["mask", box(cx, w, G, top - 10)]);
  const xs = cx + w * 0.3;
  gates.push(["wall", `M${n(cx - w / 2)},${G} V${n(top)} H${n(xs)} V${G} Z`], ["shade", `M${n(xs)},${G} V${n(top)} H${n(cx + w / 2)} V${G} Z`], ["edge", box(cx, w, G, top)]);
  gates.push(["fine", box(cx, w - 10, G - 14, top + 5)]);
  // the inscription band: a strip of flowing strokes
  const band: string[] = [];
  for (let x = cx - w / 2 + 12; x < cx + w / 2 - 14; x += 9) band.push(`M${x},${top + 20} q2,-6 4,-1 t4,-2 M${x + 2},${top + 14} v-2`);
  gates.push(["mask", box(cx, w - 18, top + 24, top + 9)], ["edge-fine", box(cx, w - 18, top + 24, top + 9)], ["fine", band.join(" ")]);
  // the great arch, its hood of muqarnas, and the doors
  const aw = w / 2 - 16, spring = top + (G - top) * 0.46, apex = top + 36;
  const opening = arch(cx, aw, G - 14, spring, apex) + " Z";
  gates.push(["hole", opening], ["fine", arch(cx, aw + 6, spring + 2, spring, apex - 8)], ["edge", opening]);
  const hood: string[] = [];
  for (let r = 0; r < 4; r++) {
    const y = apex + 10 + r * 8;
    const span = aw * (0.36 + r * 0.2);
    const count = 2 + r * 2;
    const c = (span * 2) / count;
    for (let i = 0; i < count; i++) hood.push(`M${n(cx - span + i * c)},${n(y)} Q${n(cx - span + (i + 0.5) * c)},${n(y - 8)} ${n(cx - span + (i + 1) * c)},${n(y)}`);
    hood.push(`M${n(cx - span)},${n(y)} H${n(cx + span)}`);
  }
  gates.push(["gilt-fine", hood.join(" ")]);
  const dTop = spring + 8, dw = aw - 5;
  const studs: string[] = [];
  for (let y = dTop + 8; y < G - 18; y += 8) for (let x = cx - dw + 4; x < cx + dw - 2; x += 6) if (Math.abs(x - cx) > 2) studs.push(`M${n(x)},${n(y)} h0.1`);
  gates.push(["edge-fine", `${box(cx - dw / 2, dw - 1, G - 14, dTop)} ${box(cx + dw / 2, dw - 1, G - 14, dTop)}`], ["studs", studs.join(" ")]);
  // medallions in the spandrels
  for (const s of [-1, 1]) {
    const mx = cx + s * (aw + (w / 2 - aw) / 2 - 3), my = apex + 8, r = Math.min(7, (w / 2 - aw) / 2 - 2);
    gates.push(["mask", `M${n(mx - r)},${n(my)} a${n(r)},${n(r)} 0 1 0 ${n(2 * r)},0 a${n(r)},${n(r)} 0 1 0 ${n(-2 * r)},0`], ["edge-fine", `M${n(mx - r)},${n(my)} a${n(r)},${n(r)} 0 1 0 ${n(2 * r)},0 a${n(r)},${n(r)} 0 1 0 ${n(-2 * r)},0 M${n(mx - r * 0.55)},${n(my)} L${n(mx)},${n(my - r * 0.55)} L${n(mx + r * 0.55)},${n(my)} L${n(mx)},${n(my + r * 0.55)} Z`]);
  }
  // the parapet and the corner pinnacles
  const mer: string[] = [];
  for (let x = cx - w / 2 + 2; x + 12 <= cx + w / 2; x += 15) mer.push(`M${x},${top} v-5 h2.5 v-4 h2 l1.5,-4 l1.5,4 h2 v4 h2.5 v5`);
  gates.push(["edge-fine", mer.join(" ")]);
  for (const s of [-1, 1]) {
    const px = cx + s * (w / 2 - 4);
    gates.push(["slab", box(px, 8, top, top - 22)], ["edge", box(px, 8, top, top - 22)]);
    onion(gates, px, 9, top - 22, 13, 0, 8);
  }
}
for (const [x, w, top] of gateAt) gate(x, w, top);
// the dome over the central gate, on a windowed drum
{
  const [cx, , top] = gateAt[1];
  const base = top - 2;
  domes.push(["mask", box(cx, 64, base, base - 20)]);
  shaft(domes, cx, 64, base, base - 20, 0.2);
  const win: string[] = [];
  for (const d of [-20, -7, 7, 20]) win.push(arch(cx + d, 2.6, base - 4, base - 12, base - 16) + " Z");
  domes.push(["hole", win.join(" ")], ["slab", box(cx, 70, base - 20, base - 24)], ["edge", box(cx, 70, base - 20, base - 24)]);
  onion(domes, cx, 72, base - 24, 62, 3, 30);
}

// The Green Dome over the Prophet's resting place: a square base with an arched niche, an octagonal drum with arched
// windows and a cornice, the tall ribbed dome, and its spire of spheres with the crescent. Beside it the smaller dome.
{
  const cx = 1612, base = F.top - 14;
  onion(domes, 1514, 40, base - 10, 40, 1, 18);
  domes.push(["mask", box(1514, 36, base, base - 10)], ["lit", box(1514, 36, base, base - 10)], ["edge", box(1514, 36, base, base - 10)]);
  domes.push(["mask", box(cx, 92, base, base - 34)]);
  shaft(domes, cx, 92, base, base - 34, 0.24);
  domes.push(["hole", arch(cx - 26, 6, base - 4, base - 18, base - 26) + " Z " + arch(cx + 26, 6, base - 4, base - 18, base - 26) + " Z"]);
  domes.push(["slab", box(cx, 98, base - 34, base - 39)], ["edge", box(cx, 98, base - 34, base - 39)]);
  const db = base - 39;
  shaft(domes, cx, 80, db, db - 34, 0.22);
  const win: string[] = [];
  for (const d of [-26, -9, 9, 26]) win.push(arch(cx + d, 4, db - 6, db - 20, db - 27) + " Z");
  domes.push(["hole", win.join(" ")], ["fine", `M${cx - 18},${db} V${db - 34} M${cx + 18},${db} V${db - 34}`]);
  muqarnas(domes, cx, 80, 90, db - 42, 8);
  domes.push(["slab", box(cx, 92, db - 42, db - 46)], ["edge", box(cx, 92, db - 42, db - 46)]);
  onion(domes, cx, 84, db - 46, 106, 3, 40);
}

// the four minarets of the front
for (const [x, top, w] of minaretAt) minaret(x, top, w);

// A date palm. The trunk is slender, bending gently toward its lean, and covered in a lattice of old frond bases. The
// crown is a cluster of long pinnate fronds growing from a short knot at the top: the young ones stand up out of the
// middle, the grown ones arc up and out and bow down under their own weight, the oldest hang along the trunk, and
// bunches of dates hang beneath. Each frond's leaflets grow from both sides of its spine, angled toward the tip, and
// hang under it as a fringe, bare near the base where the stalk is.
function palm(x: number, h: number, lean: number, size = 1) {
  const tx = x + lean, ty = G - h;
  const bend = x + lean * 0.4;
  const along = (t: number) => {
    const u = 1 - t;
    return [u * u * x + 2 * u * t * bend + t * t * tx, G - h * t];
  };
  const width = (t: number) => (6 - 2.2 * t) * size;
  const left: string[] = [], right: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const [px, py] = along(t);
    left.push(`${n(px - width(t))},${n(py)}`);
    right.unshift(`${n(px + width(t))},${n(py)}`);
  }
  const trunk = `M${left.join(" L")} L${right.join(" L")} Z`;

  // [direction in degrees (0 = right, -90 = up, 90 = down) at the base, length, how far its tip bows down]
  const plan = [
    [-90, 0.5, 0.15], [-78, 0.62, 0.3], [-102, 0.62, 0.3],
    [-60, 0.86, 0.6], [-120, 0.86, 0.6], [-40, 0.96, 0.85], [-140, 0.96, 0.85],
    [-22, 0.92, 1.05], [-158, 0.92, 1.05], [-6, 0.82, 1.2], [-174, 0.82, 1.2],
    [14, 0.66, 1.25], [166, 0.66, 1.25],
  ];
  const old = [[70, 0.52, 0.5], [110, 0.52, 0.5], [84, 0.46, 0.3], [96, 0.44, 0.3]];
  const knot = 7 * size;
  const frond = (deg: number, lf: number, droop: number, spines: string[], leaflets: string[]) => {
    const a = ((deg + (rand() - 0.5) * 10) * Math.PI) / 180;
    const L = 108 * size * lf * (0.9 + rand() * 0.2);
    const fall = droop * 0.62 * L;
    // fronds leave the knot at the top of the trunk, not one point
    const ox = tx + Math.cos(a) * knot * 0.8, oy = ty + Math.sin(a) * knot * 0.45;
    const pos = (s: number) => [ox + Math.cos(a) * s, oy + Math.sin(a) * s + fall * (s / L) ** 2];
    const tangent = (s: number) => {
      const dx = Math.cos(a), dy = Math.sin(a) + (2 * fall * s) / (L * L);
      const m = Math.hypot(dx, dy);
      return [dx / m, dy / m];
    };
    const pts: string[] = [];
    for (let i = 0; i <= 14; i++) {
      const [px, py] = pos((L * i) / 14);
      pts.push(`${n(px)},${n(py)}`);
    }
    spines.push(`M${pts.join(" L")}`);
    const tilt = (34 * Math.PI) / 180;
    for (let s = L * 0.2; s < L * 0.98; s += 4.4 * size) {
      const [px, py] = pos(s);
      const [ux, uy] = tangent(s);
      const f = (s - L * 0.2) / (L * 0.8);
      const l = 15 * size * (0.4 + 0.6 * Math.sin(Math.PI * (0.15 + 0.7 * f)));
      for (const side of [-1, 1]) {
        let vx = ux * Math.cos(tilt) - uy * Math.sin(tilt) * side;
        let vy = ux * Math.sin(tilt) * side + uy * Math.cos(tilt);
        vy += 0.95;
        const m = Math.hypot(vx, vy);
        vx /= m;
        vy /= m;
        leaflets.push(`M${n(px)},${n(py)} q${n(vx * l * 0.55)},${n(vy * l * 0.4)} ${n(vx * l)},${n(vy * l)}`);
      }
    }
  };
  const spines: string[] = [], leaflets: string[] = [], oldSpines: string[] = [], oldLeaflets: string[] = [];
  for (const [d, l, dr] of old) frond(d, l, dr, oldSpines, oldLeaflets);
  for (const [d, l, dr] of plan) frond(d, l, dr, spines, leaflets);
  // the knot the fronds grow from, and two bunches of dates under it
  const crown = `M${n(tx - knot)},${n(ty + 3 * size)} Q${n(tx)},${n(ty - knot * 1.1)} ${n(tx + knot)},${n(ty + 3 * size)} Q${n(tx)},${n(ty + knot * 0.9)} ${n(tx - knot)},${n(ty + 3 * size)} Z`;
  const dates: string[] = [];
  for (const side of [-1, 1]) {
    const cx = tx + side * 10 * size, cy = ty + 13 * size;
    dates.push(`M${n(tx + side * 3 * size)},${n(ty + 3 * size)} Q${n(cx)},${n(cy - 7 * size)} ${n(cx)},${n(cy)}`);
    for (let k = 0; k < 10; k++) {
      const r = 1.9 * size;
      const dx = cx + (rand() - 0.5) * 8 * size, dy = cy + 1.5 * size + rand() * 10 * size;
      dates.push(`M${n(dx - r)},${n(dy)} a${n(r)},${n(r)} 0 1 0 ${n(2 * r)},0 a${n(r)},${n(r)} 0 1 0 ${n(-2 * r)},0`);
    }
  }
  return { trunk, crown, spines: spines.join(" "), leaflets: leaflets.join(" "), oldSpines: oldSpines.join(" "), oldLeaflets: oldLeaflets.join(" "), dates: dates.join(" ") };
}
const palms = [
  palm(70, 236, -16, 0.95), palm(176, 304, 12), palm(306, 254, -9, 0.9), palm(430, 196, 7, 0.8),
  palm(1990, 204, -7, 0.8), palm(2112, 284, 11), palm(2240, 244, -12, 0.92), palm(2352, 306, 9),
];

// The old town either side: tall Hejazi houses of coral stone banded with timber, each floor marked by a double beam,
// their upper floors hung with rawasheen (latticed wooden bay windows on carved brackets under a fretted hood), small
// arched windows, an arched door, and a sawtooth parapet; behind them a row of plainer houses for depth. Each house
// shows its front in the light and a narrow side wall in shadow.
const town: Layer = [], townBack: Layer = [];
function hejazi(layer: Layer, x: number, w: number, h: number, floors: number, rawasheen: number[] = [], door = true) {
  const top = G - h, side = Math.min(13, w * 0.15), rise = 5;
  layer.push(["mask", `M${x},${G} V${top - 8} H${x + w + side} V${G} Z`]);
  layer.push(["stone", `M${x},${G} V${top} H${x + w} V${G} Z`], ["shade", `M${x + w},${G} V${top} L${x + w + side},${top - rise} V${G} Z`]);
  layer.push(["edge", `M${x},${G} V${top} H${x + w} L${x + w + side},${top - rise} V${G} M${x + w},${top} V${G}`]);
  // the sawtooth parapet along the front and the side
  const teeth: string[] = [];
  for (let t = x; t + 6 <= x + w; t += 8) teeth.push(`M${t},${top} l3,-6 l3,6`);
  for (let t = 0; t + 5 <= side; t += 6.5) teeth.push(`M${n(x + w + t)},${n(top - (rise * t) / side)} l2.5,-5 l2.5,5`);
  layer.push(["edge-fine", teeth.join(" ")]);
  // a beam at every floor, across the front and around the side
  const fh = h / floors, beams: string[] = [];
  for (let f = 1; f < floors; f++) {
    const y = G - fh * f;
    beams.push(`M${x},${n(y)} H${x + w} L${x + w + side},${n(y - rise)} M${x},${n(y + 3)} H${x + w} L${x + w + side},${n(y + 3 - rise)}`);
  }
  layer.push(["edge-fine", beams.join(" ")]);
  // windows on each floor, skipping where a roshan hangs
  const holes: string[] = [], frames: string[] = [];
  for (let f = 0; f < floors; f++) {
    const y1 = G - fh * f - (f === 0 ? 0 : 0);
    const wy = y1 - fh * 0.32;
    for (let wx = x + 12; wx + 8 <= x + w - 8; wx += 20) {
      if (f === 0 && door && Math.abs(wx + 4 - (x + w / 2)) < 16) continue;
      if (rawasheen.some((rf) => rf === f) && Math.abs(wx + 4 - (x + w / 2)) < w * 0.3) continue;
      holes.push(arch(wx + 4, 3.6, wy, wy - fh * 0.26, wy - fh * 0.34) + " Z");
      frames.push(`M${wx - 1},${n(wy + 1.5)} h10`);
    }
  }
  layer.push(["hole", holes.join(" ")], ["edge-fine", frames.join(" ")]);
  // the rawasheen: latticed bays centred on the front, on brackets, under a fretted hood
  for (const f of rawasheen) {
    const rw = Math.min(46, w * 0.52), rx = x + w / 2, y0 = G - fh * f - 6, y1 = G - fh * (f + 1) + 8;
    const bay = box(rx, rw, y0, y1);
    layer.push(["mask", box(rx, rw + 8, y0 + 8, y1 - 9)], ["lattice", bay], ["edge", bay], ["fine", `M${n(rx - rw / 2)},${n((y0 + y1) / 2)} H${n(rx + rw / 2)} M${n(rx - rw / 6)},${n(y0)} V${n(y1)} M${n(rx + rw / 6)},${n(y0)} V${n(y1)}`]);
    layer.push(["slab", box(rx, rw + 8, y1, y1 - 4)], ["edge", box(rx, rw + 8, y1, y1 - 4)]);
    const fret: string[] = [];
    for (let t = rx - rw / 2 - 3; t + 5 <= rx + rw / 2 + 4; t += 6) fret.push(`M${n(t)},${n(y1 - 4)} l2.5,-4 l2.5,4`);
    layer.push(["edge-fine", fret.join(" ")]);
    const br: string[] = [];
    for (const s of [-1, 1]) br.push(`M${n(rx + s * rw * 0.36)},${n(y0)} q${n(s * -1)},6 ${n(s * -5)},8 h${n(s * 3)}`);
    layer.push(["edge-fine", `M${n(rx - rw / 2)},${n(y0 + 3)} H${n(rx + rw / 2)} ${br.join(" ")}`]);
  }
  if (door) {
    const dw = 9, dTop = G - fh * 0.78;
    const opening = arch(x + w / 2, dw, G, dTop + 8, dTop) + " Z";
    layer.push(["hole", opening], ["edge", opening], ["fine", `M${x + w / 2},${G} V${n(dTop + 6)} M${n(x + w / 2 - dw)},${n(dTop + 14)} h${dw * 2}`]);
  }
}
// the back row: plainer and paler, their roofs above the front row
function plain(layer: Layer, x: number, w: number, h: number) {
  const top = G - h;
  layer.push(["mask", `M${x},${G} V${top - 6} H${x + w} V${G} Z`], ["stone", `M${x},${G} V${top} H${x + w} V${G} Z`], ["edge", `M${x},${G} V${top} H${x + w} V${G}`]);
  const teeth: string[] = [];
  for (let t = x; t + 6 <= x + w; t += 8) teeth.push(`M${t},${top} l3,-6 l3,6`);
  const holes: string[] = [];
  for (let wy = top + 18; wy < G - 50; wy += 30) for (let wx = x + 10; wx + 7 <= x + w - 6; wx += 18) holes.push(box(wx + 3.5, 6, wy + 10, wy));
  layer.push(["edge-fine", teeth.join(" ")], ["hole", holes.join(" ")]);
}
for (const [x, w, h] of [[30, 110, 176], [176, 96, 196], [296, 120, 166], [1984, 100, 178], [2116, 120, 198], [2268, 112, 172]]) plain(townBack, x, w, h);
hejazi(town, 6, 96, 124, 3, [2]);
hejazi(town, 112, 82, 96, 2, [], false);
hejazi(town, 204, 118, 152, 3, [1, 2]);
hejazi(town, 334, 92, 112, 3, [2], false);
hejazi(town, 1936, 80, 98, 2, [1]);
hejazi(town, 2026, 124, 148, 3, [1, 2]);
hejazi(town, 2164, 88, 112, 3, [], true);
hejazi(town, 2262, 124, 130, 3, [2]);

// the ground glints below the line, in broken strokes that thin out toward the foot; under the central gate they fade
// softly away (the "calm" mask below), so the credit the footer sets there sits among them
const glints: string[] = [];
for (let y = G + 8, k = 0; y < 790; y += 7, k++) {
  let x = rand() * 30;
  while (x < 2400) {
    const len = 20 + rand() * 120 * (1 - k / 14);
    glints.push(`M${n(x)},${y} h${n(len)}`);
    x += len + 10 + rand() * 60 * (1 + k / 4);
  }
}

const path = (cls: string, d: string) => (d ? `<path class="${cls}" d="${d}"/>` : "");

export function sceneSvg() {
  const style = `
    svg{fill:none;stroke:${INK};stroke-width:1.2;stroke-linejoin:round;stroke-linecap:round}
    .far{opacity:.22}.uhud>:not(.mask){opacity:.42}.hachure{stroke-width:.8}.uhud>.hachure-fine{stroke-width:.6;opacity:.3}
    .town-back>:not(.mask){opacity:.28}.town>:not(.mask){opacity:.7}.stone{fill:url(#eng-h);stroke:none}.lattice{fill:url(#lat);stroke-width:.9}
    .mosque .back{opacity:.4}.mosque .facade{opacity:.86}.mosque .gates{opacity:.92}.mosque .domes,.mosque .towers{opacity:.96}
    .mask{fill:#000;stroke:none}.lit,.wall{fill:url(#eng-v);stroke:none}.shade{fill:url(#eng-v2);stroke:none}.slab{fill:url(#eng-h2);stroke:none}
    .dome{fill:#000;stroke-width:.7}.umbrella{fill:url(#eng-d);stroke-width:.9}
    .edge{stroke-width:1.1}.edge-fine{stroke-width:.8}.fine{stroke-width:.65}.faint{stroke-width:.6;opacity:.35}
    .hole{fill:#000;stroke-width:.8}.gilt{fill:${INK};stroke:none}.gilt-fine{stroke-width:.7}.studs{stroke-width:1.3}
    .palm .trunk{fill:#000;stroke-width:1.1}.palm .bark{fill:url(#bark);stroke:none}
    .palm .spine{stroke-width:1.5}.palm .leaflet{stroke-width:.8;opacity:.88}.palm .crown{fill:#000}
    .palm .old{opacity:.4}.palm .dates{stroke-width:.75}
    .ground{stroke-width:1.4;opacity:.7}.glint{stroke-width:1.2;opacity:.32}`;
  const defs = `<defs>
    <pattern id="eng-h" width="8" height="7" patternUnits="userSpaceOnUse"><path d="M0,3.5 H8" stroke="${INK}" stroke-width="0.9"/></pattern>
    <pattern id="eng-v" width="5" height="8" patternUnits="userSpaceOnUse"><path d="M2.5,0 V8" stroke="${INK}" stroke-width="0.9"/></pattern>
    <pattern id="eng-v2" width="2.6" height="8" patternUnits="userSpaceOnUse"><path d="M1.3,0 V8" stroke="${INK}" stroke-width="0.85"/></pattern>
    <pattern id="eng-h2" width="8" height="3" patternUnits="userSpaceOnUse"><path d="M0,1.5 H8" stroke="${INK}" stroke-width="0.8"/></pattern>
    <pattern id="eng-d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0,3 H6" stroke="${INK}" stroke-width="1"/></pattern>
    <pattern id="eng-x" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0,3 H6 M3,0 V6" stroke="${INK}" stroke-width="0.8"/></pattern>
    <pattern id="lat" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,2 H4 M2,0 V4" stroke="${INK}" stroke-width="0.6"/></pattern>
    <radialGradient id="calm-g" cx="1200" cy="752" r="300" gradientUnits="userSpaceOnUse" gradientTransform="translate(1200 752) scale(1 0.22) translate(-1200 -752)"><stop offset="0.45" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
    <mask id="calm" maskUnits="userSpaceOnUse" x="0" y="0" width="2400" height="800"><rect width="2400" height="800" fill="url(#calm-g)"/></mask>
    <pattern id="bark" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,3.5 H7 M3.5,0 V7" stroke="${INK}" stroke-width="0.9"/></pattern>
  </defs>`;
  const layer = (cls: string, items: Layer) => `<g class="${cls}">${items.map(([c, d]) => path(c, d)).join("")}</g>`;
  const mosque = layer("back", back) + layer("facade", facade) + layer("gates", gates) + layer("domes", domes) + layer("towers", towers);
  const grove = palms.map((p) => `<g class="palm"><g class="old">${path("spine", p.oldSpines)}${path("leaflet", p.oldLeaflets)}</g>${path("trunk", p.trunk)}${path("bark", p.trunk)}${path("leaflet", p.leaflets)}${path("spine", p.spines)}${path("crown", p.crown)}${path("dates", p.dates)}</g>`).join("");
  const hills = `<g class="far">${path("edge-fine", crestPath(farRange))}${path("hachure", hachures(farRange, 0.6))}</g><g class="uhud">${path("mask", massPath(uhud))}${path("edge", crestPath(uhud))}${path("hachure", hachures(uhud, 1))}${path("hachure-fine", hachures(uhud, 0.7, 0.55))}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800" width="2400" height="800"><style>${style}</style>${defs}${hills}${layer("town-back", townBack)}${layer("town", town)}<g class="mosque">${mosque}</g>${grove}${path("ground", `M0,${G} H2400`)}<g mask="url(#calm)">${path("glint", glints.join(" "))}</g></svg>`;
}
