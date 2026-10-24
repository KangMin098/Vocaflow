// apps/web/src/lib/csat/judgment/evidence.ts
// 분석 문장 속 [u3] 참조를 원문 단위와 잇는다 — 해설의 낱말이 지문 어디에서 왔는지 화면에서 왕복하게 하는 기반.
import type { EvidenceUnit, JudgmentItem, RevealData } from './types'

export type TextPart = { kind: 'text'; text: string } | { kind: 'ref'; unitId: string; label: string; known: boolean }

const REF = /\[(u\d+)\]/g

/** 'A [u3] 가 B' → 텍스트·참조 조각. 원문에 없는 참조는 known=false 로 남겨 화면이 끊긴 링크를 만들지 않게 한다 */
export function splitRefs(text: string, units: EvidenceUnit[]): TextPart[] {
  const byId = new Map(units.map((u) => [u.id, u]))
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(REF)) {
    const at = m.index ?? 0
    if (at > last) parts.push({ kind: 'text', text: text.slice(last, at) })
    const u = byId.get(m[1])
    parts.push({ kind: 'ref', unitId: m[1], label: u ? `${u.n}번 문장` : m[1], known: Boolean(u) })
    last = at + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

/** 글 속 참조 단위 id — 등장 순서, 중복 없음, 원문에 있는 것만 */
export function refsOf(text: string | undefined, units: EvidenceUnit[]): string[] {
  if (!text) return []
  const ids = new Set(units.map((u) => u.id))
  return [...new Set([...text.matchAll(REF)].map((m) => m[1]))].filter((id) => ids.has(id))
}

/** sentence_index(1부터) → 단위 id */
export function unitsAtIndex(index: number[] | undefined, units: EvidenceUnit[]): string[] {
  if (!index) return []
  return index.map((n) => units.find((u) => u.n === n)?.id).filter((x): x is string => Boolean(x))
}

/**
 * 공개 자료가 이 문항·이 단위 판본에 대한 것인지 확인한다. 판본이 다르면 [u3] 이 다른 문장을 가리키므로
 * 근거 연결을 보여 주지 않는다(틀린 근거보다 근거 없음이 낫다).
 */
export function checkReveal(item: JudgmentItem, data: unknown): { ok: true; data: RevealData } | { ok: false; reason: 'version' | 'shape' } {
  const d = data as RevealData | null
  if (!d || typeof d !== 'object' || !Array.isArray(d.choices) || typeof d.answer !== 'number') return { ok: false, reason: 'shape' }
  if (d.id !== item.id || d.unitsVersion !== item.version.unitsVersion || d.analysisVersion !== item.version.analysisVersion) return { ok: false, reason: 'version' }
  if (d.answer < 1 || d.answer > item.choices.length || d.choices.length !== item.choices.length) return { ok: false, reason: 'shape' }
  return { ok: true, data: d }
}

/** 공개 전 props 에 정답을 확정하는 키가 섞였는지 — 정적 검증(D9)과 개발 경고가 함께 쓴다 */
export const ANSWER_KEYS = ['answer', 'answers', 'verdict', 'answerLocus', 'answer_locus', 'why_correct', 'correct', 'isCorrect'] as const
export function leakedAnswerKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leakedAnswerKeys(v, `${path}[${i}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => [
    ...((ANSWER_KEYS as readonly string[]).includes(k) ? [`${path}.${k}`] : []),
    ...leakedAnswerKeys(v, `${path}.${k}`),
  ])
}
