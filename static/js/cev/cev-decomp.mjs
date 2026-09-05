// Widget 2 — the decomposition explorer (the centerpiece).
// Drag the two sliders (parsing error, OCR error) and watch the page error split
// into d_pars, d_ocr, d_int and d_total, exactly as in the paper's schematic.
import { decompose, ALPHABET } from './cev-math.mjs';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

// Node centres in the 340×264 viewBox.
const NODES = {
  Q: { x: 170, y: 30, t: 'Q', s: 'ground truth' },
  R: { x: 66, y: 126, t: 'R', s: 'parsing on GT' },
  Sstar: { x: 274, y: 126, t: 'S*', s: 'OCR on GT' },
  S: { x: 170, y: 222, t: 'S', s: 'OCR on parse' },
};
// Edges: [from, to, metric key, colour var, dashed?]
const EDGES = [
  ['Q', 'R', 'pars', '--cev-red', false],
  ['Q', 'Sstar', 'ocr', '--cev-blue', false],
  ['R', 'S', 'int', '--cev-purple', false],
  ['Q', 'S', 'total', null, true],
];
// Per-metric reference maxima for scaling arrow thickness.
const REF_MAX = { spacer: 1.0, jsd: 0.55 };

function nodeBox(svg, node) {
  const w = 96, h = 40;
  const g = el('g', {});
  g.appendChild(el('rect', {
    x: node.x - w / 2, y: node.y - h / 2, width: w, height: h, rx: 5,
    fill: 'rgba(128,128,128,0.06)', stroke: 'currentColor', 'stroke-opacity': 0.55,
  }));
  g.appendChild(el('text', {
    x: node.x, y: node.y - 2, 'text-anchor': 'middle', 'font-size': 13,
    'font-weight': 700, fill: 'currentColor',
  }, node.t));
  g.appendChild(el('text', {
    x: node.x, y: node.y + 12, 'text-anchor': 'middle', 'font-size': 7.5,
    fill: 'currentColor', opacity: 0.7,
  }, node.s));
  svg.appendChild(g);
}

// Shorten a segment so it stops at the node-box edges (boxes are 96×40).
function trim(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // approximate half-extent along the direction
  const ext = (Math.abs(ux) * 48 + Math.abs(uy) * 20);
  const extB = (Math.abs(ux) * 48 + Math.abs(uy) * 20);
  return {
    x1: a.x + ux * (ext + 4), y1: a.y + uy * (ext + 4),
    x2: b.x - ux * (extB + 8), y2: b.y - uy * (extB + 8),
  };
}

