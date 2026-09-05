import { computeCoteGrid } from './cote-math.mjs';

const GRID_W = 120;
const GRID_H = 168;

// Three ground-truth SSUs on a two-column page (cell coordinates).
const SSUS = [
  { id: 0, rects: [{ x: 8,  y: 12, w: 48, h: 64 }] },   // left column block
  { id: 1, rects: [{ x: 8,  y: 88, w: 48, h: 64 }] },   // left column block 2
  { id: 2, rects: [{ x: 64, y: 12, w: 48, h: 140 }] },  // right column block
];

// Prediction boxes the reader can toggle/drag. `on` is the initial state.
const INITIAL_PREDS = [
  { id: 'a', x: 8,  y: 12, w: 48, h: 64, on: true },
  { id: 'b', x: 8,  y: 88, w: 60, h: 64, on: true },   // spills right -> trespass
  { id: 'c', x: 64, y: 12, w: 48, h: 70, on: true },
  { id: 'd', x: 64, y: 30, w: 30, h: 40, on: false },  // toggle on -> overlap
];

const CAT_COLOR = {
  1: [46, 158, 91],   // coverage  green
  2: [224, 181, 40],  // overlap   yellow
  3: [212, 80, 62],   // trespass  red
  4: [138, 79, 191],  // t+overlap purple
  5: [58, 120, 194],  // excess    blue
};

function makeFauxLines(svgNS, ssu) {
  // Decorative "text lines" inside an SSU rect, drawn as thin grey bars.
  const g = document.createElementNS(svgNS, 'g');
  ssu.rects.forEach((r) => {
    const lineH = 4, gap = 3;
    for (let y = r.y + 4; y < r.y + r.h - 2; y += lineH + gap) {
      const line = document.createElementNS(svgNS, 'rect');
      line.setAttribute('x', r.x + 4);
      line.setAttribute('y', y);
      line.setAttribute('width', r.w - 8 - (Math.random() * (r.w * 0.25)));
      line.setAttribute('height', lineH);
      line.setAttribute('rx', 1);
      line.setAttribute('fill', 'currentColor');
      line.setAttribute('opacity', '0.28');
      g.appendChild(line);
    }
    const outline = document.createElementNS(svgNS, 'rect');
    outline.setAttribute('x', r.x); outline.setAttribute('y', r.y);
    outline.setAttribute('width', r.w); outline.setAttribute('height', r.h);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', 'currentColor');
    outline.setAttribute('stroke-dasharray', '3 2');
    outline.setAttribute('opacity', '0.4');
    g.appendChild(outline);
  });
  return g;
}

