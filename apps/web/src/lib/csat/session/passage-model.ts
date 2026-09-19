// apps/web/src/lib/csat/session/passage-model.ts
//
// **reflow 된 지문 + 우리 분석 → 문장마다 무엇이 붙는가.** 순수 함수(브라우저에서 돈다).
//
// 분석이 원문 **안**에 들어간다(지시문 A7). 그러려면 분석의 자리(골격 문장 번호 · 짧은 인용)를
// 학습자 PDF 에서 뽑은 문장에 다시 붙여야 한다. 두 가지 열쇠를 차례로 쓴다:
//   ① 인용문을 reflow 지문에서 직접 찾는다(`findQuote`) — 가장 정확하다(Gate 1: 99.5%)
//   ② 못 찾으면 골격 문장 번호를 길이열 정렬로 옮긴다(`align.ts`) — 문장 단위까지는 맞다
// 둘 다 실패한 앵커는 **조용히 버리지 않고** `unplaced` 로 돌려준다 — 화면이 카드 목록으로 보여 준다.

import { splitSentences } from '@/lib/csat/passage-skeleton'
import { findQuote } from '@/lib/csat/quote-match'
import { skeletonToReflow } from '@/lib/csat/reflow/align'

import type { RevealAnchor } from './reveal'

export type MarkKind = 'evidence' | 'reject' | 'tempt'

export interface SentenceMark {
  anchorId: string
  kind: MarkKind
  /** 오답 선지 번호(`reject:3` → 3). 정답 근거면 null */
  choice: number | null
  /** 문장 안 상대 구간 — 인용을 찾았을 때만. 없으면 문장 전체에 붙는다 */
  ranges: { start: number; end: number }[]
}

export interface PassageSentence {
  i: number
  text: string
  /** 이 문장이 대응하는 골격 문장 번호 — 강의 `anchor:sentence:k` */
  skeleton: number[]
  marks: SentenceMark[]
  /** 이 문장 앞에서 문단이 바뀌는가 */
  breakBefore: boolean
}

export interface PassageModel {
  sentences: PassageSentence[]
  /** 기호 선지(①~⑤가 본문에 박힌 유형) — 선지 번호 → 그 기호가 있는 문장 */
  symbolSentence: Record<number, number>
  /** 선지 번호 → 그 오답을 설명하는 자리(문장) */
  choiceSentence: Record<number, number>
  /** 어디에도 못 붙인 앵커 */
  unplaced: string[]
}

const CIRC = '①②③④⑤'

function kindOf(a: RevealAnchor): MarkKind {
  if (a.id === 'answer') return 'evidence'
  return a.from === 'tempt' ? 'tempt' : 'reject'
}

function choiceOf(id: string): number | null {
  const m = id.match(/^reject:(\d)$/)
  return m ? Number(m[1]) : null
}

export function buildPassageModel(passage: string, skeleton: { sentences: number[]; anchors: RevealAnchor[] } | null): PassageModel {
  const bounds = splitSentences(passage)
  const sentences: PassageSentence[] = bounds.map((b, i) => ({
    i,
    text: passage.slice(b.start, b.end),
    skeleton: [],
    marks: [],
    breakBefore: i > 0 && /\n\s*\n/.test(passage.slice(bounds[i - 1].end, b.start)),
  }))

  const symbolSentence: Record<number, number> = {}
  bounds.forEach((b, i) => {
    const t = passage.slice(b.start, b.end)
    for (let k = 0; k < CIRC.length; k += 1) if (t.includes(CIRC[k]) && symbolSentence[k + 1] === undefined) symbolSentence[k + 1] = i
  })

  const choiceSentence: Record<number, number> = {}
  const unplaced: string[] = []
  if (!skeleton) return { sentences, symbolSentence, choiceSentence, unplaced }

  const map = skeletonToReflow(
    skeleton.sentences,
    bounds.map((b) => b.end - b.start),
  )
  map.forEach((js, k) => {
    for (const j of js) sentences[j].skeleton.push(k)
  })

  for (const a of skeleton.anchors) {
    const kind = kindOf(a)
    const choice = choiceOf(a.id)
    const touched = new Map<number, { start: number; end: number }[]>()

    for (const q of a.quotes) {
      const hit = q ? findQuote(passage, q) : null
      if (!hit) continue
      bounds.forEach((b, i) => {
        const from = Math.max(hit.start, b.start)
        const to = Math.min(hit.end, b.end)
        if (from >= to) return
        const list = touched.get(i) ?? []
        list.push({ start: from - b.start, end: to - b.start })
        touched.set(i, list)
      })
    }
    if (!touched.size) {
      // 인용을 못 찾았다 — 골격 문장 번호를 옮긴다(구간 없이 문장 전체)
      for (const k of a.sentences) for (const j of map[k] ?? []) touched.set(j, [])
    }
    if (!touched.size) {
      unplaced.push(a.id)
      continue
    }
    for (const [i, ranges] of touched) sentences[i].marks.push({ anchorId: a.id, kind, choice, ranges })
    if (choice !== null && choiceSentence[choice] === undefined) choiceSentence[choice] = Math.min(...touched.keys())
  }

  return { sentences, symbolSentence, choiceSentence, unplaced }
}

/**
 * 문장 하나를 조각으로 — 밑줄 구간과 나머지. 겹치는 구간은 합친다.
 * 화면은 이 조각을 그대로 그린다(구간 안 = 밑줄).
 */
export function segmentsOf(s: PassageSentence, kinds: MarkKind[]): { text: string; marked: MarkKind | null }[] {
  const ranges = s.marks
    .filter((m) => kinds.includes(m.kind))
    .flatMap((m) => (m.ranges.length ? m.ranges : [{ start: 0, end: s.text.length }]).map((r) => ({ ...r, kind: m.kind })))
    .sort((a, b) => a.start - b.start)
  if (!ranges.length) return [{ text: s.text, marked: null }]
  const out: { text: string; marked: MarkKind | null }[] = []
  let at = 0
  for (const r of ranges) {
    const start = Math.max(r.start, at)
    if (start >= r.end) continue
    if (start > at) out.push({ text: s.text.slice(at, start), marked: null })
    out.push({ text: s.text.slice(start, r.end), marked: r.kind })
    at = r.end
  }
  if (at < s.text.length) out.push({ text: s.text.slice(at), marked: null })
  return out
}
