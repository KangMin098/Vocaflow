// apps/web/src/lib/csat/k-regression/__tests__/fixture.ts
// K 하네스 공용 — D 실제 기출 픽스처(개발 DB published 분석 · units 판본/해시 결속 13건)와 공개 자료 생성기.
import { FIXTURE_TYPES, itemsOf } from '@/lib/csat/judgment/fixtures'
import type { JudgmentItem, RevealData } from '@/lib/csat/judgment/types'

export const ALL = FIXTURE_TYPES.flatMap((t) => itemsOf(t).map((item) => ({ t, item })))

/** 5지선다 실제 픽스처 하나 — 없으면 테스트가 조용히 지나가지 않게 던진다 */
export function fiveChoice(): JudgmentItem {
  const hit = ALL.find(({ item }) => item.choices.length === 5)?.item
  if (!hit) throw new Error('5지선다 픽스처 없음')
  return hit
}

/** 판본이 맞는 정상 공개 자료(정답 1번) — 각 테스트가 한 칸만 바꿔 쓴다 */
export const reveal = (item: JudgmentItem, o: Partial<RevealData> = {}): RevealData => ({
  id: item.id,
  analysisVersion: item.version.analysisVersion,
  unitsVersion: item.version.unitsVersion,
  unitsHash: item.version.unitsHash,
  answer: 1,
  choices: item.choices.map((_, i) => (i === 0 ? { n: 1, verdict: 'correct' as const, why_correct: 'x' } : { n: i + 1, verdict: 'distractor' as const })),
  ...o,
})

/** 객체의 문자열 값(키 포함) 어디에 text 가 들어 있는가 — 직렬화 이스케이프와 무관하게 값 그대로 비교한다 */
export function containsText(value: unknown, text: string): boolean {
  if (typeof value === 'string') return value.includes(text)
  if (Array.isArray(value)) return value.some((v) => containsText(v, text))
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => k.includes(text) || containsText(v, text))
  return false
}

/** 정답 번호와 별개로 verdict=correct 를 줄 선지 번호들 */
export const withCorrect = (item: JudgmentItem, answer: number, correct: number[]): RevealData =>
  reveal(item, {
    answer,
    choices: item.choices.map((_, i) => (correct.includes(i + 1) ? { n: i + 1, verdict: 'correct' as const, why_correct: 'x' } : { n: i + 1, verdict: 'distractor' as const })),
  })
