// apps/web/src/lib/csat/inquiry/interactive-34.ts
// 저장된 의미/선지 관계만 탐색한다. 선택은 채점·학습기록·숙달 판정이 아니다.
import type { InquiryV3 } from './labels'

export type InquiryResourceState = 'NO_DATA' | 'STALE' | 'HELD_CONTENT_APPROVAL' | 'VERIFICATION_FAILED' | 'NO_PERMISSION' | 'UNREGISTERED'
export const RESOURCE_STATE_TEXT: Record<InquiryResourceState, string> = {
  NO_DATA: '공개된 분석 자료가 없어요.',
  STALE: '이전 공개 분석을 표시 중이에요. 새 판은 검수 중입니다.',
  HELD_CONTENT_APPROVAL: '자료가 있지만 내용 승인이 보류되어 있어요.',
  VERIFICATION_FAILED: '자료 결속을 확인하지 못했어요. 근거 강조를 제공하지 않아요.',
  NO_PERMISSION: '이 자료를 볼 권한이 없어요.',
  UNREGISTERED: '이 연결은 등록되어 있지 않아요.',
}

export function meaningsForChoice(v3: InquiryV3, n: number) {
  const ids = v3.choices.find((c) => c.n === n)?.meaning_ids ?? []
  return v3.meanings.filter((m) => ids.includes(m.id))
}

export function choicesForMeaning(v3: InquiryV3, id: string) {
  if (!v3.meanings.some((m) => m.id === id)) return []
  return v3.choices.filter((c) => c.meaning_ids?.includes(id))
}

/** 한국어 분석에 이미 인용된 완성 명제만 분리한다. 공식 영어 선지를 복원하지 않는다. */
export function storedProposition(decisive: string): string | null {
  return /「([^」]+)」/.exec(decisive)?.[1] ?? null
}

/** 두 비교 칸은 독립 선택이며 중복은 허용하지 않는다. 세 번째 칸을 만들지 않는다. */
export function replaceComparison(pair: readonly [number, number], side: 0 | 1, n: number): [number, number] {
  if (pair[1 - side] === n) return [pair[1], pair[0]]
  return side === 0 ? [n, pair[1]] : [pair[0], n]
}
