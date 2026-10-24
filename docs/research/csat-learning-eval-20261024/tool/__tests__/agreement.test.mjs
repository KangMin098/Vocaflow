// docs/research/csat-learning-eval-20261024/tool/__tests__/agreement.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { percentAgreement, cohenKappa, quadraticWeightedKappa, krippendorffAlpha, bootstrapCI, mulberry32, agreementReport, extractPairs } from '../agreement.mjs';
import { loadRecords } from '../schema.mjs';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const rep = (n, pair) => Array.from({ length: n }, () => pair);

test('Cohen κ 교과서 예: 50건 (20 yes/yes, 5 yes/no, 10 no/yes, 15 no/no) → po .70, pe .50, κ .40', () => {
  const pairs = [...rep(20, ['y', 'y']), ...rep(5, ['y', 'n']), ...rep(10, ['n', 'y']), ...rep(15, ['n', 'n'])];
  const k = cohenKappa(pairs);
  near(k.po, 0.7); near(k.pe, 0.5); near(k.value, 0.4);
  near(percentAgreement(pairs).value, 0.7);
});

test('이차 가중 κ 손계산: [0,1,2] vs [0,2,1], k=3 → 0.5', () => {
  near(quadraticWeightedKappa([[0, 0], [1, 2], [2, 1]], 3).value, 0.5);
  near(quadraticWeightedKappa([[0, 0], [3, 3], [5, 5]]).value, 1);
});

test('Krippendorff(2011) 신뢰도 예제(4 평가자 × 12 단위, 결측 포함)', () => {
  const A = [1, 2, 3, 3, 2, 1, 4, 1, 2, null, null, null];
  const B = [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, null, 3];
  const C = [null, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, null];
  const D = [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, null];
  const units = A.map((_, i) => [A[i], B[i], C[i], D[i]]);
  near(krippendorffAlpha(units, 'nominal').value, 0.743, 0.0015);
  near(krippendorffAlpha(units, 'ordinal').value, 0.815, 0.0015);
  near(krippendorffAlpha(units, 'interval').value, 0.849, 0.0015);
});

test('모두 같은 평정 → κ·가중κ·α 는 null + 사유', () => {
  const pairs = rep(5, [2, 2]);
  const k = cohenKappa(pairs);
  assert.equal(k.value, null);
  assert.match(k.reason, /expected_agreement_is_1/);
  assert.equal(quadraticWeightedKappa(pairs).value, null);
  assert.equal(krippendorffAlpha(pairs, 'ordinal').value, null);
  near(percentAgreement(pairs).value, 1);
});

test('빈 입력 → null + 사유', () => {
  assert.deepEqual(cohenKappa([]), { value: null, reason: 'no_pairs' });
  assert.equal(percentAgreement([]).value, null);
  assert.equal(krippendorffAlpha([], 'ordinal').reason, 'no_pairable_units');
  assert.equal(bootstrapCI([], cohenKappa).reason, 'no_units');
});

test('부트스트랩: 같은 시드는 같은 CI, PRNG 범위 [0,1)', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 100; i += 1) { const x = r(); assert.ok(x >= 0 && x < 1); }
  const pairs = [[0, 0], [1, 1], [2, 1], [3, 3], [4, 4], [2, 2], [1, 0], [5, 5]];
  const a = bootstrapCI(pairs, quadraticWeightedKappa, { iterations: 300, seed: 42 });
  const b = bootstrapCI(pairs, quadraticWeightedKappa, { iterations: 300, seed: 42 });
  assert.deepEqual(a, b);
  assert.ok(a.lower <= a.upper);
  const allSame = bootstrapCI(rep(4, [1, 1]), cohenKappa, { iterations: 20, seed: 3 });
  assert.equal(allSame.reason, 'all_resamples_undefined');
  assert.equal(allSame.undefined_resamples, 20);
});

test('합성 데이터: UNKNOWN/NOT_EVALUATED 쌍 제외·제외 수 보고', () => {
  const recs = loadRecords(JSON.parse(readFileSync(new URL('./fixtures/synthetic-dataset.json', import.meta.url), 'utf8')));
  const { pairs, excluded } = extractPairs(recs);
  assert.equal(pairs.length, 28);
  assert.equal(excluded.special_level, 2);
  assert.deepEqual(excluded.by_level, { UNKNOWN: 1, NOT_EVALUATED: 1 });
  const rep2 = agreementReport(recs, { iterations: 100, seed: 1 });
  assert.ok(rep2.cohen_kappa.value > 0 && rep2.cohen_kappa.value < 1);
  assert.ok(rep2.quadratic_weighted_kappa.value >= rep2.cohen_kappa.value);
  assert.match(rep2.note, /타당도가 아니다/);
});

test('평가자 판정이 빠진 기록은 missing_judgment 로 제외', () => {
  const recs = loadRecords([
    { record_id: 'a', rater_judgments: [{ rater_id: 'x', level: 'U1' }] },
    { record_id: 'b', rater_judgments: [{ rater_id: 'x', level: 'U1' }, { rater_id: 'y', level: 'U2' }] },
  ]);
  const { pairs, excluded } = extractPairs(recs);
  assert.equal(pairs.length, 1);
  assert.equal(excluded.missing_judgment, 1);
});
