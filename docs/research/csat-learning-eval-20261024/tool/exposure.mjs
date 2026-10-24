// docs/research/csat-learning-eval-20261024/tool/exposure.mjs
// 노출 지도(exposure map) 적용: P6 유사 이벤트 행 → X 수준, 시도 전 노출 → 독립 판정 자격.
// 규칙: 일치하는 규칙 중 precedence 가 가장 높은 것들 → 그 안에서 가장 높은 X(max wins). 일치 없음 → 기본값(X_UNKNOWN).

import { EXPOSURE_LEVELS, exposureIndex } from './schema.mjs';

/** 지도 형식: {default?, rules:[{id, match:{field: 값|[값들]}, level, precedence?}]} — rules 배열만 줘도 된다. */
// E5 형식({when, exposure} + 지도 전역 precedence 목록 [높은 것 먼저])도 받는다.
// 전역 목록이 있으면 규칙 우선순위 = 그 목록에서의 순위(X_UNKNOWN 이 X1·X0 보다 앞이면 보수적으로 이긴다).
export function normalizeMap(map) {
  const rules = Array.isArray(map) ? map : Array.isArray(map && map.rules) ? map.rules : [];
  const def = map && EXPOSURE_LEVELS.includes(map.default) ? map.default : 'X_UNKNOWN';
  const order = map && Array.isArray(map.precedence) ? map.precedence.filter((l) => EXPOSURE_LEVELS.includes(l)) : null;
  const out = rules
    .map((r) => (r && typeof r === 'object' ? { ...r, match: r.match || r.when, level: r.level || r.exposure } : null))
    .filter((r) => r && r.match && typeof r.match === 'object' && EXPOSURE_LEVELS.includes(r.level))
    .map((r, i) => ({
      id: typeof r.id === 'string' ? r.id : `rule-${i}`,
      match: r.match,
      level: r.level,
      precedence: Number.isFinite(r.precedence) ? r.precedence : order && order.includes(r.level) ? order.length - order.indexOf(r.level) : 0,
    }));
  if (rules.length > 0 && out.length === 0) throw new Error('노출 지도: 규칙이 있으나 하나도 해석하지 못함(형식 불일치) — 조용히 X_UNKNOWN 으로 두지 않는다');
  return { default: def, rules: out };
}

// 'a.b' 경로는 중첩 객체를 따라가고, 없으면 평평한 키 'a.b' 를 본다.
function readField(event, key) {
  if (!event) return undefined;
  if (Object.prototype.hasOwnProperty.call(event, key)) return event[key];
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), event);
}

function fieldMatches(actual, expected) {
  if (Array.isArray(expected)) return expected.some((e) => fieldMatches(actual, e));
  if (expected === null) return actual === null || actual === undefined;
  if (expected === 'not null') return actual !== null && actual !== undefined;
  return actual === expected;
}

/** X_UNKNOWN 은 어떤 알려진 수준보다 '크다'고 보지 않는다. 같은 우선순위에 알려진 수준이 있으면 그중 max. */
function maxLevel(levels) {
  const knownLv = levels.filter((l) => exposureIndex(l) !== null);
  if (knownLv.length === 0) return levels.length ? 'X_UNKNOWN' : null;
  return knownLv.reduce((a, b) => (exposureIndex(b) > exposureIndex(a) ? b : a));
}

export function classifyEvent(event, map) {
  const m = normalizeMap(map);
  const hits = m.rules.filter((r) => Object.entries(r.match).every(([k, v]) => fieldMatches(readField(event, k), v)));
  if (hits.length === 0) return { level: m.default, rule_ids: [], reason: 'no_rule_matched' };
  const top = Math.max(...hits.map((h) => h.precedence));
  const tops = hits.filter((h) => h.precedence === top);
  const level = maxLevel(tops.map((h) => h.level));
  return { level, rule_ids: tops.filter((h) => h.level === level).map((h) => h.id), reason: 'rule' };
}

/** 이벤트가 시도 전인지: event.relative('BEFORE_ATTEMPT'|'AFTER_ATTEMPT') 우선, 다음은 at vs attempt_started_at. 모르면 'UNKNOWN'. */
export function eventTiming(event, attemptStartedAt) {
  if (event && event.relative === 'BEFORE_ATTEMPT') return 'BEFORE';
  if (event && event.relative === 'AFTER_ATTEMPT') return 'AFTER';
  const a = event && typeof event.at === 'string' ? Date.parse(event.at) : NaN;
  const s = typeof attemptStartedAt === 'string' ? Date.parse(attemptStartedAt) : NaN;
  if (Number.isNaN(a) || Number.isNaN(s)) return 'UNKNOWN';
  return a < s ? 'BEFORE' : 'AFTER';
}

/**
 * 기록 하나의 시도 전 노출 요약과 자격.
 * - 확정된 시도 전 X2/X3 → ASSISTED_ONLY
 * - 그 외에 X_UNKNOWN 노출 또는 시점 미상의 X2/X3/X_UNKNOWN, 혹은 노출 기록 자체가 없음 → UNKNOWN
 * - 나머지 → INDEPENDENT_ELIGIBLE
 * 이벤트에 level 이 이미 있고 지도가 없으면 그 level 을 쓴다.
 */
export function recordExposure(record, map) {
  const events = record.exposure_events;
  if (!Array.isArray(events)) {
    return { pre_attempt_max: 'X_UNKNOWN', eligibility: 'UNKNOWN', reason: 'no_exposure_log', events: [] };
  }
  const classified = events.map((e) => {
    const c = map ? classifyEvent(e, map) : { level: EXPOSURE_LEVELS.includes(e.level) ? e.level : 'X_UNKNOWN', rule_ids: [], reason: 'event_level' };
    return { event: e, level: c.level, rule_ids: c.rule_ids, timing: eventTiming(e, record.attempt_started_at) };
  });
  const before = classified.filter((c) => c.timing === 'BEFORE');
  const unsure = classified.filter((c) => c.timing === 'UNKNOWN' && (c.level === 'X_UNKNOWN' || exposureIndex(c.level) >= 2));
  const preLevels = before.map((c) => c.level);
  const preMaxKnown = maxLevel(preLevels.filter((l) => l !== 'X_UNKNOWN'));
  const hasUnknown = preLevels.includes('X_UNKNOWN') || unsure.length > 0;
  let eligibility;
  let reason;
  if (preMaxKnown && exposureIndex(preMaxKnown) >= 2) { eligibility = 'ASSISTED_ONLY'; reason = `pre_attempt_${preMaxKnown}`; }
  else if (hasUnknown) { eligibility = 'UNKNOWN'; reason = unsure.length ? 'timing_or_level_unknown' : 'pre_attempt_X_UNKNOWN'; }
  else { eligibility = 'INDEPENDENT_ELIGIBLE'; reason = 'no_decisive_pre_attempt_exposure'; }
  const preMax = eligibility === 'UNKNOWN' && !(preMaxKnown && exposureIndex(preMaxKnown) >= 2) ? 'X_UNKNOWN' : (preMaxKnown || 'X0');
  return { pre_attempt_max: preMax, eligibility, reason, events: classified };
}

export function applyMapToRows(rows, map) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, exposure: classifyEvent(row, map) }));
}