export function init(container) {
  let metric = 'spacer';
  let pErr = 0.35, oErr = 0.25;

  const two = document.createElement('div');
  two.className = 'cev-twoup';
  const left = document.createElement('div');
  const right = document.createElement('div');
  two.append(left, right);
  container.appendChild(two);

  // --- Schematic SVG ---
  const svg = el('svg', { class: 'cev-stage__svg', viewBox: '0 0 340 264', role: 'img' });
  svg.setAttribute('aria-label', 'CEV decomposition schematic: Q to R, Q to S*, R to S, and Q to S');
  svg.style.maxWidth = '340px';
  // arrowheads
  const defs = el('defs', {});
  EDGES.forEach((_, i) => {
    const m = el('marker', {
      id: `cev-h${i}`, viewBox: '0 0 10 10', refX: 7, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
    });
    m.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: `cev-headfill cev-headfill--${i}` }));
    defs.appendChild(m);
  });
  svg.appendChild(defs);

  const edgeEls = EDGES.map(([from, to, key, colour, dashed], i) => {
    const seg = trim(NODES[from], NODES[to]);
    const stroke = colour ? `var(${colour})` : 'currentColor';
    const path = el('path', {
      class: 'cev-flow', d: `M ${seg.x1} ${seg.y1} L ${seg.x2} ${seg.y2}`,
      fill: 'none', stroke, 'stroke-width': 2, 'marker-end': `url(#cev-h${i})`,
    });
    if (dashed) { path.setAttribute('stroke-dasharray', '4 3'); path.setAttribute('opacity', '0.6'); }
    path.style.transition = 'stroke-width 0.3s ease';
    svg.appendChild(path);
    // label
    const mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
    const label = el('text', {
      x: mx, y: my - 3, 'text-anchor': 'middle', 'font-size': 8.5,
      fill: stroke, 'paint-order': 'stroke', stroke: 'var(--cev-page-bg, transparent)',
    }, '');
    svg.appendChild(label);
    // colour the arrowhead to match
    const head = defs.querySelector(`.cev-headfill--${i}`);
    head.setAttribute('fill', stroke);
    if (dashed) head.setAttribute('opacity', '0.6');
    return { path, label, key, colour };
  });
  Object.values(NODES).forEach((n) => nodeBox(svg, n));
  left.appendChild(svg);

  // --- Q vs S histogram (bag of characters) ---
  const hist = el('svg', { class: 'cev-stage__svg', viewBox: '0 0 340 120', role: 'img' });
  hist.setAttribute('aria-label', 'Character distribution: ground truth Q versus observed S');
  hist.style.marginTop = '0.5rem';
  right.appendChild(hist);
  const histCaption = document.createElement('p');
  histCaption.className = 'cev-widget__hint';
  histCaption.textContent = 'Character distribution — Q (ground truth, grey) vs S (observed, blue). OCR shifts mass onto confusable and noise (·) characters; parsing changes the totals.';
  right.appendChild(histCaption);

  // --- Metric toggle ---
  const controls = document.createElement('div');
  controls.className = 'cev-controls';
  [['spacer', 'SpACER'], ['jsd', 'JSD']].forEach(([m, label]) => {
    const btn = document.createElement('button');
    btn.className = 'cev-btn'; btn.type = 'button'; btn.textContent = label;
    btn.setAttribute('aria-pressed', String(m === metric));
    btn.addEventListener('click', () => {
      metric = m;
      [...controls.children].forEach((b, i) => b.setAttribute('aria-pressed', String(['spacer', 'jsd'][i] === metric)));
      render();
    });
    controls.appendChild(btn);
  });
  container.appendChild(controls);

  // --- Sliders ---
  const sliders = document.createElement('div');
  sliders.className = 'cev-sliders';
  function makeSlider(labelText, initial, onInput) {
    const row = document.createElement('div');
    row.className = 'cev-slider';
    const label = document.createElement('label'); label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.value = String(initial * 100);
    const out = document.createElement('output'); out.textContent = initial.toFixed(2);
    input.addEventListener('input', () => {
      const v = Number(input.value) / 100;
      out.textContent = v.toFixed(2);
      onInput(v);
    });
    row.append(label, input, out);
    sliders.appendChild(row);
  }
  makeSlider('Parsing error', pErr, (v) => { pErr = v; render(); });
  makeSlider('OCR error', oErr, (v) => { oErr = v; render(); });
  container.appendChild(sliders);

  // --- Readout ---
  const readout = document.createElement('div');
  readout.className = 'cev-readout';
  const stats = {};
  [['total', 'd_total', true], ['pars', 'd_pars', false], ['ocr', 'd_ocr', false], ['int', 'd_int', false]].forEach(([key, label, score]) => {
    const wrap = document.createElement('div');
    wrap.className = 'cev-stat' + (score ? ' cev-stat--score' : '');
    const l = document.createElement('span'); l.className = 'cev-stat__label'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'cev-stat__value'; v.textContent = '0.00';
    wrap.append(l, v); readout.appendChild(wrap);
    stats[key] = { el: v, shown: 0 };
  });
  container.appendChild(readout);

  function animate(stat, target) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof window.anime !== 'function') {
      stat.shown = target; stat.el.textContent = target.toFixed(3); return;
    }
    window.anime({ targets: stat, shown: target, duration: 350, easing: 'easeOutCubic',
      update: () => { stat.el.textContent = stat.shown.toFixed(3); } });
  }

  function drawHist(Q, S) {
    hist.replaceChildren();
    const sQ = Q.reduce((a, b) => a + b, 0), sS = S.reduce((a, b) => a + b, 0);
    const n = ALPHABET.length;
    const slot = 340 / n, bw = slot * 0.32, base = 96;
    const maxP = Math.max(...Q.map((q) => q / sQ), ...S.map((s) => s / sS)) || 1;
    ALPHABET.forEach((ch, i) => {
      const x = i * slot + slot / 2;
      const hq = (Q[i] / sQ / maxP) * 80;
      const hs = (S[i] / sS / maxP) * 80;
      hist.appendChild(el('rect', { x: x - bw - 1, y: base - hq, width: bw, height: hq, fill: 'currentColor', opacity: 0.35 }));
      hist.appendChild(el('rect', { x: x + 1, y: base - hs, width: bw, height: hs, fill: 'var(--cev-blue)' }));
      hist.appendChild(el('text', { x, y: base + 12, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', opacity: 0.7 }, ch === ' ' ? '␣' : ch));
    });
  }

  function render() {
    const d = decompose(pErr, oErr);
    const vals = d[metric];
    const max = REF_MAX[metric];
    edgeEls.forEach(({ path, label, key }) => {
      const v = vals[key];
      const w = 1.5 + Math.min(v / max, 1) * 7;
      path.setAttribute('stroke-width', w.toFixed(2));
      label.textContent = v.toFixed(2);
    });
    animate(stats.total, vals.total);
    animate(stats.pars, vals.pars);
    animate(stats.ocr, vals.ocr);
    animate(stats.int, vals.int);
    drawHist(d.Q, d.S);
  }

  render();
}
