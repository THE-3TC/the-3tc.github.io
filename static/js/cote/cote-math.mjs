// Pure COTe computation over an integer cell grid. No DOM, no side effects.
// All rectangles are { x, y, w, h } in cell units. SSUs are
// { id, rects: [...] }; multiple rects may share one SSU (the many-to-one
// relation from the paper). Returns the four COTe components, the overall
// score, per-prediction SSU assignments, and a per-cell category grid for
// rendering.

const CAT = { NONE: 0, COVERAGE: 1, OVERLAP: 2, TRESPASS: 3, TRESPASS_OVERLAP: 4, EXCESS: 5 };

function paintRect(grid, W, H, rect, fn) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(W, Math.floor(rect.x + rect.w));
  const y1 = Math.min(H, Math.floor(rect.y + rect.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) fn(y * W + x);
  }
}

export function computeCoteGrid({ width, height, ssus, predictions }) {
  const W = width, H = height, N = W * H;

  // ssuGrid[cell] = index into `ssus` (its position in the array), or -1.
  const ssuGrid = new Int16Array(N).fill(-1);
  ssus.forEach((ssu, idx) => {
    ssu.rects.forEach((rect) => paintRect(ssuGrid, W, H, rect, (i) => { ssuGrid[i] = idx; }));
  });

  let areaS = 0, areaN = 0;
  for (let i = 0; i < N; i++) (ssuGrid[i] >= 0 ? areaS++ : areaN++);

  // Assign each prediction to the SSU index it overlaps most (ties -> lowest index).
  const assignments = predictions.map((pred) => {
    const overlapBySsu = new Map();
    paintRect(ssuGrid, W, H, pred, (i) => {
      const s = ssuGrid[i];
      if (s >= 0) overlapBySsu.set(s, (overlapBySsu.get(s) || 0) + 1);
    });
    let best = -1, bestArea = 0;
    for (const [s, area] of overlapBySsu) {
      if (area > bestArea || (area === bestArea && (best === -1 || s < best))) {
        best = s; bestArea = area;
      }
    }
    return best; // -1 if no overlap with any SSU
  });

  // predCount[cell] = number of predictions covering the cell.
  // trespassMark[cell] = 1 if any prediction NOT assigned to this cell's SSU covers it.
  const predCount = new Uint16Array(N);
  const trespassMark = new Uint8Array(N);
  predictions.forEach((pred, j) => {
    const assigned = assignments[j];
    paintRect(predCount, W, H, pred, (i) => {
      predCount[i] += 1;
      const s = ssuGrid[i];
      if (s >= 0 && s !== assigned) trespassMark[i] = 1;
    });
  });

  // Accumulate the four components (all normalised by the relevant area).
  let coverageCells = 0; // SSU cells with >=1 prediction
  let overlapCells = 0;  // sum over SSU cells of (predCount - 1) when >1
  let excessCells = 0;   // negative-space cells with >=1 prediction
  const categoryGrid = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    const s = ssuGrid[i];
    const c = predCount[i];
    if (s >= 0) {
      if (c > 0) {
        coverageCells++;
        if (c > 1) overlapCells += c - 1;
        const over = c > 1, tres = trespassMark[i] === 1;
        categoryGrid[i] = tres && over ? CAT.TRESPASS_OVERLAP
          : tres ? CAT.TRESPASS
          : over ? CAT.OVERLAP
          : CAT.COVERAGE;
      } else {
        categoryGrid[i] = CAT.NONE;
      }
    } else if (c > 0) {
      excessCells++;
      categoryGrid[i] = CAT.EXCESS;
    }
  }

  // Trespass is summed per prediction: each assigned prediction's area that
  // lands on a *different* SSU. (Overlapping predictions each count.)
  let trespassCells = 0;
  predictions.forEach((pred, j) => {
    const assigned = assignments[j];
    if (assigned < 0) return;
    paintRect(ssuGrid, W, H, pred, (i) => {
      const s = ssuGrid[i];
      if (s >= 0 && s !== assigned) trespassCells++;
    });
  });

  const coverage = areaS ? coverageCells / areaS : 0;
  const overlap = areaS ? overlapCells / areaS : 0;
  const trespass = areaS ? trespassCells / areaS : 0;
  const excess = areaN ? excessCells / areaN : 0;
  const cote = coverage - overlap - trespass;

  return { coverage, overlap, trespass, excess, cote, assignments, categoryGrid, CAT };
}

export const CATEGORIES = CAT;
