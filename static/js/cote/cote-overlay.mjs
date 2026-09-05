// The COTe decomposition, live. Three ground-truth semantic units on a
// two-column page; four prediction boxes the reader can toggle and drag. Every
// cell of the page is painted by what happened to it — coverage, overlap,
// trespass (hatched, so it survives red/green colour blindness), both, or
// excess — and the score breaks down beside the page.
import { computeCoteGrid } from './cote-math.mjs';
import { svg, h, sheet, toggle, button, stat, fauxLines, seeded } from '../viz.mjs';

const GRID_W = 120, GRID_H = 168;

const SSUS = [
  { id: 0, rects: [{ x: 8, y: 12, w: 48, h: 64 }] },
  { id: 1, rects: [{ x: 8, y: 88, w: 48, h: 64 }] },
  { id: 2, rects: [{ x: 64, y: 12, w: 48, h: 140 }] },
];
const INITIAL_PREDS = [
  { id: 'A', x: 8, y: 12, w: 48, h: 64, on: true },
  { id: 'B', x: 8, y: 88, w: 60, h: 64, on: true },   // spills right -> trespass
  { id: 'C', x: 64, y: 12, w: 48, h: 70, on: true },
  { id: 'D', x: 64, y: 30, w: 30, h: 40, on: false },  // toggle on -> overlap
];

// Category -> [r,g,b, hatched?]
const CAT_COLOR = {
  1: [0, 131, 0, false],       // coverage
  2: [237, 161, 0, false],     // overlap
  3: [227, 73, 72, true],      // trespass
  4: [74, 58, 167, true],      // trespass + overlap
  5: [42, 120, 214, false],    // excess
};
const COMPONENTS = [
  ['coverage', 'Coverage', 'var(--cote-green)', false],
  ['overlap', 'Overlap', 'var(--cote-yellow)', false],
  ['trespass', 'Trespass', 'var(--cote-red)', true],
  ['excess', 'Excess', 'var(--cote-blue)', false],
];

