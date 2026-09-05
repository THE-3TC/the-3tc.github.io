// Widget 1 — "CER breaks under parsing errors".
// A two-column page: two adjacent, self-contained paragraphs, one per column.
// Ground truth reads column 1 top-to-bottom, then column 2.
// Toggle a parse failure and watch the single string CER must consume get
// scrambled / duplicated / truncated — while the bag-of-characters CEV (SpACER)
// stays calm. Trespass is the killer: one box spanning both columns reads each
// line straight across the gutter, so every character survives and every line
// is mangled.
import { cer, spacerStr } from './cev-math.mjs';

// Two adjacent, self-contained paragraphs — one per column. Nothing flows
// across the gutter, so interleaving them mangles both.
const COL1 = ['the spirit', 'raised the', 'oak table'];
const COL2 = ['the medium', 'sat quietly', 'in a trance'];
const GT = [...COL1, ...COL2].join(' ');

// Tokens are [text, cls] pairs; cls '' renders plain, otherwise .cev-tok--<cls>.
const cleanTokens = [[GT, '']];
// Read line-by-line across both columns: l1c1 l1c2 l2c1 l2c2 ...
const trespassTokens = COL1.flatMap((l, i) => [
  [(i ? ' ' : '') + l + ' ', ''],
  [COL2[i], 'scram'],
]);
const overlapTokens = [[GT, ''], [' ' + COL2.join(' '), 'dup']];
const missingTokens = [[COL1.join(' ') + ' ', ''], [COL2.join(' '), 'miss']];
// The hypothesis string is every token except 'miss' ones (shown struck
// through for the reader, but never transcribed).
const joinTokens = (t) => t.filter(([, cls]) => cls !== 'miss').map(([s]) => s).join('').trim();

// Per-mode: the hypothesis string CER sees, display tokens, and page overlay.
const MODES = {
  clean: {
    label: 'Clean parse',
    tokens: cleanTokens,
    note: 'Two adjacent paragraphs, one box each, read in order. CER and CEV agree.',
  },
  trespass: {
    label: 'Trespass',
    tokens: trespassTokens,
    note: 'One box swallows both columns, so each line is read straight across the gutter and the two paragraphs interleave word by word — both come out mangled. Not a single character is wrong, yet CER scores nearly half of them as errors: it is measuring reading order, not recognition, and the number means nothing. CEV never looked at order, so it reads zero.',
  },
  overlap: {
    label: 'Overlap',
    tokens: overlapTokens,
    note: 'Two predictions cover the right-hand paragraph, so its text is transcribed twice. CER counts every duplicated character as an insertion; CEV sees inflated counts but stays bounded.',
  },
  missing: {
    label: 'Missing',
    tokens: missingTokens,
    note: 'The right-hand paragraph has no prediction, so its text is dropped. Both metrics register the loss as deletions — and note CER gives the same score here as it did for trespass, where nothing was lost.',
  },
};
const ORDER = ['clean', 'trespass', 'overlap', 'missing'];

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

// Page geometry (viewBox units).
const COLS = [
  { x: 6, y: 10, w: 50, h: 40, lines: COL1 },
  { x: 64, y: 10, w: 50, h: 40, lines: COL2 },
];
const LINE_Y = [21, 32, 43]; // text baselines
const FONT = 5.2;

