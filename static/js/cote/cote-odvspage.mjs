// No COTe math here — this is a purely illustrative contrast.
const svgNS = 'http://www.w3.org/2000/svg';

function rect(parent, x, y, w, h, opts = {}) {
  const r = document.createElementNS(svgNS, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y);
  r.setAttribute('width', w); r.setAttribute('height', h);
  r.setAttribute('rx', opts.rx ?? 2);
  r.setAttribute('fill', opts.fill ?? 'none');
  r.setAttribute('stroke', opts.stroke ?? 'currentColor');
  r.setAttribute('stroke-width', opts.sw ?? 1);
  if (opts.dash) r.setAttribute('stroke-dasharray', opts.dash);
  r.setAttribute('opacity', opts.opacity ?? 1);
  parent.appendChild(r);
  return r;
}

function panel(title, caption, draw) {
  const wrap = document.createElement('figure');
  wrap.style.margin = '0';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 80');
  svg.setAttribute('width', '100%');
  svg.style.border = '1px solid rgba(128,128,128,0.3)';
  svg.style.borderRadius = '6px';
  draw(svg);
  const cap = document.createElement('figcaption');
  cap.style.fontSize = '0.8rem'; cap.style.marginTop = '0.4rem'; cap.style.opacity = '0.85';
  cap.innerHTML = `<strong>${title}.</strong> ${caption}`;
  wrap.append(svg, cap);
  return wrap;
}

export function init(container) {
  const twoup = document.createElement('div');
  twoup.className = 'cote-twoup';

  // Left: photo — overlapping boxes are normal (objects occlude in 3D).
  const photo = panel(
    'A photograph',
    'Objects sit in front of one another, so detection boxes overlap. That is expected.',
    (svg) => {
      rect(svg, 5, 5, 90, 70, { fill: 'rgba(128,128,128,0.06)', stroke: 'none' });
      rect(svg, 18, 22, 38, 46, { stroke: 'var(--cote-green)', sw: 1.5 });   // person
      rect(svg, 40, 34, 40, 30, { stroke: 'var(--cote-blue)', sw: 1.5 });    // dog, overlapping
      rect(svg, 60, 12, 26, 24, { stroke: 'var(--cote-yellow)', sw: 1.5 });  // sky object
    });

  // Right: page — content tessellates; overlap means duplicated/garbled text.
  const page = panel(
    'A page',
    'Text tiles the page with no gaps and no overlaps. A box crossing into its neighbour corrupts the reading order.',
    (svg) => {
      rect(svg, 5, 5, 90, 70, { fill: 'rgba(128,128,128,0.06)', stroke: 'none' });
      rect(svg, 10, 10, 38, 60, { stroke: 'currentColor', dash: '2 2', opacity: 0.6 });
      rect(svg, 52, 10, 38, 28, { stroke: 'currentColor', dash: '2 2', opacity: 0.6 });
      rect(svg, 52, 42, 38, 28, { stroke: 'currentColor', dash: '2 2', opacity: 0.6 });
      // a "good" prediction
      rect(svg, 11, 11, 36, 58, { stroke: 'var(--cote-green)', sw: 1.5 });
      // a trespassing prediction the button highlights
      const bad = rect(svg, 53, 11, 36, 40, { stroke: 'var(--cote-red)', sw: 1.5, opacity: 0 });
      svg._bad = bad;
    });

  twoup.append(photo, page);
  container.appendChild(twoup);

  const controls = document.createElement('div');
  controls.className = 'cote-controls';
  const btn = document.createElement('button');
  btn.className = 'cote-btn'; btn.type = 'button';
  btn.textContent = 'Show a box that trespasses';
  let shown = false;
  const badRect = page.querySelector('svg')._bad;
  btn.addEventListener('click', () => {
    shown = !shown;
    badRect.setAttribute('opacity', shown ? '1' : '0');
    btn.textContent = shown ? 'Hide the trespassing box' : 'Show a box that trespasses';
    btn.setAttribute('aria-pressed', String(shown));
  });
  controls.appendChild(btn);
  container.appendChild(controls);
}
