// The decomposition explorer — the centrepiece. Two sliders (parsing error,
// OCR error) drive the four character-count vectors of the paper; the page
// error splits into d_pars, d_ocr, d_int and d_total. Edge thickness carries
// magnitude; the numbers sit in white chips beside each edge, never under it.
import { decompose, ALPHABET } from './cev-math.mjs';
import { svg, h, sheet, segmented, stat, arrowMarker, chip } from '../viz.mjs';

const INK = 'currentColor';

// Node centres in the 380×270 viewBox.
const NODES = {
  Q: { x: 190, y: 26, t: 'Q', s: 'ground truth' },
  R: { x: 48, y: 135, t: 'R', s: 'parsing on GT' },
  Sstar: { x: 332, y: 135, t: 'S*', s: 'OCR on GT' },
  S: { x: 190, y: 244, t: 'S', s: 'OCR on parse' },
};
const NODE_W = 82, NODE_H = 34;
// [from, to, key, colour, dashed, label side (-1 left/up, +1 right/down)]
const EDGES = [
  ['Q', 'R', 'pars', 'var(--cev-red)', false, -1],
  ['Q', 'Sstar', 'ocr', 'var(--cev-blue)', false, +1],
  ['R', 'S', 'int', 'var(--cev-purple)', false, -1],
  ['Q', 'S', 'total', INK, true, +1],
];
const NAMES = { pars: 'd_pars', ocr: 'd_ocr', int: 'd_int', total: 'd_total' };
const REF_MAX = { spacer: 1.0, jsd: 0.55 };

// Distance from a node centre to its box edge along a unit direction.
function edgeDist(ux, uy) {
  const tx = Math.abs(ux) > 1e-6 ? (NODE_W / 2) / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? (NODE_H / 2) / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}
// Shorten a segment so it starts/ends just outside the node boxes.
function trim(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const ea = edgeDist(ux, uy) + 3, eb = edgeDist(ux, uy) + 5;
  return { x1: a.x + ux * ea, y1: a.y + uy * ea, x2: b.x - ux * eb, y2: b.y - uy * eb, ux, uy };
}