function drawPage(mode) {
  const svg = el('svg', { class: 'cev-stage__svg', viewBox: '0 0 124 60', role: 'img' });
  svg.setAttribute('aria-label', `Two-column page, ${MODES[mode].label} parse`);

  const defs = el('defs', {});
  const marker = el('marker', {
    id: 'cev-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5,
    markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse',
  });
  marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--cev-red)' }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Columns: outline, reading-order number, and the actual words.
  COLS.forEach((c, idx) => {
    const faded = mode === 'missing' && idx === 1;
    const g = el('g', { opacity: faded ? 0.35 : 1 });
    g.appendChild(el('rect', {
      x: c.x, y: c.y, width: c.w, height: c.h, fill: 'none',
      stroke: 'currentColor', 'stroke-dasharray': '3 2', opacity: 0.4,
    }));
    g.appendChild(el('text', {
      x: c.x + c.w / 2, y: 6.5, 'text-anchor': 'middle', 'font-size': 4,
      fill: 'currentColor', opacity: 0.55, 'font-weight': 600,
    }, `column ${idx + 1}`));
    c.lines.forEach((line, r) => {
      g.appendChild(el('text', {
        x: c.x + 4, y: LINE_Y[r], 'font-size': FONT, fill: 'currentColor',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }, line));
    });
    svg.appendChild(g);
  });

  // Prediction overlays per mode.
  const box = (x, y, w, h, cssVar) => el('rect', {
    x, y, width: w, height: h, rx: 1, fill: `var(${cssVar})`, 'fill-opacity': 0.18,
    stroke: `var(${cssVar})`, 'stroke-width': 1.5,
  });
  const [c1, c2] = COLS;
  if (mode === 'clean') {
    svg.appendChild(box(c1.x, c1.y, c1.w, c1.h, '--cev-green'));
    svg.appendChild(box(c2.x, c2.y, c2.w, c2.h, '--cev-green'));
  } else if (mode === 'trespass') {
    // One box spanning both columns, plus the reading path it induces: each
    // line read straight across the gutter.
    svg.appendChild(box(c1.x - 2, c1.y - 2, c2.x + c2.w - c1.x + 4, c1.h + 4, '--cev-red'));
    LINE_Y.forEach((y) => {
      svg.appendChild(el('path', {
        d: `M ${c1.x + 2} ${y + 2} L ${c2.x + c2.w - 3} ${y + 2}`,
        stroke: 'var(--cev-red)', 'stroke-width': 0.9, opacity: 0.85,
        'marker-end': 'url(#cev-arrow)',
      }));
    });
  } else if (mode === 'overlap') {
    svg.appendChild(box(c1.x, c1.y, c1.w, c1.h, '--cev-green'));
    svg.appendChild(box(c2.x, c2.y, c2.w, c2.h, '--cev-green'));
    // The duplicate prediction: same size as the real one, offset down-right so
    // the two boxes read as a cascade of overlapping predictions.
    svg.appendChild(box(c2.x + 5, c2.y + 5, c2.w, c2.h, '--cev-yellow'));
  } else if (mode === 'missing') {
    svg.appendChild(box(c1.x, c1.y, c1.w, c1.h, '--cev-green'));
  }
  return svg;
}

export function init(container) {
  let mode = 'clean';

  const two = document.createElement('div');
  two.className = 'cev-twoup';
  const left = document.createElement('div');
  const right = document.createElement('div');
  two.append(left, right);
  container.appendChild(two);

  // Right: the string CER reads + note.
  const stringLabel = document.createElement('p');
  stringLabel.className = 'cev-widget__hint';
  stringLabel.style.margin = '0 0 0.3rem';
  stringLabel.textContent = 'The one string CER gets to see:';
  const stringBox = document.createElement('div');
  stringBox.className = 'cev-string';
  stringBox.style.marginTop = '0';
  const note = document.createElement('p');
  note.className = 'cev-widget__hint';
  note.style.marginTop = '0.75rem';
  right.append(stringLabel, stringBox, note);

  // Controls (mode toggles).
  const controls = document.createElement('div');
  controls.className = 'cev-controls';
  ORDER.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'cev-btn';
    btn.type = 'button';
    btn.textContent = MODES[m].label;
    btn.setAttribute('aria-pressed', String(m === mode));
    btn.addEventListener('click', () => { mode = m; render(); });
    controls.appendChild(btn);
  });
  container.appendChild(controls);

  // Readout: CER vs CEV.
  const readout = document.createElement('div');
  readout.className = 'cev-readout';
  const stats = {};
  [['cer', 'CER (sequential)'], ['cev', 'CEV / SpACER (bag)']].forEach(([k, label]) => {
    const wrap = document.createElement('div');
    wrap.className = 'cev-stat cev-stat--score';
    const l = document.createElement('span'); l.className = 'cev-stat__label'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'cev-stat__value'; v.textContent = '0.00';
    const sub = document.createElement('span'); sub.className = 'cev-stat__sub';
    wrap.append(l, v, sub); readout.appendChild(wrap);
    stats[k] = { wrap, value: v, sub };
  });
  container.appendChild(readout);

  function render() {
    // page
    left.replaceChildren(drawPage(mode));
    // string tokens
    stringBox.replaceChildren();
    MODES[mode].tokens.forEach(([text, cls]) => {
      if (cls) {
        const b = document.createElement('b');
        b.className = `cev-tok--${cls}`;
        b.textContent = text;
        stringBox.appendChild(b);
      } else {
        stringBox.appendChild(document.createTextNode(text));
      }
    });
    note.textContent = MODES[mode].note;
    // metrics
    const hyp = joinTokens(MODES[mode].tokens);
    stats.cer.value.textContent = cer(GT, hyp).toFixed(2);
    stats.cev.value.textContent = spacerStr(GT, hyp).toFixed(2);
    const trespass = mode === 'trespass';
    stats.cer.wrap.classList.toggle('cev-stat--undefined', trespass);
    stats.cer.sub.textContent = trespass ? 'with zero characters wrong' : '';
    stats.cev.sub.textContent = trespass ? 'order never mattered' : '';
    // button states
    [...controls.children].forEach((btn, i) => btn.setAttribute('aria-pressed', String(ORDER[i] === mode)));
  }

  render();
}
