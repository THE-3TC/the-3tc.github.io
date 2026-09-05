// Real results from the Spiritualist case study. Page-level d_total (SpACER,
// lower is better). End-to-end VLMs lose to modular pipelines — and the "best"
// score of all is a degenerate-parser trap that only COTe Trespass exposes.
import { svg, h, sheet, toggle, reserveHeight, setNote, hatch } from '../viz.mjs';

const ROWS = [
  { name: 'PPDoc-S + PaddleOCR', dtotal: 0.006, trespass: 0.74, kind: 'modular', trap: true },
  { name: 'Heron + PaddleOCR', dtotal: 0.009, trespass: 0.00, kind: 'modular' },
  { name: 'YOLO + EasyOCR', dtotal: 0.028, trespass: 0.00, kind: 'modular' },
  { name: 'M.OCR', dtotal: 0.097, trespass: null, kind: 'e2e' },
  { name: 'olmOCR', dtotal: 0.106, trespass: null, kind: 'e2e' },
  { name: 'Granite', dtotal: 0.864, trespass: null, kind: 'e2e' },
];
const KIND = { modular: ['Modular pipeline', 'var(--viz-ink-2)'], e2e: ['End-to-end VLM', 'var(--cev-blue)'] };

const AXIS_MAX = 0.18;
const W = 480, LABEL_W = 132, X0 = LABEL_W, X1 = 352, TX = 400;
const ROW_H = 30, TOP = 22, BAR_H = 16;
const INK = 'currentColor';

const NOTES = {
  off: 'Lower d_total is better. All three end-to-end models are beaten by the modular pipelines: their OCR is excellent, but their page parsing is weaker. The apparent winner, PPDoc-S at 0.006, looks too good. Cross-check it.',
  on: 'PPDoc-S earns the lowest d_total of all — by parsing the page into a few giant boxes that span every column. The character counts come out right, so a bag-of-characters score cannot see it. Its COTe Trespass of 0.74 flags the parse as junk. The honest winner is Heron + PaddleOCR.',
};

