// "Photos aren't pages" — a purely illustrative contrast, no COTe maths.
// Left: a photograph, where detection boxes overlap because objects occlude.
// Right: a page, where text tiles the surface and one box crossing into its
// neighbour corrupts the reading order of everything it touches.
import { svg, h, sheet, toggle, fauxLines, hatch, chip } from '../viz.mjs';

const INK = 'currentColor';

function photoScene() {
  const s = svg('svg', { class: 'viz-svg', viewBox: '0 0 100 72', role: 'img' });
  s.setAttribute('aria-label', 'A photograph of a person flying a kite with a dog beside them, with three overlapping detection boxes.');
  const FIG = '#8f8f8f';
  // ground + horizon
  s.appendChild(svg('rect', { x: 0, y: 50, width: 100, height: 22, fill: 'rgba(0,0,0,0.05)' }));
  s.appendChild(svg('line', { x1: 0, y1: 50, x2: 100, y2: 50, stroke: INK, 'stroke-opacity': 0.15, 'stroke-width': 0.5 }));

  // kite: diamond with spars, a bow tail, and a string down to the hand
  const kite = svg('g', {});
  kite.appendChild(svg('path', { d: 'M 72 26 Q 66 34 60 30 Q 55 27 44 36', fill: 'none', stroke: FIG, 'stroke-width': 0.6 }));           // string
  kite.appendChild(svg('polygon', { points: '72,7 81,17 72,27 63,17', fill: FIG }));
  kite.appendChild(svg('path', { d: 'M 72 7 V 27 M 63 17 H 81', stroke: 'var(--viz-sheet)', 'stroke-width': 0.6, opacity: 0.9 }));
  kite.appendChild(svg('path', { d: 'M 72 27 q 3 3 0 6 q -3 3 0 6', fill: 'none', stroke: FIG, 'stroke-width': 0.6 }));                 // tail
  [30, 36].forEach((y) => kite.appendChild(svg('path', { d: `M ${71.4} ${y} l -1.6 -1.4 v 2.8 z M ${72.6} ${y} l 1.6 -1.4 v 2.8 z`, fill: FIG })));
  s.appendChild(kite);

  // person: head, body, arms (one raised to the string), legs
  const person = svg('g', { fill: FIG, stroke: FIG, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  person.appendChild(svg('circle', { cx: 33, cy: 14.5, r: 4, stroke: 'none' }));
  person.appendChild(svg('path', { d: 'M 29 21 h 8 l 1.5 17 h -11 z', stroke: 'none' }));                                              // torso
  person.appendChild(svg('path', { d: 'M 30 22 L 26 33 L 27.5 40', fill: 'none', 'stroke-width': 2.6 }));                              // left arm
  person.appendChild(svg('path', { d: 'M 36.5 22 L 41 30 L 44 36', fill: 'none', 'stroke-width': 2.6 }));                              // right arm to string
  person.appendChild(svg('path', { d: 'M 30 38 L 29 56 M 36 38 L 37.5 56', fill: 'none', 'stroke-width': 3 }));                        // legs
  person.appendChild(svg('path', { d: 'M 29 56 h -3 M 37.5 56 h 3.5', fill: 'none', 'stroke-width': 2.2 }));                          // feet
  s.appendChild(person);

  // dog: body, head with ear and snout, legs, tail
  const dog = svg('g', { fill: FIG, stroke: FIG, 'stroke-linecap': 'round' });
  dog.appendChild(svg('rect', { x: 46, y: 43, width: 15, height: 8, rx: 4, stroke: 'none' }));                                          // body
  dog.appendChild(svg('circle', { cx: 63, cy: 42.5, r: 3.6, stroke: 'none' }));                                                          // head
  dog.appendChild(svg('path', { d: 'M 63 42.5 l 4.5 1.2 l -1.5 1.6 z', stroke: 'none' }));                                              // snout
  dog.appendChild(svg('path', { d: 'M 61 39.5 l -1.6 -3 l 2.8 1.6 z', stroke: 'none' }));                                              // ear
  dog.appendChild(svg('path', { d: 'M 48.5 50 V 56 M 52 50 V 56 M 55.5 50 V 56 M 59 50 V 56', fill: 'none', 'stroke-width': 1.8 }));  // legs
  dog.appendChild(svg('path', { d: 'M 46 45 q -3 -1 -3.5 -4.5', fill: 'none', 'stroke-width': 1.4 }));                                 // tail
  s.appendChild(dog);

  // detection boxes — same ink for all, since identity is not the point here
  const box = (x, y, w, hgt, label) => {
    s.appendChild(svg('rect', { x, y, width: w, height: hgt, rx: 1, fill: 'none', stroke: INK, 'stroke-width': 1.1 }));
    chip(s, x + 1.5, y + 4.6, label, { size: 3.6 });
  };
  box(23, 8, 24, 50, 'person');
  box(41, 34, 30, 24, 'dog');
  box(59, 3, 26, 38, 'kite');
  // where person and dog boxes overlap — expected in a photo, so it stays quiet
  s.appendChild(svg('rect', { x: 41, y: 34, width: 6, height: 24, fill: INK, opacity: 0.10 }));
  chip(s, 50, 66.5, 'boxes overlap: expected', { size: 3.4, anchor: 'middle' });
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
