// apps/web/src/lib/learner/dcp.ts
//
// CTP DCP(구문 연습) 공용 타입 + error_cause 정적 매핑 (client·server 공용, 'use server' 아님).
// 문항 계약은 packages/library-pipeline generate-items.ts 와 DB grade_dcp_item 에 정합:
//   order  : payload.presented(셔플 문장) · 제출 {order:[배열한 presented 인덱스]} (각 presented[k]를 원래 위치로)
//   insert : payload.{remaining, insert_sentence, gap_count} · 제출 {position:슬롯 0..remaining.length}
//   선택지 9종 : payload.{passage, choices[5], stem_ko, …} · 제출 {choice:1..5}

import { explainItem } from '@vocaflow/library-pipeline/explain-items'

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

/** grade_dcp_item 반환. 오답이면 answerKey 동봉(정답 공개용). */
export interface DcpGradeResult {
  correct: boolean
  attemptId: string | null
  /** order: {source_order} / insert: {position} / 선택지: {answer:1..5, rationale_ko} / 정답이면 null */
  answerKey: Record<string, unknown> | null
}

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
 * 학습자에게 보여 줄 해설 — **저장된 것이 없으면 규칙으로 쓴다.**
 *
 * ── 왜 필요한가 (실측 2026-09-01) ─────────────────────────────────
 * 해설은 세 곳에서 온다: 배치가 쓴 `explanation_ko`·`rationale_ko`, 그리고 유형별
 * **규칙 해설기**(`explainItem`). 조판기(`render-volume.mjs`)는 2026-08-31 에 세 번째를
 * 배선했고 V7 한 권이 49/60 → 60/60 이 됐다. **그런데 웹 학습 화면은 안 고쳐졌다** —
 * `explainItem` 은 `apps/web` 어디에서도 불리지 않았다(grep 실측).
 *
 * 그 결과 같은 문항이 **인쇄물에는 해설이 있고 화면에는 없었다**:
 *   · 저장된 해설 94.8% · 규칙이 채우는 몫 5.1%p
 *   · 저장 없는 22,062문항이 전부 V7 에 몰려 있다(고3/수능 — 해설이 가장 필요한 계단)
 * `market-benchmark` 의 A1 은 "학습자가 받는 100.0%" 라고 찍고 있었는데, 그 100% 는
 * **조판 경로에서만** 참이었다. 이 함수가 그 말을 화면에서도 참으로 만든다.
 *
 * ⚠️ 규칙이 **먼저가 아니다.** 저장된 해설이 있으면 그것을 쓴다 — 배치·생성형이 쓴 것이
 *    글을 읽고 쓴 것이라 규칙보다 낫다. 규칙은 빈자리만 메운다.
 * ⚠️ 규칙이 못 쓰는 유형(`explainItem` 이 null)은 **그대로 null 이다.** 빈 문자열이나
 *    "해설 없음" 을 지어내지 않는다 — 없는 것을 있는 척하면 이 저장소가 계속 싸워 온 그 거짓이 된다.
 */
export function explanationFor(
  item: Pick<DcpItem, 'type' | 'payload'> | null | undefined,
  answerKey: Record<string, unknown> | null | undefined,
): string | null {
  const stored = pickExplanationText(answerKey)
  if (stored) return stored
  if (!item) return null
  // `explainItem` 은 배럴이 아니라 서브패스로 가져온다 — 배럴은 supabase·anthropic·xlsx 를 끌고 온다.
  const rule = explainItem(item.type, item.payload as never, (answerKey ?? {}) as never)
  return typeof rule?.ko === 'string' && rule.ko.trim() ? rule.ko.trim() : null
}
