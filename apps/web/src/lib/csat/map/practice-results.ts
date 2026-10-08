// apps/web/src/lib/csat/map/practice-results.ts
// 학습 지도 「결과 환류」(2026-10-08) — FIND 과제에 연결된 실행 과제(기출 한 문항)를 학습자 본인이 어떻게 했는지 요약한다.
// 읽기는 학습자 키(RLS — 본인 행만). 집계는 이 모듈의 순수 함수가 한다.
// 이 요약은 「이번 확인의 결과」일 뿐이다 — 실력 · 원인을 확정하지 않고, 효과를 약속하지 않는다.

import type { MapPracticeLink } from '../../knowledge/product-server'

export interface AttemptRow {
  task_key: string
  item_ref: string | null
  is_correct: boolean | null
  answered_at: string
  /** 측정 단계 — practice(이 문항) · transfer(다른 지문에 적용) 등. 없으면 practice 로 본다 */
  phase?: string | null
}

/** 학습 세션의 「다시 보기 예약」(G0 계약 reviewAt · learning_sessions.review_at) */
export interface ReviewRow {
  item_ref: string | null
  review_at: string | null
  deleted_at: string | null
}

/** 첫 시도 뷰(learning_first_attempts)의 한 줄 — 세션의 실효 도움 수준 · 해설 뒤 판단 여부가 붙는다 */
export interface FirstAttemptRow {
  task_key: string
  item_ref: string | null
  is_correct: boolean | null
  help_level: string | null
  after_explanation: boolean | null
}

export interface PracticeResult {
  attempts: number
  /** 처음 판단이 맞았나(null = 판정 없음) */
  firstCorrect: boolean | null
  /** 처음 판단이 도움(해설 먼저 · 힌트) 없이, 해설을 열기 전에 나왔나 — 뷰가 없거나 모르면 null */
  firstIndependent: boolean | null
  latestCorrect: boolean | null
  latestAt: string | null
  /** 다른 지문에 적용(전이)한 결과 — 같은 과제 키의 transfer 단계 시도. 없으면 null */
  transfer: { attempts: number; latestCorrect: boolean | null } | null
  /** 이 문항에 잡힌 가장 이른 「다시 보기」 예약(삭제되지 않은 세션) */
  reviewAt: string | null
  /** 다음 행동 — 결과에서 바로 정해지는 닫힌 열거. 최근이 오답이면 retry, 예약일이 지났으면 review */
  next: 'retry' | 'review' | 'move_on' | 'start'
}

export function summarizePractice(rows: AttemptRow[], first: FirstAttemptRow | null, extra: { transfers?: AttemptRow[]; reviews?: ReviewRow[]; now?: Date } = {}): PracticeResult {
  const sorted = [...rows].sort((a, b) => a.answered_at.localeCompare(b.answered_at))
  const latest = sorted.at(-1) ?? null
  const firstRow = sorted[0] ?? null
  const firstCorrect = first ? first.is_correct : firstRow?.is_correct ?? null
  // 도움 여부는 기록에 있을 때만 말한다 — 도움 수준이 비어 있으면(세션 없는 옛 기록) 모른다(null). 모르는 것을 「도움받았다」로 단정하지 않는다
  const firstIndependent = !first || first.help_level === null
    ? (first?.after_explanation ? false : null)
    : first.help_level === 'independent' && !first.after_explanation
  const tr = [...(extra.transfers ?? [])].sort((a, b) => a.answered_at.localeCompare(b.answered_at))
  const transfer = tr.length ? { attempts: tr.length, latestCorrect: tr.at(-1)!.is_correct } : null
  const reviewAt = (extra.reviews ?? []).filter((r) => r.review_at && !r.deleted_at).map((r) => r.review_at as string).sort()[0] ?? null
  // 예약일 비교는 주입한 now 로만(시계를 직접 읽지 않는다)
  const reviewDue = !!(reviewAt && extra.now && new Date(reviewAt).getTime() <= extra.now.getTime())
  const next: PracticeResult['next'] = !latest ? 'start' : !latest.is_correct ? 'retry' : reviewDue ? 'review' : 'move_on'
  return { attempts: sorted.length, firstCorrect, firstIndependent, latestCorrect: latest?.is_correct ?? null, latestAt: latest?.answered_at ?? null, transfer, reviewAt, next }
}

/** 지도 과제 id → 본인 수행 요약. 연결이 없거나 수행이 없으면 attempts 0(next 'start') */
export function practiceResultsFor(links: Record<string, MapPracticeLink>, rows: AttemptRow[], firsts: FirstAttemptRow[], reviews: ReviewRow[] = [], now?: Date): Record<string, PracticeResult> {
  const out: Record<string, PracticeResult> = {}
  for (const [taskId, link] of Object.entries(links)) {
    // 이 문항의 연습(practice · 단계 없음) · 같은 과제 키로 다른 지문에 적용한 전이(transfer — 문항은 어디든)
    const mine = rows.filter((r) => r.task_key === link.taskKey && r.item_ref === link.itemId && (r.phase ?? 'practice') !== 'transfer')
    const transfers = rows.filter((r) => r.task_key === link.taskKey && r.phase === 'transfer')
    // 첫 시도 뷰는 (과제 · 문항 · 단계)마다 한 줄 — 같은 과제 · 문항의 가장 이른 줄을 쓴다
    const first = firsts.filter((f) => f.task_key === link.taskKey && f.item_ref === link.itemId)[0] ?? null
    out[taskId] = summarizePractice(mine, first, { transfers, reviews: reviews.filter((r) => r.item_ref === link.itemId), now })
  }
  return out
}
