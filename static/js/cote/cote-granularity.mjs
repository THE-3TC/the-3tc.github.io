// The granularity trap. The same page content, labelled as 3 line boxes that
// form ONE semantic unit. The model predicts the identical area at a chosen
// granularity — the parse is always perfect, only the number of boxes changes.
// F1 matches boxes one-to-one by IoU, so it only scores well when the
// granularities happen to line up. COTe scores the semantic unit and does not
// care how many boxes it took.
import { computeCoteGrid } from './cote-math.mjs';
import { svg, h, sheet, segmented, stat, fauxLines, chip } from '../viz.mjs';

const GT_LINES = 3;
const STATES = [
  { key: 'coarser', label: 'Coarser · 1 box', n: 1 },
  { key: 'aligned', label: 'Aligned · 3 boxes', n: GT_LINES },
  { key: 'finer', label: 'Finer · 9 boxes', n: 9 },
];
const START = 'aligned';

const VB_W = 200, VB_H = 112;
const TOP = 22, BOT = 106;
const GT = { x: 12, w: 72 };
const PR = { x: 116, w: 72 };
const INK = 'currentColor';

const intervals = (n) => Array.from({ length: n }, (_, i) => ({ a: i / n, b: (i + 1) / n }));
function iou1d(p, q) {
  const inter = Math.max(0, Math.min(p.b, q.b) - Math.max(p.a, q.a));
  const uni = (p.b - p.a) + (q.b - q.a) - inter;
  return uni > 0 ? inter / uni : 0;
}
// Greedy one-to-one IoU matching at 0.5 — the standard basis for detection F1.
function matchF1(gt, pred, thr = 0.5) {
  const pairs = [];
  let best = 0;
  pred.forEach((p, pi) => gt.forEach((g, gi) => {
    const v = iou1d(p, g); best = Math.max(best, v);
    if (v >= thr) pairs.push({ pi, gi, v });
  }));
  pairs.sort((a, b) => b.v - a.v);
  const pUsed = Array(pred.length).fill(false), gUsed = Array(gt.length).fill(false);
  const matchPred = Array(pred.length).fill(-1);
  let tp = 0;
  for (const { pi, gi } of pairs) {
    if (!pUsed[pi] && !gUsed[gi]) { pUsed[pi] = gUsed[gi] = true; matchPred[pi] = gi; tp++; }
  }
  const fp = pred.length - tp, fn = gt.length - tp;
  const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { f1, matchPred, tp, best };
}
// Honest COTe via the shared module: one SSU (the 3 GT lines) vs n tiling preds.
function coteScore(n) {
  const W = 12, H = 72, lineH = H / GT_LINES, ph = H / n;
  const ssus = [{ id: 0, rects: Array.from({ length: GT_LINES }, (_, i) => ({ x: 0, y: i * lineH, w: W, h: lineH })) }];
  const predictions = Array.from({ length: n }, (_, i) => ({ x: 0, y: i * ph, w: W, h: ph }));
  return computeCoteGrid({ width: W, height: H, ssus, predictions });
}
const yOf = (t) => TOP + t * (BOT - TOP);

