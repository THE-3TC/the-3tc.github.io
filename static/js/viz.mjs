// Shared scaffolding for the interactive figures. No maths here — only DOM
// helpers and the small set of UI pieces every widget is built from, so the
// figures read as one system: segmented controls that never move, stat tiles
// with reserved space, notes that never push the layout around.

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, text) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

export function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

export function sheet(className) {
  return h('div', 'viz-sheet' + (className ? ' ' + className : ''));
}

// Mutually exclusive options. Labels are fixed, so the control never reflows.
export function segmented(options, current, onChange, ariaLabel) {
  const wrap = h('div', 'viz-seg');
  wrap.setAttribute('role', 'radiogroup');
  if (ariaLabel) wrap.setAttribute('aria-label', ariaLabel);
  const buttons = new Map();
  const set = (key) => {
    current = key;
    buttons.forEach((b, k) => {
      const on = k === key;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  };
  options.forEach(({ key, label }) => {
    const b = h('button', 'viz-seg__btn', label);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { if (key !== current) { set(key); onChange(key); } });
    b.addEventListener('keydown', (e) => {
      const keys = options.map((o) => o.key);
      const i = keys.indexOf(current);
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = keys[(i + 1) % keys.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = keys[(i - 1 + keys.length) % keys.length];
      if (next) { e.preventDefault(); set(next); buttons.get(next).focus(); onChange(next); }
    });
    buttons.set(key, b);
    wrap.appendChild(b);
  });
  set(current);
  return { el: wrap, set };
}

// An on/off control whose label never changes; state lives in aria-pressed.
export function toggle(label, pressed, onChange, { swatch = null } = {}) {
  const b = h('button', 'viz-btn', label);
  b.type = 'button';
  if (swatch) {
    const sw = h('i', 'viz-swatch');
    sw.style.backgroundColor = swatch;
    b.prepend(sw);
  }
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', () => {
    pressed = !pressed;
    b.setAttribute('aria-pressed', String(pressed));
    onChange(pressed);
  });
  return { el: b, set(v) { pressed = v; b.setAttribute('aria-pressed', String(v)); } };
}

export function button(label, onClick) {
  const b = h('button', 'viz-btn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// A stat tile: label, big value, and an always-present sub line (so the tile's
// height is fixed whether or not there is something to say).
export function stat(parent, label, { hero = false, digits = 2, swatch = null } = {}) {
  const wrap = h('div', 'viz-stat' + (hero ? ' viz-stat--hero' : ''));
  const l = h('span', 'viz-stat__label');
  if (swatch) {
    const s = h('i', 'viz-swatch');
    s.style.background = swatch;
    l.appendChild(s);
  }
  l.appendChild(document.createTextNode(label));
  const v = h('span', 'viz-stat__value', (0).toFixed(digits));
  const sub = h('span', 'viz-stat__sub', '');
  wrap.append(l, v, sub);
  parent.appendChild(wrap);
  const st = { el: wrap, value: v, sub, shown: 0, digits };
  st.setSub = (t) => { sub.textContent = t || ''; };
  st.set = (target) => animateTo(st, target);
  return st;
}

export function animateTo(st, target) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (x) => x.toFixed(st.digits);
  if (reduced || typeof window.anime !== 'function') {
    st.shown = target; st.value.textContent = fmt(target); return;
  }
  window.anime.remove(st);
  window.anime({
    targets: st, shown: target, duration: 420, easing: 'easeOutCubic',
    update: () => { st.value.textContent = fmt(st.shown); },
  });
}

// Give a text element enough min-height for the longest of `texts`, so
// swapping its content never moves anything below it. Re-measures on resize.
export function reserveHeight(el, texts) {
  const measure = () => {
    const keep = el.textContent;
    el.style.minHeight = '0px';
    let max = 0;
    texts.forEach((t) => { el.textContent = t; max = Math.max(max, el.offsetHeight); });
    el.textContent = keep;
    el.style.minHeight = `${max}px`;
  };
  measure();
  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
  return measure;
}

// Swap a note's text with a short cross-fade instead of a hard cut.
export function setNote(el, text) {
  if (el.textContent === text) return;
  el.classList.add('is-swapping');
  const apply = () => { el.textContent = text; el.classList.remove('is-swapping'); };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  reduced ? apply() : setTimeout(apply, 120);
}

// Tiny deterministic PRNG so decorative "text lines" are identical on every render.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Decorative text lines inside a rect (viewBox units). Returns a <g>.
export function fauxLines(rect, { lineH = 2.2, gap = 1.8, pad = 2.5, seed = 1, fill = 'currentColor', opacity = 0.32 } = {}) {
  const rnd = seeded(seed);
  const g = svg('g', { fill, opacity });
  const x = rect.x + pad, maxW = rect.w - pad * 2;
  let y = rect.y + pad;
  let i = 0;
  while (y + lineH <= rect.y + rect.h - pad + 0.01) {
    const last = y + lineH + gap + lineH > rect.y + rect.h - pad;
    const w = last ? maxW * (0.35 + rnd() * 0.4) : maxW * (0.82 + rnd() * 0.18);
    g.appendChild(svg('rect', { x, y, width: w, height: lineH, rx: lineH / 2 }));
    y += lineH + gap; i++;
  }
  return g;
}

// A 45° hatch pattern for the "trespass" family — a second channel besides hue.
export function hatch(defs, id, color, spacing = 4, width = 1.2) {
  const p = svg('pattern', {
    id, patternUnits: 'userSpaceOnUse', width: spacing, height: spacing,
    patternTransform: 'rotate(45)',
  });
  p.appendChild(svg('rect', { x: 0, y: 0, width, height: spacing, fill: color }));
  defs.appendChild(p);
  return `url(#${id})`;
}

// Fixed-size arrowhead (does not grow with stroke width).
export function arrowMarker(defs, id, color, size = 7) {
  const m = svg('marker', {
    id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerUnits: 'userSpaceOnUse',
    markerWidth: size, markerHeight: size, orient: 'auto-start-reverse',
  });
  m.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }));
  defs.appendChild(m);
  return `url(#${id})`;
}

