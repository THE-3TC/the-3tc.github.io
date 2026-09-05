import { init as initCerBreak } from './cev-cerbreak.mjs';
import { init as initDecomp } from './cev-decomp.mjs';
import { init as initResults } from './cev-results.mjs';

function run() {
  const cerBreak = document.getElementById('cev-cerbreak');
  if (cerBreak) initCerBreak(cerBreak);
  const decomp = document.getElementById('cev-decomp');
  if (decomp) initDecomp(decomp);
  const results = document.getElementById('cev-results');
  if (results) initResults(results);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}
