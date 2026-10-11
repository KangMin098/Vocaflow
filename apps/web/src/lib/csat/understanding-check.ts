// apps/web/src/lib/csat/understanding-check.ts
//
// **이해 확인 과제 — 해설을 읽은 뒤 관계를 다시 짚는다**(지시문 §9 · M4, 2026-10-11).
//
// 정답 번호를 다시 고르게 하지 않는다. 검수된 분석에서 **판정 가능한 관계**만 과제로 만든다 — 새로 생성하는 내용은 없다.
//   ① 근거 자리 찾기 — 지문 지도에서 정답 근거 문장을 고른다. 근거가 여럿이면 그중 무엇이든 맞다(복수 근거 허용).
//   ② 바뀐 성분 고르기 — 오답 하나가 지문에서 무엇을 바꿨는지 닫힌 함정 라벨표(분석 드레인 _PROMPT §1-b)에서 고른다.
//      선택≠참거짓 유형의 부정형 발문은 오답이 맞는 진술이라 이 과제를 만들지 않는다(`distractorsAreTrue`).
//
// 이 화면은 해설이 열린 뒤에 과제를 낸다 — 기록은 늘 「설명 후 수행」(독립 수행 아님)이다.

import { distractorsAreTrue } from './teaching-contract'

/** 선지가 문장 · 구인 유형의 함정 라벨(§1-b A) */
export const PROPOSITION_TRAPS = ['범위 과대', '범위 과소', '인과 역전', '주체 역전', '부분 사실', '어휘 함정', '지문 밖 상식', '반대 진술', '무관'] as const
/** 선지가 위치 · 순열 기호인 유형의 함정 라벨(§1-b B) */
export const POSITION_TRAPS = ['첫 등장 위반', '지시어 선행사 절단', '지시어 선행사 앞당김', '연결사 방향 충돌', '열거·병렬 절단', '총론-각론 역전', '조건-귀결 절단', '시간·인과 순서 역전', '어휘 반복 유인', '마무리 문장 위치 오판'] as const

const POSITION_TYPES = new Set(['R-INSERT', 'R-ORDER', 'R-IRRELEVANT', 'X-ORDER'])

/** 라벨마다 학습자에게 보일 한 줄 풀이 — 라벨 이름만으로는 뜻이 안 잡힌다 */
export const TRAP_GLOSS: Record<string, string> = {
  '범위 과대': '지문보다 넓게 말한다',
  '범위 과소': '지문보다 좁게 말한다',
  '인과 역전': '원인과 결과를 뒤집는다',
  '주체 역전': '행위는 같은데 하는 사람이 바뀐다',
  '부분 사실': '지문의 일부만 옮기고 결론이 빠진다',
  '어휘 함정': '지문 낱말을 빌려 다른 뜻으로 쓴다',
  '지문 밖 상식': '지문에 없는 상식을 근거로 삼는다',
  '반대 진술': '지문과 방향이 반대다',
  무관: '지문 내용과 관계가 없다',
  '첫 등장 위반': '처음 나오는 것을 이미 나온 것처럼 놓는다',
  '지시어 선행사 절단': '지시어가 받을 말과 떨어진다',
  '지시어 선행사 앞당김': '받을 말보다 지시어가 먼저 온다',
  '연결사 방향 충돌': '연결어의 방향과 앞뒤 내용이 어긋난다',
  '열거·병렬 절단': '나열이나 짝이 중간에 끊긴다',
  '총론-각론 역전': '일반 진술과 사례의 순서가 뒤집힌다',
  '조건-귀결 절단': '조건과 그 결과가 떨어진다',
  '시간·인과 순서 역전': '일어난 순서나 인과 순서가 뒤집힌다',
  '어휘 반복 유인': '겹치는 낱말이 단서가 아니라 미끼다',
  '마무리 문장 위치 오판': '마무리 문장을 엉뚱한 자리에 둔다',
}

export interface EvidenceCheck {
  kind: 'evidence'
  /** 지도 막대 수(0-기반 문장 k 를 고른다) */
  sentenceCount: number
  /** 정답 근거 문장들(0-기반) — 이 중 하나를 고르면 맞다 */
  correct: number[]
}
export interface LureCheck {
  kind: 'lure'
  choice: number
  /** 보기 넷(정답 라벨 포함) — 문항 id 로 정해지는 순서라 다시 열어도 같다 */
  options: string[]
  correct: string
}
export type UnderstandingCheck = EvidenceCheck | LureCheck

export interface CheckSource {
  id: string
  type_id: string | null | undefined
  distractors: { n: number; trap: string | null }[]
  /** 지도 막대 수 · 정답 근거 자리 — 지도가 없으면 null */
  map: { sentenceCount: number; answerSentences: number[] } | null
}

/** 문자열 → 0 이상 정수(결정적) — 보기 순서 · 고를 오답을 문항마다 고정한다(Math.random 금지: 다시 열면 바뀐다) */
function seedOf(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export function buildChecks(src: CheckSource): UnderstandingCheck[] {
  const out: UnderstandingCheck[] = []
  if (src.map && src.map.answerSentences.length > 0 && src.map.sentenceCount > 1) {
    out.push({ kind: 'evidence', sentenceCount: src.map.sentenceCount, correct: [...new Set(src.map.answerSentences)].sort((a, b) => a - b) })
  }
  if (!distractorsAreTrue(src.type_id, src.id)) {
    const table: readonly string[] = POSITION_TYPES.has(src.type_id ?? '') ? POSITION_TRAPS : PROPOSITION_TRAPS
    // 라벨표에 있는 라벨이 달린 오답만 — 표 밖 라벨(어법 유형의 새 라벨 등)로는 닫힌 보기를 만들 수 없다
    const candidates = src.distractors.filter((d) => d.trap && table.includes(d.trap.trim()))
    if (candidates.length) {
      const seed = seedOf(src.id)
      const pick = candidates[seed % candidates.length]
      const correct = pick.trap!.trim()
      const others = table.filter((t) => t !== correct)
      const chosen = [0, 1, 2].map((i) => others[(seed + i * 7) % others.length])
      const options = [...new Set([correct, ...chosen])]
      while (options.length < 4) options.push(others.find((t) => !options.includes(t))!)
      const rotate = seed % options.length
      out.push({ kind: 'lure', choice: pick.n, options: [...options.slice(rotate), ...options.slice(0, rotate)], correct })
    }
  }
  return out
}

/** 판정 — 근거는 복수 정답 중 하나면 맞다 */
export function judgeCheck(check: UnderstandingCheck, pick: number | string): boolean {
  return check.kind === 'evidence' ? check.correct.includes(Number(pick)) : pick === check.correct
}

/**
 * 다음 복습 간격(일) — 고정 3일 대신 이해 확인 결과로(M4 · 지시문 §9 「복습은 관계 재설명으로」).
 * 시도가 없으면 1일(확인하지 않은 관계는 빨리 다시), 모두 첫 시도에 맞혔으면 7일, 그 밖은 3일. 답을 열어 봤으면 1일.
 */
export function reviewDays(attempts: { kind: string; correct: boolean; tries: number; revealed: boolean }[]): 1 | 3 | 7 {
  if (!attempts.length) return 1
  const lastByKind = new Map<string, (typeof attempts)[number]>()
  for (const a of attempts) lastByKind.set(a.kind, a)
  const xs = [...lastByKind.values()]
  if (xs.some((a) => a.revealed || !a.correct)) return 1
  return xs.every((a) => a.tries === 1) ? 7 : 3
}