export function init(container) {
  let metric = 'spacer';
  let pErr = 0.35, oErr = 0.25;

  // ── Controls ─────────────────────────────────────────────────────────
  const seg = segmented([{ key: 'spacer', label: 'SpACER' }, { key: 'jsd', label: 'JSD' }], metric, (k) => { metric = k; render(); }, 'Distance');
  const controls = h('div', 'viz-controls');
  controls.appendChild(seg.el);
  const segHint = h('span', 'viz-hint', 'SpACER is a CER-like magnitude; JSD reacts to the shape of the character distribution.');
  segHint.style.margin = '0';
  controls.appendChild(segHint);
  container.appendChild(controls);

  const side = h('div', 'viz-grid-side');
  container.appendChild(side);

  // ── Schematic ────────────────────────────────────────────────────────
  const paper = sheet('viz-sheet--tight');
  const s = svg('svg', { class: 'viz-svg', viewBox: '0 0 380 270', role: 'img' });
  s.setAttribute('aria-label', 'Decomposition schematic: Q to R is parsing error, Q to S-star is OCR error, R to S is interaction, Q to S is total.');
  const defs = svg('defs', {});
  s.appendChild(defs);
  const edgeEls = EDGES.map(([from, to, key, colour, dashed, sideSign], i) => {
    const seg0 = trim(NODES[from], NODES[to]);
    const head = arrowMarker(defs, `cev-dc-head-${i}`, colour, 8);
    const path = svg('path', {
      d: `M ${seg0.x1} ${seg0.y1} L ${seg0.x2} ${seg0.y2}`, fill: 'none', stroke: colour,
      'stroke-width': 2, 'stroke-linecap': 'butt', 'marker-end': head,
      'stroke-dasharray': dashed ? '5 4' : null, opacity: dashed ? 0.55 : 1,
    });
    path.style.transition = 'stroke-width 0.3s ease';
    s.appendChild(path);
    // Label position: the midpoint pushed out perpendicular to the edge, on the outer side.
    const mx = (seg0.x1 + seg0.x2) / 2, my = (seg0.y1 + seg0.y2) / 2;
    const px = -seg0.uy * sideSign, py = seg0.ux * sideSign; // unit normal
    const off = 17;
    return { path, key, colour, lx: mx + px * off, ly: my + py * off, dashed };
  });
  const labelLayer = svg('g', {});
  s.appendChild(labelLayer);
  Object.values(NODES).forEach((n) => {
    const g = svg('g', {});
    g.appendChild(svg('rect', { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 4, fill: 'var(--viz-sheet)', stroke: INK, 'stroke-opacity': 0.6 }));
    g.appendChild(svg('text', { x: n.x, y: n.y - 2.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 500, fill: INK }, n.t));
    g.appendChild(svg('text', { x: n.x, y: n.y + 11, 'text-anchor': 'middle', 'font-size': 7.5, fill: INK, opacity: 0.65 }, n.s));
    s.appendChild(g);
  });
  paper.appendChild(s);
  side.appendChild(paper);

  // ── Sliders + readout ────────────────────────────────────────────────
  const right = h('div', 'viz-stack');
  side.appendChild(right);
  const sliders = h('div', 'viz-sliders');
  function makeSlider(labelText, initial, onInput) {
    const row = h('div', 'viz-slider');
    const label = h('label', null, labelText);
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.value = String(Math.round(initial * 100));
    input.setAttribute('aria-label', labelText);
    const out = h('output', null, initial.toFixed(2));
    input.addEventListener('input', () => { const v = Number(input.value) / 100; out.textContent = v.toFixed(2); onInput(v); });
    row.append(label, out, input);
    sliders.appendChild(row);
  }
  makeSlider('Parsing error', pErr, (v) => { pErr = v; render(); });
  makeSlider('OCR error', oErr, (v) => { oErr = v; render(); });
  right.appendChild(sliders);

  const readout = h('div', 'viz-readout viz-readout--grid');
  readout.style.marginTop = '0';
  const stats = {
    total: stat(readout, 'd_total', { hero: true, digits: 3, swatch: 'var(--viz-ink)' }),
    pars: stat(readout, 'd_pars', { digits: 3, swatch: 'var(--cev-red)' }),
    ocr: stat(readout, 'd_ocr', { digits: 3, swatch: 'var(--cev-blue)' }),
    int: stat(readout, 'd_int', { digits: 3, swatch: 'var(--cev-purple)' }),
  };
  stats.total.el.style.gridColumn = '1 / -1';
  right.appendChild(readout);

  // ── Histogram (Q vs S), full width ───────────────────────────────────
  const histSheet = sheet('viz-sheet--tight viz-sheet--scroll');
  histSheet.style.marginTop = '1rem';
  const HW = 680, HH = 150, BASE = 118;
  const hist = svg('svg', { class: 'viz-svg', viewBox: `0 0 ${HW} ${HH}`, role: 'img' });
  hist.setAttribute('aria-label', 'Character distribution: ground truth Q versus observed S, per character.');
  histSheet.appendChild(hist);
  container.appendChild(histSheet);
  const histLegend = h('div', 'viz-legend');
  [['Q · ground truth', 'var(--viz-grey)'], ['S · what the pipeline produced', 'var(--cev-blue)']].forEach(([label, color]) => {
    const item = h('span', 'viz-legend__item');
    const sw = h('i', 'viz-swatch'); sw.style.background = color;
    item.append(sw, document.createTextNode(label));
    histLegend.appendChild(item);
  });
  container.appendChild(histLegend);
  const histCap = h('p', 'viz-caption', 'OCR moves mass off the right characters onto confusable neighbours and into the noise bucket (·), changing the shape of the distribution. Parsing changes the totals.');
  container.appendChild(histCap);

  function drawHist(Q, S) {
    hist.replaceChildren();
    const sQ = Q.reduce((a, b) => a + b, 0), sS = S.reduce((a, b) => a + b, 0);
    const n = ALPHABET.length;
    const slot = HW / n, bw = Math.min(18, slot * 0.3), gap = 2;
    const maxP = Math.max(...Q.map((q) => q / sQ), ...S.map((v) => v / sS)) || 1;
    hist.appendChild(svg('line', { x1: 8, y1: BASE + 0.5, x2: HW - 8, y2: BASE + 0.5, stroke: INK, 'stroke-opacity': 0.25 }));
    ALPHABET.forEach((ch, i) => {
      const x = i * slot + slot / 2;
      const hq = (Q[i] / sQ / maxP) * 96, hs = (S[i] / sS / maxP) * 96;
      const bar = (bx, hgt, fill, opacity) => {
        if (hgt <= 0.01) return;
        const r = Math.min(3, hgt / 2);
        hist.appendChild(svg('path', {
          d: `M ${bx} ${BASE} V ${BASE - hgt + r} Q ${bx} ${BASE - hgt} ${bx + r} ${BASE - hgt} H ${bx + bw - r} Q ${bx + bw} ${BASE - hgt} ${bx + bw} ${BASE - hgt + r} V ${BASE} Z`,
          fill, opacity,
        }));
      };
      bar(x - bw - gap / 2, hq, 'var(--viz-grey)', 0.75);
      bar(x + gap / 2, hs, 'var(--cev-blue)', 1);
      const isNoise = ch === '·';
      hist.appendChild(svg('text', { x, y: BASE + 15, 'text-anchor': 'middle', 'font-size': 11, fill: INK, opacity: 0.75, 'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace' }, ch === ' ' ? '␣' : ch));
      if (isNoise) hist.appendChild(svg('text', { x, y: BASE + 27, 'text-anchor': 'middle', 'font-size': 8.5, fill: INK, opacity: 0.6 }, 'noise'));
      if (ch === ' ') hist.appendChild(svg('text', { x, y: BASE + 27, 'text-anchor': 'middle', 'font-size': 8.5, fill: INK, opacity: 0.6 }, 'space'));
    });
  }

  function render() {
    const d = decompose(pErr, oErr);
    const vals = d[metric];
    const max = REF_MAX[metric];
    labelLayer.replaceChildren();
    edgeEls.forEach(({ path, key, colour, lx, ly, dashed }) => {
      const v = vals[key];
      path.setAttribute('stroke-width', (1.5 + Math.min(v / max, 1) * 5.5).toFixed(2));
      chip(labelLayer, lx, ly, `${NAMES[key]}  ${v.toFixed(2)}`, { size: 8.5, anchor: 'middle', key: dashed ? 'var(--viz-ink)' : colour });
    });
    stats.total.set(vals.total); stats.pars.set(vals.pars); stats.ocr.set(vals.ocr); stats.int.set(vals.int);
    const dominant = vals.pars > vals.ocr ? 'parsing is the bottleneck' : vals.ocr > vals.pars ? 'OCR is the bottleneck' : 'evenly split';
    stats.total.setSub(dominant);
    drawHist(d.Q, d.S);
  }

  render();
}
