// apps/web/src/lib/csat/reflow/crop-mark-view.ts
//
// **원본 크롭 위 밑줄 강조 — 무엇을 그리고 무엇을 말할지.** (v3 F08)
// 대응이 확실할 때만 사각형을 낸다. 아니면 그리지 않고 이유 한 줄(없는 범위를 만들지 않는다 · F08 수용 기준 3).
//   choice n → 기호: ①~⑤ 유형은 n 그대로. (a)~(e) 세트는 선지 n 의 글이 정확히 「(x)」 일 때만 x 의 순번(실제 선지 구조로 확인).
// 순수 함수 — 화면(ItemPaper)과 테스트가 같은 판정을 쓴다.

import type { CropMarks } from './read-paper'
import type { CropRect } from './paper-marks'

export type CropMarkRequest = { kind: 'choice'; n: number } | { kind: 'implied' }
export interface CropMarkView {
  rects: CropRect[]
  state: 'none' | 'shown' | 'unavailable'
  label: string | null
}

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

/** 선지 n → 지문 기호 순번. 세트는 선지 글이 「(a)」~「(e)」 그대로일 때만 */
export function markerOfChoice(marks: Pick<CropMarks, 'kind'>, n: number, choices: readonly string[]): number | null {
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  if (marks.kind === 'circled') return n
  if (marks.kind !== 'letters') return null
  const m = /^\(\s*([a-e])\s*\)$/.exec((choices[n - 1] ?? '').trim())
  return m ? m[1].charCodeAt(0) - 96 : null
}

export function cropMarkView(marks: CropMarks | null, req: CropMarkRequest | null, choices: readonly string[]): CropMarkView {
  if (!req) return { rects: [], state: 'none', label: null }
  const subject = req.kind === 'choice' ? `선지 ${CIRCLED[req.n] ?? req.n}` : '밑줄 친 어구'
  if (!marks) return { rects: [], state: 'unavailable', label: `${subject}의 원본 위치를 이 문제지에서 계산하지 못해 표시하지 않았어요.` }
  if (marks.itemIssues.includes('multi_page')) return { rects: [], state: 'unavailable', label: '여러 쪽에 걸친 문항이라 원본 위 위치는 아직 표시하지 않아요.' }
  if (req.kind === 'implied') {
    if (marks.kind !== 'none') return { rects: [], state: 'none', label: null }
    return marks.implied?.length
      ? { rects: marks.implied, state: 'shown', label: '밑줄 친 어구를 원본에 표시했어요.' }
      : { rects: [], state: 'unavailable', label: '밑줄 친 어구를 원본에서 하나로 정할 수 없어 표시하지 않았어요.' }
  }
  if (marks.kind === 'none') return { rects: [], state: 'none', label: null }
  const k = markerOfChoice(marks, req.n, choices)
  if (k === null) return { rects: [], state: 'unavailable', label: `${subject}이 지문의 어느 밑줄인지 선지 구조로 확인할 수 없어 표시하지 않았어요.` }
  const rects = marks.byMarker[k]
  if (rects?.length) return { rects, state: 'shown', label: `${subject}의 밑줄을 원본에 표시했어요.` }
  return {
    rects: [],
    state: 'unavailable',
    label: marks.issues[k] === 'ambiguous_underline'
      ? `${subject}의 밑줄을 하나로 정할 수 없어 표시하지 않았어요.`
      : `${subject}에 대응하는 밑줄을 원본에서 찾지 못해 표시하지 않았어요.`,
  }
}
