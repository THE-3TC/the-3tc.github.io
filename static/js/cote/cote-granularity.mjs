import { computeCoteGrid } from './cote-math.mjs';

// Two side-by-side renderings of the SAME page content. The ground truth is
// labelled as 3 lines; the model predicts the identical area at a chosen
// granularity. The parse is always perfect (every word captured once) — only
// the number of boxes changes. F1 matches boxes 1-to-1 by IoU, so it only
// scores well when the granularities happen to line up. COTe, scored against
// the whole semantic unit, does not care.

const GT_LINES = 3;
const STATES = {
  coarser: { label: 'Coarser · 1 box', n: 1 },
  aligned: { label: 'Aligned · 3 boxes', n: GT_LINES },
  finer:   { label: 'Finer · 9 boxes', n: 9 },
};
const START = 'aligned';

const VB_W = 160, VB_H = 104;
const TOP = 22, BOT = 98;          // content vertical span (viewBox units)
const GT_X = 10, GT_W = 60;        // ground-truth column
const PR_X = 90, PR_W = 60;        // prediction column

const svgNS = 'http://www.w3.org/2000/svg';

function intervals(n) {
  return Array.from({ length: n }, (_, i) => ({ a: i / n, b: (i + 1) / n }));
}
function iou1d(p, q) {
  const inter = Math.max(0, Math.min(p.b, q.b) - Math.max(p.a, q.a));
  const uni = (p.b - p.a) + (q.b - q.a) - inter;
  return uni > 0 ? inter / uni : 0;
}
// Greedy 1-to-1 IoU matching (>= 0.5), the standard basis for detection F1.
function matchF1(gt, pred, thr = 0.5) {
  const pairs = [];
  pred.forEach((p, pi) => gt.forEach((g, gi) => {
    const v = iou1d(p, g);
    if (v >= thr) pairs.push({ pi, gi, v });
  }));
  pairs.sort((a, b) => b.v - a.v);
  const pUsed = Array(pred.length).fill(false);
  const gUsed = Array(gt.length).fill(false);
  const matchPred = Array(pred.length).fill(-1); // pred index -> gt index, or -1
  let tp = 0;
  for (const { pi, gi } of pairs) {
    if (!pUsed[pi] && !gUsed[gi]) { pUsed[pi] = gUsed[gi] = true; matchPred[pi] = gi; tp++; }
  }
  const fp = pred.length - tp, fn = gt.length - tp;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { f1, matchPred };
}
// Honest COTe via the shared module: one SSU (the 3 GT lines) vs n tiling preds.
function coteScore(n) {
  const W = 12, H = 72, lineH = H / GT_LINES, ph = H / n;
  const ssus = [{ id: 0, rects: Array.from({ length: GT_LINES }, (_, i) => ({ x: 0, y: i * lineH, w: W, h: lineH })) }];
  const predictions = Array.from({ length: n }, (_, i) => ({ x: 0, y: i * ph, w: W, h: ph }));
  return computeCoteGrid({ width: W, height: H, ssus, predictions }).cote;
}
const yOf = (t) => TOP + t * (BOT - TOP);