export function init(container) {
  let showTrap = false;

  const paper = sheet('viz-sheet--tight viz-sheet--scroll');
  const H = TOP + ROWS.length * ROW_H + 26;
  const s = svg('svg', { class: 'viz-svg', viewBox: `0 0 ${W} ${H}`, role: 'img' });
  s.setAttribute('aria-label', 'Page-level d_total by model, lower is better. ' + ROWS.map((r) => `${r.name} ${r.dtotal}`).join(', ') + '.');
  const defs = svg('defs', {});
  const redHatch = hatch(defs, 'cev-res-hatch', 'rgba(255,255,255,0.55)', 5, 1.6);
  s.appendChild(defs);
  paper.appendChild(s);
  container.appendChild(paper);

  const legend = h('div', 'viz-legend');
  Object.values(KIND).forEach(([label, color]) => {
    const item = h('span', 'viz-legend__item');
    const sw = h('i', 'viz-swatch'); sw.style.background = color;
    item.append(sw, document.createTextNode(label));
    legend.appendChild(item);
  });
  const trapItem = h('span', 'viz-legend__item');
  const trapSw = h('i', 'viz-swatch viz-swatch--hatch');
  trapItem.append(trapSw, document.createTextNode('Degenerate parse (Trespass ≥ 0.5)'));
  trapItem.style.visibility = 'hidden';
  legend.appendChild(trapItem);
  container.appendChild(legend);

  const controls = h('div', 'viz-controls viz-controls--after');
  const t = toggle('Cross-check with COTe Trespass', false, (on) => { showTrap = on; rerender(); });
  controls.appendChild(t.el);
  container.appendChild(controls);

  const note = h('p', 'viz-note');
  container.appendChild(note);
  reserveHeight(note, Object.values(NOTES));

  function render() {
    s.replaceChildren(defs);
    const bottom = TOP + ROWS.length * ROW_H;
    // column headers
    s.appendChild(svg('text', { x: X0, y: 11, 'font-size': 8, fill: INK, opacity: 0.6 }, 'd_total  ·  lower is better'));
    const trHead = svg('text', { x: TX + 20, y: 11, 'font-size': 8, 'text-anchor': 'middle', fill: INK, opacity: showTrap ? 0.85 : 0 }, 'COTe Trespass');
    trHead.style.transition = 'opacity 0.3s ease';
    s.appendChild(trHead);
    // axis
    s.appendChild(svg('line', { x1: X0, y1: TOP - 4, x2: X0, y2: bottom, stroke: INK, 'stroke-opacity': 0.3 }));
    [0, 0.05, 0.1, 0.15].forEach((v) => {
      const x = X0 + (v / AXIS_MAX) * (X1 - X0);
      s.appendChild(svg('line', { x1: x, y1: bottom, x2: x, y2: bottom + 3, stroke: INK, 'stroke-opacity': 0.3 }));
      s.appendChild(svg('text', { x, y: bottom + 12, 'text-anchor': 'middle', 'font-size': 7.5, fill: INK, opacity: 0.55, 'font-variant-numeric': 'tabular-nums' }, v.toFixed(2)));
    });

    ROWS.forEach((r, i) => {
      const y = TOP + i * ROW_H + (ROW_H - BAR_H) / 2;
      const cy = y + BAR_H / 2;
      const clipped = r.dtotal > AXIS_MAX;
      const w = (Math.min(r.dtotal, AXIS_MAX) / AXIS_MAX) * (X1 - X0);
      const isTrap = showTrap && r.trap;
      const fill = isTrap ? 'var(--cev-red)' : KIND[r.kind][1];
      const g = svg('g', {});
      g.appendChild(svg('title', {}, `${r.name}: d_total ${r.dtotal.toFixed(3)}${r.trespass != null ? `, COTe Trespass ${r.trespass.toFixed(2)}` : ''}`));
      g.appendChild(svg('text', { x: X0 - 8, y: cy + 3, 'text-anchor': 'end', 'font-size': 9, fill: INK, opacity: isTrap ? 1 : 0.9, 'font-weight': isTrap ? 500 : 400 }, r.name));
      // bar: square at the baseline, rounded at the data end
      const bw = Math.max(w, 2), rr = 3;
      const d = `M ${X0} ${y} H ${X0 + bw - rr} Q ${X0 + bw} ${y} ${X0 + bw} ${y + rr} V ${y + BAR_H - rr} Q ${X0 + bw} ${y + BAR_H} ${X0 + bw - rr} ${y + BAR_H} H ${X0} Z`;
      const bar = svg('path', { d, fill });
      bar.style.transition = 'fill 0.3s ease';
      g.appendChild(bar);
      if (isTrap) g.appendChild(svg('path', { d, fill: redHatch }));
      // value at the tip (or outside the clip)
      const vx = clipped ? X1 + 6 : X0 + bw + 5;
      g.appendChild(svg('text', { x: vx, y: cy + 3, 'font-size': 8.5, fill: INK, opacity: 0.85, 'font-variant-numeric': 'tabular-nums' }, clipped ? `${r.dtotal.toFixed(3)} »` : r.dtotal.toFixed(3)));
      if (clipped) g.appendChild(svg('line', { x1: X1 - 3, y1: y - 2, x2: X1 + 3, y2: y + BAR_H + 2, stroke: 'var(--viz-sheet)', 'stroke-width': 3 }));
      // trespass column (appears on cross-check)
      const tr = svg('g', { opacity: showTrap ? 1 : 0 });
      tr.style.transition = 'opacity 0.3s ease';
      if (r.trespass == null) {
        tr.appendChild(svg('text', { x: TX + 20, y: cy + 3, 'text-anchor': 'middle', 'font-size': 8.5, fill: INK, opacity: 0.4 }, '—'));
      } else {
        const tw = r.trespass * 40;
        if (tw > 0) tr.appendChild(svg('rect', { x: TX, y: y + 3, width: tw, height: BAR_H - 6, rx: 2, fill: 'var(--cev-red)' }));
        tr.appendChild(svg('text', { x: TX + Math.max(tw, 0) + 5, y: cy + 3, 'font-size': 8.5, fill: r.trap ? 'var(--cev-red)' : INK, opacity: r.trap ? 1 : 0.7, 'font-weight': r.trap ? 500 : 400, 'font-variant-numeric': 'tabular-nums' }, r.trespass.toFixed(2)));
      }
      g.appendChild(tr);
      s.appendChild(g);
    });
  }

  function rerender() {
    render();
    trapItem.style.visibility = showTrap ? 'visible' : 'hidden';
    setNote(note, showTrap ? NOTES.on : NOTES.off);
  }
  rerender();
}
