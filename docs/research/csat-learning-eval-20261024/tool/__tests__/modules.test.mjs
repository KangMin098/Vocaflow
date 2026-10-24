// docs/research/csat-learning-eval-20261024/tool/__tests__/modules.test.mjs
// schema · score · exposure · disagreements · review · compare · checks · cli 회귀. 데이터는 전부 SYNTHETIC.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateDataset, validateRecord, loadRecords } from '../schema.mjs';
import { suggestLevel, normalizeRubric } from '../score.mjs';
import { normalizeMap, classifyEvent, recordExposure } from '../exposure.mjs';
import { listDisagreements } from '../disagreements.mjs';
import { renderReviewHtml, escapeHtml, safeJson } from '../review.mjs';
import { compare, SYNTHETIC_BANNER } from '../compare.mjs';
import { runChecks } from '../checks.mjs';
import { run } from '../cli.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const DATA = join(here, 'fixtures', 'synthetic-dataset.json');
const FIX_MAP = join(here, 'fixtures', 'exposure-map.fixture.json');
const REAL_RUBRIC = join(root, 'rubric', 'levels.json');
const REAL_MAP = join(root, 'rubric', 'p6-exposure-map.json');

const base = (over = {}) => ({
  record_id: 'r1', learner_pseudo_id: 'syn-L99', item_id: 'item-A', item_version: 'v1', analysis_version: 'a1',
  phase: 'POST_INDEPENDENT', path: 'FREE', task_format: 'mcq_with_evidence', attempt_started_at: '2026-10-10T09:00:00Z',
  response: { selected_option: '1', evidence_span_ids: ['S1'], failure_codes: [], condition_toggles: {} },
  exposure_events: [], rater_judgments: [], data_origin: 'SYNTHETIC', ...over,
});

test('schema: 합성 데이터셋 통과, 이메일·전화번호·숫자 수준 거부', () => {
  assert.equal(validateDataset(readJson(DATA)).ok, true);
  assert.equal(validateRecord(base({ learner_pseudo_id: 'kim@example.com' })).ok, false);
  assert.equal(validateRecord(base({ note: '010-1234-5678' })).ok, false);
  assert.equal(validateRecord(base({ rater_judgments: [{ rater_id: 'h', rater_kind: 'human', level: 3 }] })).ok, false);
  assert.equal(validateDataset([]).ok, false);
});

test('schema: 누락 필드는 UNKNOWN 경고로 남고 기본값으로 채우지 않는다', () => {
  const r = { ...base() };
  delete r.exposure_events;
  delete r.data_origin;
  const v = validateRecord(r);
  assert.equal(v.ok, true);
  assert.ok(v.warnings.some((w) => w.includes('exposure_events')));
  assert.ok(v.warnings.some((w) => w.includes('data_origin')));
});

test('score(실제 E1 루브릭): all_of 를 다 채우지 못하면 그 수준을 주지 않는다', () => {
  const rubric = readJson(REAL_RUBRIC);
  const rec = loadRecords([base()])[0];
  const one = suggestLevel(['EV-U2-a'], { record: rec, rubric });
  assert.notEqual(one.level, 'U2');
  const both = suggestLevel(['EV-U2-a', 'EV-U2-b'], { record: rec, rubric });
  assert.equal(both.level, 'U2');
  assert.equal(both.status, 'SUGGESTION');
  assert.ok(normalizeRubric(rubric).levels.U2.sets);
});

test('score: 탐색만 있으면 U0 상한, U5 는 TRANSFER·미학습·검증 플래그가 모두 있어야', () => {
  const rubric = { levels: [{ id: 'U5', min_evidence: 1, evidence_codes: [{ code: 'EV-U5-a' }] }] };
  const rec = loadRecords([base()])[0];
  assert.equal(suggestLevel(['EV-NAV-click'], { record: rec, rubric }).level, 'U0');
  const capped = suggestLevel(['EV-U5-a'], { record: rec, rubric });
  assert.equal(capped.level, 'U4');
  const ok = loadRecords([base({ phase: 'TRANSFER', item_id: 'item-B', studied_item_ids: ['item-A'], transfer_eligibility_verified: true })])[0];
  assert.equal(suggestLevel(['EV-U5-a'], { record: ok, rubric }).level, 'U5');
});

test('exposure: 시도 전 X3 → ASSISTED_ONLY, 노출 기록 없음 → UNKNOWN', () => {
  const map = readJson(FIX_MAP);
  const assisted = loadRecords([base({ exposure_events: [{ event_type: 'answer_revealed', at: '2026-10-10T08:00:00Z' }] })])[0];
  assert.equal(recordExposure(assisted, map).eligibility, 'ASSISTED_ONLY');
  const r = base();
  delete r.exposure_events;
  assert.equal(recordExposure(loadRecords([r])[0], map).eligibility, 'UNKNOWN');
});

