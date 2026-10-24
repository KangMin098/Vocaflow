// docs/research/csat-learning-eval-20261024/tool/agreement.mjs
// 평가자 간 일치도: 백분율 일치, Cohen κ, 이차 가중 κ(U0~U5 순서), Krippendorff α(결측 허용), 시드 부트스트랩 CI.
// UNKNOWN·NOT_EVALUATED 는 숫자로 바꾸지 않고 쌍에서 제외하며 제외 수를 보고한다.

import { LEVELS, levelIndex } from './schema.mjs';

/** 결정적 PRNG(mulberry32). 시드를 주입한다. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const undef = (reason) => ({ value: null, reason });

export function percentAgreement(pairs) {
  if (pairs.length === 0) return undef('no_pairs');
  return { value: pairs.filter(([a, b]) => a === b).length / pairs.length, reason: null };
}

/** pairs: [[a,b],...] 범주 값(같음 비교). */
export function cohenKappa(pairs) {
  const n = pairs.length;
  if (n === 0) return undef('no_pairs');
  const ca = new Map();
  const cb = new Map();
  let agree = 0;
  for (const [a, b] of pairs) {
    ca.set(a, (ca.get(a) || 0) + 1);
    cb.set(b, (cb.get(b) || 0) + 1);
    if (a === b) agree += 1;
  }
  const po = agree / n;
  let pe = 0;
  for (const [c, x] of ca) pe += (x / n) * ((cb.get(c) || 0) / n);
  if (Math.abs(1 - pe) < 1e-12) return { ...undef('expected_agreement_is_1_(all_ratings_in_one_category)'), po, pe };
  return { value: (po - pe) / (1 - pe), reason: null, po, pe };
}

/** pairs: [[i,j],...] 0..k-1 정수. 이차 가중 κ. */
export function quadraticWeightedKappa(pairs, k = LEVELS.length) {
  const n = pairs.length;
  if (n === 0) return undef('no_pairs');
  const ra = new Array(k).fill(0);
  const rb = new Array(k).fill(0);
  let obs = 0;
  const w = (i, j) => ((i - j) ** 2) / ((k - 1) ** 2);
  for (const [i, j] of pairs) { ra[i] += 1; rb[j] += 1; obs += w(i, j); }
  obs /= n;
  let exp = 0;
  for (let i = 0; i < k; i += 1) for (let j = 0; j < k; j += 1) exp += (ra[i] / n) * (rb[j] / n) * w(i, j);
  if (exp < 1e-12) return undef('expected_weighted_disagreement_is_0_(no_variation)');
  return { value: 1 - obs / exp, reason: null };
}

/**
 * Krippendorff α. units: [[v|null, ...], ...] (단위 × 평가자). metric: nominal | ordinal | interval.
 * 서수는 값의 크기순으로 범주를 정렬한다(Krippendorff 2011, ordinal δ²).
 */
