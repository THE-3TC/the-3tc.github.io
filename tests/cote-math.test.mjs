import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCoteGrid } from '../static/js/cote/cote-math.mjs';

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// One SSU filling the left half of a 10x10 grid; one prediction exactly on it.
const baseSsus = [{ id: 0, rects: [{ x: 0, y: 0, w: 5, h: 10 }] }];

test('perfect coverage of a single SSU scores 1', () => {
  const r = computeCoteGrid({
    width: 10, height: 10,
    ssus: baseSsus,
    predictions: [{ x: 0, y: 0, w: 5, h: 10 }],
  });
  assert.ok(approx(r.coverage, 1), `coverage=${r.coverage}`);
  assert.ok(approx(r.overlap, 0), `overlap=${r.overlap}`);
  assert.ok(approx(r.trespass, 0), `trespass=${r.trespass}`);
  assert.ok(approx(r.excess, 0), `excess=${r.excess}`);
  assert.ok(approx(r.cote, 1), `cote=${r.cote}`);
});

test('two identical predictions on one SSU => full overlap, cote 0', () => {
  const r = computeCoteGrid({
    width: 10, height: 10,
    ssus: baseSsus,
    predictions: [
      { x: 0, y: 0, w: 5, h: 10 },
      { x: 0, y: 0, w: 5, h: 10 },
    ],
  });
  assert.ok(approx(r.coverage, 1), `coverage=${r.coverage}`);
  assert.ok(approx(r.overlap, 1), `overlap=${r.overlap}`); // one extra full layer
  assert.ok(approx(r.cote, 0), `cote=${r.cote}`);
});

test('a prediction spanning two equal SSUs trespasses by half its assigned area', () => {
  // Two SSUs, left (id0) cols 0-4, right (id1) cols 5-9, each 10 tall (area 50 each, A^S=100).
  // One prediction covers the whole 10x10. It is assigned to id0 (tie -> lowest index),
  // and trespasses onto id1's 50 cells. T = 50 / 100 = 0.5. Coverage = 1.
  const r = computeCoteGrid({
    width: 10, height: 10,
    ssus: [
      { id: 0, rects: [{ x: 0, y: 0, w: 5, h: 10 }] },
      { id: 1, rects: [{ x: 5, y: 0, w: 5, h: 10 }] },
    ],
    predictions: [{ x: 0, y: 0, w: 10, h: 10 }],
  });
  assert.ok(approx(r.coverage, 1), `coverage=${r.coverage}`);
  assert.ok(approx(r.trespass, 0.5), `trespass=${r.trespass}`);
  assert.ok(approx(r.overlap, 0), `overlap=${r.overlap}`);
  assert.equal(r.assignments[0], 0, `assignment=${r.assignments[0]}`);
});

test('prediction spilling into blank space produces excess', () => {
  // SSU is left half (area 50). Negative space is right half (area 50).
  // Prediction covers whole page => excess = 50/50 = 1, coverage = 1.
  const r = computeCoteGrid({
    width: 10, height: 10,
    ssus: baseSsus,
    predictions: [{ x: 0, y: 0, w: 10, h: 10 }],
  });
  assert.ok(approx(r.coverage, 1), `coverage=${r.coverage}`);
  assert.ok(approx(r.excess, 1), `excess=${r.excess}`);
});

test('prediction touching no SSU is unassigned and only adds excess', () => {
  const r = computeCoteGrid({
    width: 10, height: 10,
    ssus: baseSsus,
    predictions: [{ x: 6, y: 0, w: 3, h: 10 }], // entirely in blank right half
  });
  assert.ok(approx(r.coverage, 0), `coverage=${r.coverage}`);
  assert.equal(r.assignments[0], -1, `assignment=${r.assignments[0]}`);
  assert.ok(r.excess > 0, `excess=${r.excess}`);
});

test('categoryGrid marks coverage, trespass, overlap, and excess cells', () => {
  const r = computeCoteGrid({
    width: 10, height: 10,
    ssus: [
      { id: 0, rects: [{ x: 0, y: 0, w: 5, h: 10 }] },
      { id: 1, rects: [{ x: 5, y: 0, w: 5, h: 10 }] },
    ],
    predictions: [
      { x: 0, y: 0, w: 10, h: 5 },  // top: assigned id0, trespasses id1 (top-right)
      { x: 0, y: 0, w: 3, h: 5 },   // overlaps the first prediction in top-left
    ],
  });
  const at = (x, y) => r.categoryGrid[y * 10 + x];
  assert.equal(at(1, 1), 2, 'top-left overlapping cell should be overlap (2)');
  assert.equal(at(7, 1), 3, 'top-right cell trespassed by id0 pred should be trespass (3)');
  assert.equal(at(4, 4), 1, 'bottom-left covered-once cell should be coverage (1)');
});
