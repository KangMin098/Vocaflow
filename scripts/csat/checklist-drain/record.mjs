// scripts/csat/checklist-drain/record.mjs
//
// **체크리스트 답 → 보관 판정 기록(`kind:"retain"` 검토 한 건)** — 판정 기준 v7 §3-6.
//
// 규칙(`checklist-exp/decide.mjs`)이 `keep` 이라 한 글만 기록으로 만든다. 모양 검사는 적재기와 같은 `retain-record.mjs` 로 한다
// (규칙을 두 곳에 쓰지 않는다). 기록에는 판정자 답을 그대로 남긴다(`checklist`) — 기준을 고치면 답으로 다시 계산할 수 있게.
// 순수 함수만 둔다. 쓰는 곳: `checklist-exp/validate.mjs --record` · `checklist-drain/assemble.mjs`.

import { CRITERIA_VERSION } from '../gate-rules.mjs'
import { retainProblems } from '../retain-record.mjs'
import { decide } from '../checklist-exp/decide.mjs'

/**
 * @param {object} item 청크 항목(id · source_updated_at · body_sha256 …)
 * @param {object} out  판정자 출력 한 건(answers · sample · note · record)
 * @returns {{ decision: ReturnType<typeof decide>, review: object|null, problems: string[] }}
 *   review 는 decision 이 keep 일 때만 — 그 밖은 null(전문 판정으로 간다).
 */
export function toRetainReview(item, out) {
  const decision = decide(out.answers)
  if (decision.retention !== 'keep') return { decision, review: null, problems: [] }
  const rec = out.record ?? {}
  const review = {
    id: item.id,
    source_updated_at: item.source_updated_at,
    body_sha256: item.body_sha256,
    kind: 'retain',
    basis: 'full',
    criteria_version: CRITERIA_VERSION,
    retention: 'keep',
    genre: rec.genre,
    why: out.note,
    slots: rec.slots,
    processing: {
      detachable: out.answers.detachable,
      standsAlone: out.answers.standsAlone,
      vocabAdjustable: out.answers.vocabAdjustable,
      sample: out.sample,
      note: out.note,
    },
    method: 'checklist',
    checklist: { answers: out.answers, rule: decision.rule },
  }
  return { decision, review, problems: retainProblems(review, item.id.slice(0, 8)) }
}
