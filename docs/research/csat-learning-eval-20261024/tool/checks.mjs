// docs/research/csat-learning-eval-20261024/tool/checks.mjs
// 데이터 점검: 결측 보고, 노출 수준 분포, 버전 일관성, 근거 추적성.

import { recordExposure } from './exposure.mjs';
import { levelIndex } from './schema.mjs';

/** 근거 ref 가 응답 요소를 가리키는지. 'span:ID' | 'failure:CODE' | 'option:X' | 'toggle:KEY' */
export function resolveRef(ref, response) {
  if (typeof ref !== 'string') return { ok: false, reason: 'no_ref' };
  const i = ref.indexOf(':');
  if (i < 0) return { ok: false, reason: 'malformed_ref' };
  const kind = ref.slice(0, i);
  const val = ref.slice(i + 1);
  if (kind === 'span') return response.evidence_span_ids.includes(val) ? { ok: true, element: `evidence_span_ids:${val}` } : { ok: false, reason: 'span_not_in_response' };
  if (kind === 'failure') return response.failure_codes.includes(val) ? { ok: true, element: `failure_codes:${val}` } : { ok: false, reason: 'failure_code_not_in_response' };
  if (kind === 'option') return response.selected_option !== 'UNKNOWN' && response.selected_option === val ? { ok: true, element: `selected_option:${val}` } : { ok: false, reason: 'option_not_selected' };
  if (kind === 'toggle') return Object.prototype.hasOwnProperty.call(response.condition_toggles, val) ? { ok: true, element: `condition_toggles:${val}=${JSON.stringify(response.condition_toggles[val])}` } : { ok: false, reason: 'toggle_not_in_response' };
  return { ok: false, reason: `unknown_ref_kind:${kind}` };
}

export function evidenceTrace(record, judgment) {
  return judgment.evidence_codes.map((e) => ({ code: e.code, ref: e.ref, ...resolveRef(e.ref, record.response) }));
}

export function missingnessReport(records) {
  const fields = ['learner_pseudo_id', 'item_id', 'item_version', 'analysis_version', 'phase', 'path', 'task_format', 'data_origin'];
  const out = { n_records: records.length, fields: {}, response_selected_option_unknown: 0, exposure_log_missing: 0, no_judgments: 0, judgment_levels: { UNKNOWN: 0, NOT_EVALUATED: 0 } };
  for (const f of fields) out.fields[f] = records.filter((r) => r[f] === 'UNKNOWN').length;
  for (const r of records) {
    if (r.response.selected_option === 'UNKNOWN') out.response_selected_option_unknown += 1;
    if (!Array.isArray(r.exposure_events)) out.exposure_log_missing += 1;
    if (r.rater_judgments.length === 0) out.no_judgments += 1;
    for (const j of r.rater_judgments) if (levelIndex(j.level) === null) out.judgment_levels[j.level] = (out.judgment_levels[j.level] || 0) + 1;
  }
  return out;
}

export function exposureCoverage(records, map = null) {
  const byLevel = { X0: 0, X1: 0, X2: 0, X3: 0, X_UNKNOWN: 0 };
  const byEligibility = { INDEPENDENT_ELIGIBLE: 0, ASSISTED_ONLY: 0, UNKNOWN: 0 };
  const byPhase = {};
  let eventsTotal = 0;
  let eventsUnmapped = 0;
  for (const r of records) {
    const e = recordExposure(r, map);
    byLevel[e.pre_attempt_max] += 1;
    byEligibility[e.eligibility] += 1;
    byPhase[r.phase] = byPhase[r.phase] || { INDEPENDENT_ELIGIBLE: 0, ASSISTED_ONLY: 0, UNKNOWN: 0 };
    byPhase[r.phase][e.eligibility] += 1;
    eventsTotal += e.events.length;
    eventsUnmapped += e.events.filter((x) => x.level === 'X_UNKNOWN').length;
  }
  return { pre_attempt_max_by_level: byLevel, eligibility: byEligibility, eligibility_by_phase: byPhase, events_total: eventsTotal, events_X_UNKNOWN: eventsUnmapped };
}

export function versionConsistency(records) {
  const byItem = new Map();
  const flags = [];
  for (const r of records) {
    if (!byItem.has(r.item_id)) byItem.set(r.item_id, { item: new Set(), analysis: new Set() });
    byItem.get(r.item_id).item.add(r.item_version);
    byItem.get(r.item_id).analysis.add(r.analysis_version);
    for (const j of r.rater_judgments) {
      if (j.item_version !== null && j.item_version !== r.item_version) flags.push({ kind: 'rater_item_version_mismatch', record_id: r.record_id, rater_id: j.rater_id, record_version: r.item_version, rater_version: j.item_version });
    }
  }
  for (const [item, v] of byItem) {
    if (v.item.size > 1) flags.push({ kind: 'item_version_varies_across_records', item_id: item, versions: [...v.item].sort() });
    if (v.analysis.size > 1) flags.push({ kind: 'analysis_version_varies_across_records', item_id: item, versions: [...v.analysis].sort() });
  }
  return { ok: flags.length === 0, flags };
}

export function traceability(records) {
  const untraceable = [];
  let total = 0;
  for (const r of records) for (const j of r.rater_judgments) for (const t of evidenceTrace(r, j)) {
    total += 1;
    if (!t.ok) untraceable.push({ record_id: r.record_id, rater_id: j.rater_id, code: t.code, ref: t.ref, reason: t.reason });
  }
  return { ok: untraceable.length === 0, codes_total: total, untraceable };
}

export function runChecks(records, { exposureMap = null } = {}) {
  return {
    missingness: missingnessReport(records),
    exposure_coverage: exposureCoverage(records, exposureMap),
    version_consistency: versionConsistency(records),
    evidence_traceability: traceability(records),
  };
}
