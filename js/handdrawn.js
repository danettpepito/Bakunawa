/* Hand-drawn layer for the story screen.
   A p5 canvas that sits between the SVG scene and the paper textures and draws
   the pieces from the two drawings (ART, from art-data.js):
     stage 0  five clouds, filled in, hiding a large moon
     stage 1  the clouds drift off and the seven moons slide out along the arc
     stage 2  the waves and the body rise together, it eats the six, the clouds close
     stage 3  the clouds part on the serpent curled around the last moon
     stage 4  sounds fill the screen and the serpent shakes
     stage 5  the sounds fade on the last moon, back in its place; the view closes in on it as it glows
   Each piece is rasterised once, its inside found by flood fill, then painted
   in the scene's colours. The line is redrawn in three jittered copies that swap
   a few times a second, so it "boils" like hand animation, in one of four inks
   (C.ink, from the first question):
     crayon  grain of crayon on paper (the original)
     brush   a calligraphic nib: bold across the nib, hairline along it, a few dry-brush skips
     ember   a string of round glowing beads with clear gaps between, flickering,
             with the odd faint spark drifting up
     thread  a running stitch: short clean dashes that follow the line, with gaps between
   All four stay in the scene's own line colour; only the texture changes.
   The serpent (ART.serpent) is the back half of the body, arched, with the tail fin at the left:
     swallowing        it rises with the waves already arched over the sea, its front down in the water
                       on the right, the moons sitting along its back. The whole drawing turns around the
                       centre of its arch, so it dives on into the sea; as the tail passes each of the six
                       it is pulled down into the body and is gone, until the tail too slips under
     the last moon     clouds close in behind it; they part on the whole serpent (ART.curl) curled
                       around the moon */

