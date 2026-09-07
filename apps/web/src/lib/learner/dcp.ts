// apps/web/src/lib/learner/dcp.ts
//
// CTP DCP(구문 연습) 공용 타입 + error_cause 정적 매핑 (client·server 공용, 'use server' 아님).
// 문항 계약은 packages/library-pipeline generate-items.ts 와 DB grade_dcp_item 에 정합:
//   order  : payload.presented(셔플 문장) · 제출 {order:[배열한 presented 인덱스]} (각 presented[k]를 원래 위치로)
//   insert : payload.{remaining, insert_sentence, gap_count} · 제출 {position:슬롯 0..remaining.length}
//   선택지 9종 : payload.{passage, choices[5], stem_ko, …} · 제출 {choice:1..5}

import type { ChoiceDcpType } from './dcp-types'

/**
 * 화면이 그릴 수 있는 유형. 갈래 목록의 정본은 `dcp-types.ts` 다 — 여기서 다시 적으면
 * 두 목록이 조용히 어긋난다(이 저장소가 이름 레지스트리에서 이미 겪은 실패다).
 */
export type DcpItemType = 'order' | 'insert' | ChoiceDcpType

export interface DcpOrderPayload {
  presented: string[]
}
export interface DcpInsertPayload {
  remaining: string[]
  insert_sentence: string
  gap_count: number
}

/**
 * 선택지 9종 공용 payload — 아홉 유형이 **같은 모양**이라 하나로 받는다(실측).
 *
 * `underline` 은 함축 의미(`implication`)에서만 차 있고, `summary_sentence` 는 요약(`summary`)의
 * (A)/(B) 빈칸 문장이다. 둘 다 없을 수 있으므로 선택 필드다 — **없다고 유형을 거르지 않는다.**
 */
export interface DcpChoicePayload {
  passage: string
  /** 정확히 5개. 부족하거나 넘치면 문항이 성립하지 않는다. */
  choices: string[]
  /** 묻는 말(한국어). 유형 차이는 사실상 이 문장에 들어 있다. */
  stemKo: string
  /** 지문 안에서 밑줄로 표시할 구절. 없으면 null. */
  underline: string | null
  /** 요약 유형의 (A)…(B) 문장. 없으면 null. */
  summarySentence: string | null
}

export interface DcpItem {
  id: string
  type: DcpItemType
  paragraphIdx: number
  payload: DcpOrderPayload | DcpInsertPayload | DcpChoicePayload
}

/** 채점이 실제로 끝난 결과. 오답이면 answerKey 동봉(정답 공개용). */
export interface DcpGradeOk {
  ok: true
  correct: boolean
  attemptId: string | null
  /** order: {source_order} / insert: {position} / 선택지: {answer:1..5, rationale_ko} / 정답이면 null */
  answerKey: Record<string, unknown> | null
}

/**
 * 채점을 **못 한** 상태. 오답이 아니다.
 *
 * ⚠️ 예전에는 `if (error || !data) return { correct: false, … }` 였다 — RPC 거부·타임아웃을
 *   「틀렸다」로 번역한 것이다. 그러면 화면이 **맞힌 학습자에게 "아쉬워요" 라고 말하고**
 *   정답 공개도 못 하니(answerKey 가 null) 왜 틀렸는지도 안 나온다. 게다가 attempt 행이
 *   안 남아 그 오답 판정은 어디에도 근거가 없다.
 *   같은 파일 `fetchTextbookPracticeItems` 는 정반대를 이미 적어 뒀다 —
 *   "조회 실패를 빈 목록으로 뭉개지 않는다". 채점 경로만 그 규칙을 안 따르고 있었다.
 *   **타입으로 갈라 둔다** — 뭉개려면 컴파일러를 지나야 한다.
 */
export interface DcpGradeFailed {
  ok: false
  error: string
}

export type DcpGradeResult = DcpGradeOk | DcpGradeFailed

// ── error_cause 정적 5원인 (오답 자기보고 → 격려 tip + 존재 라우트만 링크) ──
export type DcpErrorCause = 'vocab' | 'parsing' | 'structure' | 'inference' | 'timing'

export interface ErrorCauseDef {
  cause: DcpErrorCause
  /** 1-tap 칩 라벨(학습자 관점 원인) */
  label: string
  /** 격려형 처방 tip (Empathetic Feedback) */
  tip: string
  /** 존재하는 라우트만 — 없으면 tip 만(허위 링크 금지) */
  href: string | null
}

export const ERROR_CAUSES: readonly ErrorCauseDef[] = [
  { cause: 'vocab', label: '단어를 몰랐어요', tip: '흐려진 단어부터 가볍게 복습해요.', href: '/flashcard/play' },
  { cause: 'parsing', label: '문장 해석이 어려웠어요', tip: '문장을 끊어 천천히 다시 읽어보면 도움이 돼요.', href: null },
  { cause: 'structure', label: '글 구조가 헷갈렸어요', tip: '문단을 잇는 연결어(however·so 등)를 따라가 보세요.', href: null },
  { cause: 'inference', label: '논리 추론이 안 됐어요', tip: '결론의 근거가 되는 문장을 짚어보면 흐름이 보여요.', href: null },
  { cause: 'timing', label: '시간이 부족했어요', tip: '실전처럼 시간을 재며 반복하면 감각이 붙어요.', href: null },
] as const

