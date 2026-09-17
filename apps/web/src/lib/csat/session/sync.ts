// apps/web/src/lib/csat/session/sync.ts
//
// **기기 기록 ↔ 서버 기록 합치기.** 순수 함수 — 브라우저(store.ts)와 API 가 같은 규칙을 쓴다.
//
// ── 복습 큐는 옮기지 않고 **다시 계산한다** ───────────────────────────
// 기기 둘(휴대폰·노트북)이 각자 복습 단계를 갖고 있으면 「어느 쪽이 맞나」를 가를 규칙이 또 필요하다.
// 그런데 복습 큐는 풀이 기록의 함수다(`applyResult` 를 시간순으로 돌린 결과). 그래서 풀이 기록만
// 합치고(겹치면 하나로) 큐는 처음부터 다시 돌린다 — 규칙은 `model.ts` 한 곳에 남고 충돌이 없다.

import { EMPTY_RECORD, applyResult, type Attempt, type LearnerRecord, type ReviewEntry } from './model'

/** 한 풀이의 열쇠 — 서버 고유 제약 `(user_id, item_id, answered_at)` 과 같다 */
export const attemptKey = (a: Pick<Attempt, 'item_id' | 'at'>) => `${a.item_id}@${new Date(a.at).toISOString()}`

export function mergeAttempts(...lists: Attempt[][]): Attempt[] {
  const by = new Map<string, Attempt>()
  for (const list of lists) for (const a of list) if (!by.has(attemptKey(a))) by.set(attemptKey(a), a)
  return [...by.values()].sort((x, y) => Date.parse(x.at) - Date.parse(y.at))
}

/** 풀이 기록을 시간순으로 돌려 복습 큐를 만든다 */
export function replayReviews(attempts: Attempt[]): ReviewEntry[] {
  let rec: LearnerRecord = { ...EMPTY_RECORD, attempts: [], reviews: [] }
  for (const a of [...attempts].sort((x, y) => Date.parse(x.at) - Date.parse(y.at))) {
    rec = applyResult(
      rec,
      { item: { id: a.item_id, exam_id: a.item_id.split('#')[0], no: 0, type_id: a.type_id, points: null }, correct: a.correct, confused: a.confused, sec: a.sec },
      new Date(a.at),
    )
  }
  return rec.reviews
}

/** 기기 기록 + 서버 풀이 → 합친 기록. 서버에만 있는 풀이가 있으면 온보딩은 끝난 것이다. */
export function mergeRecord(local: LearnerRecord, server: Attempt[]): LearnerRecord {
  const attempts = mergeAttempts(local.attempts, server)
  return {
    version: 1,
    attempts,
    reviews: replayReviews(attempts),
    onboarded: local.onboarded || server.length > 0,
  }
}

/** 서버에 아직 없는 풀이 */
export function unsynced(local: Attempt[], server: Attempt[]): Attempt[] {
  const have = new Set(server.map(attemptKey))
  return local.filter((a) => !have.has(attemptKey(a)))
}

const ITEM_RE = /^[A-Za-z0-9_]{1,16}#\d{1,2}$/
const TYPE_RE = /^[A-Z]-[A-Z0-9]{2,16}$/

/** API 입력 검사 — 모양이 맞는 것만 통과시킨다(자유 문자열이 표로 흘러가지 않게) */
export function cleanAttempts(raw: unknown, max = 200): Attempt[] {
  if (!Array.isArray(raw)) return []
  const out: Attempt[] = []
  for (const r of raw.slice(0, max)) {
    const a = r as Partial<Attempt>
    if (typeof a.item_id !== 'string' || !ITEM_RE.test(a.item_id)) continue
    if (typeof a.type_id !== 'string' || !TYPE_RE.test(a.type_id)) continue
    if (!(a.correct === null || typeof a.correct === 'boolean')) continue
    if (typeof a.at !== 'string' || Number.isNaN(Date.parse(a.at))) continue
    const t = Date.parse(a.at)
    if (t > Date.now() + 5 * 60_000 || t < Date.parse('2026-01-01')) continue
    out.push({
      item_id: a.item_id,
      type_id: a.type_id,
      correct: a.correct,
      confused: a.confused === true,
      at: new Date(t).toISOString(),
      sec: Math.max(0, Math.min(86_399, Math.round(Number(a.sec) || 0))),
    })
  }
  return out
}
