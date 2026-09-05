// Pure CEV computation over character-count vectors. No DOM, no side effects.
// Vectors are plain arrays of counts indexed against ALPHABET. The last bucket
// is a "noise" symbol that OCR introduces from page degradation (e.g. "$").
//
// The four vectors mirror the paper (Table 2):
//   Q  — ground-truth characters            (no error)
//   R  — predicted parsing on GT characters  (parsing error only)
//   S* — OCR on the GT regions               (OCR error only)
//   S  — OCR on the predicted regions        (combined)
// and the decomposition (Table 1):
//   d_pars = d(R‖Q)   d_ocr = d(S*‖Q)   d_int = d(S‖R)   d_total = d(S‖Q)

export const ALPHABET = ['e', 't', 'a', 'o', 'i', 'n', 's', 'h', 'r', 'l', ' ', '·'];

// Ground-truth counts (English-ish over ~1000 chars). The noise bucket is 0.
export const Q_BASE = [120, 92, 81, 77, 73, 67, 63, 61, 60, 40, 166, 0];

const sum = (v) => v.reduce((a, b) => a + b, 0);

// SpACER between an observed count vector `p` and reference (ground truth) `g`.
//   SpACER = (D + Ê) / 2C,  Ê = ‖g − p‖₁,  D = max(0, |g| − |p|),  C = |g|
// Symmetric to insertions/deletions; can exceed 1, like CER.
export function spacer(g, p) {
  const C = sum(g);
  if (C === 0) return 0;
  let eHat = 0;
  for (let i = 0; i < g.length; i++) eHat += Math.abs(g[i] - p[i]);
  const D = Math.max(0, sum(g) - sum(p));
  return (D + eHat) / (2 * C);
}

// Jensen–Shannon distance (Shannon entropy in bits, sqrt of the divergence).
// A proper metric, bounded in [0, 1]; weights rare characters heavily.
export function jsd(a, b) {
  const sa = sum(a), sb = sum(b);
  if (sa === 0 || sb === 0) return 0;
  const ent = (p) => (p > 0 ? -p * Math.log2(p) : 0);
  let hM = 0, hA = 0, hB = 0;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i] / sa, pb = b[i] / sb, m = (pa + pb) / 2;
    hM += ent(m); hA += ent(pa); hB += ent(pb);
  }
  return Math.sqrt(Math.max(0, hM - 0.5 * (hA + hB)));
}

// Parsing corrupts COUNTS: some regions are missed (mass deleted), some overlap
// (mass duplicated). Deletions are made to dominate slightly, as in real parses.
export function applyParsing(Q, pErr) {
  return Q.map((q, i) => {
    const dir = i % 3 === 1 ? +1 : -1; // ~⅓ duplicated, ~⅔ thinned
    return Math.max(0, q * (1 + dir * 0.9 * pErr));
  });
}

// OCR corrupts IDENTITIES: mass moves off correct characters onto a confusable
// neighbour and into the noise bucket — changing the distribution's shape.
export function applyOCR(base, oErr) {
  const S = base.slice();
  const noise = S.length - 1;
  let toNoise = 0;
  for (let i = 0; i < S.length - 1; i++) {
    const off = base[i] * 0.6 * oErr;
    S[i] = Math.max(0, base[i] - off);
    S[(i + 1) % (S.length - 1)] += off * 0.5; // confusable substitution
    toNoise += off * 0.5;
  }
  S[noise] += toNoise;
  return S;
}

// Full decomposition for given parsing/OCR severities in [0, 1].
export function decompose(pErr, oErr) {
  const Q = Q_BASE;
  const R = applyParsing(Q, pErr);
  const Sstar = applyOCR(Q, oErr);
  const S = applyOCR(R, oErr);
  return {
    Q, R, Sstar, S,
    spacer: { pars: spacer(Q, R), ocr: spacer(Q, Sstar), int: spacer(R, S), total: spacer(Q, S) },
    jsd: { pars: jsd(R, Q), ocr: jsd(Sstar, Q), int: jsd(S, R), total: jsd(S, Q) },
  };
}

// --- String-level helpers for the "CER breaks" widget ---

// Character Error Rate via Levenshtein distance, normalised by |ref|.
export function cer(ref, hyp) {
  const m = ref.length, n = hyp.length;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = ref[i - 1] === hyp[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n] / Math.max(1, m);
}

function charCounts(s) {
  const m = new Map();
  for (const ch of s) m.set(ch, (m.get(ch) || 0) + 1);
  return m;
}

// Bag-of-characters SpACER over two strings (order-independent).
export function spacerStr(ref, hyp) {
  const g = charCounts(ref), p = charCounts(hyp);
  const keys = new Set([...g.keys(), ...p.keys()]);
  let eHat = 0, sp = 0;
  for (const k of keys) {
    const a = g.get(k) || 0, b = p.get(k) || 0;
    eHat += Math.abs(a - b);
    sp += b;
  }
  const C = ref.length;
  const D = Math.max(0, C - sp);
  return (D + eHat) / (2 * Math.max(1, C));
}
