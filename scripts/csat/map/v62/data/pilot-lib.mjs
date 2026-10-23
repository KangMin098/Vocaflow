// scripts/csat/map/v62/data/pilot-lib.mjs
//
// 문항↔TASK 심층 매핑 — 청크 만들기 · 출력 검증 공용(형식만이 아니라 내용도 검사한다).
//   - 21 비보류 TASK 를 문항마다 정확히 한 번씩 판정했는가
//   - direct · indirect 는 원문 인용(anchor.quote)이 실제 해당 필드에 그대로 있는가
//   - 주 TASK 는 direct 인가 · 정답이 공식 정답과 같은가 · 오답 선지를 빠짐없이 다뤘는가
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
export const LOCAL = path.join(ROOT, 'scripts/csat/map/v62/data/local')

export const RELEVANCE = ['direct', 'indirect', 'not_applicable', 'unknown']
export const DISTORTION = ['scope_expand', 'scope_shrink', 'partial_truth', 'reversal', 'unmentioned', 'wrong_target', 'mixed_attribution', 'surface_word_match', 'overgeneralization', 'causal_error', 'off_demand', 'form_error', 'true_statement', 'other']
export const ELIGIBILITY = ['candidate_if_unexposed', 'not_suitable']

export function nonHeldTasks() {
  const cb = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4/codebook.json'), 'utf8'))
  return cb.tasks.filter((t) => t.status !== 'hold').map((t) => ({ id: t.id, display: t.display, kind: t.kind, name: t.name, goal: t.goal, conditions: t.conditions, evidence: t.evidence, criterion: t.criterion }))
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
function fieldText(source, field) {
  if (field === 'choices') return (source.choices ?? []).map((c) => (typeof c === 'string' ? c : JSON.stringify(c))).join(' ')
  return String(source[field] ?? '')
}
const answerSet = (src) => (src.answers?.length ? src.answers : src.answer != null ? [src.answer] : [])

/** 한 문항 출력의 결함 목록 — 빈 배열이면 통과 */
export function validateRow(row, input, tasks) {
  const errs = []
  const src = input.source
  if (row.item_id !== input.item_id) errs.push('item_id 불일치')
  if (row.source_sha256 !== input.source_sha256) errs.push('source_sha256 불일치(다른 원문을 읽었다)')
  if (row.status !== 'AI_PROPOSED') errs.push('status 는 AI_PROPOSED 여야 한다')
  const ids = tasks.map((t) => t.id)
  const links = Array.isArray(row.links) ? row.links : []
  const seen = new Map()
  for (const l of links) seen.set(l.task_id, (seen.get(l.task_id) ?? 0) + 1)
  for (const id of ids) if (seen.get(id) !== 1) errs.push(`TASK ${id} 판정 ${seen.get(id) ?? 0}회(정확히 1회)`)
  for (const l of links) {
    if (!ids.includes(l.task_id)) errs.push(`정의에 없는 TASK ${l.task_id}`)
    if (!RELEVANCE.includes(l.relevance)) errs.push(`${l.task_id} relevance 값 ${l.relevance}`)
    // not_applicable 은 문항의 decision_path 를 근거로 짧게 — 나머지는 문항 고유 근거
    if (norm(l.why).length < (l.relevance === 'not_applicable' ? 6 : 15)) errs.push(`${l.task_id} why 가 비었거나 너무 짧다`)
    if (l.relevance === 'direct' || l.relevance === 'indirect') {
      const q = norm(l.anchor?.quote)
      if (q.length < 3) errs.push(`${l.task_id} ${l.relevance} 인데 원문 인용 없음`)
      else if (!['passage', 'stem', 'choices'].includes(l.anchor?.field)) errs.push(`${l.task_id} anchor.field 는 passage·stem·choices`)
      else if (!norm(fieldText(src, l.anchor.field)).includes(q)) errs.push(`${l.task_id} 인용이 ${l.anchor.field} 에 없다: 「${q.slice(0, 40)}」`)
      if (norm(l.task_distinction).length < 10) errs.push(`${l.task_id} 인접 TASK 와의 구별(task_distinction) 없음`)
    }
  }
  const dp = row.decision_path
  if (norm(dp?.summary).length < 40) errs.push('decision_path.summary(이 문항이 실제로 풀리는 경로) 없음 또는 40자 미만')
  if (!dp?.quote || norm(dp.quote).length < 3 || !['passage', 'stem', 'choices'].includes(dp.field) || !norm(fieldText(src, dp.field)).includes(norm(dp.quote))) errs.push('decision_path 인용이 원문에 없다')
  const byTask = new Map(links.map((l) => [l.task_id, l]))
  if (byTask.get(row.primary_task)?.relevance !== 'direct') errs.push(`주 TASK ${row.primary_task} 가 direct 가 아니다`)
  for (const s of row.secondary_tasks ?? []) if (!['direct', 'indirect'].includes(byTask.get(s)?.relevance)) errs.push(`보조 TASK ${s} 가 direct·indirect 가 아니다`)
  const official = answerSet(src)
  if (!official.includes(row.answer_logic?.answer)) errs.push(`정답 ${row.answer_logic?.answer} ≠ 공식 ${official.join('/')}`)
  if (norm(row.answer_logic?.why).length < 20) errs.push('정답 논리 없음')
  const loc = row.answer_logic?.decisive_locus
  if (!loc || !norm(fieldText(src, loc.field)).includes(norm(loc.quote)) || norm(loc.quote).length < 3) errs.push('결정 근거 위치 인용이 원문에 없다')
  const nChoices = (src.choices ?? []).length
  if (nChoices) {
    const wrong = Array.from({ length: nChoices }, (_, k) => k + 1).filter((n) => !official.includes(n))
    const got = new Set((row.distractors ?? []).map((d) => d.choice))
    for (const n of wrong) if (!got.has(n)) errs.push(`오답 ${n} 분석 없음`)
    for (const d of row.distractors ?? []) {
      if (!DISTORTION.includes(d.distortion_type)) errs.push(`오답 ${d.choice} 왜곡 유형 ${d.distortion_type}`)
      if (norm(d.why).length < 15) errs.push(`오답 ${d.choice} 근거 없음`)
    }
  }
  for (const k of ['passage_structure', 'design_hypothesis', 'stem_demand']) if (norm(typeof row[k] === 'string' ? row[k] : JSON.stringify(row[k] ?? '')).length < 15) errs.push(`${k} 없음`)
  const direct = links.filter((l) => l.relevance === 'direct').map((l) => l.task_id)
  for (const t of row.directly_observable ?? []) if (!direct.includes(t)) errs.push(`직접 확인 ${t} 가 direct 링크가 아니다`)
  if (!Array.isArray(row.not_observable) || row.not_observable.some((n) => norm(n.why).length < 10)) errs.push('직접 확인 불가 수행(not_observable) 근거 없음')
  if (!ELIGIBILITY.includes(row.independent_assessment?.eligibility)) errs.push('independent_assessment.eligibility 값')
  // 상투문 검사 — 한 문항 안에서 같은 why 를 여러 TASK 에 복사하면 판정을 안 한 것이다
  const whyCount = new Map()
  for (const l of links) { const w = norm(l.why); whyCount.set(w, (whyCount.get(w) ?? 0) + 1) }
  for (const [w, n] of whyCount) if (n >= 3) errs.push(`같은 why 를 ${n}개 TASK 에 복사: 「${w.slice(0, 30)}」`)
  // other 과반 금지 규칙은 두지 않는다 — 검증을 맞추려 허위 유형을 고르게 만들었다(2026-10-23 표본). 맞는 유형이 없으면 other + why
  return errs
}

/** 링크만 판정하는 행(확대 배치 · 규칙 재판정) — 지정한 TASK 만, 같은 인용 · 경로 · 반복 검사 */
export function validateLinkRow(row, input, taskIds) {
  const errs = []
  const src = input.source
  if (row.item_id !== input.item_id) errs.push('item_id 불일치')
  if (row.source_sha256 !== input.source_sha256) errs.push('source_sha256 불일치(다른 원문을 읽었다)')
  if (row.status !== 'AI_PROPOSED') errs.push('status 는 AI_PROPOSED 여야 한다')
  const dp = row.decision_path
  if (norm(dp?.summary).length < 40) errs.push('decision_path.summary 없음 또는 40자 미만')
  if (!dp?.quote || norm(dp.quote).length < 3 || !['passage', 'stem', 'choices'].includes(dp.field) || !norm(fieldText(src, dp.field)).includes(norm(dp.quote))) errs.push('decision_path 인용이 원문에 없다')
  const links = Array.isArray(row.links) ? row.links : []
  for (const id of taskIds) if (links.filter((l) => l.task_id === id).length !== 1) errs.push(`TASK ${id} 판정 횟수가 1이 아니다`)
  for (const l of links) {
    if (!taskIds.includes(l.task_id)) errs.push(`대상 밖 TASK ${l.task_id}`)
    if (!RELEVANCE.includes(l.relevance)) errs.push(`${l.task_id} relevance 값 ${l.relevance}`)
    if (norm(l.why).length < 15) errs.push(`${l.task_id} why 가 비었거나 너무 짧다`)
    if (l.relevance === 'direct' || l.relevance === 'indirect') {
      const q = norm(l.anchor?.quote)
      if (q.length < 3 || !['passage', 'stem', 'choices'].includes(l.anchor?.field) || !norm(fieldText(src, l.anchor.field)).includes(q)) errs.push(`${l.task_id} 인용이 원문에 없다`)
      if (norm(l.task_distinction).length < 10) errs.push(`${l.task_id} task_distinction 없음`)
    }
  }
  return errs
}

/** 링크 행 묶음의 상투문 — why · decision_path 가 문항 3개 이상에서 같으면 결함 */
export function validateLinkChunk(rows) {
  const seen = new Map()
  for (const r of rows) for (const k of new Set([`dp:${norm(r.decision_path?.summary)}`, ...(r.links ?? []).map((l) => `${l.task_id}:${norm(l.why)}`)])) seen.set(k, [...(seen.get(k) ?? []), r.item_id])
  return [...seen].filter(([, ids]) => ids.length >= 3).map(([k, ids]) => `문항 ${ids.length}개에 같은 문장(${ids.slice(0, 3).join(',')}…): 「${k.slice(0, 40)}」`)
}

/** 청크 전체의 상투문 — 문항이 달라도 같은 문장이 반복되면 생성기로 찍어낸 것이다 */
export function validateChunk(rows) {
  const errs = []
  const seen = new Map()
  // 문항 id · 유형 · 번호를 떼고 비교한다(고정 문장 앞에 id 만 붙여 반복 검사를 피하는 것을 막는다)
  const strip = (s, r) => norm(s).replace(new RegExp(String(r.item_id).replace(/[#]/g, '#?'), 'gi'), '').replace(/[A-Z]-[A-Z0-9]+/g, '').replace(/\d+/g, '').replace(/^[\s:·()[\]-]+/, '').trim()
  const tail = (s) => norm(s).slice(-25)
  for (const r of rows) {
    const keys = [JSON.stringify((r.teaching_principles ?? []).map(norm)), `dp:${strip(r.decision_path?.summary, r)}`, ...(r.links ?? []).filter((l) => l.relevance !== 'not_applicable').map((l) => strip(l.why, r)), ...(r.distractors ?? []).map((d) => strip(d.why, r)), ...(r.links ?? []).filter((l) => l.relevance === 'direct' || l.relevance === 'indirect').map((l) => `tail:${tail(l.why)}`)]
    for (const k of new Set(keys)) { if (k.length < 5) continue; seen.set(k, [...(seen.get(k) ?? []), r.item_id]) }
  }
  // 같은 유형 문항(빈칸 4개 등)의 끝 문구가 비슷한 것은 자연스럽다 — 끝 문구만 5문항 이상부터
  for (const [k, ids] of seen) if (ids.length >= (k.startsWith('tail:') ? 5 : 3)) errs.push(`문항 ${ids.length}개에 같은 문장 반복(${ids.slice(0, 3).join(',')}…): 「${k.slice(0, 40)}」`)
  return errs
}
