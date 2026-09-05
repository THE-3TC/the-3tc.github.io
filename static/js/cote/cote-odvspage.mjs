// "Photos aren't pages" — a purely illustrative contrast, no COTe maths.
// Left: a photograph, where detection boxes overlap because objects occlude.
// Right: a page, where text tiles the surface and one box crossing into its
// neighbour corrupts the reading order of everything it touches.
import { svg, h, sheet, toggle, fauxLines, hatch, chip } from '../viz.mjs';

const INK = 'currentColor';

function photoScene() {
  const s = svg('svg', { class: 'viz-svg', viewBox: '0 0 100 72', role: 'img' });
  s.setAttribute('aria-label', 'A photograph of a person jumping while holding a beagle on a lead, with detection boxes for the person, their backpack and the dog. The backpack box sits inside the person box.');
  const defs = svg('defs', {});
  const clip = svg('clipPath', { id: 'odp-photo' });
  clip.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 72, rx: 1.5 }));
  defs.appendChild(clip);
  s.appendChild(defs);
  s.appendChild(svg('image', { href: '/images/park-beagle.jpg', x: 0, y: 0, width: 100, height: 72, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#odp-photo)' }));
  // Boxes in ink on the photo; labels on dark chips so they read over any background.
  const box = (x, y, w, hgt, label, labelBelow = false) => {
    s.appendChild(svg('rect', { x, y, width: w, height: hgt, rx: 0.8, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-opacity': 0.55 }));
    s.appendChild(svg('rect', { x, y, width: w, height: hgt, rx: 0.8, fill: 'none', stroke: '#111111', 'stroke-width': 1 }));
    const lw = label.length * 2.2 + 3, ly = labelBelow ? y + hgt + 0.8 : y - 5.6;
    s.appendChild(svg('rect', { x, y: ly, width: lw, height: 4.8, rx: 0.6, fill: '#111111' }));
    s.appendChild(svg('text', { x: x + 1.5, y: ly + 3.5, 'font-size': 3.4, fill: '#ffffff' }, label));
  };
  box(27.5, 16, 39, 38, 'person');
  box(45.8, 22.4, 8.4, 9.2, 'backpack', true);
  box(61.4, 54, 11.8, 13.9, 'dog');
  // the nested backpack: overlap is the normal state of affairs in a photograph
  s.appendChild(svg('rect', { x: 45.8, y: 22.4, width: 8.4, height: 9.2, fill: '#ffffff', opacity: 0.18 }));
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
  photoCap.innerHTML = '<strong>A photograph.</strong> Objects sit in front of one another, so detection boxes overlap and nest. That is expected, and IoU was built for it. Photo: <a href="https://commons.wikimedia.org/wiki/File:Young_woman_jumping_with_her_lovely_beagle_dog_in_the_park_of_Bali_island,_Indonesia._(50194002498).jpg">Artem Beliaikin</a>, CC0.';

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