export function init(container) {
  const stage = document.createElement('div');
  stage.className = 'cote-stage';
  stage.style.maxWidth = '480px';
  const sizer = document.createElement('div');
  sizer.className = 'cote-stage__sizer';
  sizer.style.paddingTop = `${(VB_H / VB_W) * 100}%`;
  stage.appendChild(sizer);
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'cote-stage__svg');
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  stage.appendChild(svg);
  container.appendChild(stage);

  const readout = document.createElement('div');
  readout.className = 'cote-readout';
  const f1Stat = makeStat(readout, 'F1', true);
  const coteStat = makeStat(readout, 'COTe', true);
  container.appendChild(readout);

  const controls = document.createElement('div');
  controls.className = 'cote-controls';
  let current = START;
  const keys = Object.keys(STATES);
  keys.forEach((key) => {
    const btn = document.createElement('button');
    btn.className = 'cote-btn'; btn.type = 'button'; btn.textContent = STATES[key].label;
    btn.setAttribute('aria-pressed', String(key === current));
    btn.addEventListener('click', () => {
      current = key;
      [...controls.children].forEach((c, i) => c.setAttribute('aria-pressed', String(keys[i] === current)));
      render();
    });
    controls.appendChild(btn);
  });
  container.appendChild(controls);

  function rect(x, y, w, h, opts = {}) {
    const r = document.createElementNS(svgNS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('rx', opts.rx ?? 1.5);
    r.setAttribute('fill', opts.fill ?? 'none');
    if (opts.stroke) r.setAttribute('stroke', opts.stroke);
    if (opts.sw) r.setAttribute('stroke-width', opts.sw);
    if (opts.dash) r.setAttribute('stroke-dasharray', opts.dash);
    if (opts.opacity != null) r.setAttribute('opacity', opts.opacity);
    svg.appendChild(r);
  }
  function label(x, y, s) {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('font-size', 5.5); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', 'currentColor'); t.setAttribute('opacity', 0.75);
    t.textContent = s; svg.appendChild(t);
  }
  function connector(y1, y2) {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', GT_X + GT_W); l.setAttribute('y1', y1);
    l.setAttribute('x2', PR_X); l.setAttribute('y2', y2);
    l.setAttribute('stroke', 'var(--cote-green)'); l.setAttribute('stroke-width', 0.9);
    l.setAttribute('opacity', 0.85); svg.appendChild(l);
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const n = STATES[current].n;
    const gt = intervals(GT_LINES);
    const pred = intervals(n);
    const { f1, matchPred } = matchF1(gt, pred);
    const matchedGt = new Set(matchPred.filter((gi) => gi >= 0));

    label(GT_X + GT_W / 2, 13, 'Ground truth · 3 lines');
    label(PR_X + PR_W / 2, 13, `Model · ${n} box${n > 1 ? 'es' : ''}`);

    // Green coverage wash — what COTe sees (full coverage on both sides).
    rect(GT_X, yOf(0), GT_W, yOf(1) - yOf(0), { fill: 'var(--cote-green)', opacity: 0.12 });
    rect(PR_X, yOf(0), PR_W, yOf(1) - yOf(0), { fill: 'var(--cote-green)', opacity: 0.12 });

    // Ground-truth line boxes: green if matched, grey if a false negative.
    gt.forEach((g, gi) => {
      const matched = matchedGt.has(gi);
      rect(GT_X, yOf(g.a) + 0.7, GT_W, (g.b - g.a) * (BOT - TOP) - 1.4, {
        fill: matched ? 'var(--cote-green)' : 'rgba(128,128,128,0.12)',
        opacity: matched ? 0.4 : 1,
        stroke: matched ? 'var(--cote-green)' : 'rgba(128,128,128,0.55)',
        sw: 0.8, dash: '2 1.5',
      });
    });
    // Prediction boxes: green if F1 matched them, red if rejected.
    pred.forEach((p, pi) => {
      const matched = matchPred[pi] >= 0;
      rect(PR_X, yOf(p.a) + 0.7, PR_W, (p.b - p.a) * (BOT - TOP) - 1.4, {
        fill: matched ? 'var(--cote-green)' : 'var(--cote-red)', opacity: 0.45,
        stroke: matched ? 'var(--cote-green)' : 'var(--cote-red)', sw: 0.8,
      });
    });
    // Match connectors.
    pred.forEach((p, pi) => {
      const gi = matchPred[pi];
      if (gi < 0) return;
      connector(yOf((gt[gi].a + gt[gi].b) / 2), yOf((p.a + p.b) / 2));
    });

    animateStat(f1Stat, f1);
    animateStat(coteStat, coteScore(n));
  }

  render();
}

function makeStat(parent, labelText, isScore) {
  const wrap = document.createElement('div');
  wrap.className = 'cote-stat' + (isScore ? ' cote-stat--score' : '');
  const l = document.createElement('span'); l.className = 'cote-stat__label'; l.textContent = labelText;
  const v = document.createElement('span'); v.className = 'cote-stat__value'; v.textContent = '0.00';
  wrap.append(l, v); parent.appendChild(wrap);
  return { el: v, shown: 0 };
}

function animateStat(stat, target) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || typeof window.anime !== 'function') {
    stat.shown = target; stat.el.textContent = target.toFixed(2); return;
  }
  window.anime({
    targets: stat, shown: target, duration: 400, easing: 'easeOutCubic',
    update: () => { stat.el.textContent = stat.shown.toFixed(2); },
  });
}
