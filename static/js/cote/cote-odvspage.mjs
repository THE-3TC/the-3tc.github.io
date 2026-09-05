// "Photos aren't pages" — a purely illustrative contrast, no COTe maths.
// Left: a photograph, where detection boxes overlap because objects occlude.
// Right: a page, where text tiles the surface and one box crossing into its
// neighbour corrupts the reading order of everything it touches.
import { svg, h, sheet, toggle, fauxLines, hatch, chip } from '../viz.mjs';

const INK = 'currentColor';

function photoScene() {
  const s = svg('svg', { class: 'viz-svg', viewBox: '0 0 100 72', role: 'img' });
  s.setAttribute('aria-label', 'A photograph with three overlapping detection boxes: person, dog, kite.');
  // ground + horizon
  s.appendChild(svg('rect', { x: 0, y: 46, width: 100, height: 26, fill: 'rgba(0,0,0,0.05)' }));
  s.appendChild(svg('line', { x1: 0, y1: 46, x2: 100, y2: 46, stroke: INK, 'stroke-opacity': 0.15, 'stroke-width': 0.5 }));
  // silhouettes (soft grey shapes so the boxes have something to detect)
  s.appendChild(svg('rect', { x: 27, y: 22, width: 12, height: 40, rx: 5, fill: INK, opacity: 0.12 }));       // person
  s.appendChild(svg('circle', { cx: 33, cy: 16, r: 5, fill: INK, opacity: 0.12 }));
  s.appendChild(svg('rect', { x: 42, y: 46, width: 22, height: 12, rx: 5, fill: INK, opacity: 0.12 }));       // dog
  s.appendChild(svg('polygon', { points: '72,10 82,18 72,26 62,18', fill: INK, opacity: 0.12 }));             // kite
  s.appendChild(svg('path', { d: 'M 72 26 Q 66 40 52 48', stroke: INK, 'stroke-opacity': 0.25, 'stroke-width': 0.5, fill: 'none' }));
  // detection boxes — same ink, since identity is not the point here
  const box = (x, y, w, hgt, label) => {
    s.appendChild(svg('rect', { x, y, width: w, height: hgt, rx: 1, fill: 'none', stroke: INK, 'stroke-width': 1.1 }));
    chip(s, x + 1.5, y + 4.6, label, { size: 3.6 });
  };
  box(22, 8, 22, 56, 'person');
  box(38, 40, 30, 20, 'dog');
  box(58, 6, 28, 24, 'kite');
  // the overlap between person and dog — expected, so it is quiet grey
  s.appendChild(svg('rect', { x: 38, y: 40, width: 6, height: 20, fill: INK, opacity: 0.14 }));
  chip(s, 41, 67.5, 'overlap: expected', { size: 3.4, anchor: 'middle' });
  return s;
}

function pageScene() {
  const s = svg('svg', { class: 'viz-svg', viewBox: '0 0 100 72', role: 'img' });
  s.setAttribute('aria-label', 'A two-column page of text. Three prediction boxes tile it exactly; a fourth box can be shown that swallows part of a neighbouring paragraph.');
  const defs = svg('defs', {});
  const hatchFill = hatch(defs, 'odp-hatch', 'var(--cote-red)', 3, 0.9);
  s.appendChild(defs);

  const blocks = [
    { x: 8, y: 8, w: 38, h: 56, seed: 11 },   // left column
    { x: 54, y: 8, w: 38, h: 26, seed: 12 },  // right top
    { x: 54, y: 38, w: 38, h: 26, seed: 13 }, // right bottom
  ];
  blocks.forEach((b) => s.appendChild(fauxLines(b, { seed: b.seed, lineH: 1.9, gap: 1.6, pad: 2.2 })));

  // Clean predictions: one box per paragraph.
  const clean = svg('g', { class: 'odp-clean' });
  blocks.forEach((b) => clean.appendChild(svg('rect', {
    x: b.x - 1, y: b.y - 1, width: b.w + 2, height: b.h + 2, rx: 1,
    fill: 'var(--cote-green)', 'fill-opacity': 0.10, stroke: 'var(--cote-green)', 'stroke-width': 1.1,
  })));
  s.appendChild(clean);

  // Trespassing prediction: swallows the right-top paragraph and the first
  // lines of the right-bottom one. Everything it steals is hatched red.
  const bad = svg('g', { class: 'odp-bad', opacity: 0 });
  bad.style.transition = 'opacity 0.25s ease';
  const stolen = { x: 54, y: 38, w: 38, h: 12 };
  bad.appendChild(svg('rect', { x: stolen.x, y: stolen.y - 1, width: stolen.w, height: stolen.h + 1, fill: hatchFill, opacity: 0.55 }));
  bad.appendChild(svg('rect', {
    x: 53, y: 7, width: 40, height: 44, rx: 1,
    fill: 'var(--cote-red)', 'fill-opacity': 0.08, stroke: 'var(--cote-red)', 'stroke-width': 1.3,
  }));
  chip(bad, 73, 55.5, 'two paragraphs, one box', { size: 3.4, anchor: 'middle', key: 'var(--cote-red)' });
  s.appendChild(bad);
  s._bad = bad; s._clean = clean;
  return s;
}

export function init(container) {
  const grid = h('div', 'viz-grid-2');

  const photo = sheet('viz-sheet--tight');
  photo.appendChild(photoScene());
  const photoCap = h('p', 'viz-caption');
  photoCap.innerHTML = '<strong>A photograph.</strong> Objects sit in front of one another, so detection boxes overlap. That is expected, and IoU was built for it.';

  const page = sheet('viz-sheet--tight');
  const pageSvg = pageScene();
  page.appendChild(pageSvg);
  const pageCap = h('p', 'viz-caption');
  pageCap.innerHTML = '<strong>A page.</strong> Text tiles the surface with no gaps and no overlaps. A box that crosses into its neighbour corrupts the reading order of both paragraphs.';

  const left = h('div'); left.append(photo, photoCap);
  const right = h('div'); right.append(page, pageCap);
  grid.append(left, right);
  container.appendChild(grid);

  const controls = h('div', 'viz-controls viz-controls--after');
  const t = toggle('Show a trespassing box', false, (on) => {
    pageSvg._bad.setAttribute('opacity', on ? '1' : '0');
    // the clean right-hand boxes step back while the bad one is on
    [...pageSvg._clean.children].forEach((r, i) => { if (i > 0) r.setAttribute('opacity', on ? '0.25' : '1'); });
  });
  controls.appendChild(t.el);
  container.appendChild(controls);
}