export function init(container) {
  let current = START;

  const seg = segmented(STATES, current, (key) => { current = key; render(); }, 'Prediction granularity');
  const controls = h('div', 'viz-controls');
  controls.appendChild(seg.el);
  container.appendChild(controls);

  const paper = sheet('viz-sheet--tight');
  const s = svg('svg', { class: 'viz-svg', viewBox: `0 0 ${VB_W} ${VB_H}`, role: 'img' });
  s.setAttribute('aria-label', 'Ground truth of three line boxes forming one semantic unit, beside the model prediction at the chosen granularity.');
  paper.appendChild(s);
  container.appendChild(paper);

  const readout = h('div', 'viz-readout');
  const f1Stat = stat(readout, 'F1 · IoU ≥ 0.5', { hero: true });
  const coteStat = stat(readout, 'COTe', { hero: true });
  container.appendChild(readout);

  // Static layer: the text itself never changes between states.
  const text = svg('g', {});
  const fauxRect = { x: GT.x, y: TOP, w: GT.w, h: BOT - TOP };
  text.appendChild(fauxLines(fauxRect, { seed: 7, lineH: 2.4, gap: 2.2, pad: 3.5 }));
  const textR = fauxLines({ ...fauxRect, x: PR.x }, { seed: 7, lineH: 2.4, gap: 2.2, pad: 3.5 });
  text.appendChild(textR);
  s.appendChild(text);
  const dyn = svg('g', {});
  s.appendChild(dyn);

  const label = (x, y, str, opts = {}) => dyn.appendChild(svg('text', {
    x, y, 'font-size': 5.2, 'text-anchor': 'middle', fill: INK, opacity: opts.muted ? 0.55 : 0.85,
    'font-weight': opts.bold ? 500 : 400,
  }, str));

  function render() {
    const n = STATES.find((st) => st.key === current).n;
    const gt = intervals(GT_LINES), pred = intervals(n);
    const { f1, matchPred, tp, best } = matchF1(gt, pred);
    const matchedGt = new Set(matchPred.filter((gi) => gi >= 0));
    dyn.replaceChildren();

    label(GT.x + GT.w / 2, 9, 'Ground truth', { bold: true });
    label(GT.x + GT.w / 2, 16, '3 line boxes · one semantic unit', { muted: true });
    label(PR.x + PR.w / 2, 9, 'Prediction', { bold: true });
    label(PR.x + PR.w / 2, 16, `${n} box${n > 1 ? 'es' : ''} · same area`, { muted: true });

    // Ground-truth line boxes — ink outlines; a matched one gets a quiet green wash.
    gt.forEach((g, gi) => {
      const matched = matchedGt.has(gi);
      dyn.appendChild(svg('rect', {
        x: GT.x, y: yOf(g.a) + 0.6, width: GT.w, height: (g.b - g.a) * (BOT - TOP) - 1.2, rx: 1,
        fill: matched ? 'var(--cote-green)' : 'none', 'fill-opacity': 0.10,
        stroke: INK, 'stroke-opacity': 0.55, 'stroke-width': 0.7, 'stroke-dasharray': '2 1.4',
      }));
    });
    // Prediction boxes — green if F1 accepted them, red (hatched by stroke) if rejected.
    pred.forEach((p, pi) => {
      const matched = matchPred[pi] >= 0;
      const col = matched ? 'var(--cote-green)' : 'var(--cote-red)';
      const r = svg('rect', {
        x: PR.x, y: yOf(p.a) + 0.6, width: PR.w, height: (p.b - p.a) * (BOT - TOP) - 1.2, rx: 1,
        fill: col, 'fill-opacity': 0.14, stroke: col, 'stroke-width': 0.9,
        'stroke-dasharray': matched ? null : '1.6 1.2',
      });
      dyn.appendChild(r);
    });
    // Match connectors, drawn in ink so colour stays reserved for verdicts.
    pred.forEach((p, pi) => {
      const gi = matchPred[pi];
      if (gi < 0) return;
      const y1 = yOf((gt[gi].a + gt[gi].b) / 2), y2 = yOf((p.a + p.b) / 2);
      dyn.appendChild(svg('path', {
        d: `M ${GT.x + GT.w + 1} ${y1} C ${GT.x + GT.w + 14} ${y1}, ${PR.x - 14} ${y2}, ${PR.x - 1} ${y2}`,
        stroke: INK, 'stroke-opacity': 0.5, 'stroke-width': 0.7, fill: 'none',
      }));
      chip(dyn, (GT.x + GT.w + PR.x) / 2, (y1 + y2) / 2 + 0.6, `IoU ${iou1d(pred[pi], gt[gi]).toFixed(2)}`, { size: 3.6, anchor: 'middle' });
    });
    // fade the new drawing in
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dyn.style.opacity = '0'; requestAnimationFrame(() => { dyn.style.transition = 'opacity 0.25s ease'; dyn.style.opacity = '1'; });
    }

    f1Stat.set(f1);
    f1Stat.setSub(tp ? `${tp} of ${GT_LINES} boxes matched` : `best IoU ${best.toFixed(2)} — nothing clears 0.5`);
    const c = coteScore(n);
    coteStat.set(c.cote);
    coteStat.setSub(`coverage ${c.coverage.toFixed(2)} · overlap ${c.overlap.toFixed(2)} · trespass ${c.trespass.toFixed(2)}`);
  }

  render();
}