export function krippendorffAlpha(units, metric = 'ordinal') {
  const pairable = units.map((u) => u.filter((v) => v !== null && v !== undefined)).filter((u) => u.length >= 2);
  const cats = [...new Set(pairable.flat())].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  if (pairable.length === 0) return undef('no_pairable_units');
  const idx = new Map(cats.map((c, i) => [c, i]));
  const K = cats.length;
  const o = Array.from({ length: K }, () => new Array(K).fill(0));
  for (const u of pairable) {
    const m = u.length;
    for (let p = 0; p < m; p += 1) for (let q = 0; q < m; q += 1) {
      if (p !== q) o[idx.get(u[p])][idx.get(u[q])] += 1 / (m - 1);
    }
  }
  const nc = o.map((row) => row.reduce((s, x) => s + x, 0));
  const n = nc.reduce((s, x) => s + x, 0);
  const delta = (c, k) => {
    if (metric === 'nominal') return c === k ? 0 : 1;
    if (metric === 'interval') return (cats[c] - cats[k]) ** 2;
    const lo = Math.min(c, k);
    const hi = Math.max(c, k);
    let s = 0;
    for (let g = lo; g <= hi; g += 1) s += nc[g];
    return (s - (nc[c] + nc[k]) / 2) ** 2;
  };
  let num = 0;
  let den = 0;
  for (let c = 0; c < K; c += 1) for (let k = 0; k < K; k += 1) {
    const d = delta(c, k);
    num += o[c][k] * d;
    den += nc[c] * nc[k] * d;
  }
  if (den < 1e-12) return undef('no_variation_expected_disagreement_0');
  return { value: 1 - ((n - 1) * num) / den, reason: null, pairable_values: n };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** 단위 재표집 부트스트랩. statFn(units) → {value}. 정의되지 않은 재표본은 세고 버린다. */
export function bootstrapCI(units, statFn, { iterations = 1000, seed = 1, alpha = 0.05 } = {}) {
  if (units.length === 0) return { lower: null, upper: null, iterations, seed, undefined_resamples: 0, reason: 'no_units' };
  const rand = mulberry32(seed);
  const vals = [];
  let undefinedCount = 0;
  for (let it = 0; it < iterations; it += 1) {
    const sample = [];
    for (let i = 0; i < units.length; i += 1) sample.push(units[Math.floor(rand() * units.length)]);
    const r = statFn(sample);
    if (r.value === null || !Number.isFinite(r.value)) undefinedCount += 1;
    else vals.push(r.value);
  }
  vals.sort((a, b) => a - b);
  if (vals.length === 0) return { lower: null, upper: null, iterations, seed, undefined_resamples: undefinedCount, reason: 'all_resamples_undefined' };
  return { lower: percentile(vals, alpha / 2), upper: percentile(vals, 1 - alpha / 2), iterations, seed, undefined_resamples: undefinedCount, reason: null };
}

function raterIds(records) {
  const ids = [];
  for (const r of records) for (const j of r.rater_judgments) if (!ids.includes(j.rater_id)) ids.push(j.rater_id);
  return ids;
}

/** 정규화된 기록에서 두 평가자 쌍을 뽑는다. */
export function extractPairs(records, { raterA, raterB } = {}) {
  const ids = raterIds(records);
  const A = raterA || ids[0];
  const B = raterB || ids.find((x) => x !== A);
  const pairs = [];
  const excluded = { total: 0, missing_judgment: 0, special_level: 0, by_level: {} };
  for (const r of records) {
    const ja = r.rater_judgments.find((j) => j.rater_id === A);
    const jb = r.rater_judgments.find((j) => j.rater_id === B);
    if (!ja || !jb) { excluded.total += 1; excluded.missing_judgment += 1; continue; }
    const ia = levelIndex(ja.level);
    const ib = levelIndex(jb.level);
    if (ia === null || ib === null) {
      excluded.total += 1;
      excluded.special_level += 1;
      for (const l of [ja.level, jb.level]) if (levelIndex(l) === null) excluded.by_level[l] = (excluded.by_level[l] || 0) + 1;
      continue;
    }
    pairs.push({ record_id: r.record_id, a: ia, b: ib });
  }
  return { rater_a: A || null, rater_b: B || null, pairs, excluded };
}

export function agreementReport(records, { raterA, raterB, iterations = 1000, seed = 20261024 } = {}) {
  const { rater_a, rater_b, pairs, excluded } = extractPairs(records, { raterA, raterB });
  const P = pairs.map((p) => [p.a, p.b]);
  const kUnits = P.map(([a, b]) => [a, b]);
  const ids = raterIds(records);
  const allUnits = records.map((r) => ids.map((id) => {
    const j = r.rater_judgments.find((x) => x.rater_id === id);
    return j ? levelIndex(j.level) : null;
  }));
  const bs = (fn) => bootstrapCI(P, fn, { iterations, seed });
  const pctFn = (s) => percentAgreement(s);
  const kFn = (s) => cohenKappa(s);
  const qFn = (s) => quadraticWeightedKappa(s);
  const aFn = (s) => krippendorffAlpha(s, 'ordinal');
  return {
    rater_a,
    rater_b,
    n_pairs: P.length,
    excluded,
    percent_agreement: { ...pctFn(P), ci95: bs(pctFn) },
    cohen_kappa: { ...kFn(P), ci95: bs(kFn) },
    quadratic_weighted_kappa: { ...qFn(P), ci95: bs(qFn) },
    krippendorff_alpha_ordinal_pair: { ...aFn(kUnits), ci95: bootstrapCI(kUnits, aFn, { iterations, seed }) },
    krippendorff_alpha_ordinal_all_raters: { ...krippendorffAlpha(allUnits, 'ordinal'), raters: ids, units: allUnits.length },
    note: '일치도는 신뢰도이지 타당도가 아니다. AI 평가자와의 일치는 학습 효과·판정 정확성의 근거가 아니다.',
  };
}
