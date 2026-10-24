// docs/research/csat-learning-eval-20261024/tool/disagreements.mjs
// 불일치 사례 목록: 수준 차 ≥ threshold(기본 1), 순서 수준과 특수 수준(UNKNOWN/NOT_EVALUATED)의 엇갈림, 자격 불일치.

import { levelIndex } from './schema.mjs';
import { recordExposure } from './exposure.mjs';
import { evidenceTrace } from './checks.mjs';

export function listDisagreements(records, { threshold = 1, exposureMap = null } = {}) {
  const cases = [];
  for (const r of records) {
    const js = r.rater_judgments;
    if (js.length < 2) continue;
    const reasons = [];
    for (let p = 0; p < js.length; p += 1) for (let q = p + 1; q < js.length; q += 1) {
      const a = levelIndex(js[p].level);
      const b = levelIndex(js[q].level);
      if (a !== null && b !== null && Math.abs(a - b) >= threshold) reasons.push({ kind: 'level_diff', raters: [js[p].rater_id, js[q].rater_id], diff: Math.abs(a - b) });
      else if ((a === null) !== (b === null) || (a === null && b === null && js[p].level !== js[q].level)) reasons.push({ kind: 'level_status_mismatch', raters: [js[p].rater_id, js[q].rater_id], levels: [js[p].level, js[q].level] });
      if (js[p].eligibility && js[q].eligibility && js[p].eligibility !== js[q].eligibility) reasons.push({ kind: 'eligibility_mismatch', raters: [js[p].rater_id, js[q].rater_id], eligibility: [js[p].eligibility, js[q].eligibility] });
    }
    if (reasons.length === 0) continue;
    const exp = recordExposure(r, exposureMap);
    cases.push({
      record_id: r.record_id,
      learner_pseudo_id: r.learner_pseudo_id,
      item_id: r.item_id,
      item_version: r.item_version,
      phase: r.phase,
      path: r.path,
      task_format: r.task_format,
      data_origin: r.data_origin,
      reasons,
      response: r.response,
      exposure: { pre_attempt_max: exp.pre_attempt_max, eligibility: exp.eligibility, reason: exp.reason, events: exp.events.map((e) => ({ ...e.event, mapped_level: e.level, timing: e.timing })) },
      judgments: js.map((j) => ({ rater_id: j.rater_id, rater_kind: j.rater_kind, level: j.level, eligibility: j.eligibility, note: j.note, evidence_trace: evidenceTrace(r, j) })),
    });
  }
  return { n_records: records.length, n_cases: cases.length, cases };
}
