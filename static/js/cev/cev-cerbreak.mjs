// "CER breaks under parsing errors." A two-column page holding two adjacent,
// self-contained paragraphs. Ground truth reads column 1 top to bottom, then
// column 2. Pick a parse failure and watch the single string CER must consume
// get scrambled, duplicated or truncated — while the bag-of-characters CEV
// stays calm. Reading order is shown as numbered badges beside each line, so
// nothing is ever drawn over the words.
import { cer, spacerStr } from './cev-math.mjs';
import { svg, h, sheet, segmented, stat, reserveHeight, setNote, arrowMarker } from '../viz.mjs';

const COL1 = ['the spirit', 'raised the', 'oak table'];
const COL2 = ['the medium', 'sat quietly', 'in a trance'];
const GT = [...COL1, ...COL2].join(' ');

// Tokens are [text, cls] pairs; cls '' renders plain, otherwise .viz-tok--<cls>.
const cleanTokens = [[GT, '']];
const trespassTokens = COL1.flatMap((l, i) => [[(i ? ' ' : '') + l + ' ', ''], [COL2[i], 'scram']]);
const overlapTokens = [[GT, ''], [' ' + COL2.join(' '), 'dup']];
const missingTokens = [[COL1.join(' ') + ' ', ''], [COL2.join(' '), 'miss']];
const joinTokens = (t) => t.filter(([, cls]) => cls !== 'miss').map(([s]) => s).join('').trim();

const MODES = {
  clean: {
    label: 'Clean parse', tokens: cleanTokens,
    order: [[1, 2, 3], [4, 5, 6]],
    note: 'Two paragraphs, one box each, read in order. CER and CEV agree: nothing is wrong.',
  },
  trespass: {
    label: 'Trespass', tokens: trespassTokens,
    order: [[1, 3, 5], [2, 4, 6]],
    note: 'One box swallows both columns, so every line is read straight across the gutter and the two paragraphs interleave. Not a single character is wrong, yet CER scores nearly half of them as errors — it is measuring reading order, not recognition. CEV never looked at order, so it reads zero.',
  },
  overlap: {
    label: 'Overlap', tokens: overlapTokens,
    order: [[1, 2, 3], [4, 5, 6]],
    note: 'Two predictions cover the right-hand paragraph, so its text is transcribed twice. CER counts every duplicated character as an insertion; CEV sees inflated counts but stays bounded.',
  },
  missing: {
    label: 'Missing', tokens: missingTokens,
    order: [[1, 2, 3], [null, null, null]],
    note: 'The right-hand paragraph has no prediction, so its text is dropped. Both metrics register the loss — and CER gives the same score here as it did for trespass, where nothing was lost at all.',
  },
};
const ORDER = ['clean', 'trespass', 'overlap', 'missing'];

// Page geometry (viewBox units).
const COLS = [
  { x: 8, y: 12, w: 52, h: 40, lines: COL1 },
  { x: 68, y: 12, w: 52, h: 40, lines: COL2 },
];
const LINE_Y = [23, 34, 45];
const FONT = 5;
const INK = 'currentColor';

