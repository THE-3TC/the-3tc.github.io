import { init as initOverlay } from './cote-overlay.mjs';
import { init as initGranularity } from './cote-granularity.mjs';
import { init as initOdVsPage } from './cote-odvspage.mjs';

function run() {
  const overlay = document.getElementById('cote-overlay');
  if (overlay) initOverlay(overlay);
  const gran = document.getElementById('cote-granularity');
  if (gran) initGranularity(gran);
  const odp = document.getElementById('cote-odvspage');
  if (odp) initOdVsPage(odp);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}