// Label chip drawn in SVG: white pill behind ink text. Width estimated from text.
export function chip(parent, x, y, text, { size = 4, anchor = 'start', fill = 'var(--viz-sheet)', ink = 'currentColor', pad = 1.4, key = null } = {}) {
  const g = svg('g', {});
  const est = text.length * size * 0.58 + pad * 2 + (key ? size * 1.1 : 0);
  let bx = x;
  if (anchor === 'middle') bx = x - est / 2;
  if (anchor === 'end') bx = x - est;
  g.appendChild(svg('rect', { x: bx, y: y - size * 0.95, width: est, height: size * 1.55, rx: size * 0.5, fill, opacity: 0.94 }));
  let tx = bx + pad;
  if (key) {
    g.appendChild(svg('circle', { cx: tx + size * 0.35, cy: y - size * 0.18, r: size * 0.32, fill: key }));
    tx += size * 1.1;
  }
  g.appendChild(svg('text', { x: tx, y: y + size * 0.2, 'font-size': size, fill: ink, 'font-family': 'inherit' }, text));
  parent.appendChild(g);
  return g;
}

// A labelled bounding box in the same style as the draggable prediction boxes
// (.viz-predbox): thin solid outline, and a small filled corner tag carrying the
// label. `unit` is roughly how many viewBox units make one CSS pixel, so the
// stroke and tag come out the same size on screen whatever the viewBox.
export function tagBox(parent, { x, y, w, h: hgt }, label, { color = '#111111', unit = 0.3, at = 'tl', ink = '#ffffff' } = {}) {
  const sw = 1.5 * unit, fs = 10 * unit, padX = 5 * unit, padY = 3 * unit, r1 = 2 * unit, r2 = 3 * unit;
  const g = svg('g', {});
  g.appendChild(svg('rect', { x, y, width: w, height: hgt, rx: r1, fill: 'none', stroke: color, 'stroke-width': sw }));
  const tw = label.length * fs * 0.62 + padX * 2, th = fs + padY * 2;
  const tx = x - sw / 2, ty = at === 'tl' ? y - sw / 2 : y + hgt + sw / 2 - th;
  const d = at === 'tl'
    ? `M ${tx + r1} ${ty} H ${tx + tw} V ${ty + th - r2} Q ${tx + tw} ${ty + th} ${tx + tw - r2} ${ty + th} H ${tx} V ${ty + r1} Q ${tx} ${ty} ${tx + r1} ${ty} Z`
    : `M ${tx} ${ty} H ${tx + tw - r2} Q ${tx + tw} ${ty} ${tx + tw} ${ty + r2} V ${ty + th} H ${tx + r1} Q ${tx} ${ty + th} ${tx} ${ty + th - r1} Z`;
  g.appendChild(svg('path', { d, fill: color }));
  g.appendChild(svg('text', { x: tx + padX, y: ty + padY + fs * 0.8, 'font-size': fs, 'font-weight': 500, 'letter-spacing': 0.4 * unit, fill: ink }, label));
  parent.appendChild(g);
  return g;
}
