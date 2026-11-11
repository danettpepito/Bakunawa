/* Question frame
   The hand-drawn frame (frame.svg) around the questions, laid over one big piece of woven cloth.
   - Lays out the window the questions sit in, from where the frame's inner line falls,
     and writes it to the stage as CSS variables (--wl --wt --wr --wb, --m, --fx --fy).
   - Paints the cloth on a canvas behind the frame from the pattern drawings (img/patterns): the eight-point
     star before the first answer, the stepped diamond after it, tone on tone, so it blends into the ground.
     The window covers it completely.
   - The first answer leans the cloth towards a different thread; the new one sweeps in diagonally
     over the old, like a new weave being laid over it. A colour change cross-fades.
   StoryFrame(stage, {colours, pattern}) -> {repaint(how)}   how: leave out to cross-fade, or "none" to repaint in place while a slider moves
*/
function StoryFrame(stage, api) {
  // frame.svg measurements, in its own units (1026.4 x 580.8)
  const F = {
    h: 580.8,
    inner: { l: 63, t: 48.6, r: 61.7, b: 53.2 },   // centre of the inner line
    slice: { x: 98, y: 82 },                       // keeps the corner fans from stretching
    cut: { x: 26, y: 22 }                          // how far along each edge the window's corners curve away
  };
  const SWEEP_MS = 2800, FADE_MS = 1400;
  const TONE = .1, SHADE = .2; // how strongly the diamonds show against the ground, and how far it is all darkened
  if (!document.getElementById('frame-anim')) {
    const s = document.createElement('style'); s.id = 'frame-anim';
    s.textContent =
      'canvas.pat.pat-fade{opacity:0;transition:opacity ' + FADE_MS + 'ms ease}canvas.pat.pat-fade.in{opacity:1}' +
      'canvas.pat.pat-sweep{-webkit-mask-image:linear-gradient(115deg,#000 42%,transparent 58%);mask-image:linear-gradient(115deg,#000 42%,transparent 58%);' +
      '-webkit-mask-size:260% 260%;mask-size:260% 260%;-webkit-mask-position:100% 100%;mask-position:100% 100%;' +
      'transition:-webkit-mask-position ' + SWEEP_MS + 'ms cubic-bezier(.45,.05,.3,1),mask-position ' + SWEEP_MS + 'ms cubic-bezier(.45,.05,.3,1)}' +
      'canvas.pat.pat-sweep.in{-webkit-mask-position:0 0;mask-position:0 0}' +
      '@media (prefers-reduced-motion: reduce){canvas.pat.pat-fade,canvas.pat.pat-sweep{transition:none}}';
    document.head.appendChild(s);
  }
  let cur = stage.querySelector('canvas.pat');
  let ctx = null, L = null, painted = '', shownPattern = null;

  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

  /* ---------- the cloth ---------- */
  // each answer leans the cloth towards a different thread, very slightly
  const COLOURWAY = { stars: 'cream', binituen: 'gold', binakol: 'rose', okir: 'teal', ikat: 'ember' };

  // the pattern drawings: one repeating tile each (in the file's own units), woven in 12-unit cells
  // of three threads. The star is the cloth before any answer; every answer brings in the diamond
  const TILES = {
    star: { src: 'img/patterns/eight-point-star-band.svg', size: 240 },
    diamond: { src: 'img/patterns/stepped-diamond-band.svg', size: 192 }
  };
  const tileFor = pat => TILES[pat === 'stars' ? 'star' : 'diamond'];
  const CELL = 12; // the drawings' cell, in their units
  for (const t of Object.values(TILES)) {
    t.img = new Image();
    t.img.onload = () => { painted = ''; if (L) paint('none'); };
    t.img.src = t.src;
  }

  // the tile, tinted in the thread's colour, repeated over the whole cloth from its centre
  function cloth(W, H, k, tint, pat, dpr) {
    const t = tileFor(pat);
    if (!t.img.complete || !t.img.naturalWidth) return;
    const u = Math.max(4, Math.round(7 * k)), size = t.size * u / CELL, px = Math.max(1, Math.round(size * dpr));
    const tile = document.createElement('canvas');
    tile.width = tile.height = px;
    const x = tile.getContext('2d');
    x.drawImage(t.img, 0, 0, t.size, t.size, 0, 0, px, px);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = tint; x.fillRect(0, 0, px, px);
    const p = ctx.createPattern(tile, 'repeat');
    p.setTransform(new DOMMatrix().translate(W / 2 - size / 2, H / 2 - size / 2).scale(size / px));
    ctx.fillStyle = p; ctx.globalAlpha = TONE;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  /* ---------- layout ---------- */
  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return false;
    const m = Math.round(Math.min(H, W * 0.64) * 0.022);
    // a floor keeps the weave readable on phones, where the frame would otherwise shrink to specks
    const k = Math.max(0.55, (Math.min(H, W * 0.64) - 2 * m) / F.h);
    const box = { x: m, y: m, x2: W - m, y2: H - m };
    const i = { x: box.x + F.inner.l * k, y: box.y + F.inner.t * k, x2: box.x2 - F.inner.r * k, y2: box.y2 - F.inner.b * k };
    L = { W, H, k, i };
    const px = v => v.toFixed(1) + 'px';
    stage.style.setProperty('--m', px(m));
    stage.style.setProperty('--fx', px(F.slice.x * k));
    stage.style.setProperty('--fy', px(F.slice.y * k));
    // the window tucks just under the inner line so no gap shows at the crayon edge
    stage.style.setProperty('--wl', px(i.x - 1));
    stage.style.setProperty('--wt', px(i.y - 1));
    stage.style.setProperty('--wr', px(W - i.x2 - 1));
    stage.style.setProperty('--wb', px(H - i.y2 - 1));
    // the frame's corners curve in over the window, and are open beyond the band, so the window's
    // own corners are cut on the same curve (under the band) to keep the scene from showing past it
    const ww = i.x2 - i.x + 2, wh = i.y2 - i.y + 2, cx = F.cut.x * k, cy = F.cut.y * k, n = v => v.toFixed(1);
    const arc = (x, y) => `A${n(cx)} ${n(cy)} 0 0 0 ${n(x)} ${n(y)}`;
    const win = stage.querySelector('.win');
    if (win) win.style.clipPath = `path('M${n(cx)} 0H${n(ww - cx)}${arc(ww, cy)}V${n(wh - cy)}${arc(ww - cx, wh)}H${n(cx)}${arc(0, wh - cy)}V${n(cy)}${arc(cx, 0)}Z')`;
    return true;
  }

  /* ---------- painting ---------- */
  const patternNow = () => { const p = api.pattern ? api.pattern() : 'stars'; return p in COLOURWAY ? p : 'stars'; };

  function paintInto(cv, c, pat) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr);
    ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { W, H, k } = L;

    ctx.fillStyle = c.base; ctx.fillRect(0, 0, W, H);
    cloth(W, H, k, c.thread[COLOURWAY[pat]], pat, dpr);
    ctx.fillStyle = '#000'; ctx.globalAlpha = SHADE; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // paint a new canvas over the current one and reveal it: 'sweep' for a new pattern,
  // 'fade' for new colours, 'none' to repaint in place (first paint, resizes)
  function paint(how) {
    if (!L) return;
    const c = api.colours(), pat = patternNow();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = [L.W, L.H, dpr, pat, c.base, c.line, c.band, ...Object.values(c.thread)].join('|');
    if (key === painted) return;
    painted = key;
    if (how === 'auto') how = shownPattern === null ? 'none' : pat !== shownPattern ? 'sweep' : 'fade';
    shownPattern = pat;
    if (how === 'none') { paintInto(cur, c, pat); return; }
    const old = cur, nc = document.createElement('canvas');
    nc.className = 'pat ' + (how === 'sweep' ? 'pat-sweep' : 'pat-fade');
    nc.setAttribute('aria-hidden', 'true');
    paintInto(nc, c, pat);
    old.after(nc);
    cur = nc;
    nc.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => nc.classList.add('in')));
    setTimeout(() => {
      // once revealed, the old layers underneath go
      let p = nc.previousElementSibling;
      while (p && p.matches('canvas.pat')) { const q = p.previousElementSibling; p.remove(); p = q; }
      nc.className = 'pat';
    }, (how === 'sweep' ? SWEEP_MS : FADE_MS) + 150);
  }

  let rt = null;
  new ResizeObserver(() => {
    if (!layout()) return;
    clearTimeout(rt); rt = setTimeout(() => paint('none'), 120); // repaint once the size settles
  }).observe(stage);
  if (layout()) paint('none');

  return { repaint(how = 'auto') { if (L || layout()) paint(how); } };
}
