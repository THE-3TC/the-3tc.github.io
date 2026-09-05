// Widget 3 — real results from the Spiritualist case study.
// Page-level d_total (SpACER, lower = better). End-to-end VLMs lose to modular
// pipelines — and the "best" score of all is a degenerate-parser trap that only
// the COTe Trespass component exposes.
const ROWS = [
  { name: 'PPDoc-S + PaddleOCR', dtotal: 0.006, trespass: 0.74, kind: 'trap' },
  { name: 'Heron + PaddleOCR', dtotal: 0.009, trespass: 0.00, kind: 'pipeline' },
  { name: 'YOLO + EasyOCR', dtotal: 0.028, trespass: 0.00, kind: 'pipeline' },
  { name: 'M.OCR (end-to-end)', dtotal: 0.097, trespass: null, kind: 'e2e' },
  { name: 'olmOCR (end-to-end)', dtotal: 0.106, trespass: null, kind: 'e2e' },
  { name: 'Granite (end-to-end)', dtotal: 0.864, trespass: null, kind: 'e2e' },
];

const NS = 'http://www.w3.org/2000/svg';
const AXIS_MAX = 0.18; // d_total beyond this is clipped and labelled with its true value
const LABEL_W = 124, X0 = LABEL_W, X1 = 330;
const ROW_H = 30, TOP = 8;

function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

const colourFor = (kind, showTrap) => {
  if (kind === 'trap') return showTrap ? 'var(--cev-red)' : 'var(--cev-green)';
  if (kind === 'pipeline') return 'var(--cev-green)';
  return 'var(--cev-blue)';
};

export function init(container) {
  let showTrap = false;

  const svg = el('svg', { class: 'cev-stage__svg', viewBox: `0 0 340 ${TOP * 2 + ROWS.length * ROW_H + 16}`, role: 'img' });
  svg.setAttribute('aria-label', 'Page-level d_total by model, lower is better');
  svg.style.maxWidth = '460px';
  container.appendChild(svg);

  const controls = document.createElement('div');
  controls.className = 'cev-controls';
  const trapBtn = document.createElement('button');
  trapBtn.className = 'cev-btn'; trapBtn.type = 'button';
  trapBtn.textContent = 'Cross-check with COTe Trespass';
  trapBtn.setAttribute('aria-pressed', 'false');
  trapBtn.addEventListener('click', () => { showTrap = !showTrap; trapBtn.setAttribute('aria-pressed', String(showTrap)); rerender(); });
  controls.appendChild(trapBtn);
  container.appendChild(controls);

  const note = document.createElement('p');
  note.className = 'cev-widget__hint';
  note.style.marginTop = '0.6rem';
  container.appendChild(note);

  function render() {
    svg.replaceChildren();
    // axis baseline
    svg.appendChild(el('line', { x1: X0, y1: TOP, x2: X0, y2: TOP + ROWS.length * ROW_H, stroke: 'currentColor', 'stroke-opacity': 0.3 }));
    [0, 0.05, 0.1, 0.15].forEach((t) => {
      const x = X0 + (t / AXIS_MAX) * (X1 - X0);
      svg.appendChild(el('text', { x, y: TOP + ROWS.length * ROW_H + 12, 'text-anchor': 'middle', 'font-size': 7, fill: 'currentColor', opacity: 0.5 }, t.toFixed(2)));
    });

    ROWS.forEach((r, i) => {
      const y = TOP + i * ROW_H + 6;
      const clipped = r.dtotal > AXIS_MAX;
      const w = (Math.min(r.dtotal, AXIS_MAX) / AXIS_MAX) * (X1 - X0);
      const fill = colourFor(r.kind, showTrap);
      // name
      svg.appendChild(el('text', { x: X0 - 6, y: y + 13, 'text-anchor': 'end', 'font-size': 8.5, fill: 'currentColor' }, r.name));
      // bar
      const bar = el('rect', { class: 'cev-bar', x: X0, y, width: Math.max(w, 1), height: 16, rx: 2, fill, 'fill-opacity': 0.85 });
      bar.style.transition = 'fill 0.3s ease';
      svg.appendChild(bar);
      // clipped marker
      if (clipped) svg.appendChild(el('text', { x: X1 + 2, y: y + 12, 'font-size': 9, fill }, '»'));
      // value
      svg.appendChild(el('text', { x: clipped ? X1 + 10 : X0 + w + 4, y: y + 12, 'font-size': 8, fill: 'currentColor', opacity: 0.8 }, r.dtotal.toFixed(3)));
      // trap annotation
      if (showTrap && r.kind === 'trap') {
        svg.appendChild(el('text', { x: X0 + Math.max(w, 1) + 4, y: y + 12, 'font-size': 7.5, fill: 'var(--cev-red)' }, `Trespass ${r.trespass.toFixed(2)} — degenerate parse`));
      }
    });
  }

  function updateNote() {
    note.textContent = showTrap
      ? 'PPDoc-S earns the lowest d_total of all (0.006) — but it parses the page into a few giant boxes that span every column. Its COTe Trespass of 0.74 flags the parse as junk, disqualifying it. The honest winner is Heron + PaddleOCR. SpACER alone cannot see this; the ecosystem of metrics can.'
      : 'Lower d_total is better. Note that all three end-to-end VLMs are beaten by the modular pipelines — their OCR is excellent, but their page parsing is weaker. The apparent overall winner (PPDoc-S, 0.006) looks too good… press the button.';
  }

  function rerender() { render(); updateNote(); }
  rerender();
}
