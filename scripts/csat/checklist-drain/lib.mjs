// scripts/csat/checklist-drain/lib.mjs
//
// **v7 체크리스트 경로 운영 드레인의 순수 함수** — 판정 기준 v7 §3-6(criteria.md). DB·파일·시계를 만지지 않는다.
//
//   export.mjs   → auditPick(감사 5% 고르기) · chunkByBudget · activeSources(원천 끄기)
//   assemble.mjs → route(체크리스트 keep 은 기록으로, 나머지·감사분은 전문 판정으로)
//   ledger.mjs   → tallyAudit(감사 결과 세기) · sourceStatus(원천별 누적 오판률 → 끄기)
//
// 수치(5% · 3% · 30편)는 `gate-rules.mjs` 의 CHECKLIST_AUDIT 하나만 쓴다 — 문서와의 일치는 judge-criteria 테스트가 본다.

import crypto from 'node:crypto'

import { CHECKLIST_AUDIT, PAPER_SOURCES } from '../gate-rules.mjs'
import { toRetainReview } from './record.mjs'

const order = (salt, id) => crypto.createHash('sha256').update(`${salt}:${id}`).digest('hex')

/**
 * 배치에서 전문 재판정할 글 — `sha256(batch:id)` 순서 앞쪽 올림(rate × n)편. 같은 배치·같은 id 면 같은 선택(재실행 안전).
 * 판정자에게는 알리지 않는다(눈가림) — 감사 목록은 배치 폴더의 `audit.json` 에만 둔다.
 */
export function auditPick(ids, batch, rate = CHECKLIST_AUDIT.rate) {
  if (!ids.length) return []
  const n = Math.max(1, Math.ceil(ids.length * rate))
  return [...ids].sort((a, b) => order(`audit-${batch}`, a).localeCompare(order(`audit-${batch}`, b))).slice(0, n)
}

/** 본문 글자 수 합이 budget 을 넘지 않게 자른다(한 편이 budget 보다 길면 그 한 편만 한 청크). */
export function chunkByBudget(items, budget, len = (x) => String(x.content ?? '').length) {
  const chunks = []
  let cur = []
  let size = 0
  for (const it of items) {
    const l = len(it)
    if (cur.length && size + l > budget) { chunks.push(cur); cur = []; size = 0 }
    cur.push(it)
    size += l
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

/** 체크리스트 경로에 넣어도 되는 원천인가 — 논문 원천도 아니고 원장이 끄지도 않은 것. */
export const checklistAllowed = (source, disabled = new Set()) => !PAPER_SOURCES.has(source) && !disabled.has(source)

/**
 * 판정자 출력을 두 갈래로 나눈다.
 *   records — 규칙 keep · 감사 대상 아님 → `gate-mixed-import --input` 에 그대로 넣을 보관 판정 기록
 *   full    — 규칙이 keep 이 아니거나 감사 대상 → 전문 판정 청크로(체크리스트 답은 싣지 않는다 — 눈가림)
 *   audited — 감사 대상의 체크리스트 결론(원장이 전문 판정과 대 본다)
 *   problems — 답이 없거나 기록 모양이 틀린 글. 이 글은 어느 갈래에도 넣지 않는다(고친 뒤 다시 돌린다).
 */
export function route(items, outs, auditIds) {
  const audit = new Set(auditIds)
  const byId = new Map(outs.map((o) => [o.id, o]))
  const records = []
  const full = []
  const audited = []
  const problems = []
  for (const it of items) {
    const o = byId.get(it.id)
    if (!o) { problems.push(`${it.id.slice(0, 8)}: 판정자 출력 없음`); continue }
    const { decision, review, problems: p } = toRetainReview(it, o)
    if (p.length) { problems.push(...p); continue }
    if (audit.has(it.id)) {
      audited.push({ id: it.id, source: it.source, checklist: decision.retention, rule: decision.rule })
      full.push(it)
    } else if (review) records.push(review)
    else full.push(it)
  }
  return { records, full, audited, problems }
}

/**
 * 감사 결과 세기 — 원천별 `{ audited, auditedKeep, wrongKeep }`.
 * 오판은 **체크리스트가 keep 이라 했는데 전문 판정이 keep 이 아닌 것**만 센다(체크리스트 경로는 keep 만 확정하므로).
 * 전문 판정이 아직 없는 글은 세지 않고 `pending` 으로 돌려준다.
 */
export function tallyAudit(audited, fullById) {
  const bySource = {}
  const pending = []
  const wrong = []
  for (const a of audited) {
    const truth = fullById.get(a.id)
    if (!truth) { pending.push(a.id); continue }
    const s = (bySource[a.source] ??= { audited: 0, auditedKeep: 0, wrongKeep: 0 })
    s.audited++
    if (a.checklist === 'keep') {
      s.auditedKeep++
      if (truth !== 'keep') { s.wrongKeep++; wrong.push({ id: a.id, source: a.source, truth, rule: a.rule }) }
    }
  }
  return { bySource, pending, wrong }
}

/**
 * 원장(배치별 원천 집계 목록)을 누적해 원천별 상태를 낸다.
 * 감사로 본 keep 이 minAudited 이상 쌓인 뒤에만 판단한다 — 그 전 오판률은 한두 편에 크게 흔들린다.
 * 한 번 꺼진 원천은 원장에 `off` 로 남고 다시 켜지 않는다(켜려면 사람이 원장을 고친다).
 */
export function sourceStatus(batches, { maxWrongKeep, minAudited } = CHECKLIST_AUDIT) {
  const sum = {}
  for (const b of batches) {
    for (const [src, s] of Object.entries(b.bySource ?? {})) {
      const t = (sum[src] ??= { audited: 0, auditedKeep: 0, wrongKeep: 0 })
      t.audited += s.audited
      t.auditedKeep += s.auditedKeep
      t.wrongKeep += s.wrongKeep
    }
  }
  const out = {}
  for (const [src, t] of Object.entries(sum)) {
    const rate = t.auditedKeep ? t.wrongKeep / t.auditedKeep : 0
    out[src] = { ...t, rate, off: t.auditedKeep >= minAudited && rate > maxWrongKeep }
  }
  return out
}

/** 원장 파일 내용에서 꺼진 원천 집합 — 누적 계산으로 꺼진 것과 사람이 `disabled` 에 적은 것의 합. */
export function disabledSources(ledger) {
  const off = new Set(ledger?.disabled ?? [])
  for (const [src, s] of Object.entries(sourceStatus(ledger?.batches ?? []))) if (s.off) off.add(src)
  return off
}