function drawPage(mode) {
  const s = svg('svg', { class: 'viz-svg', viewBox: '0 0 128 60', role: 'img' });
  s.setAttribute('aria-label', `Two-column page, ${MODES[mode].label.toLowerCase()}. Reading order ${MODES[mode].order.flat().map((n) => n ?? '–').join(', ')}.`);
  const defs = svg('defs', {});
  const redHead = arrowMarker(defs, 'cev-cb-head', 'var(--cev-red)', 5);
  s.appendChild(defs);

  const box = (x, y, w, hgt, cssVar, extra = {}) => svg('rect', {
    x, y, width: w, height: hgt, rx: 1, fill: `var(${cssVar})`, 'fill-opacity': 0.10,
    stroke: `var(${cssVar})`, 'stroke-width': 1.1, ...extra,
  });
  const [c1, c2] = COLS;

  // Prediction boxes go underneath the text.
  if (mode === 'clean') {
    s.appendChild(box(c1.x, c1.y, c1.w, c1.h, '--cev-green'));
    s.appendChild(box(c2.x, c2.y, c2.w, c2.h, '--cev-green'));
  } else if (mode === 'trespass') {
    s.appendChild(box(c1.x - 2, c1.y - 2, c2.x + c2.w - c1.x + 4, c1.h + 4, '--cev-red'));
  } else if (mode === 'overlap') {
    s.appendChild(box(c1.x, c1.y, c1.w, c1.h, '--cev-green'));
    s.appendChild(box(c2.x, c2.y, c2.w, c2.h, '--cev-green'));
    s.appendChild(box(c2.x + 4, c2.y + 5, c2.w, c2.h, '--cev-yellow'));
  } else if (mode === 'missing') {
    s.appendChild(box(c1.x, c1.y, c1.w, c1.h, '--cev-green'));
  }

  // Columns: faint outline, header, the words, and a reading-order badge per line.
  COLS.forEach((c, idx) => {
    const faded = mode === 'missing' && idx === 1;
    const g = svg('g', { opacity: faded ? 0.35 : 1 });
    g.appendChild(svg('rect', { x: c.x, y: c.y, width: c.w, height: c.h, fill: 'none', stroke: INK, 'stroke-opacity': 0.35, 'stroke-width': 0.5, 'stroke-dasharray': '2 1.5' }));
    g.appendChild(svg('text', { x: c.x + c.w / 2, y: 7.5, 'text-anchor': 'middle', 'font-size': 3.8, fill: INK, opacity: 0.6 }, `column ${idx + 1}`));
    c.lines.forEach((line, r) => {
      const n = MODES[mode].order[idx][r];
      const bad = mode === 'trespass';
      // badge
      g.appendChild(svg('circle', { cx: c.x + 5.5, cy: LINE_Y[r] - 1.6, r: 2.9, fill: n == null ? 'none' : bad ? 'var(--cev-red)' : INK, stroke: n == null ? INK : 'none', 'stroke-opacity': 0.5, 'stroke-width': 0.5 }));
      if (n != null) g.appendChild(svg('text', { x: c.x + 5.5, y: LINE_Y[r] - 0.2, 'text-anchor': 'middle', 'font-size': 3.6, 'font-weight': 500, fill: '#fff' }, String(n)));
      g.appendChild(svg('text', {
        x: c.x + 11, y: LINE_Y[r], 'font-size': FONT, fill: INK,
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }, line));
    });
    s.appendChild(g);
  });

  // Trespass: the reading path jumps the gutter on every line. Drawn only in
  // the gutter, so the words stay readable.
  if (mode === 'trespass') {
    LINE_Y.forEach((y) => {
      s.appendChild(svg('path', {
        d: `M ${c1.x + c1.w - 1} ${y - 1.6} L ${c2.x + 1.5} ${y - 1.6}`,
        stroke: 'var(--cev-red)', 'stroke-width': 0.8, 'marker-end': redHead,
      }));
    });
  }
  if (mode === 'overlap') {
    s.appendChild(svg('text', { x: c2.x + c2.w + 3.5, y: c2.y + c2.h + 4, 'font-size': 3.6, 'text-anchor': 'end', fill: INK, opacity: 0.7 }, '×2'));
  }
  return s;
}

export function init(container) {
  let mode = 'clean';

  const seg = segmented(ORDER.map((k) => ({ key: k, label: MODES[k].label })), mode, (k) => { mode = k; render(); }, 'Parse outcome');
  const controls = h('div', 'viz-controls');
  controls.appendChild(seg.el);
  container.appendChild(controls);

  const two = h('div', 'viz-grid-2');
  const left = sheet('viz-sheet--tight');
  const right = h('div');
  two.append(left, right);
  container.appendChild(two);

  const stringLabel = h('p', 'viz-hint', 'The one string CER gets to see');
  stringLabel.style.margin = '0 0 0.4rem';
  const stringSheet = sheet();
  const stringBox = h('div', 'viz-string');
  stringSheet.appendChild(stringBox);
  right.append(stringLabel, stringSheet);

  const readout = h('div', 'viz-readout');
  const cerStat = stat(readout, 'CER · sequential', { hero: true });
  const cevStat = stat(readout, 'CEV / SpACER · bag of characters', { hero: true });
  container.appendChild(readout);

  const note = h('p', 'viz-note');
  container.appendChild(note);
  reserveHeight(note, ORDER.map((k) => MODES[k].note));

  function render() {
    left.replaceChildren(drawPage(mode));
    stringBox.replaceChildren();
    MODES[mode].tokens.forEach(([text, cls]) => {
      if (cls) {
        const b = h('b', `viz-tok--${cls}`, text);
        stringBox.appendChild(b);
      } else {
        stringBox.appendChild(document.createTextNode(text));
      }
    });
    const hyp = joinTokens(MODES[mode].tokens);
    cerStat.set(cer(GT, hyp));
    cevStat.set(spacerStr(GT, hyp));
    const trespass = mode === 'trespass';
    cerStat.el.classList.toggle('viz-stat--alert', trespass);
    cerStat.setSub(trespass ? 'with zero characters wrong' : mode === 'missing' ? 'same score as trespass' : '');
    cevStat.setSub(trespass ? 'order never mattered' : '');
    setNote(note, MODES[mode].note);
  }

  render();
}