/**
 * order 정답 순서 복원 — answerKey.source_order[k] = presented[k]의 원래 위치.
 * 정답 배열(presented 인덱스, 원래 순서대로) = 각 pos 에 대해 source_order[k]==pos 인 k.
 */
export function correctOrderFromKey(sourceOrder: number[]): number[] {
  const n = sourceOrder.length
  const result: number[] = new Array(n).fill(0)
  for (let k = 0; k < n; k++) {
    const pos = sourceOrder[k]
    if (pos >= 0 && pos < n) result[pos] = k
  }
  return result
}

/**
 * 해설 문구를 고른다 — **해설은 두 이름으로 산다.**
 *
 * 생성형 드레인(`item-drain-*`)은 `rationale_ko` 에, 결정론·배치 드레인
 * (`explain-fill` · `explain-drain-*`)은 `explanation_ko` 에 넣는다. 한쪽만 읽으면
 * 그 유형의 해설이 있는데도 화면에 안 나온다 — 순서·삽입이 실제로 그랬다
 * (2026-08-30 에 2,755건을 채웠는데 화면은 정답만 보여 주고 있었다).
 *
 * 규칙은 여기 한 곳에만 둔다. 화면마다 각자 고르게 두면 같은 실수가 다시 난다.
 * 우선순위는 `explanation_ko` — 결정론/배치가 나중에 쓴 것이고 더 최신이다.
 */
export function pickExplanationText(answerKey: Record<string, unknown> | null | undefined): string | null {
  if (!answerKey) return null
  for (const key of ['explanation_ko', 'rationale_ko'] as const) {
    const v = answerKey[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/**
 * ⚠️ **규칙 해설 대체를 여기 넣었다가 되돌렸다 (2026-09-01). 다시 넣지 말 것 — 재 봤다.**
 *
 * 조판기(render-volume.mjs)는 저장된 해설이 없으면 규칙으로 채운다. 화면에도 같은 것을
 * 붙이면 되겠다고 생각해 두 번 시도했고, **둘 다 실측으로 0건이었다**:
 *
 *   ① explainItem(8종) — 그 8종은 TEXTBOOK_ONLY_DCP_TYPES 와 정확히 같다.
 *      화면에 절대 안 나가는 유형이라 플레이어에는 한 건도 안 닿는다.
 *      (인쇄물 기준 22,000건을 덮는다는 수를 화면 기준으로 착각했다 —
 *       비율·범위를 적을 때는 **어느 모집단인지**를 먼저 못 박아야 한다.)
 *   ② 이음매 해설기(order·insert) — 화면이 그리는 유형은 맞다. 그런데 해설이 없는
 *      **62건 전부**(order 31 · insert 31)를 규칙이 거부한다. hasCitationResidue 같은
 *      안전장치에 걸리는 지문들이라 거부가 옳다.
 *
 * 즉 화면의 해설 공백은 210,462건 중 **62건(0.03%)** 이고, 그 62건은 규칙으로 못 메운다.
 * 고치려면 지문의 인용 잔해를 상류에서 걷거나 그 문항을 연습에서 빼야 한다 —
 * 클라이언트 대체 코드로는 안 된다(번들만 늘고 0건을 덮는다).
 */

// ════════════════════════════════════════════════════════════
// 오늘 몫 — 「이미 푼 것」을 빼는 규칙
//
// (바로 위 블록은 어떤 함수의 문서도 아니다 — 되돌린 시도의 기록이다.)
// ════════════════════════════════════════════════════════════

/**
 * `prescribe_today` 가 오늘 몫을 고정하는 경계 — **UTC 자정**.
 *
 * RPC 본문이 `ORDER BY md5(i.id::text || current_date::text)` 로 5문항을 고르고 DB
 * 타임존은 UTC 다(실측 2026-09-06). 그러니 "오늘 이미 풀었나" 도 **같은 경계**로 물어야
 * 한다 — 이 저장소가 다른 곳에서 쓰는 KST 자정으로 물으면 09:00 KST 이전에는 처방은
 * 어제 것인데 시도만 오늘로 새로 세어, 방금 푼 문항이 다시 나온다. 경계가 둘이면 어긋난다.
 */
export function utcDayStartIso(now: number = Date.now()): string {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * 오늘 이미 시도한 문항을 뺀 나머지.
 *
 * ⚠️ **`prescribe_today` 는 시도를 보지 않는다** — practice 블록에 `csat_item_attempts`
 *   참조가 없다(본문 실측 2026-09-06). 그래서 다 풀고 나갔다 돌아오면 **같은 5문항이
 *   1번부터 다시** 나왔고, 중간에 이탈하면 이미 푼 것을 또 풀어 같은 날 중복 attempt 가
 *   쌓였다. 근본 해결은 RPC 에 `NOT EXISTS` 를 더하는 것이지만(마이그레이션 필요),
 *   `csat_item_attempts` 는 소유자 RLS 라 앱에서 그대로 읽히므로 여기서 뺀다.
 */
export function remainingAfterAttempts<T extends { id: string }>(
  items: readonly T[],
  attemptedIds: readonly (string | null)[],
): T[] {
  const done = new Set(attemptedIds.filter((id): id is string => typeof id === 'string'))
  return items.filter((i) => !done.has(i.id))
}