export function init(container) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const preds = INITIAL_PREDS.map((p) => ({ ...p }));

  // --- Stage scaffolding ---
  const stage = document.createElement('div');
  stage.className = 'cote-stage';
  // sizer enforces the page aspect ratio so the absolute layers have a height.
  const sizer = document.createElement('div');
  sizer.className = 'cote-stage__sizer';
  sizer.style.paddingTop = `${(GRID_H / GRID_W) * 100}%`;
  stage.appendChild(sizer);

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'cote-stage__svg');
  svg.setAttribute('viewBox', `0 0 ${GRID_W} ${GRID_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  SSUS.forEach((ssu) => svg.appendChild(makeFauxLines(svgNS, ssu)));
  stage.appendChild(svg);

  const canvas = document.createElement('canvas');
  canvas.className = 'cote-stage__canvas';
  canvas.width = GRID_W; canvas.height = GRID_H;
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const boxLayer = document.createElement('div');
  boxLayer.className = 'cote-stage__boxes';
  stage.appendChild(boxLayer);

  container.appendChild(stage);

  // --- Prediction box elements (draggable) ---
  const pct = (v, total) => `${(v / total) * 100}%`;
  preds.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'cote-predbox' + (p.on ? '' : ' cote-predbox--off');
    el.dataset.id = p.id;
    const place = () => {
      el.style.left = pct(p.x, GRID_W);
      el.style.top = pct(p.y, GRID_H);
      el.style.width = pct(p.w, GRID_W);
      el.style.height = pct(p.h, GRID_H);
    };
    place();
    p._el = el; p._place = place;
    boxLayer.appendChild(el);
    enableDrag(el, p, stage, recompute);
  });

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'cote-controls';
  preds.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'cote-btn';
    btn.type = 'button';
    btn.textContent = `Box ${p.id.toUpperCase()}`;
    btn.setAttribute('aria-pressed', String(p.on));
    btn.addEventListener('click', () => {
      p.on = !p.on;
      btn.setAttribute('aria-pressed', String(p.on));
      p._el.classList.toggle('cote-predbox--off', !p.on);
      recompute();
    });
    controls.appendChild(btn);
  });
  const reset = document.createElement('button');
  reset.className = 'cote-btn';
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    INITIAL_PREDS.forEach((init0, i) => {
      Object.assign(preds[i], { x: init0.x, y: init0.y, w: init0.w, h: init0.h, on: init0.on });
      preds[i]._place();
      preds[i]._el.classList.toggle('cote-predbox--off', !preds[i].on);
      controls.children[i].setAttribute('aria-pressed', String(preds[i].on));
    });
    recompute();
  });
  controls.appendChild(reset);
  container.appendChild(controls);

  // --- Readout ---
  const readout = document.createElement('div');
  readout.className = 'cote-readout';
  const stats = {};
  [
    ['cote', 'COTe', true], ['coverage', 'Coverage', false],
    ['overlap', 'Overlap', false], ['trespass', 'Trespass', false],
    ['excess', 'Excess', false],
  ].forEach(([key, label, isScore]) => {
    const wrap = document.createElement('div');
    wrap.className = 'cote-stat' + (isScore ? ' cote-stat--score' : '');
    const l = document.createElement('span'); l.className = 'cote-stat__label'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'cote-stat__value'; v.textContent = '0.00';
    wrap.append(l, v); readout.appendChild(wrap);
    stats[key] = { el: v, shown: 0 };
  });
  container.appendChild(readout);

  // --- Legend ---
  const legend = document.createElement('div');
  legend.className = 'cote-legend';
  [['green', 'Coverage'], ['yellow', 'Overlap'], ['red', 'Trespass'],
   ['purple', 'Overlap+Trespass'], ['blue', 'Excess']].forEach(([c, label]) => {
    const item = document.createElement('span'); item.className = 'cote-legend__item';
    const sw = document.createElement('span'); sw.className = 'cote-swatch';
    sw.style.background = `var(--cote-${c})`;
    const t = document.createElement('span'); t.textContent = label;
    item.append(sw, t); legend.appendChild(item);
  });
  container.appendChild(legend);

  // --- Recompute + render ---
  function activePredRects() {
    return preds.filter((p) => p.on).map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
  }

  function paintCanvas(categoryGrid) {
    const img = ctx.createImageData(GRID_W, GRID_H);
    for (let i = 0; i < categoryGrid.length; i++) {
      const cat = categoryGrid[i];
      const o = i * 4;
      if (cat && CAT_COLOR[cat]) {
        const [r, g, b] = CAT_COLOR[cat];
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      } else {
        img.data[o + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function animateStat(stat, target) {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof window.anime !== 'function') {
      stat.shown = target; stat.el.textContent = target.toFixed(2); return;
    }
    window.anime({
      targets: stat, shown: target, duration: 350, easing: 'easeOutCubic',
      update: () => { stat.el.textContent = stat.shown.toFixed(2); },
    });
  }

  function recompute() {
    const result = computeCoteGrid({
      width: GRID_W, height: GRID_H, ssus: SSUS, predictions: activePredRects(),
    });
    paintCanvas(result.categoryGrid);
    animateStat(stats.cote, result.cote);
    animateStat(stats.coverage, result.coverage);
    animateStat(stats.overlap, result.overlap);
    animateStat(stats.trespass, result.trespass);
    animateStat(stats.excess, result.excess);
  }

  recompute();
}

// Pointer dragging that keeps box coords in grid units and clamps to the page.
function enableDrag(el, pred, stage, onChange) {
  let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;
  el.addEventListener('pointerdown', (e) => {
    dragging = true; el.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY; origX = pred.x; origY = pred.y;
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((e.clientX - startX) / rect.width) * GRID_W;
    const dy = ((e.clientY - startY) / rect.height) * GRID_H;
    pred.x = Math.max(0, Math.min(GRID_W - pred.w, origX + dx));
    pred.y = Math.max(0, Math.min(GRID_H - pred.h, origY + dy));
    pred._place();
    onChange();
  });
  const end = () => { dragging = false; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