export function init(container) {
  const preds = INITIAL_PREDS.map((p) => ({ ...p }));

  const grid = h('div', 'viz-grid-side');
  container.appendChild(grid);

  // ── Left: the page ───────────────────────────────────────────────────
  const paper = sheet('viz-sheet--tight');
  const stage = h('div', 'viz-stage');
  const sizer = h('div', 'viz-stage__sizer');
  sizer.style.paddingTop = `${(GRID_H / GRID_W) * 100}%`;
  stage.appendChild(sizer);

  const s = svg('svg', { class: 'viz-stage__svg', viewBox: `0 0 ${GRID_W} ${GRID_H}`, preserveAspectRatio: 'none' });
  SSUS.forEach((ssu, i) => ssu.rects.forEach((r) => {
    s.appendChild(fauxLines(r, { seed: 100 + i, lineH: 3.2, gap: 3.4, pad: 4, opacity: 0.3 }));
    s.appendChild(svg('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.45, 'stroke-width': 0.6, 'stroke-dasharray': '2.5 1.8' }));
  }));
  stage.appendChild(s);

  const canvas = h('canvas', 'viz-stage__canvas');
  canvas.width = GRID_W; canvas.height = GRID_H;
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const boxLayer = h('div', 'viz-stage__boxes');
  stage.appendChild(boxLayer);
  paper.appendChild(stage);

  const hint = h('p', 'viz-hint', 'Drag a box to move it. Dashed outlines are the three ground-truth units.');
  const leftCol = h('div'); leftCol.append(paper, hint);
  grid.appendChild(leftCol);

  // ── Right: score, breakdown, controls ────────────────────────────────
  const right = h('div', 'viz-stack');
  grid.appendChild(right);

  const readout = h('div', 'viz-readout');
  readout.style.marginTop = '0';
  const coteStat = stat(readout, 'COTe = C − O − T', { hero: true });
  right.appendChild(readout);

  const comps = h('div', 'viz-comps');
  const compEls = {};
  COMPONENTS.forEach(([key, label, color, hatched]) => {
    const l = h('span', 'viz-comp__label');
    const sw = h('i', 'viz-swatch' + (hatched ? ' viz-swatch--hatch' : ''));
    if (!hatched) sw.style.background = color;
    l.append(sw, document.createTextNode(label));
    const track = h('div', 'viz-comp__track');
    const fill = h('div', 'viz-comp__fill' + (hatched ? ' viz-comp__fill--hatch' : ''));
    fill.style.backgroundColor = color;
    track.appendChild(fill);
    const v = h('span', 'viz-comp__value', '0.00');
    comps.append(l, track, v);
    compEls[key] = { fill, v };
  });
  right.appendChild(comps);

  const controls = h('div', 'viz-controls');
  controls.style.margin = '0';
  const toggles = preds.map((p) => {
    const t = toggle(`Box ${p.id}`, p.on, (on) => {
      p.on = on;
      p._el.classList.toggle('viz-predbox--off', !on);
      recompute();
    });
    controls.appendChild(t.el);
    return t;
  });
  const reset = button('Reset', () => {
    INITIAL_PREDS.forEach((init0, i) => {
      Object.assign(preds[i], { x: init0.x, y: init0.y, w: init0.w, h: init0.h, on: init0.on });
      preds[i]._place();
      preds[i]._el.classList.toggle('viz-predbox--off', !preds[i].on);
      toggles[i].set(preds[i].on);
    });
    recompute();
  });
  reset.classList.add('viz-btn--quiet');
  controls.appendChild(reset);
  right.appendChild(controls);

  const legend = h('div', 'viz-legend');
  [['Coverage', 'var(--cote-green)', false], ['Overlap', 'var(--cote-yellow)', false], ['Trespass', 'var(--cote-red)', true],
   ['Overlap + trespass', 'var(--cote-purple)', true], ['Excess', 'var(--cote-blue)', false]].forEach(([label, color, hatched]) => {
    const item = h('span', 'viz-legend__item');
    const sw = h('i', 'viz-swatch' + (hatched ? ' viz-swatch--hatch' : ''));
    sw.style.backgroundColor = color;
    if (hatched) sw.style.backgroundImage = `repeating-linear-gradient(45deg, ${color} 0 2px, rgba(255,255,255,0.6) 2px 4px)`;
    item.append(sw, document.createTextNode(label));
    legend.appendChild(item);
  });
  right.appendChild(legend);

  // ── Prediction boxes (draggable, lettered) ───────────────────────────
  const pct = (v, total) => `${(v / total) * 100}%`;
  preds.forEach((p) => {
    const el = h('div', 'viz-predbox' + (p.on ? '' : ' viz-predbox--off'));
    el.dataset.id = p.id;
    el.setAttribute('aria-label', `Prediction box ${p.id}`);
    el.appendChild(h('span', 'viz-predbox__tag', p.id));
    const place = () => {
      el.style.left = pct(p.x, GRID_W); el.style.top = pct(p.y, GRID_H);
      el.style.width = pct(p.w, GRID_W); el.style.height = pct(p.h, GRID_H);
    };
    place();
    p._el = el; p._place = place;
    boxLayer.appendChild(el);
    enableDrag(el, p, stage, recompute);
  });

  // ── Paint + recompute ────────────────────────────────────────────────
  function paintCanvas(categoryGrid) {
    const img = ctx.createImageData(GRID_W, GRID_H);
    for (let i = 0; i < categoryGrid.length; i++) {
      const cat = categoryGrid[i];
      const o = i * 4;
      const c = CAT_COLOR[cat];
      if (!c) { img.data[o + 3] = 0; continue; }
      const [r, g, b, hatched] = c;
      const x = i % GRID_W, y = (i / GRID_W) | 0;
      // 45° hatch at cell resolution: every other diagonal band lightens
      const light = hatched && ((x + y) % 6) < 3;
      img.data[o] = light ? 255 - (255 - r) * 0.35 : r;
      img.data[o + 1] = light ? 255 - (255 - g) * 0.35 : g;
      img.data[o + 2] = light ? 255 - (255 - b) * 0.35 : b;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function recompute() {
    const result = computeCoteGrid({
      width: GRID_W, height: GRID_H, ssus: SSUS,
      predictions: preds.filter((p) => p.on).map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
    });
    paintCanvas(result.categoryGrid);
    coteStat.set(result.cote);
    coteStat.el.classList.toggle('viz-stat--alert', result.cote < 0);
    coteStat.setSub(result.cote < 0 ? 'worse than predicting nothing' : result.cote > 0.99 ? 'a perfect parse' : '');
    COMPONENTS.forEach(([key]) => {
      const v = result[key];
      compEls[key].fill.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`;
      compEls[key].v.textContent = v.toFixed(2);
    });
  }

  recompute();
}

// Pointer dragging in grid units, clamped to the page.
function enableDrag(el, pred, stage, onChange) {
  let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;
  el.addEventListener('pointerdown', (e) => {
    dragging = true; el.setPointerCapture(e.pointerId); el.classList.add('is-dragging');
    startX = e.clientX; startY = e.clientY; origX = pred.x; origY = pred.y;
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((e.clientX - startX) / rect.width) * GRID_W;
    const dy = ((e.clientY - startY) / rect.height) * GRID_H;
    pred.x = Math.round(Math.max(0, Math.min(GRID_W - pred.w, origX + dx)));
    pred.y = Math.round(Math.max(0, Math.min(GRID_H - pred.h, origY + dy)));
    pred._place();
    onChange();
  });
  const end = () => { dragging = false; el.classList.remove('is-dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
