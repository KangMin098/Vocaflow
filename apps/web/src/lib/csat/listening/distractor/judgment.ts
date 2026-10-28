// apps/web/src/lib/csat/listening/distractor/judgment.ts
//
// 학습자 판단(선지를 조각으로 자르고 「들은 부분 / 들리지 않은·틀린 부분」 표시 + 들은 조각을 발화에 연결)과
// 분석 결과 대조. 화면 상태만 다룬다 — 점수·숙달 산입·자유서술 평가를 하지 않는다.

import type { ChoiceNo } from '../types'
import { tokenize } from './normalize'
import type { ChoiceAnalysis } from './analyze'

export type SegmentLabel = 'heard' | 'unheard'

export interface ChoiceWord {
  text: string
  charStart: number
  charEnd: number
}

export interface JudgedSegment {
  /** 낱말 인덱스 [wordStart, wordEnd] (양끝 포함) */
  wordStart: number
  wordEnd: number
  label: SegmentLabel | null
  /** 들은 조각이 이어진 발화 id */
  utteranceId: string | null
}

export interface DistractorJudgment {
  choice: ChoiceNo
  segments: JudgedSegment[]
}

/** 선지를 공백 단위 낱말로 나눈다(자르기 단위) */
export function choiceWords(text: string): ChoiceWord[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({ text: m[0], charStart: m.index ?? 0, charEnd: (m.index ?? 0) + m[0].length }))
}

/** cuts: 「낱말 i 뒤에서 자른다」 인덱스 집합 → 조각. 기존 조각의 표시는 시작 낱말이 같으면 유지 */
export function segmentsFromCuts(wordCount: number, cuts: readonly number[], prev: readonly JudgedSegment[] = []): JudgedSegment[] {
  if (wordCount === 0) return []
  const sorted = [...new Set(cuts)].filter((c) => c >= 0 && c < wordCount - 1).sort((a, b) => a - b)
  const out: JudgedSegment[] = []
  let start = 0
  for (const c of [...sorted, wordCount - 1]) {
    const old = prev.find((p) => p.wordStart === start && p.wordEnd === c)
    out.push({ wordStart: start, wordEnd: c, label: old?.label ?? null, utteranceId: old?.utteranceId ?? null })
    start = c + 1
  }
  return out
}

/** 모든 조각에 표시가 있고, 들은 조각은 발화에 연결됐는가 */
export function judgmentComplete(j: DistractorJudgment): boolean {
  return j.segments.length > 0 && j.segments.every((s) => s.label !== null && (s.label === 'unheard' || s.utteranceId !== null))
}

export interface SegmentComparison {
  segment: JudgedSegment
  text: string
  /** 분석: 이 조각 안 내용어가 하나라도 그대로 들렸는가(내용어가 없으면 null) */
  analysisHeard: boolean | null
  /** 분석이 이 조각의 낱말을 찾은 발화 id */
  analysisUtteranceIds: string[]
  /** 이 조각이 반박 근거와 같은 발화에 걸치는가 */
  touchesConflict: boolean
  labelAgrees: boolean | null
  /** 들은 조각의 연결이 분석의 발화 중 하나와 같은가(들은 조각이 아니면 null) */
  linkAgrees: boolean | null
}

export function compareJudgment(j: DistractorJudgment, analysis: ChoiceAnalysis): SegmentComparison[] {
  const words = choiceWords(analysis.text)
  const toks = analysis.tokens
  return j.segments.map((s) => {
    const from = words[s.wordStart]?.charStart ?? 0
    const to = words[s.wordEnd]?.charEnd ?? 0
    const inSeg = toks.filter((t) => t.content && t.charStart >= from && t.charEnd <= to)
    const ids = [...new Set(inSeg.flatMap((t) => t.heardAt.map((h) => h.utteranceId)))]
    const analysisHeard = inSeg.length === 0 ? null : inSeg.some((t) => t.heardAt.length > 0)
    const conflictUtts = new Set(analysis.conflicts.map((c) => c.utteranceId))
    return {
      segment: s,
      text: analysis.text.slice(from, to),
      analysisHeard,
      analysisUtteranceIds: ids,
      touchesConflict: ids.some((id) => conflictUtts.has(id)),
      labelAgrees: analysisHeard === null || s.label === null ? null : (s.label === 'heard') === analysisHeard,
      linkAgrees: s.label === 'heard' && s.utteranceId ? ids.includes(s.utteranceId) : null,
    }
  })
}

/** 선지 낱말 수(토큰 기준이 아닌 자르기 단위) — 테스트·화면 공용 */
export function contentWordCount(text: string): number {
  return tokenize(text).filter((t) => t.content).length
}