function HandDrawn(host, api) {
  // the scene's view box; the story screen may pick a different one per window shape (api.view)
  let VB = { x: 0, y: -30, w: 1028, h: 700 };

  // where the cloud drawing sits before the reveal (iconAsset 11 units -> scene units)
  // the opening cover, centred so the whole cloud bank sits inside the frame
  const COVER = { s: .5, moonX: 1085, moonY: 399, moonR: 295, x: 609, y: 300 };
  const CLOUDS = {
    // drawn back to front; dir is where each one drifts when the moon is revealed
    topLeft:     { dir: [-1, -.3],  delay: .1 },
    topRight:    { dir: [1, -.3],   delay: .14 },
    middleLeft:  { dir: [-1, .02],  delay: 0 },
    bottomLeft:  { dir: [-1, .35],  delay: .07 },
    bottomRight: { dir: [1, .3],    delay: .03 },
  };
  // smaller clouds around the bank, reusing the same drawings (scene units, centred on cx, cy;
  // s is the size against the bank, flip mirrors it). Drawn behind the bank, they leave first
  const EXTRA = [
    { src: 'topRight',    cx: 520, cy: 70,  s: .55, flip: true,  dir: [.2, -1],  delay: 0 },
    { src: 'middleLeft',  cx: 150, cy: 470, s: .62, flip: false, dir: [-1, .3],  delay: .02 },
    { src: 'topLeft',     cx: 875, cy: 470, s: .6,  flip: true,  dir: [1, .3],   delay: .04 },
    { src: 'bottomRight', cx: 600, cy: 505, s: .5,  flip: true,  dir: [.3, 1],   delay: .05 },
    { src: 'topLeft',     cx: 945, cy: 285, s: .45, flip: false, dir: [1, 0],    delay: .01 },
    { src: 'bottomLeft',  cx: 95,  cy: 325, s: .45, flip: true,  dir: [-1, 0],   delay: .03 },
    { src: 'middleLeft',  cx: 330, cy: 515, s: .42, flip: true,  dir: [-.4, 1],  delay: .06 },
    { src: 'topRight',    cx: 160, cy: 75,  s: .4,  flip: false, dir: [-1, -.4], delay: .02 },
    // only when the clouds close over the last moon, which sits higher than the bank
    { src: 'topLeft',     cx: 560, cy: 150, s: .8,  flip: false, dir: [.1, -1],  delay: 0, late: true },
  ];
  // the ocean (iconwaves-v2) along the bottom of the scene, in scene units, kept to the drawing's
  // own proportions: its crests reach up to the lowest moons, it runs past both sides, and
  // the bottom of the drawing falls below the view. Wider views scale it up, never stretch it
  const OCEAN = { top: 280, w: 1100, h: 1100 * 481 / 1321.4, skyFrom: 44 / 1321.4 };
  // seven moons on the story's arc (degrees). The serpent climbs the arc from the
  // left, so it eats them in that order, passing over the centre one
  const MOONS = {
    centre: { slot: 0,   ring: 0, rank: -1 },
    left3:  { slot: -62, ring: 3, rank: 0 },
    left2:  { slot: -42, ring: 2, rank: 1 },
    left1:  { slot: -22, ring: 1, rank: 2 },
    right1: { slot: 22,  ring: 1, rank: 3 },
    right2: { slot: 42,  ring: 2, rank: 4 },
    right3: { slot: 62,  ring: 3, rank: 5 },
  };
  // the serpent's moves, in seconds and scene units
  // the drawing turns around the centre of its arch (cx, cy, below the sea) at size s; the moons sit just
  // beyond its back. sweepA is where the tail is, from (left, under the waves) to (right, under again), in
  // degrees from straight up. eat: degrees past a moon until the tail has swallowed it
  const SWEEP = { cx: 514, cy: 600, s: 1.47, from: -72, to: 92, rise: 300, slow: 9, fast: 22, eat: 16 };
  // the curled serpent: its size, and where the moon sits in the coil. The drawing turns around that point
  const CURL = { s: .74, x: 561, y: 182, r: 70, turn: 34, drop: 430 };
  // placeholder sounds, until the drawings arrive: rings on a jittered grid over the whole view.
  // fill and fade are in seconds; hold is how far the moon gets home behind them before they fade
  const NOISE = { cols: 9, rows: 6, r: 118, fill: 13, fade: 5, hold: .6 };
  // the ending: how far the view closes in on the moon and how long that takes (seconds); fit is the most
  // of the view the moon may fill, y where it comes to rest (clear of the words), from how thin the sounds have got
  const FINALE = { zoom: 3, span: 11, fit: .56, y: .44, from: .85 };
  const R_VISITOR = 63, R_COVER = COVER.moonR * COVER.s;
  const PHASE_TABLE = [[0, 1], [24, .72], [40, .5], [55, .3], [66, .12], [82, 0]];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
  function phaseOf(theta) {
    const a = Math.abs(theta);
    for (let i = 0; i < PHASE_TABLE.length - 1; i++) {
      const [a0, k0] = PHASE_TABLE[i], [a1, k1] = PHASE_TABLE[i + 1];
      if (a <= a1) return lerp(k0, k1, (a - a0) / (a1 - a0));
    }
    return 0;
  }

  let pieces = null;          // analysed shapes, by name
  let paint = null, prevPaint = null, paintAt = 0;
  let pendingKey = null;
  let rv = 0;                 // reveal: 0 clouds closed, 1 moons out
  let eaten = 0;              // how far the serpent has got through the six moons
  const gone = [0, 0, 0, 0, 0, 0]; // the same, moon by moon, when the serpent is doing the eating
  const held = [];            // where each swallowed moon is being carried, by rank
  let seaIn = 0;              // the waves rising, from the third answer on
  let noise = 0;              // the sounds: 0 none, 1 the screen covered
  let finale = 0;             // the ending: 0 the whole scene, 1 closed in on the glowing moon
  let sweepA = SWEEP.from, sweepPass = 0; // pass: 0 hunting, 1 gone
  let sweepCnv = null; // the serpent is drawn here first, so it can fade out under the water
  // cover: the clouds closing over the swallowing. Behind them the moon moves into the coil (moonIn);
  // curlOn: the serpent is there once they part. curlIn: it winds itself in; curlOut: it leaves
  let cover = 0, moonIn = 0, curlOn = false, curlIn = 0, curlOut = 0;
  let dpr = 1, scale = 1, offX = 0, offY = 0;
  let builtFor = 0;

  /* ---------- analysis: rasterise, find the inside, sample the line ---------- */

  async function rasterise(svg, w, h) {
    const sized = svg.replace('<svg ', `<svg width="${w}" height="${h}" preserveAspectRatio="none" `);
    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
    try {
      const im = new Image();
      im.src = url;
      await im.decode();
      const c = mk(w, h);
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  async function analyse(name, art, pxPerUnit, kind) {
    const [bx, by, bw, bh] = art.box;
    const w = Math.round(bw * pxPerUnit), h = Math.round(bh * pxPerUnit);
    const c = await rasterise(art.svg, w, h);
    const a = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = a[i * 4 + 3] > 80 ? 1 : 0;

    // walls: the line, thickened enough to close the gaps in crayon strokes. Start
    // small; if the outside leaks in (almost nothing left inside), close wider gaps.
    const base = Math.max(1, Math.round(pxPerUnit * (kind === 'cloud' ? 1.6 : .9)));
    const minInside = kind === 'cloud' ? .3 : kind === 'serpent' ? .2 : .45;
    // keep the fullest attempt in case none clears the bar
    let fill = null;
    for (const k of [1, 2, 3.5, 5.5, 8, 11]) {
      const f = fillInside(ink, w, h, Math.round(base * k), (art.holes || []).map(([x, y]) => [Math.round((x - bx) * pxPerUnit), Math.round((y - by) * pxPerUnit)]));
      if (!fill || f.area > fill.area) fill = f;
      if (f.area / (w * h) > minInside) break;
    }
    const { inside, area, sx, sy } = fill;
    const mask = mk(w, h);
    mask.getContext('2d').putImageData(inside, 0, 0);

    // line samples; on big pieces every other pixel is plenty
    const step = pxPerUnit > 2.4 ? 2 : 1;
    const pts = [];
    for (let y = 0; y < h; y += step) for (let x = (y / step) % 2 ? 1 : 0; x < w; x += step) if (ink[y * w + x]) pts.push(x, y);

    return {
      name, kind, box: art.box, w, h, pxPerUnit, mask, pts: Float32Array.from(pts), step,
      // fitted disc (moons): centre and radius in the drawing's own units
      cxU: bx + sx / area / pxPerUnit, cyU: by + sy / area / pxPerUnit,
      rU: Math.sqrt(area / Math.PI) / pxPerUnit,
    };
  }

  // flood the outside from the edges; whatever it can't reach is the shape's inside
  function fillInside(ink, w, h, grow, holes = []) {
    const wall = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h && dx * dx + dy * dy <= grow * grow) wall[Y * w + X] = 1;
      }
    }
    const out = new Uint8Array(w * h), stack = new Int32Array(w * h);
    let sp = 0;
    const seed = p => { if (!wall[p] && !out[p]) { out[p] = 1; stack[sp++] = p; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    for (const [x, y] of holes) seed(y * w + x);
    while (sp) {
      const p = stack[--sp], x = p % w;
      if (x > 0) seed(p - 1);
      if (x < w - 1) seed(p + 1);
      if (p >= w) seed(p - w);
      if (p < w * (h - 1)) seed(p + w);
    }
    // the outer band of the thickened wall belongs outside; the fill stops under the drawn line
    const touchesOut = p => {
      for (let d = 1; d <= grow; d++) {
        if ((p % w) - d >= 0 && out[p - d]) return true;
        if ((p % w) + d < w && out[p + d]) return true;
        if (p - d * w >= 0 && out[p - d * w]) return true;
        if (p + d * w < w * h && out[p + d * w]) return true;
      }
      return false;
    };
    const inside = new ImageData(w, h);
    let area = 0, sx = 0, sy = 0;
    for (let p = 0; p < w * h; p++) {
      if (out[p] || (wall[p] && !ink[p] && touchesOut(p))) continue;
      inside.data[p * 4 + 3] = 255;
      area++; sx += p % w; sy += (p - p % w) / w;
    }
    return { inside, area, sx, sy };
  }

  // the ocean is open at the bottom, so it can't be filled from the outside in like a cloud.
  // The sky is flooded down from the top edge until it meets the line; everything below is
  // water. The water is then split along the drawn lines into separate pools (each band of a
  // wave, each curl), and every pool is given its own shade when painted
  async function analyseOcean(art, want) {
    const w = Math.round(OCEAN.w * want), h = Math.round(OCEAN.h * want);
    const c = await rasterise(art.svg, w, h);
    const a = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = a[i * 4 + 3] > 80 ? 1 : 0;
    // thicken the line by r in a square, in two sliding passes, so it costs the same at any r
    const dilate = r => {
      const row = new Uint8Array(w * h), out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        let n = 0;
        const o = y * w;
        for (let x = 0; x < Math.min(r, w); x++) n += ink[o + x];
        for (let x = 0; x < w; x++) {
          if (x + r < w) n += ink[o + x + r];
          if (x - r - 1 >= 0) n -= ink[o + x - r - 1];
          row[o + x] = n > 0 ? 1 : 0;
        }
      }
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let y = 0; y < Math.min(r, h); y++) n += row[y * w + x];
        for (let y = 0; y < h; y++) {
          if (y + r < h) n += row[(y + r) * w + x];
          if (y - r - 1 >= 0) n -= row[(y - r - 1) * w + x];
          out[y * w + x] = n > 0 ? 1 : 0;
        }
      }
      return out;
    };
    const stack = new Int32Array(w * h);
    // flood the sky from the top edge; widen the walls until it stops leaking into the water
    let sky = null;
    const unit = Math.max(1, Math.round(want));
    // the left crest runs off the top corner of the drawing, so the flood starts to the right of it
    // and the strip above it is shut, or the sky would pour in over the top and leave it unpainted
    const skyFrom = Math.round(w * OCEAN.skyFrom);
    for (const k of [1, 2, 3, 4.5, 6]) {
      const wall = dilate(Math.round(unit * k));
      for (let y = 0; y < unit * 3; y++) wall.fill(1, y * w, y * w + skyFrom);
      const out = new Uint8Array(w * h);
      let sp = 0, n = 0;
      const seed = p => { if (!wall[p] && !out[p]) { out[p] = 1; stack[sp++] = p; n++; } };
      for (let x = skyFrom; x < w; x++) seed(x);
      while (sp) {
        const p = stack[--sp], x = p % w;
        if (x > 0) seed(p - 1);
        if (x < w - 1) seed(p + 1);
        if (p >= w) seed(p - w);
        if (p < w * (h - 1)) seed(p + w);
      }
      sky = out;
      if (n / (w * h) < .45) break;
    }
    // pools: the water between the lines (walls just thick enough to close the crayon gaps)
    const wall = dilate(Math.round(unit * 1.8));
    const label = new Int32Array(w * h).fill(-1);
    const pools = [];
    for (let p0 = 0; p0 < w * h; p0++) {
      if (sky[p0] || wall[p0] || label[p0] >= 0) continue;
      const id = pools.length;
      let sp = 0, n = 0, sy = 0, minY = h, maxY = 0;
      label[p0] = id; stack[sp++] = p0;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p - x) / w;
        n++; sy += y; if (y < minY) minY = y; if (y > maxY) maxY = y;
        const go = q => { if (!sky[q] && !wall[q] && label[q] < 0) { label[q] = id; stack[sp++] = q; } };
        if (x > 0) go(p - 1);
        if (x < w - 1) go(p + 1);
        if (p >= w) go(p - w);
        if (p < w * (h - 1)) go(p + w);
      }
      pools.push({ n, y: sy / n / h, top: minY / h, span: (maxY - minY) / h });
    }
    // under the line itself: take the nearest pool, so no seams show between the bands
    for (let pass = 0; pass < unit * 4 + 4; pass++) {
      let changed = 0;
      for (let p = 0; p < w * h; p++) {
        if (sky[p] || label[p] >= 0) continue;
        const x = p % w;
        const l = (x > 0 && label[p - 1] >= 0) ? label[p - 1] : (x < w - 1 && label[p + 1] >= 0) ? label[p + 1]
          : (p >= w && label[p - w] >= 0) ? label[p - w] : (p < w * (h - 1) && label[p + w] >= 0) ? label[p + w] : -1;
        if (l >= 0) { label[p] = l; changed++; }
      }
      if (!changed) break;
    }
    // the water's surface, column by column (0 top, 1 bottom), softened so the serpent doesn't catch on every curl
    const top = new Float32Array(w), surf = new Float32Array(w), soft = Math.round(w * .012);
    for (let x = 0; x < w; x++) { let y = 0; while (y < h - 1 && sky[y * w + x]) y++; top[x] = y / h; }
    for (let x = 0; x < w; x++) {
      let n = 0, sum = 0;
      for (let d = Math.max(0, x - soft); d <= Math.min(w - 1, x + soft); d++) { sum += top[d]; n++; }
      surf[x] = sum / n;
    }
    const step = want > 2.4 ? 2 : 1;
    const pts = [];
    for (let y = 0; y < h; y += step) for (let x = (y / step) % 2 ? 1 : 0; x < w; x += step) if (ink[y * w + x]) pts.push(x, y);
    return { name: 'ocean', kind: 'ocean', box: [0, 0, OCEAN.w, OCEAN.h], w, h, pxPerUnit: want, label, pools, surf, pts: Float32Array.from(pts), step };
  }

  // the back half of the serpent, filled like a cloud; tailAt is the tail, in degrees from straight up around the arch
  async function analyseSerpent(art, pxPerUnit) {
    const pc = await analyse('serpent', art, pxPerUnit, 'serpent'), [x, y] = art.pivot, [rIn, rOut] = art.body;
    const tailAt = Math.atan2(art.tail[0] - x, y - art.tail[1]) * 180 / Math.PI;
    return Object.assign(pc, { cxU: x, cyU: y, rIn, rOut, rMid: (rIn + rOut) / 2, tailAt });
  }

  // the whole serpent in one piece: filled like a cloud, shaded around the moon like the coil
  async function analyseCurl(art, pxPerUnit) {
    const pc = await analyse('curl', art, pxPerUnit, 'serpent'), [x, y, r] = art.moon;
    return Object.assign(pc, { cxU: x, cyU: y, rIn: r, rOut: r * 3.2 });
  }

  async function analyseAll() {
    const want = scale * dpr;
    builtFor = want;
    const list = [];
    for (const n in CLOUDS) list.push(analyse(n, ART.clouds[n], COVER.s * want, 'cloud'));
    const rC = 108; // rough centre-moon radius in iconAsset 12 units; refined after analysis
    for (const n in MOONS) {
      const maxR = n === 'centre' ? R_COVER : 46;
      list.push(analyse(n, ART.moons[n], maxR / rC * want * 1.05, 'moon'));
    }
    if (ART.ocean) list.push(analyseOcean(ART.ocean, want));
    if (ART.serpent) list.push(analyseSerpent(ART.serpent, SWEEP.s * 1.1 * want));
    if (ART.curl) list.push(analyseCurl(ART.curl, CURL.s * 1.1 * want));
    const done = await Promise.all(list);
    pieces = {};
    for (const pc of done) pieces[pc.name] = pc;
    paint = paintAll(pendingKey || api.colours());
    prevPaint = null;
  }

  /* ---------- painting: colour the inside, draw the line as crayon ---------- */

  // each pool of water in one of the sea's shades: deeper and darker low down, lighter
  // towards the crests, small pools (the hearts of the curls) in foam, with a little variety
  function paintOcean(pc, C) {
    const c = mk(pc.w, pc.h), x = c.getContext('2d');
    const shades = [C.sea1, C.sea2, C.sea3, C.sea4].map(hexRgb), foam = hexRgb(C.seaFoam);
    const big = pc.w * pc.h * .0015;
    const col = pc.pools.map((P, i) => {
      if (P.n < big && P.span < .12) return foam;
      // higher pools (the crests) lean light, lower ones deep, with plenty of mixing
      const k = Math.floor(hash(i * 3.7 + 1.3) * 4 + (.55 - P.y) * 1.6);
      return shades[Math.max(0, Math.min(3, k))];
    });
    const a = C.line === 'painted' ? 255 : C.line === 'linework' ? 190 : 120;
    const img = x.createImageData(pc.w, pc.h), D = img.data, L = pc.label;
    for (let p = 0; p < L.length; p++) {
      const l = L[p];
      if (l < 0) continue;
      const k = col[l], y = (p - p % pc.w) / pc.w / pc.h;
      // a soft darkening towards the bottom of the view
      const f = 1 - y * .18;
      D[p * 4] = k[0] * f; D[p * 4 + 1] = k[1] * f; D[p * 4 + 2] = k[2] * f; D[p * 4 + 3] = a;
    }
    x.putImageData(img, 0, 0);
    // flecks of light on the water, like the dots in the reference
    x.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 220; i++) {
      const X = hash(i * 1.37) * pc.w, Y = hash(i * 2.11 + 5) * pc.h, R = (.6 + hash(i * 4.3) * 1.6) * pc.pxPerUnit;
      x.fillStyle = rgba(C.seaFoam, .25 + hash(i * .77) * .35);
      x.beginPath(); x.arc(X, Y, R, 0, Math.PI * 2); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  // a dark back shading to a paler belly, in the same dried-gouache blooms as the clouds
  function paintSerpent(pc, C) {
    const c = mk(pc.w, pc.h), x = c.getContext('2d'), k = pc.pxPerUnit;
    const g = x.createRadialGradient(pc.cxU * k, pc.cyU * k, pc.rIn * k, pc.cxU * k, pc.cyU * k, pc.rOut * k);
    g.addColorStop(0, C.serpentBelly); g.addColorStop(.55, C.serpentBack); g.addColorStop(1, C.serpentBack);
    x.fillStyle = g; x.fillRect(0, 0, pc.w, pc.h);
    for (let i = 0; i < 26; i++) {
      const X = hash(i * 1.9 + 3) * pc.w, Y = hash(i * 3.7 + 1) * pc.h, R = (.05 + hash(i * 5.3) * .09) * pc.w;
      const b = x.createRadialGradient(X, Y, 0, X, Y, R);
      b.addColorStop(0, rgba(C.serpentBelly, .1 + hash(i * 2.3) * .14)); b.addColorStop(1, rgba(C.serpentBelly, 0));
      x.fillStyle = b; x.fillRect(X - R, Y - R, R * 2, R * 2);
    }
    x.globalCompositeOperation = 'destination-in';
    x.globalAlpha = C.line === 'painted' ? 1 : C.line === 'linework' ? .75 : .5;
    x.drawImage(pc.mask, 0, 0);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintFill(pc, C) {
    if (pc.kind === 'ocean') return paintOcean(pc, C);
    if (pc.kind === 'serpent') return paintSerpent(pc, C);
    const c = mk(pc.w, pc.h), x = c.getContext('2d');
    const style = C.line;
    if (pc.kind === 'cloud') {
      const g = x.createLinearGradient(0, 0, 0, pc.h);
      g.addColorStop(0, C.cloudTop); g.addColorStop(1, C.cloudBottom);
      x.fillStyle = g; x.fillRect(0, 0, pc.w, pc.h);
      // soft blooms, like gouache that dried unevenly
      for (let i = 0; i < 14; i++) {
        const X = hash(i + pc.w) * pc.w, Y = hash(i * 3.3 + pc.h) * pc.h, R = (.12 + hash(i * 7.1) * .25) * Math.max(pc.w, pc.h);
        const b = x.createRadialGradient(X, Y, 0, X, Y, R);
        b.addColorStop(0, rgba(C.cloudGlow, .16 + hash(i * 1.9) * .14)); b.addColorStop(1, rgba(C.cloudGlow, 0));
        x.fillStyle = b; x.fillRect(X - R, Y - R, R * 2, R * 2);
      }
    } else {
      const a = style === 'painted' ? 1 : style === 'linework' ? .09 : .035;
      const cx = (pc.cxU - pc.box[0]) * pc.pxPerUnit, cy = (pc.cyU - pc.box[1]) * pc.pxPerUnit, r = pc.rU * pc.pxPerUnit;
      x.globalAlpha = a;
      x.fillStyle = C.lit; x.fillRect(0, 0, pc.w, pc.h);
      if (style === 'painted') {
        // light from the upper left, a cooler rim, and a few soft maria
        const g = x.createRadialGradient(cx - r * .35, cy - r * .4, r * .1, cx, cy, r * 1.05);
        g.addColorStop(0, 'rgba(255,250,238,.55)'); g.addColorStop(.7, 'rgba(255,250,238,0)'); g.addColorStop(1, rgba(C.crater, .55));
        x.fillStyle = g; x.fillRect(0, 0, pc.w, pc.h);
        const seed = pc.name.length * 13 + pc.w;
        for (let i = 0; i < 6; i++) {
          const ang = hash(seed + i) * 6.28, d = hash(seed + i * 2.7) * r * .6, R = r * (.14 + hash(seed + i * 5.3) * .2);
          const X = cx + Math.cos(ang) * d, Y = cy + Math.sin(ang) * d;
          const b = x.createRadialGradient(X, Y, 0, X, Y, R);
          b.addColorStop(0, rgba(C.crater, .38)); b.addColorStop(1, rgba(C.crater, 0));
          x.fillStyle = b; x.fillRect(X - R, Y - R, R * 2, R * 2);
        }
      }
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(pc.mask, 0, 0);
    return c;
  }

  // the line as a plain mask (every sampled ink pixel), for the inks that are drawn through it
  function lineMask(pc, grow) {
    const c = mk(pc.w, pc.h), x = c.getContext('2d'), P = pc.pts, sz = pc.step + grow * 2;
    x.fillStyle = '#000';
    x.beginPath();
    for (let i = 0; i < P.length; i += 2) x.rect(P[i] - grow, P[i + 1] - grow, sz, sz);
    x.fill();
    return c;
  }
  // the moon answer's "dotted" look carried into the other inks: break the line into dabs
  function breakUp(x, pc, keep) {
    x.globalCompositeOperation = 'destination-out';
    const cell = Math.max(5, pc.pxPerUnit * 3);
    for (let Y = 0; Y < pc.h; Y += cell) for (let X = 0; X < pc.w; X += cell)
      if (hash(X * .37 + Y * 31.1) > keep) x.fillRect(X, Y, cell, cell);
    x.globalCompositeOperation = 'source-over';
  }

  // the line sorted into square cells, in scene units: each cell's middle, and the way the line
  // runs through it, so the bead and stitch inks can place one clean mark per cell
  function lineCells(pc, size) {
    const g = size * builtFor, P = pc.pts, cells = new Map();
    for (let i = 0; i < P.length; i += 2) {
      const key = Math.floor(P[i] / g) * 65536 + Math.floor(P[i + 1] / g);
      let c = cells.get(key);
      if (!c) cells.set(key, c = { n: 0, x: 0, y: 0, xx: 0, yy: 0, xy: 0 });
      c.n++; c.x += P[i]; c.y += P[i + 1]; c.xx += P[i] * P[i]; c.yy += P[i + 1] * P[i + 1]; c.xy += P[i] * P[i + 1];
    }
    return [...cells.values()].filter(c => c.n > 2).map(c => {
      const x = c.x / c.n, y = c.y / c.n, a = c.xx / c.n - x * x, b = c.yy / c.n - y * y, d = c.xy / c.n - x * y;
      return { x, y, ang: .5 * Math.atan2(2 * d, a - b) };
    });
  }

  function paintBrush(pc, col, variant, dotted) {
    // a flat nib held at about 40 degrees: drag the line mask along the nib, so strokes
    // across the nib come out broad and strokes along it stay hairline-thin
    const c = mk(pc.w, pc.h), x = c.getContext('2d');
    const m = lineMask(pc, 0);
    const ang = (-40 + (variant - 1) * 4) * Math.PI / 180, L = Math.max(2.5, builtFor * 2.3);
    const tint = mk(pc.w, pc.h), tx = tint.getContext('2d');
    tx.drawImage(m, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = col; tx.fillRect(0, 0, pc.w, pc.h);
    for (let t = -L; t <= L; t += .7) x.drawImage(tint, Math.cos(ang) * t, Math.sin(ang) * t);
    // dry-brush: the bristles skip on the paper's tooth, in streaks along the nib
    x.globalCompositeOperation = 'destination-out';
    x.strokeStyle = '#000'; x.lineWidth = Math.max(.6, pc.pxPerUnit * .25);
    const n = Math.round(pc.w * pc.h / 700);
    for (let i = 0; i < n; i++) {
      const X = hash(i * 1.7 + variant * 3.1) * pc.w, Y = hash(i * 2.9 + variant * 5.3) * pc.h, len = (2 + hash(i * .9) * 7) * pc.pxPerUnit * .5;
      x.globalAlpha = .45 + hash(i * 4.1) * .55;
      x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(ang + Math.PI / 2) * len, Y + Math.sin(ang + Math.PI / 2) * len); x.stroke();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    if (dotted) breakUp(x, pc, .45);
    return c;
  }

  function paintEmber(pc, col, variant, dotted) {
    // the line as round beads in its own colour, each a little brighter or dimmer per copy
    // so it flickers, over a faint halo of the same colour
    const c = mk(pc.w, pc.h), x = c.getContext('2d');
    const core = mk(pc.w, pc.h), cx = core.getContext('2d');
    const [r, g, b] = hexRgb(col), R = builtFor * 1.15;
    lineCells(pc, 4.6).forEach((d, n) => {
      const h = hash(n * .53 + variant * 3.1), k = .86 + h * .24;
      cx.fillStyle = `rgba(${Math.min(255, Math.round(r * k + 10))},${Math.min(255, Math.round(g * k + 6))},${Math.min(255, Math.round(b * k))},${(.72 + h * .28).toFixed(2)})`;
      cx.beginPath(); cx.arc(d.x, d.y, R * (.82 + hash(n * 1.7) * .36), 0, Math.PI * 2); cx.fill();
    });
    if (dotted) breakUp(cx, pc, .55);
    x.filter = `blur(${Math.max(3, builtFor * 2.4).toFixed(1)}px)`;
    x.globalAlpha = .6; x.drawImage(core, 0, 0);
    x.filter = 'none'; x.globalAlpha = 1;
    x.drawImage(core, 0, 0);
    return c;
  }

  function paintThread(pc, col, variant, dotted) {
    // a running stitch: a dash along the line in each cell, slightly uneven as if sewn by hand,
    // with a lighter strand down the middle of each
    const c = mk(pc.w, pc.h), x = c.getContext('2d');
    const [r, g, b] = hexRgb(col), half = builtFor * 2.2, w = builtFor * 1.65;
    x.lineCap = 'round';
    lineCells(pc, 6.2).forEach((d, n) => {
      const a = d.ang + (hash(n * 2.9 + variant) - .5) * .1, l = half * (.85 + hash(n * 1.3) * .3);
      const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
      x.beginPath(); x.moveTo(d.x - dx, d.y - dy); x.lineTo(d.x + dx, d.y + dy);
      x.strokeStyle = `rgb(${Math.round(r * .84)},${Math.round(g * .84)},${Math.round(b * .84)})`; x.lineWidth = w; x.stroke();
      x.strokeStyle = `rgb(${Math.min(255, r + 14)},${Math.min(255, g + 14)},${Math.min(255, b + 14)})`; x.lineWidth = w * .42; x.stroke();
    });
    if (dotted) breakUp(x, pc, .6);
    return c;
  }

  function paintInk(pc, C, variant) {
    const c = mk(pc.w, pc.h), x = c.getContext('2d');
    const dotted = C.line === 'dotted';
    const col = pc.kind === 'cloud' || pc.kind === 'serpent' ? C.cloudLine : pc.kind === 'ocean' ? C.seaLine : C.line === 'painted' ? C.moonLine : C.lit;
    if (C.ink === 'brush') return paintBrush(pc, col, variant, dotted);
    if (C.ink === 'ember') return paintEmber(pc, col, variant, dotted);
    if (C.ink === 'thread') return paintThread(pc, col, variant, dotted);
    x.fillStyle = rgba(col, pc.kind === 'moon' ? .92 : .95);
    const unit = Math.max(1, pc.pxPerUnit);
    const s = Math.max(1.4, Math.min(3.2, unit * .55)) * (dotted ? 1.5 : 1) * Math.max(1, pc.step * .8);
    const jit = s * .55;
    const P = pc.pts;
    x.beginPath();
    for (let i = 0; i < P.length; i += 2) {
      const n = i * .5;
      if (dotted && hash(n * .37 + Math.floor(P[i] / 7) + Math.floor(P[i + 1] / 7) * 31) > .2) continue;
      const h1 = hash(n * 1.31 + variant * 17.7), h2 = hash(n * 2.07 + variant * 9.1);
      const stray = hash(n * .71) < .025 ? 2.6 : 1;
      x.rect(P[i] + (h1 - .5) * 2 * jit * stray - s / 2, P[i + 1] + (h2 - .5) * 2 * jit * stray - s / 2, s, s);
    }
    x.fill();
    return c;
  }

  function paintAll(C) {
    const out = { C, key: JSON.stringify(C) };
    for (const n in pieces) {
      const pc = pieces[n];
      out[n] = { fill: paintFill(pc, C), ink: [0, 1, 2].map(v => paintInk(pc, C, v)) };
    }
    return out;
  }

  /* ---------- p5 sketch ---------- */

  let hostW = 0, hostH = 0;
  function measure() {
    hostW = host.clientWidth; hostH = host.clientHeight;
    if (api.view) VB = api.view(hostW, hostH);
    scale = Math.max(hostW / VB.w, hostH / VB.h);
    offX = (hostW - VB.w * scale) / 2; offY = (hostH - VB.h * scale) / 2;
  }

  new p5(p => {
    p.setup = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      p.pixelDensity(dpr);
      measure();
      const cnv = p.createCanvas(hostW, hostH);
      cnv.elt.classList.add('hand');
      cnv.elt.setAttribute('aria-hidden', 'true');
      // keep the canvas just above the scene, below the paper textures
      const scene = host.querySelector('#scene');
      if (scene && scene.nextSibling !== cnv.elt) host.insertBefore(cnv.elt, scene.nextSibling);
      new ResizeObserver(() => {
        measure();
        if (hostW > 0 && hostH > 0 && (hostW !== p.width || hostH !== p.height)) p.resizeCanvas(hostW, hostH);
        // re-rasterise if the screen got noticeably bigger than what the pieces were drawn for
        if (pieces && scale * dpr > builtFor * 1.3) analyseAll();
      }).observe(host);
      if (hostW > 0) analyseAll();
    };

    p.draw = () => {
      const ctx = p.drawingContext;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, p.width * dpr, p.height * dpr);
      if (!pieces) { if (!builtFor && hostW > 0) analyseAll(); return; }
      if (pendingKey && JSON.stringify(pendingKey) !== paint.key) {
        prevPaint = paint; paint = paintAll(pendingKey); paintAt = performance.now();
      }
      pendingKey = null;

      const S = api.get();
      const dt = Math.min(.05, p.deltaTime / 1000 || .016);
      rv = S.stage >= 1 ? Math.min(1, rv + dt / 5.5) : Math.max(0, rv - dt / 3);
      // the story only gives one moon back: once eaten, the other six stay gone until a new visit
      seaIn = S.stage >= 2 ? Math.min(1, seaIn + dt / 4.5) : Math.max(0, seaIn - dt / 3);
      eaten = S.stage >= 2 ? Math.max(eaten, S.swallow) : S.swallow;
      if (pieces.serpent) serpentStep(S, dt);
      if (S.stage < 5) finale = Math.max(0, finale - dt / 1.5);
      else if (noise < FINALE.from && !(curlOn && curlOut < 1)) finale = S.rm ? 1 : Math.min(1, finale + dt / FINALE.span);

      const a = scale * dpr;
      ctx.setTransform(a, 0, 0, a, offX * dpr - VB.x * a, offY * dpr - VB.y * a);
      const cam = camera();
      if (cam) { ctx.translate(cam.px, cam.py); ctx.scale(cam.z, cam.z); ctx.translate(-cam.mx, -cam.my); }

      const fade = prevPaint ? clamp((performance.now() - paintAt) / 1400) : 1;
      if (prevPaint && fade < 1) { drawScene(ctx, prevPaint, S, 1); drawScene(ctx, paint, S, fade); }
      else { prevPaint = null; drawScene(ctx, paint, S, 1); }
      sparkRGB = hexRgb(paint.C.cloudLine).join(',');
      sparkStep(ctx, S, paint.C.ink === 'ember');
    };
  }, host);

  /* ---------- sparks, for the ember ink ---------- */
  // each drawn piece offers places to throw sparks from: its line pixels, mapped to the scene
  let sparks = [], emitters = [], lastSparkT = 0;
  function emitFrom(pc, x, y, w, h, a) { if (a > .3) emitters.push({ pc, x, y, sx: w / pc.w, sy: h / pc.h, a }); }
  let sparkRGB = '255,240,220';
  function sparkStep(ctx, S, on) {
    const dt = clamp(S.t - lastSparkT, 0, .1); lastSparkT = S.t;
    if (on && emitters.length) {
      // about 30 a second across everything on screen
      let want = dt * 9;
      while (want > 0 && sparks.length < 60) {
        if (want < 1 && Math.random() > want) break;
        want--;
        const e = emitters[Math.floor(Math.random() * emitters.length)], P = e.pc.pts;
        if (!P.length) continue;
        const i = Math.floor(Math.random() * P.length / 2) * 2;
        sparks.push({ x: e.x + P[i] * e.sx, y: e.y + P[i + 1] * e.sy, vx: (Math.random() - .5) * 8, vy: -8 - Math.random() * 14,
          life: 0, max: 1.2 + Math.random() * 1.6, r: .5 + Math.random() * .6, ph: Math.random() * 6.28 });
      }
    }
    emitters = [];
    if (!sparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    sparks = sparks.filter(p => {
      p.life += dt;
      if (p.life >= p.max) return false;
      p.vy += -6 * dt; p.vx += Math.sin(S.t * 3 + p.ph) * 10 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = p.life / p.max, a = (1 - f) * (f < .15 ? f / .15 : 1) * .55;
      ctx.fillStyle = `rgba(${sparkRGB},${(a * .3).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${sparkRGB},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    ctx.restore();
  }

  // the ending's view: the moon at (mx, my) is carried to (px, py) and everything grows z times around it
  function camera() {
    const e = easeInOut(finale);
    if (e <= 0) return null;
    const [mx, my] = api.arcPos(0), most = FINALE.fit * Math.min(VB.w, VB.h) / (2 * R_VISITOR);
    return { mx, my, z: lerp(1, Math.min(FINALE.zoom, most), e), px: lerp(mx, VB.x + VB.w / 2, e), py: lerp(my, VB.y + VB.h * FINALE.y, e) };
  }

  function drawScene(ctx, P, S, alpha) {
    const fps = S.motion === 'still' ? 3 : 7;
    const bf = Math.floor(S.t * fps) % 3;
    const wob = S.motion === 'still' ? 0 : 1;

    // the seven moons
    const centre = api.arcPos(0);
    const m = easeInOut((rv - .12) / .55);
    for (const n of ['left3', 'right3', 'left2', 'right2', 'left1', 'right1']) {
      const M = MOONS[n];
      const pr = easeOut((rv - .38 - .09 * M.ring) / .5);
      if (pr <= 0) continue;
      let theta = M.slot * pr;
      if (S.motion === 'orbit') theta += Math.sin(S.mt * .5 + M.slot) * 3;
      const [x, y0] = api.arcPos(theta);
      const y = y0 + (S.motion === 'tide' ? Math.sin(S.mt * .9 + M.slot * .1) * 3 : 0);
      const r = (46 - .17 * Math.abs(M.slot)) * lerp(.55, 1, pr);
      const edge = clamp((82 - Math.abs(theta)) / 12), k = lerp(1, phaseOf(theta), pr), side = theta < 0 ? 1 : -1;
      if (pieces.serpent) {
        // taken as the tail goes by: pulled down into the body behind it, shrinking, and is gone
        const g = gone[M.rank], at = held[M.rank];
        if (g >= 1 && !at) continue;
        const e = easeInOut(g);
        drawMoon(ctx, P, n, at ? lerp(x, at[0], e) : x, at ? lerp(y, at[1], e) : y, r * (1 - .6 * g), k, side, alpha * pr * edge * (1 - g * g), 0, bf);
        continue;
      }
      const g = clamp(eaten - M.rank);
      drawMoon(ctx, P, n, x, y, r * (1 - .25 * g), k, side, alpha * pr * edge * (1 - .94 * g), 0, bf);
    }
    // the body passes behind the last moon, so it can never swallow it
    if (pieces.serpent && S.stage >= 2 && sweepPass === 0) drawSweep(ctx, P, S, alpha, bf);
    const vx = lerp(COVER.x, centre[0], m), vy = lerp(COVER.y, centre[1], m) + Math.sin(S.t * .4) * 2 * wob * (1 - m);
    const mi = easeInOut(moonIn);
    const lastX = lerp(vx, CURL.x, mi), lastY = lerp(vy, CURL.y, mi), lastR = lerp(lerp(R_COVER, R_VISITOR, m), CURL.r, mi);
    const lux = alpha * easeInOut(finale * 1.5) * (S.rm ? 1 : 1 + Math.sin(S.t * .8) * .07);
    if (lux > 0) drawHalo(ctx, P, lastX, lastY, lastR, lux);
    drawMoon(ctx, P, 'centre', lastX, lastY, lastR, S.k, -1, alpha, S.ecl, bf);
    if (lux > 0) drawShine(ctx, P, lastX, lastY, lastR, lux);

    // the ocean rises in with the body, then swells gently (more on a "tide" night)
    if (pieces.ocean) {
      const { sea, x, y, w, h } = oceanAt(S), pc = pieces.ocean;
      if (sea > 0) {
        ctx.globalAlpha = alpha * sea;
        ctx.drawImage(P.ocean.fill, x, y, w, h);
        ctx.drawImage(P.ocean.ink[(bf + 2) % 3], x, y, w, h);
        if (P.C.ink === 'ember') emitFrom(pc, x, y, w, h, ctx.globalAlpha * .5);
        ctx.globalAlpha = 1;
      }
    }

    // in front of the water, so the whole of it shows
    if (pieces.curl) drawCurl(ctx, P, S, alpha, bf);

    // the same clouds as the opening, drifting back in as the moons are eaten
    const open = Math.min(rv, 1 - cover);

    // the small clouds first, so the bank sits in front of them
    EXTRA.forEach((e, j) => {
      const pc = pieces[e.src];
      const out = easeInOut(((e.late ? 1 - cover : open) - e.delay) / .55);
      if (out >= 1) return;
      const bob = (1 - out) * wob;
      const w = pc.box[2] * COVER.s * e.s, h = pc.box[3] * COVER.s * e.s;
      const x = e.cx - w / 2 + e.dir[0] * out * 700 + Math.sin(S.t * .19 + j * 2.1) * 5 * bob;
      const y = e.cy - h / 2 + e.dir[1] * out * 420 + Math.sin(S.t * .27 + j * 1.3) * 2.5 * bob;
      ctx.globalAlpha = alpha * (1 - clamp((out - .7) / .3));
      ctx.save();
      if (e.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
      ctx.drawImage(P[e.src].fill, 0, 0, w, h);
      ctx.drawImage(P[e.src].ink[(bf + j + 1) % 3], 0, 0, w, h);
      ctx.restore();
      if (P.C.ink === 'ember' && !e.flip) emitFrom(pc, x, y, w, h, ctx.globalAlpha * .6);
    });

    // the clouds, drawn last so they cover the moon until the reveal
    let i = 0;
    for (const n in CLOUDS) {
      const c = CLOUDS[n], pc = pieces[n];
      const out = easeInOut((open - c.delay) / .62);
      if (out >= 1) { i++; continue; }
      const bob = (1 - out) * wob;
      const dx = c.dir[0] * out * 760 + Math.sin(S.t * .23 + i * 1.7) * 6 * bob;
      const dy = c.dir[1] * out * 300 + Math.sin(S.t * .31 + i * 2.3) * 3 * bob;
      const x = COVER.x + (pc.box[0] - COVER.moonX) * COVER.s + dx;
      const y = COVER.y + (pc.box[1] - COVER.moonY) * COVER.s + dy;
      const w = pc.box[2] * COVER.s, h = pc.box[3] * COVER.s;
      ctx.globalAlpha = alpha * (1 - clamp((out - .75) / .25));
      ctx.drawImage(P[n].fill, x, y, w, h);
      ctx.drawImage(P[n].ink[(bf + i) % 3], x, y, w, h);
      if (P.C.ink === 'ember') emitFrom(pc, x, y, w, h, ctx.globalAlpha);
      i++;
    }
    ctx.globalAlpha = 1;

    if (noise > 0) drawNoise(ctx, P, S, alpha, bf);
  }

  /* ---------- the glow ---------- */

  // light spilling out into the sky around the moon, in the moon's own colour
  function drawHalo(ctx, P, x, y, r, lux) {
    const g = ctx.createRadialGradient(x, y, r * .9, x, y, r * 4.6);
    g.addColorStop(0, rgba(P.C.lit, .78 * lux)); g.addColorStop(.22, rgba(P.C.lit, .38 * lux));
    g.addColorStop(.55, rgba(P.C.lit, .12 * lux)); g.addColorStop(1, rgba(P.C.lit, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // and the moon itself lit from within, evenly, so its markings still show
  function drawShine(ctx, P, x, y, r, lux) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(P.C.lit, .32 * lux)); g.addColorStop(.7, rgba(P.C.lit, .27 * lux)); g.addColorStop(1, rgba(P.C.lit, .18 * lux));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.01, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ---------- the sounds ---------- */

  // each one swells in at its own moment, so they build until they cover everything, then all fade together
  function drawNoise(ctx, P, S, alpha, bf) {
    const C = P.C, { cols, rows, r } = NOISE;
    const fading = S.stage >= 5, n = cols * rows;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const at = hash(i * 3.7) * .72;
      const grow = fading ? 1 : easeOut((noise - at) / .28);
      if (grow <= 0) continue;
      const col = i % cols, row = Math.floor(i / cols);
      const x = VB.x + VB.w * (col + .5 + (hash(i + 9) - .5) * .5) / cols;
      const y = VB.y + VB.h * (row + .5 + (hash(i + 21) - .5) * .5) / rows;
      const pulse = S.rm ? 1 : 1 + Math.sin(S.t * 5 + i * 1.9) * .035, size = r * grow * pulse;
      ctx.globalAlpha = alpha * (fading ? noise : Math.min(1, grow * 1.4));
      ctx.fillStyle = i % 2 ? C.cloudTop : C.cloudBottom;
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.cloudLine; ctx.lineWidth = 2.4;
      for (let k = 1; k <= 3; k++) {
        const from = hash(i + k * 5) * 6.28 + bf * .35;
        ctx.beginPath(); ctx.arc(x, y, size * k / 3.4, from, from + 4.2 + hash(i * k) * 1.6); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- the serpent ---------- */

  function oceanAt(S) {
    const sw = S.motion === 'tide' ? 2 : S.motion === 'still' ? 0 : 1, sea = easeOut(seaIn);
    const w = Math.max(OCEAN.w, VB.w + 40), h = w * OCEAN.h / OCEAN.w;
    return { sea, w, h, x: 514 - w / 2 + Math.sin(S.mt * .35) * 6 * sw, y: OCEAN.top + (1 - sea) * h * .7 + Math.sin(S.mt * .5) * 3 * sw };
  }
  // the height of the water at x, in scene units
  function waterAt(S, x) {
    const pc = pieces.ocean;
    if (!pc) return VB.y + VB.h;
    const o = oceanAt(S), col = Math.round(clamp((x - o.x) / o.w) * (pc.w - 1));
    return o.y + pc.surf[col] * o.h;
  }
  // where the serpent goes under: the drawn water, or the dark sea beneath the words where the waves part
  const surfaceAt = (S, x) => Math.min(waterAt(S, x), 530);

  const moonAt = rank => { for (const n in MOONS) if (MOONS[n].rank === rank) return api.arcPos(MOONS[n].slot); };

  // how far below its place the serpent is: it comes up with the waves
  const tailLift = () => (1 - easeOut(seaIn)) * SWEEP.rise;
  // a point at angle a (degrees from straight up) and distance r from the centre of the arch
  const onArch = (a, r) => { const t = a * Math.PI / 180; return [SWEEP.cx + r * Math.sin(t), SWEEP.cy - r * Math.cos(t) + tailLift()]; };
  const moonAngle = k => { const [x, y] = moonAt(k); return Math.atan2(x - SWEEP.cx, SWEEP.cy - y) * 180 / Math.PI; };

  function serpentStep(S, dt) {
    const still = S.motion === 'still';
    if (S.stage < 2) {
      sweepA = SWEEP.from; sweepPass = 0; held.length = 0;
      for (let k = 0; k < 6; k++) gone[k] = clamp(S.swallow - k);
    } else if (still) {
      for (let k = 0; k < 6; k++) gone[k] = Math.max(gone[k], clamp(S.swallow - k));
      sweepPass = 1; sweepA = SWEEP.to;
    } else {
      if (sweepPass === 0 && rv >= 1 && seaIn >= .8) { // not before the moons are all out and it has risen
        // slow among the moons, so they go one by one
        sweepA += lerp(SWEEP.slow, SWEEP.fast, clamp((Math.abs(sweepA) - 52) / 14)) * dt;
        if (sweepA >= SWEEP.to) { sweepA = SWEEP.to; sweepPass = 1; }
        // the tail reaches a moon: it is drawn down into the body just ahead of the tail, and goes
        const pc = pieces.serpent, into = onArch(sweepA + 6, pc.rMid * SWEEP.s);
        for (let k = 0; k < 6; k++) {
          const past = sweepA - moonAngle(k);
          if (past < 0) continue;
          gone[k] = Math.max(gone[k], clamp(past / SWEEP.eat));
          if (gone[k] < 1) held[k] = into; else delete held[k];
        }
      }
    }
    curlStep(S, dt, still);
  }

  // the clouds only start to close once the last moon is gone, and are shut as the tail goes under,
  // so every moon is seen going (half closed, the clouds already hide most of the sky)
  function eatenSoFar(S, still) {
    if (still) return clamp(S.swallow / 7);
    if (sweepPass >= 1) return 1;
    const a = moonAngle(5) + SWEEP.eat * .6, b = SWEEP.to;
    return clamp((sweepA - a) / (b - a));
  }

  function curlStep(S, dt, still) {
    if (S.stage < 2) { cover = Math.max(0, cover - dt / 3); curlOn = false; curlIn = curlOut = 0; }
    else {
      const want = S.stage >= 5 || (S.stage >= 3 && curlOn) ? 0 : eatenSoFar(S, still);
      cover = want > cover ? Math.min(want, cover + dt / 3) : Math.max(want, cover - dt / 5.5);
      // the swap only ever happens behind closed clouds
      if (cover >= .995 && S.stage < 5) curlOn = S.stage >= 3;
      if (!curlOn) curlIn = 0;
      else if (cover < .9) curlIn = Math.min(1, curlIn + dt / 7);
      if (S.stage >= 5 && curlOn) curlOut = Math.min(1, curlOut + dt / 2.5);
    }
    const mw = S.stage < 2 || S.stage >= 5 ? 0 : curlOn ? 1 : cover;
    moonIn = mw > moonIn ? Math.min(mw, moonIn + dt / 3) : Math.max(mw, moonIn - dt / 3);
    // the sounds build while it holds on, and only thin out once it has gone and the moon is nearly back
    if (S.stage === 4 && curlOn) noise = Math.min(1, noise + dt / NOISE.fill);
    else if (S.stage < 4) noise = 0;
    else if (S.stage >= 5 && (!curlOn || curlOut >= 1) && moonIn <= NOISE.hold) noise = Math.max(0, noise - dt / NOISE.fade);
  }

  // the drawing turns around the moon: it winds in as the clouds part, sways, then falls away to the sea
  function drawCurl(ctx, P, S, alpha, bf) {
    if (!curlOn || curlOut >= 1) return;
    const pc = pieces.curl, [, , bw, bh] = pc.box, out = easeInOut(curlOut);
    const sway = S.motion === 'still' ? 0 : Math.sin(S.mt * .4) * 1.6;
    // the noise gets to it: a shiver that grows as the sounds build
    const shake = S.stage === 4 && !S.rm ? .35 + Math.min(1, noise * 2) * .65 : 0;
    const jx = Math.sin(S.t * 37) * 4 * shake, jy = Math.sin(S.t * 29 + 1) * 3 * shake;
    const turn = (-CURL.turn * (1 - easeOut(curlIn)) + sway + Math.sin(S.t * 23) * 1.1 * shake + out * 26) * Math.PI / 180;
    const size = CURL.s * lerp(.93, 1, easeOut(curlIn));
    // the bank has gaps, so it comes into view as the clouds part rather than popping in between them
    const a = alpha * (1 - out * out) * clamp((.95 - cover) / .5);
    ctx.save();
    ctx.translate(CURL.x + jx, CURL.y + jy + out * CURL.drop);
    ctx.rotate(turn); ctx.scale(size, size); ctx.translate(-pc.cxU, -pc.cyU);
    ctx.globalAlpha = a;
    ctx.drawImage(P.curl.fill, 0, 0, bw, bh);
    ctx.drawImage(P.curl.ink[bf], 0, 0, bw, bh);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (P.C.ink === 'ember') emitFrom(pc, CURL.x - pc.cxU * size, CURL.y - pc.cyU * size, bw * size, bh * size, a);
  }

  // the whole drawing turned around its arch so the tail sits at sweepA, drawn on its own canvas, then
  // thinned out in steps below the water's surface so its ends fade into the sea rather than being cut off
  function drawSweep(ctx, P, S, alpha, bf) {
    const pc = pieces.serpent, [, , bw, bh] = pc.box, cv = ctx.canvas, sway = S.motion === 'still' ? 0 : Math.sin(S.mt * .9) * 1.2;
    if (!sweepCnv || sweepCnv.width !== cv.width || sweepCnv.height !== cv.height) sweepCnv = mk(cv.width, cv.height);
    const t = sweepCnv.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, cv.width, cv.height); t.setTransform(ctx.getTransform());
    t.translate(SWEEP.cx, SWEEP.cy + tailLift()); t.rotate((sweepA - pc.tailAt + sway) * Math.PI / 180);
    t.scale(SWEEP.s, SWEEP.s); t.translate(-pc.cxU, -pc.cyU);
    t.drawImage(P.serpent.fill, 0, 0, bw, bh);
    t.drawImage(P.serpent.ink[bf], 0, 0, bw, bh);
    t.setTransform(ctx.getTransform()); t.globalCompositeOperation = 'destination-out';
    const x0 = VB.x - 80, x1 = VB.x + VB.w + 92, floor = VB.y + VB.h + 600;
    for (let i = 0; i < 6; i++) {
      t.globalAlpha = i === 5 ? 1 : .32;
      t.beginPath(); t.moveTo(x0, floor);
      for (let x = x0; x <= x1; x += 12) t.lineTo(x, surfaceAt(S, x) + 12 + i * 9);
      t.lineTo(x1, floor); t.fill();
    }
    t.globalAlpha = 1; t.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(sweepCnv, 0, 0); ctx.restore();
  }

  function drawMoon(ctx, P, n, x, y, r, k, litSide, alpha, eclipse, bf) {
    if (alpha < .01 || r < 1) return;
    const pc = pieces[n], sc = r / pc.rU;
    const left = x - (pc.cxU - pc.box[0]) * sc, top = y - (pc.cyU - pc.box[1]) * sc;
    const w = pc.box[2] * sc, h = pc.box[3] * sc;
    const C = P.C;
    ctx.globalAlpha = alpha;
    ctx.drawImage(P[n].fill, left, top, w, h);
    if (k < .995 || eclipse > .01) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r * .99, 0, Math.PI * 2); ctx.clip();
      if (k < .995) {
        // the same terminator the SVG moons used
        const semi = litSide > 0 ? 0 : 1, term = k < .5 ? semi : 1 - semi, rx = Math.max(.01, r * Math.abs(1 - 2 * k));
        ctx.fillStyle = rgba(C.dark, C.line === 'painted' ? .9 : .72);
        ctx.fill(new Path2D(`M${x},${y - r}A${r},${r} 0 0 ${semi} ${x},${y + r}A${rx},${r} 0 0 ${term} ${x},${y - r}Z`));
      }
      if (eclipse > .01) {
        ctx.fillStyle = rgba(C.sky1, .94);
        ctx.beginPath(); ctx.arc(x + (1 - eclipse) * r * 2.1, y - r * .12, r * 1.04, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.drawImage(P[n].ink[bf], left, top, w, h);
    if (C.ink === 'ember') emitFrom(pc, left, top, w, h, alpha);
    ctx.globalAlpha = 1;
  }

  return {
    // call whenever the scene's colours or line style change
    repaint() { pendingKey = api.colours(); },
    // the ending's view, for the sky behind to follow; null while the whole scene is in view
    camera,
    // has this stage shown what it needs to, so the next question can open?
    settled(stage) {
      if (!pieces) return true;
      if (stage === 2) return cover >= .995;
      if (stage === 3) return curlIn >= .7;
      if (stage === 4) return noise >= .95;
      return true;
    },
  };
}
