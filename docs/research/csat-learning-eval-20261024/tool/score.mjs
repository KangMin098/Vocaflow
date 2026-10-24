// docs/research/csat-learning-eval-20261024/tool/score.mjs
// 루브릭 보조 수준 제안. 결과는 언제나 SUGGESTION 이며 최종 판정이 아니다.

import { LEVELS, levelIndex, normalizeEvidence } from './schema.mjs';
import { recordExposure } from './exposure.mjs';

const CODE_LEVEL_RE = /^EV-(U[0-5])-/;
const NAV_RE = /^EV-NAV/;

/**
 * 루브릭 정규화. 받아들이는 형태:
 *  {levels:[{level|id:'U2', min_evidence:2|{count:2}, codes|evidence:[ 'EV-U2-a' | {code|id, kind?} ]}], navigation_codes?:[...]}
 *  {levels:{U2:{...}}}
 * 코드가 목록에 없으면 'EV-U<n>-' 접두로 수준을 추정한다. kind:'navigation' 또는 'EV-NAV' 접두는 클릭/탐색 근거.
 */
export function normalizeRubric(rubric) {
  const src = rubric && rubric.levels ? rubric.levels : [];
  const entries = Array.isArray(src) ? src : Object.entries(src).map(([k, v]) => ({ level: k, ...v }));
  const levels = {};
  const codeLevel = {};
  const nav = new Set(Array.isArray(rubric && rubric.navigation_codes) ? rubric.navigation_codes : []);
  for (const e of entries) {
    const lv = e.level || e.id || e.code;
    if (!LEVELS.includes(lv)) continue;
    const me = typeof e.min_evidence === 'number' ? e.min_evidence : e.min_evidence && typeof e.min_evidence.count === 'number' ? e.min_evidence.count : 1;
    // E1 형식 {all_of, any_of}: all_of 전부 + (any_of 가 있으면) 그중 하나 이상. 개수 규칙보다 우선한다.
    const sets = e.min_evidence && (Array.isArray(e.min_evidence.all_of) || Array.isArray(e.min_evidence.any_of))
      ? { all_of: e.min_evidence.all_of || [], any_of: e.min_evidence.any_of || [] }
      : null;
    levels[lv] = { min_evidence: Math.max(1, me), sets };
    const codes = Array.isArray(e.codes) ? e.codes : Array.isArray(e.evidence) ? e.evidence : Array.isArray(e.evidence_codes) ? e.evidence_codes : [];
    for (const c of codes) {
      const code = typeof c === 'string' ? c : c && (c.code || c.id);
      if (typeof code !== 'string') continue;
      codeLevel[code] = lv;
      if (c && typeof c === 'object' && c.kind === 'navigation') nav.add(code);
    }
  }
  return { levels, codeLevel, navigation: nav };
}

export function codeLevelOf(code, rub) {
  if (rub.codeLevel[code]) return rub.codeLevel[code];
  const m = CODE_LEVEL_RE.exec(code);
  return m ? m[1] : null;
}
function isNav(code, rub) { return rub.navigation.has(code) || NAV_RE.test(code); }

/**
 * @param codes  근거 코드 목록(문자열 또는 {code, ref})
 * @param ctx    {record, rubric, exposureMap?, studiedItemIds?}
 */
export function suggestLevel(codes, ctx) {
  const rub = normalizeRubric(ctx.rubric);
  const rec = ctx.record;
  const ev = (codes || []).map(normalizeEvidence);
  const flags = [];
  const distinct = [...new Set(ev.map((e) => e.code))];
  const substantive = distinct.filter((c) => !isNav(c, rub));
  const unknownCodes = distinct.filter((c) => !isNav(c, rub) && !codeLevelOf(c, rub));
  if (unknownCodes.length) flags.push(`unknown_codes:${unknownCodes.join(',')}`);

  const counts = {};
  for (const c of substantive) {
    const lv = codeLevelOf(c, rub);
    if (lv) counts[lv] = (counts[lv] || 0) + 1;
  }
  let level = null;
  for (const lv of LEVELS) {
    const spec = rub.levels[lv];
    if (!spec) continue;
    if (spec.sets) {
      const has = new Set(substantive);
      const allOk = spec.sets.all_of.every((c) => has.has(c));
      const anyOk = spec.sets.any_of.length === 0 || spec.sets.any_of.some((c) => has.has(c));
      if (allOk && anyOk && (spec.sets.all_of.length + spec.sets.any_of.length) > 0) level = lv;
    } else if ((counts[lv] || 0) >= spec.min_evidence) level = lv;
  }
  if (distinct.length > 0 && substantive.length === 0) {
    flags.push('navigation_only_cap_U0');
    level = 'U0';
  }
  if (level === 'U5') {
    const studied = new Set([...(rec.studied_item_ids || []), ...(ctx.studiedItemIds || [])]);
    const okPhase = rec.phase === 'TRANSFER';
    const okItem = rec.item_id !== 'UNKNOWN' && !studied.has(rec.item_id);
    const okFlag = rec.transfer_eligibility_verified === true;
    if (!(okPhase && okItem && okFlag)) {
      flags.push(`u5_capped_to_U4:${[!okPhase && 'phase_not_TRANSFER', !okItem && 'item_is_studied_or_unknown', !okFlag && 'transfer_eligibility_not_verified'].filter(Boolean).join('+')}`);
      level = 'U4';
    }
  }
  const exp = recordExposure(rec, ctx.exposureMap || null);
  const out = {
    status: 'SUGGESTION',
    record_id: rec.record_id,
    level: level || 'NOT_EVALUATED',
    level_reason: level ? 'highest_level_min_evidence_met' : distinct.length ? 'min_evidence_not_met' : 'no_evidence',
    eligibility: exp.eligibility,
    independent: exp.eligibility === 'INDEPENDENT_ELIGIBLE',
    pre_attempt_exposure: exp.pre_attempt_max,
    exposure_reason: exp.reason,
    evidence_counts: counts,
    flags,
  };
  if (exp.eligibility === 'ASSISTED_ONLY') out.flags.push('non_independent_assisted_only');
  if (exp.eligibility === 'UNKNOWN') out.flags.push('eligibility_unknown');
  return out;
}

/** 기록마다 평가자별 제안. */
export function scoreRecords(records, { rubric, exposureMap = null } = {}) {
  return records.map((rec) => ({
    record_id: rec.record_id,
    suggestions: rec.rater_judgments.map((j) => ({ rater_id: j.rater_id, rater_level: j.level, ...suggestLevel(j.evidence_codes, { record: rec, rubric, exposureMap }) })),
  }));
}

export { levelIndex };