test('exposure(실제 E5 지도): 12개 규칙을 모두 읽고 P6 필드를 판정한다', () => {
  const map = readJson(REAL_MAP);
  assert.equal(normalizeMap(map).rules.length, map.rules.length);
  const ok = { attempt: { exposure_order_at: '2026-10-10T09:00:00Z', item_ref: 'item-A' } };
  assert.equal(classifyEvent({ ...ok, exposure: { kind: 'answer_direct' } }, map).level, 'X3');
  assert.equal(classifyEvent({ ...ok, exposure: { kind: 'decisive_hint' } }, map).level, 'X2');
  assert.equal(classifyEvent({ ...ok, first_attempt: { help_level: 'hint' } }, map).level, 'X1');
  assert.equal(classifyEvent({ ...ok, first_attempt: { help_level: 'independent' }, ledger_rows_in_window: 0 }, map).level, 'X0');
  // 순서 시각 없음(legacy) → X0 조건을 갖춰도 X_UNKNOWN 이 이긴다
  assert.equal(classifyEvent({ attempt: { exposure_order_at: null, item_ref: 'item-A' }, first_attempt: { help_level: 'independent' }, ledger_rows_in_window: 0 }, map).level, 'X_UNKNOWN');
  // 결정적 단서 + 정답 직접 노출이 같이 있으면 X3
  assert.throws(() => normalizeMap({ rules: [{ id: 'bad', foo: 1 }] }));
});

test('disagreements: 수준 차이·자격 불일치를 사례로 뽑는다', () => {
  const recs = loadRecords(readJson(DATA));
  const d = listDisagreements(recs, { exposureMap: readJson(FIX_MAP) });
  assert.equal(d.n_records, 30);
  assert.ok(d.n_cases > 0);
  assert.ok(d.cases.every((c) => c.reasons.length > 0));
});

test('review: 사용자 값은 이스케이프되고 </script> 탈출이 막힌다', () => {
  assert.equal(escapeHtml('<b>"x"&\'</b>'), '&lt;b&gt;&quot;x&quot;&amp;&#39;&lt;/b&gt;');
  assert.ok(!safeJson({ a: '</script><script>alert(1)</script>' }).includes('</script>'));
  const evil = base({ record_id: 'r-evil', rater_judgments: [
    { rater_id: 'h', rater_kind: 'human', level: 'U0', evidence_codes: [], note: '<img src=x onerror=alert(1)>' },
    { rater_id: 'a', rater_kind: 'ai', level: 'U3', evidence_codes: [], note: 'x' },
  ] });
  const html = renderReviewHtml(listDisagreements(loadRecords([evil])), { generatedAt: '2026-10-24T00:00:00Z' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes(':focus'));
});

test('compare: SYNTHETIC 배너, REAL 없으면 NOT_EVALUATED, 독립 아닌 기록은 제외 집계', () => {
  const c = compare(loadRecords(readJson(DATA)), { exposureMap: readJson(FIX_MAP) });
  assert.equal(c.banner, SYNTHETIC_BANNER);
  assert.equal(c.effect_status, 'NOT_EVALUATED');
  assert.ok(c.excluded.not_independent.ASSISTED_ONLY + c.excluded.not_independent.UNKNOWN > 0);
  for (const l of c.per_learner) for (const v of Object.values(l.levels)) assert.ok(typeof v === 'string');
});

test('compare: REAL 만 있어도 결측은 UNKNOWN 으로 남는다(대체 없음)', () => {
  const recs = loadRecords([
    base({ record_id: 'p', phase: 'PRE', data_origin: 'REAL', rater_judgments: [{ rater_id: 'h', rater_kind: 'human', level: 'U1', evidence_codes: [] }] }),
  ]);
  const c = compare(recs, { independentOnly: false });
  assert.notEqual(c.banner, SYNTHETIC_BANNER);
  const lv = c.per_learner[0].levels;
  assert.ok(lv.POST_INDEPENDENT === undefined || lv.POST_INDEPENDENT === 'UNKNOWN');
});

test('checks: 결측·버전·근거 추적 보고', () => {
  const c = runChecks(loadRecords(readJson(DATA)), { exposureMap: readJson(FIX_MAP) });
  assert.equal(c.missingness.n_records, 30);
  assert.equal(c.missingness.exposure_log_missing, 1);
  assert.ok('exposure_coverage' in c);
});

test('cli: 7개 명령이 실제 루브릭·지도와 함께 돈다', () => {
  for (const cmd of ['validate', 'agree', 'disagree', 'compare', 'check']) {
    assert.equal(run([cmd, '--in', DATA, '--map', REAL_MAP]).code, 0, cmd);
  }
  const s = JSON.parse(run(['score', '--in', DATA, '--rubric', REAL_RUBRIC, '--map', REAL_MAP]).output);
  assert.equal(s.status, 'SUGGESTION');
  assert.ok(run(['review-html', '--in', DATA, '--generated-at', '2026-10-24T00:00:00Z']).output.startsWith('<!doctype html>'));
  assert.throws(() => run(['bogus', '--in', DATA]));
});
