// docs/research/csat-learning-eval-20261024/tool/compare.mjs
// 학습자별 대응 비교: PRE ↔ POST_INDEPENDENT ↔ TRANSFER. 결측은 UNKNOWN 으로 남기고 보고하며 메우지 않는다.
// 기본은 독립 판정 자격(INDEPENDENT_ELIGIBLE) 기록만 쓴다. 이 결과는 기술 통계이며 인과 효과 주장이 아니다.

import { levelIndex, LEVELS } from './schema.mjs';
import { recordExposure } from './exposure.mjs';

export const SYNTHETIC_BANNER = 'SYNTHETIC — 학습 효과 근거 아님';
const COMPARISONS = [['PRE', 'POST_INDEPENDENT'], ['POST_INDEPENDENT', 'TRANSFER'], ['PRE', 'TRANSFER']];

/** 기록 수준: final_level(조정 결과) > 평가자 전원 일치 > UNKNOWN. */
export function recordLevel(r) {
  if (r.final_level) return { level: r.final_level, source: 'final_level' };
  const ls = r.rater_judgments.map((j) => j.level);
  if (ls.length === 0) return { level: 'UNKNOWN', source: 'no_judgment' };
  if (ls.some((l) => levelIndex(l) === null)) return { level: 'UNKNOWN', source: 'special_level_in_judgments' };
  if (new Set(ls).size > 1) return { level: 'UNKNOWN', source: 'unresolved_disagreement' };
  return { level: ls[0], source: 'rater_consensus' };
}

/** 같은 국면에 여러 기록: 모두 순서 수준이면 아래쪽 중앙값, 하나라도 미상이면 UNKNOWN. */
function phaseLevel(levels) {
  if (levels.length === 0) return 'UNKNOWN';
  if (levels.some((l) => levelIndex(l) === null)) return 'UNKNOWN';
  const s = levels.map(levelIndex).sort((a, b) => a - b);
  return LEVELS[s[Math.floor((s.length - 1) / 2)]];
}

export function compare(records, { independentOnly = true, exposureMap = null } = {}) {
  const origins = { SYNTHETIC: 0, REAL: 0, UNKNOWN: 0 };
  for (const r of records) origins[r.data_origin] = (origins[r.data_origin] || 0) + 1;
  const excluded = { not_independent: { ASSISTED_ONLY: 0, UNKNOWN: 0 }, other_phase: 0 };
  const learners = new Map();
  for (const r of records) {
    if (!['PRE', 'POST_INDEPENDENT', 'TRANSFER'].includes(r.phase)) { excluded.other_phase += 1; continue; }
    const elig = recordExposure(r, exposureMap).eligibility;
    if (independentOnly && elig !== 'INDEPENDENT_ELIGIBLE') { excluded.not_independent[elig] += 1; continue; }
    if (!learners.has(r.learner_pseudo_id)) learners.set(r.learner_pseudo_id, { paths: new Set(), phases: {} });
    const L = learners.get(r.learner_pseudo_id);
    L.paths.add(r.path);
    (L.phases[r.phase] = L.phases[r.phase] || []).push(recordLevel(r).level);
  }
  const perLearner = [];
  for (const [id, L] of learners) {
    const path = L.paths.size === 1 ? [...L.paths][0] : 'MIXED';
    const levels = {};
    for (const ph of ['PRE', 'POST_INDEPENDENT', 'TRANSFER']) levels[ph] = L.phases[ph] ? phaseLevel(L.phases[ph]) : 'UNKNOWN';
    perLearner.push({ learner_pseudo_id: id, path, levels, missing_phases: ['PRE', 'POST_INDEPENDENT', 'TRANSFER'].filter((p) => !L.phases[p]) });
  }
  perLearner.sort((a, b) => (a.learner_pseudo_id < b.learner_pseudo_id ? -1 : 1));
  const comparisons = {};
  for (const [from, to] of COMPARISONS) {
    const key = `${from}->${to}`;
    const c = { transitions: {}, direction: { up: 0, same: 0, down: 0, UNKNOWN: 0 }, by_path: {}, unknown_learners: [] };
    for (const p of perLearner) {
      const a = p.levels[from];
      const b = p.levels[to];
      const ia = levelIndex(a);
      const ib = levelIndex(b);
      const dir = ia === null || ib === null ? 'UNKNOWN' : ib > ia ? 'up' : ib < ia ? 'down' : 'same';
      const t = `${a}->${b}`;
      c.transitions[t] = (c.transitions[t] || 0) + 1;
      c.direction[dir] += 1;
      c.by_path[p.path] = c.by_path[p.path] || { up: 0, same: 0, down: 0, UNKNOWN: 0, transitions: {} };
      c.by_path[p.path][dir] += 1;
      c.by_path[p.path].transitions[t] = (c.by_path[p.path].transitions[t] || 0) + 1;
      if (dir === 'UNKNOWN') c.unknown_learners.push(p.learner_pseudo_id);
    }
    comparisons[key] = c;
  }
  const hasSynthetic = origins.SYNTHETIC > 0;
  return {
    banner: hasSynthetic ? SYNTHETIC_BANNER : null,
    data_origin: origins,
    effect_status: origins.REAL === 0 ? 'NOT_EVALUATED' : 'DESCRIPTIVE_ONLY',
    effect_status_reason: origins.REAL === 0 ? 'REAL 데이터 없음 — 학습 효과는 평가하지 않음' : '대응 기술 통계만 제공 — 통제·무작위화 없이 인과 효과로 해석하지 않음',
    independent_only: independentOnly,
    excluded,
    n_learners: perLearner.length,
    per_learner: perLearner,
    comparisons,
  };
}
