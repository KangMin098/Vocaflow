// apps/web/src/lib/csat/ec-pilot/targets.ts
//
// 수집 대상 선정 · 증거 값 검증 — 순수 함수(서버 · 테스트 공용).
//   대상 = 오답 전부 + 설정의 정답 대조 수(세션 id 로 결정적 선택). 번호순으로 내보내 정오가 드러나지 않게 한다.
//   제외: 고른 답 없음 · 듣기(1–17) · 발문 · 선지 없음 · body_ok 거짓(csat_ec_pilot_eligible 과 같은 조건).

import { splitSentences } from '@/lib/csat/passage-skeleton'

export interface TargetCandidate {
  itemNo: number
  chosen: number | null
  isCorrect: boolean
  stem: string | null
  passage: string | null
  choices: string[] | null
  bodyOk: boolean
}

const LISTENING_LAST = 17

function eligible(c: TargetCandidate): boolean {
  return c.itemNo > LISTENING_LAST && c.chosen !== null && !!c.stem?.trim() && Array.isArray(c.choices) && c.choices.length > 0 && c.bodyOk
}

/** 문자열 → 0 이상 정수(결정적) — 정답 대조를 세션마다 고정해 다시 열어도 같은 문항이 나오게 */
function seeded(seed: string, n: number): number {
  let h = 2166136261
  for (const ch of `${seed}|${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

export function selectTargets(cands: TargetCandidate[], correctControls: number | null, seed: string): number[] {
  const ok = cands.filter(eligible)
  const wrong = ok.filter((c) => !c.isCorrect).map((c) => c.itemNo)
  const right = ok.filter((c) => c.isCorrect).map((c) => c.itemNo)
  const k = Math.max(0, Math.min(correctControls ?? 0, right.length))
  const controls = [...right].sort((a, b) => seeded(seed, a) - seeded(seed, b) || a - b).slice(0, k)
  return [...wrong, ...controls].sort((a, b) => a - b)
}

// ── 학생 범주(student_group) — 원인 라벨이 아니다. 저장은 kind 'category' 과정 증거 하나 ──
export const STUDENT_GROUPS = [
  { key: 'word', label: '단어 · 표현' },
  { key: 'sentence', label: '문장 해석' },
  { key: 'flow', label: '글의 흐름' },
  { key: 'evidence', label: '근거 찾기' },
  { key: 'choice', label: '문제 · 선지 판단' },
  { key: 'time', label: '시간 · 집중' },
  { key: 'unsure', label: '잘 모르겠어요' },
] as const
export type StudentGroup = (typeof STUDENT_GROUPS)[number]['key']
const GROUP_KEYS = new Set<string>(STUDENT_GROUPS.map((g) => g.key))

export type InterpretationState = 'answered' | 'unknown' | 'skipped'

/** 문장 단위 막힌 곳 — 지문은 문장, 발문 · 선지는 통째(문장 0) */
export function sentenceRanges(text: string | null, part: 'passage' | 'stem' | 'option'): { start: number; end: number }[] {
  if (!text) return []
  if (part !== 'passage') return text.trim() ? [{ start: 0, end: text.length }] : []
  return splitSentences(text).filter((r) => r.end > r.start && text.slice(r.start, r.end).trim().length > 0)
}

export type EvidenceInput =
  | { kind: 'reason'; text: string }
  | { kind: 'interpretation'; state: InterpretationState; text?: string }
  | { kind: 'category'; group: StudentGroup }
  | { kind: 'blocked_span'; part: 'passage' | 'stem' | 'option'; option: number | null; sentence: number }

/** 요청 본문 → 검증된 입력(아니면 null). 글은 앞뒤 공백을 지운다 */
export function parseEvidence(raw: unknown): EvidenceInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const text = typeof r.text === 'string' ? r.text.trim() : null
  switch (r.kind) {
    case 'reason':
      return text && text.length <= 500 ? { kind: 'reason', text } : null
    case 'interpretation':
      if (r.state === 'answered') return text && text.length <= 500 ? { kind: 'interpretation', state: 'answered', text } : null
      if (r.state === 'unknown' || r.state === 'skipped') return text ? null : { kind: 'interpretation', state: r.state }
      return null
    case 'category':
      return typeof r.group === 'string' && GROUP_KEYS.has(r.group) ? { kind: 'category', group: r.group as StudentGroup } : null
    case 'blocked_span': {
      const part = r.part
      if (part !== 'passage' && part !== 'stem' && part !== 'option') return null
      const option = part === 'option' ? r.option : null
      if (part === 'option' && !(Number.isInteger(option) && (option as number) >= 1 && (option as number) <= 5)) return null
      if (!Number.isInteger(r.sentence) || (r.sentence as number) < 0) return null
      return { kind: 'blocked_span', part, option: option as number | null, sentence: r.sentence as number }
    }
    default:
      return null
  }
}

/** 검증된 입력 → DB 값. 막힌 곳은 서버가 원문으로 문자 범위를 계산한다(학생이 보낸 범위를 믿지 않는다) */
export function evidenceValue(
  input: EvidenceInput,
  item: { itemId: string; stem: string | null; passage: string | null; choices: string[] | null },
): Record<string, unknown> | null {
  switch (input.kind) {
    case 'reason':
      return { text: input.text }
    case 'interpretation':
      return input.state === 'answered' ? { state: 'answered', text: input.text } : { state: input.state }
    case 'category':
      return { group: input.group }
    case 'blocked_span': {
      const text = input.part === 'passage' ? item.passage : input.part === 'stem' ? item.stem : item.choices?.[(input.option ?? 0) - 1] ?? null
      const r = sentenceRanges(text, input.part)[input.sentence]
      if (!r) return null
      return { item_id: item.itemId, part: input.part, option: input.option, sentence: input.sentence, start: r.start, end: r.end }
    }
  }
}
