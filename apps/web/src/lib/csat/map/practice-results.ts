// apps/web/src/lib/csat/map/practice-results.ts
// 학습 지도 「결과 환류」(2026-10-08) — FIND 과제에 연결된 실행 과제(기출 한 문항)를 학습자 본인이 어떻게 했는지 요약한다.
// 읽기는 학습자 키(RLS — 본인 행만). 집계는 이 모듈의 순수 함수가 한다.
// 이 요약은 「이번 확인의 결과」일 뿐이다 — 실력 · 원인을 확정하지 않고, 효과를 약속하지 않는다.

import type { MapPracticeLink } from '../../knowledge/product-server'

/**
 * 전이(다른 지문 적용)로 함께 셀 과제 키. Practice 는 주석 문항을 `<key>` 로, 골격(정답 근거 앵커)만 있는 문항을 `<key>-skeleton` 으로 기록한다.
 * 전이 문항(주제 · 제목)은 대부분 골격이다 — 학습자에게 보이는 「다른 지문에 적용」 은 둘 다 센다(효과 계산과는 별개).
 */
export const transferKeysOf = (taskKey: string): string[] => [taskKey, `${taskKey}-skeleton`]

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
  /** M8 — 판단 시각이 도움 · 해설 시각과 겹치거나 기기 시계를 믿을 수 없어 독립 여부를 보류한다 */
  timing_uncertain?: boolean | null
  answered_at?: string | null
  phase?: string | null
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
  // M8 시각 불확실이면 「도움 없이 풀었다」고 단정하지 않는다(모름 = null). 해설 뒤 판단은 그대로 false
  const firstIndependent = !first || first.help_level === null
    ? (first?.after_explanation ? false : null)
    : first.after_explanation || first.help_level !== 'independent' ? false
    : first.timing_uncertain ? null
    : true
  const tr = [...(extra.transfers ?? [])].sort((a, b) => a.answered_at.localeCompare(b.answered_at))
  const transfer = tr.length ? { attempts: tr.length, latestCorrect: tr.at(-1)!.is_correct } : null
  // 아직 하지 않은 예약만 — 예약 시각 뒤에 이 문항을 다시 확인했으면 그 예약은 끝난 것이다
  const reviewAt = (extra.reviews ?? [])
    // 끝난 예약 = 예약 시각 뒤에 **같은 문항**을 다시 확인한 것 — 다른 확인 문항의 시도로 이 문항의 예약을 지우지 않는다(Codex P1)
    .filter((r) => r.review_at && !r.deleted_at && !sorted.some((a) => a.item_ref === r.item_ref && a.answered_at >= (r.review_at as string)))
    .map((r) => r.review_at as string).sort()[0] ?? null
  // 예약일 비교는 주입한 now 로만(시계를 직접 읽지 않는다)
  const reviewDue = !!(reviewAt && extra.now && new Date(reviewAt).getTime() <= extra.now.getTime())
  const next: PracticeResult['next'] = !latest ? 'start' : !latest.is_correct ? 'retry' : reviewDue ? 'review' : 'move_on'
  return { attempts: sorted.length, firstCorrect, firstIndependent, latestCorrect: latest?.is_correct ?? null, latestAt: latest?.answered_at ?? null, transfer, reviewAt, next }
}

/** 지도 과제 id → 본인 수행 요약. 연결이 없거나 수행이 없으면 attempts 0(next 'start') */
export function practiceResultsFor(links: Record<string, MapPracticeLink>, rows: AttemptRow[], firsts: FirstAttemptRow[], reviews: ReviewRow[] = [], now?: Date): Record<string, PracticeResult> {
  const out: Record<string, PracticeResult> = {}
  for (const [taskId, link] of Object.entries(links)) {
    // 확인 문항 **전부**(과제 키 · 문항 쌍) — 첫 문항만 보면 다른 확인 문항의 수행 · 복습 예약이 지도에서 빠진다(Codex P1)
    const pairs = link.confirm?.length ? link.confirm.map((c) => ({ taskKey: c.taskKey, item: c.target })) : [{ taskKey: link.taskKey, item: link.itemId }]
    const isConfirm = (taskKey: string, item: string | null) => pairs.some((p) => p.taskKey === taskKey && p.item === item)
    const targets = new Set(pairs.map((p) => p.item))
    // 확인 문항의 연습(practice · 단계 없음) · 같은 과제 키로 다른 지문에 적용한 전이(transfer — 확인 문항 밖)
    const mine = rows.filter((r) => isConfirm(r.task_key, r.item_ref) && (r.phase ?? 'practice') !== 'transfer')
    // 「다른 지문에 적용」 — 같은 원리(과제 키 · 골격 포함)를 확인 문항 밖에서 수행한 기록. 단계는 묻지 않는다:
    // Practice 의 주석 문항(R-CLAIM)은 practice 로, 주제 · 제목 골격은 transfer 로 남는다 — 둘 다 「다른 지문」 이다
    const transfers = rows.filter((r) => transferKeysOf(link.taskKey).includes(r.task_key) && !targets.has(r.item_ref ?? ''))
    // 첫 시도 뷰는 (과제 · 문항 · 단계)마다 한 줄 — 확인 문항들 중 판단 시각이 가장 이른 줄
    const first = firsts
      .filter((f) => isConfirm(f.task_key, f.item_ref) && (f.phase ?? 'practice') !== 'transfer')
      .sort((a, b) => (a.answered_at ?? '').localeCompare(b.answered_at ?? ''))[0] ?? null
    out[taskId] = summarizePractice(mine, first, { transfers, reviews: reviews.filter((r) => targets.has(r.item_ref ?? '')), now })
  }
  return out
}
