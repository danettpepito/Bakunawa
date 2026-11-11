/* Shared by both screens: the questions, what an answer can hold, and the colours it turns into.
   The story paints with these; the question screen dresses itself in the same ones, so the two
   always match. Answers are small objects of numbers, so a slider can land anywhere between
   the old fixed choices:
     air    'moon' | 'lights' | 'clouds' | 'dark'
     moon   {k, haze}   how much is lit (the slider), how much cloud is over it (only "I can't find it")
     sky    {p, l, c}   where the slider is (p), and the dark to light (l) and blue to grey to city (c) it stands for
     stars  {n}         how many, 0-150
     sound  {v}         quiet to busy (0-1)
     again  'moon' | 'clouds' | 'darker' | 'same'
   Each question looks out of the window at what the scene on the big screen is showing.
*/
const BKW = (() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- colour helpers ---------- */
  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => lerp(v, y[i], k))); };
  function hexToHsl(hex) { const [R, G, B] = rgbOf(hex), r = R / 255, g = G / 255, b = B / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; }
  function hslToHex(h, s, l) { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))); return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join(''); }
  const luminance = hex => { const [r, g, b] = rgbOf(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

  /* ---------- the skies ----------
     Each is a whole sky of its own (set), and the rest of the drawing is nudged toward it
     (target hue, pull, saturation, lightness). A slider position blends the nearest ones. */
  const DEEP = {
    target: 0, pull: 0, sat: 1, light: 1, set: {
      sky1: '#121443', sky2: '#262170', haze: '#5a3fa6', cloud: '#0e1038', horizon: '#c9b4f0', sea: '#1a1c4c', star: '#fbecc8',
      cloudTop: '#3a3190', cloudBottom: '#221c62', cloudGlow: '#8d74e0',
      sea1: '#1c2a78', sea2: '#2f4fb8', sea3: '#4b8ad8', sea4: '#86c2ec', seaFoam: '#d2ecf8', seaLine: '#e9c27c',
      serpentBack: '#17505c', serpentBelly: '#3fb3a2'
    }
  };
  // city glow: dusky plum overhead, melting through rose to a soft butter yellow low down
  const ORANGE = {
    target: 335, pull: 0.3, sat: 0.95, light: 1.04, set: {
      sky1: '#4c2c68', sky2: '#d27aa6', sky3: '#ffdf9e', haze: '#f9bcc6', cloud: '#4b2c5c', horizon: '#fbe0a6', sea: '#4a2c5e', star: '#fff0c8',
      cloudTop: '#a65f92', cloudBottom: '#5c3373', cloudGlow: '#f7cfc0',
      sea1: '#4a3078', sea2: '#8c5299', sea3: '#dc86ae', sea4: '#f5b7c6', seaFoam: '#fdeabd', seaLine: '#ffe6ab',
      serpentBack: '#7d2a66', serpentBelly: '#f7c873'
    }
  };
  // overcast: flat slate, the stars dimmed behind it
  const GREY = {
    target: 225, pull: 0.25, sat: 0.4, light: 0.96, set: {
      sky1: '#1a1d25', sky2: '#3c414d', haze: '#6c7282', cloud: '#252932', horizon: '#aeb2bd', sea: '#1f222a', star: '#cfd3dc',
      cloudTop: '#4c515e', cloudBottom: '#2a2e37', cloudGlow: '#959baa',
      sea1: '#22272f', sea2: '#353c49', sea3: '#525d6d', sea4: '#7d8899', seaFoam: '#b4bcc8', seaLine: '#d2c8b0',
      serpentBack: '#4a4e63', serpentBelly: '#c3c9d6'
    }
  };
  // blue hour: still light overhead, a last peach glow low down
  const PALE = {
    target: 208, pull: 0.38, sat: 0.9, light: 1.18, set: {
      sky1: '#1d4b82', sky2: '#7aa5cf', haze: '#b4cfea', cloud: '#2d5e94', horizon: '#f6c9a4', sea: '#284c78', star: '#ffffff',
      cloudTop: '#6690bf', cloudBottom: '#3e6799', cloudGlow: '#f2d6c0',
      sea1: '#1a3f70', sea2: '#2c5f9a', sea3: '#4f8cc6', sea4: '#8ec0e6', seaFoam: '#e3f1fa', seaLine: '#f6d6ae',
      serpentBack: '#2b2a78', serpentBelly: '#e58aa6'
    }
  };
  // the two skies the old choices had no answer for: a lighter overcast, a darker city night
  const shaded = (c, f) => {
    const set = {};
    for (const k in c.set) { const [h, s, l] = hexToHsl(c.set[k]); set[k] = hslToHex(h, s, clamp(l * f)); }
    return Object.assign({}, c, { light: c.light * Math.min(f, 1.3), set });
  };
  const GREY_DAY = shaded(GREY, 1.75), ORANGE_NIGHT = shaded(ORANGE, .58);

  function tf(c, hex) {
    if (!c.pull && c.sat === 1 && c.light === 1) return hex;
    const [h, s, l] = hexToHsl(hex), d = ((c.target - h + 540) % 360) - 180;
    return hslToHex((h + d * c.pull + 360) % 360, clamp(s * c.sat), clamp(l * c.light));
  }

  // the sky for an answer (null: the story's own deep night), as {target, pull, sat, light, set, skyMid}
  function skyColour(sky) {
    const l = sky ? sky.l : 0, c = sky ? sky.c : 0;
    const across = c < .5 ? [1 - 2 * c, 2 * c, 0] : [0, 2 - 2 * c, 2 * c - 1];
    const parts = [[DEEP, across[0] * (1 - l)], [PALE, across[0] * l], [GREY, across[1] * (1 - l)], [GREY_DAY, across[1] * l], [ORANGE_NIGHT, across[2] * (1 - l)], [ORANGE, across[2] * l]].filter(p => p[1] > 0);
    const out = { pull: 0, sat: 0, light: 0, set: {} };
    let x = 0, y = 0;
    for (const [p, w] of parts) {
      out.pull += p.pull * w; out.sat += p.sat * w; out.light += p.light * w;
      x += Math.cos(p.target * Math.PI / 180) * p.pull * w; y += Math.sin(p.target * Math.PI / 180) * p.pull * w;
    }
    out.target = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    for (const k in DEEP.set) {
      const acc = [0, 0, 0];
      for (const [p, w] of parts) rgbOf(p.set[k]).forEach((v, i) => acc[i] += v * w);
      out.set[k] = hexOf(acc);
    }
    // the serpent stays sea-green under every sky, so it always stands out from it
    out.set.serpentBack = DEEP.set.serpentBack; out.set.serpentBelly = DEEP.set.serpentBelly;
    // the city sky has a third colour low down; it comes in with the glow
    const glow = across[2];
    out.glow = glow;
    out.skyMid = lerp(.65, .48, glow);
    if (glow > 0) out.set.sky3 = mix(out.set.sky2, mix(ORANGE_NIGHT.set.sky3, ORANGE.set.sky3, l), glow);
    return out;
  }

  /* ---------- what the other answers become ---------- */
  // the moon's phase, and the way the whole scene is drawn: cloud breaks it into dots, a sliver thins it to line
  function moonLook(m) {
    if (!m) return { line: 'painted', k: 1 };
    return { line: m.haze >= .5 ? 'dotted' : m.k < .35 ? 'linework' : 'painted', k: m.k };
  }
  const starCount = s => s ? s.n : 48;
  const MOTIONS = ['still', 'drift', 'tide', 'orbit'];
  const motionOf = s => s ? MOTIONS[Math.min(3, Math.floor(s.v * 4))] : 'drift';
  // the first answer sets the weave of the cloth around the questions, and the thread it leans towards
  const WEAVE = {
    moon: { pattern: 'binituen', thread: 'gold' },
    lights: { pattern: 'binakol', thread: 'rose' },
    clouds: { pattern: 'okir', thread: 'teal' },
    dark: { pattern: 'ikat', thread: 'ember' }
  };

  /* ---------- the question screen's colours, taken from the story's ---------- */
  function ui(a) {
    const c = skyColour(a.sky), s = c.set, t = h => tf(c, h), weave = WEAVE[a.air] || { pattern: 'stars', thread: 'cream' };
    const thread = { ember: t('#d9743a'), gold: t('#e2b45e'), cream: t('#f1e6d2'), rose: t('#cf4f77'), teal: t('#45a79c') };
    const text = '#ffffff';
    // the story's sky, a little quieter, and deepened (keeping its hue) as far as white words need to stay easy to read on it.
    // The city sky stays the story's dull pink and dusty gold, nearly as light as the story; a dark glow behind the words (glow) keeps them readable on it
    const g = c.glow, floor = lerp(6, 3.5, g), ink = mix(s.sky1, '#07061a', .45), hold = col => {
      const [h0, s0, l0] = hexToHsl(mix(col, ink, lerp(.14, 0, g))), yellow = h0 > 25 && h0 < 75, h = yellow ? lerp(h0, 20, .85) : h0, sa = Math.min(s0 * lerp(.82, .68, g), yellow ? lerp(1, .33, g) : 1);
      let l = l0, o = hslToHex(h, sa, l);
      while (contrast(o, text) < floor && l > .02) { l *= .96; o = hslToHex(h, sa, l); }
      return o;
    };
    const win = [hold(s.sky1), hold(s.sky2), hold(s.sky3 || s.sky2)];
    const lightest = win.slice().sort((x, y) => luminance(y) - luminance(x))[0];
    const lift = col => { let o = col; for (let k = .05; contrast(o, lightest) < 3 && k <= 1; k += .05) o = mix(col, '#ffffff', k); return o; };
    return {
      text, win, glow: g, skyMid: lerp(c.skyMid, .62, g), muted: mix(text, lightest, .1), accent: lift(thread[weave.thread]),
      star: s.star, cloud: rgbOf(s.cloudGlow).join(','), line: moonLook(a.moon).line,
      frame: [t('#ffc4d6'), t('#ffe9ad')], beige: mix('#ffc4d6', '#ffe9ad', .5), // the frame's colour on the deep sky; it stays this on every sky
      cloth: { base: t('#1d1752'), line: t('#8d74e0'), band: t('#100d36'), thread },
      pattern: weave.pattern,
      moon: { lit: t('#efe3c8'), dark: t('#3a3672'), ink: t('#2c2862') },
      sea: [s.sea3, s.seaLine]
    };
  }

  /* ---------- the questions ---------- */
  const QS = [
    {
      id: 'air', short: 'First look', q: 'Look out your window. What do you notice first?',
      opts: [['The moon', 'moon'], ['City lights', 'lights'], ['The clouds', 'clouds'], ['Just darkness', 'dark']]
    },
    {
      id: 'moon', short: 'The moon', q: 'Clouds are drifting past this moon. Now find yours. How does it look tonight?',
      hint: 'Slide until it looks like yours.', send: 'This is my moon', start: { k: 1, haze: 0 },
      sliders: [{ key: 'k', min: .05, max: 1, from: 'A thin sliver', to: 'Full and bright' }],
      alt: { label: "I can't find it", value: { k: .03, haze: 1 } },
      read: m => m.k < .05 ? "I can't find it" : m.haze >= .5 ? 'Hazy, behind cloud' : m.k < .35 ? 'A thin sliver' : m.k < .8 ? 'Part of it in shadow' : 'Full and bright'
    },
    {
      id: 'sky', short: 'The sky', q: 'Seven moons once lit this sky. How does your sky look with only one?',
      hint: 'Slide until this screen looks like your window.', send: 'This is my sky', start: { p: 0, l: 0, c: 0 },
      sliders: [{ key: 'p', min: 0, max: 1, from: 'Almost black', to: 'City orange' }],
      // the one slider walks through every sky: night, up to the pale blue of a sky still light, across to the grey, then on to the soft pink and butter yellow
      fit: s => {
        const p = s.p, t = (a, b) => (p - a) / (b - a);
        if (p <= .34) { s.c = 0; s.l = t(0, .34); }
        else if (p <= .62) { s.c = t(.34, .62) * .5; s.l = 1 - t(.34, .62) * .775; }
        else { s.c = .5 + t(.62, 1) * .5; s.l = .225 + t(.62, 1) * .775; }
      },
      read: s => s.c > .7 ? 'Orange, from the city lights' : s.c > .2 ? 'Grey, covered in cloud' : s.l > .5 ? 'Still light, pale blue' : 'Deep blue, almost black'
    },
    {
      id: 'stars', short: 'Stars', q: 'Clouds have closed over the last moon. How many stars can you still see?',
      hint: 'Slide to bring them out, or put them away.', send: 'These are my stars', start: { n: 48 },
      sliders: [{ key: 'n', min: 0, max: 150, step: 1, from: 'None', to: 'Too many to count' }],
      read: s => s.n < 15 ? 'None, or hardly any' : s.n < 90 ? 'A handful' : 'More than I can count'
    },
    {
      id: 'sound', short: 'What you hear', q: 'Bakunawa has the last moon. Stop and listen. How much can you hear around you?',
      hint: 'Close your eyes for a moment, then slide.', send: 'This is what I hear', start: { v: .35 },
      sliders: [{ key: 'v', min: 0, max: 1, from: 'Silence', to: 'Everything at once' }],
      read: s => ["Nothing, it's quiet", 'A low hum, wind or traffic', 'Voices or music', 'Lots going on at once'][Math.min(3, Math.floor(s.v * 4))]
    },
    {
      id: 'again', short: 'Last look', q: 'The noise is filling the sky. Look out your window once more. What has changed?',
      opts: [['The moon has moved', 'moon'], ['The clouds have shifted', 'clouds'], ['It has grown darker', 'darker'], ['Nothing, it looks the same', 'same']]
    }
  ];

  function sanitizeA(a) {
    a = a || {};
    const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : null;
    const pack = (src, spec) => {
      if (!src || typeof src !== 'object') return null;
      const o = {};
      for (const k in spec) { o[k] = num(src[k], spec[k][0], spec[k][1]); if (o[k] === null) return null; }
      return o;
    };
    return {
      air: a.air in WEAVE ? a.air : null,
      moon: pack(a.moon, { k: [0, 1], haze: [0, 1] }),
      sky: (o => o && Object.assign(o, { p: num(a.sky.p, 0, 1) || 0 }))(pack(a.sky, { l: [0, 1], c: [0, 1] })),
      stars: pack(a.stars, { n: [0, 150] }),
      sound: pack(a.sound, { v: [0, 1] }),
      again: ['moon', 'clouds', 'darker', 'same'].includes(a.again) ? a.again : null
    };
  }

  return { QS, sanitizeA, tf, mix, skyColour, moonLook, starCount, motionOf, ui };
})();
