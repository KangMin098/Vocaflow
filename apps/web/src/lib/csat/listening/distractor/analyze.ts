// apps/web/src/lib/csat/listening/distractor/analyze.ts
//
// I6 부분 일치 오답 분석. 선지마다 (1) 발화에서 글자 그대로 들린 낱말·구 (2) 계약 근거(evidence·rationale)가
// 반박하거나 묻지 않은 부분 (3) 함정 유형을 결정적으로 계산한다. 시계·DB·LLM 을 읽지 않는다.
// 함정 유형 이름은 `../pedagogy.ts` 의 DistractorPattern 을 그대로 쓴다.
//
// 한계: 겹침은 글자 겹침이다. 한국어 선지와 영어 발화는 숫자·로마자 고유명사만 겹친다(번역 대응은 하지 않는다).

import type { ChoiceNo, ChoiceVerdict, EvidenceSpan, ListeningItem } from '../types'
import { LISTENING_PEDAGOGY, type DistractorPattern, type ListeningPedagogyTypeId } from '../pedagogy'
import { isNumericNorm, tokenize, type Token } from './normalize'

export interface UtteranceSpan {
  utteranceId: string
  charStart: number
  charEnd: number
}

export interface ChoiceTokenAnalysis extends Token {
  /** 이 낱말이 들린 자리(내용어만 · 없으면 빈 배열) */
  heardAt: UtteranceSpan[]
}

export interface HeardPhrase {
  /** 선지 안의 [charStart, charEnd) */
  charStart: number
  charEnd: number
  text: string
  /** 연속으로 들린 발화 자리(낱말 2개 이상이면 구) */
  at: UtteranceSpan
  words: number
}

export interface ConflictSpan extends UtteranceSpan {
  evidenceId: string
  text: string
  kind: 'refutes' | 'contrast'
}

export interface ChoiceAnalysis {
  choice: ChoiceNo
  text: string
  isAnswer: boolean
  verdict: ChoiceVerdict | null
  tokens: ChoiceTokenAnalysis[]
  phrases: HeardPhrase[]
  /** 들린 내용어 / 전체 내용어 (내용어가 없으면 0) */
  heardRatio: number
  /** 들리지 않은 내용어 원문 */
  unheardWords: string[]
  /** 이 선지를 반박하는 근거 구간 */
  conflicts: ConflictSpan[]
  /** 묻지 않은 것(언급은 됐으나 질문 대상이 아님) 또는 아예 나오지 않은 것 */
  unasked: 'mentioned-not-asked' | 'not-mentioned' | null
  pattern: DistractorPattern | null
  /** 판정 사유(어떤 규칙이 골랐는지) — 화면 보조 문구 */
  patternReason: string | null
  /** 이 유형의 교수 설계가 예상하는 함정인가 */
  patternExpected: boolean
}

const TIMING_RE = /\b(already|yesterday|tomorrow|tonight|before|after|later|next|last|now|soon|until|by then|earlier)\b|이미|어제|내일|오늘|나중|먼저|다음|지난|미리|벌써/i

export function pedagogyTypeOf(item: Pick<ListeningItem, 'typeId' | 'itemNo'>): ListeningPedagogyTypeId | null {
  if (item.typeId === 'L-RESPONSE') return item.itemNo <= 5 ? 'L-RESPONSE-SHORT' : 'L-RESPONSE-LONG'
  if (item.typeId === 'L-EMOTION') return null
  return item.typeId
}

export function expectedPatterns(item: Pick<ListeningItem, 'typeId' | 'itemNo'>): DistractorPattern[] {
  const t = pedagogyTypeOf(item)
  return t ? [...LISTENING_PEDAGOGY[t].distractorPatterns] : []
}

function heardTokens(choiceText: string, item: ListeningItem): { tokens: ChoiceTokenAnalysis[]; phrases: HeardPhrase[] } {
  const uttTokens = item.utterances.map((u) => ({ id: u.id, toks: tokenize(u.text) }))
  const tokens: ChoiceTokenAnalysis[] = tokenize(choiceText).map((t) => ({
    ...t,
    heardAt: t.content
      ? uttTokens.flatMap((u) => u.toks.filter((x) => x.norm === t.norm).map((x) => ({ utteranceId: u.id, charStart: x.charStart, charEnd: x.charEnd })))
      : [],
  }))

  // 구: 선지의 연속 토큰 i..j 가 한 발화의 연속 토큰 k..k+(j-i) 와 같은 최장 구간(내용어 1개 이상 포함)
  const phrases: HeardPhrase[] = []
  let i = 0
  while (i < tokens.length) {
    let best: { len: number; uid: string; s: Token; e: Token } | null = null
    for (const u of uttTokens) {
      for (let k = 0; k < u.toks.length; k++) {
        let len = 0
        while (i + len < tokens.length && k + len < u.toks.length && tokens[i + len].norm === u.toks[k + len].norm) len++
        if (len > 0 && tokens.slice(i, i + len).some((t) => t.content) && (!best || len > best.len)) {
          best = { len, uid: u.id, s: u.toks[k], e: u.toks[k + len - 1] }
        }
      }
    }
    if (best) {
      const a = tokens[i]
      const b = tokens[i + best.len - 1]
      phrases.push({
        charStart: a.charStart,
        charEnd: b.charEnd,
        text: choiceText.slice(a.charStart, b.charEnd),
        at: { utteranceId: best.uid, charStart: best.s.charStart, charEnd: best.e.charEnd },
        words: best.len,
      })
      i += best.len
    } else i++
  }
  return { tokens, phrases }
}

function conflictsFor(item: ListeningItem, choice: ChoiceNo, evidenceIds: string[]): ConflictSpan[] {
  const textOf = (e: EvidenceSpan) => item.utterances.find((u) => u.id === e.utteranceId)?.text.slice(e.charStart, e.charEnd) ?? ''
  return item.evidence
    .filter((e) => e.refutesChoices?.includes(choice) || (e.role === 'contrast' && evidenceIds.includes(e.id)))
    .map((e) => ({
      evidenceId: e.id,
      utteranceId: e.utteranceId,
      charStart: e.charStart,
      charEnd: e.charEnd,
      text: textOf(e),
      kind: e.refutesChoices?.includes(choice) ? ('refutes' as const) : ('contrast' as const),
    }))
}

function classify(
  verdict: ChoiceVerdict | null,
  tokens: ChoiceTokenAnalysis[],
  conflicts: ConflictSpan[],
  heardRatio: number,
): { pattern: DistractorPattern | null; reason: string | null } {
  if (verdict === null || verdict === 'correct') return { pattern: null, reason: null }
  if (verdict === 'reversed-role' || verdict === 'wrong-speaker') return { pattern: 'role-reversal', reason: '근거가 다른 사람의 일·말로 판정' }
  const conflictText = conflicts.map((c) => c.text).join(' ')
  const choiceNums = tokens.filter((t) => isNumericNorm(t.norm))
  const conflictNums = tokenize(conflictText).filter((t) => isNumericNorm(t.norm))
  if (choiceNums.length > 0 && conflictNums.length > 0) {
    const differs = choiceNums.some((c) => !conflictNums.some((n) => n.norm === c.norm))
    if (differs) return { pattern: 'numeric-calc-trap', reason: '선지의 수와 근거의 수가 다름' }
  }
  const choiceText = tokens.map((t) => t.raw).join(' ')
  if (TIMING_RE.test(conflictText) || TIMING_RE.test(choiceText)) {
    if (conflicts.length > 0) return { pattern: 'timing-trap', reason: '반박 근거나 선지에 시점 표지가 있음' }
  }
  if (verdict === 'not-mentioned') {
    return heardRatio > 0 ? { pattern: 'mentioned-not-asked', reason: '낱말은 들렸으나 묻는 대상이 아님' } : { pattern: null, reason: '대화에 나오지 않음' }
  }
  if (heardRatio > 0) return { pattern: 'partial-match', reason: '일부 낱말은 그대로 들렸으나 전체가 근거와 맞지 않음' }
  return { pattern: null, reason: '들린 낱말 없음' }
}

export function analyzeChoice(item: ListeningItem, choice: ChoiceNo): ChoiceAnalysis {
  const text = item.choices[choice - 1] ?? ''
  const rationale = item.rationales.find((r) => r.choice === choice) ?? null
  const verdict = rationale?.verdict ?? null
  const { tokens, phrases } = heardTokens(text, item)
  const content = tokens.filter((t) => t.content)
  const heard = content.filter((t) => t.heardAt.length > 0)
  const heardRatio = content.length === 0 ? 0 : heard.length / content.length
  const conflicts = conflictsFor(item, choice, rationale?.evidenceIds ?? [])
  const { pattern, reason } = classify(verdict, tokens, conflicts, heardRatio)
  const unasked: ChoiceAnalysis['unasked'] =
    verdict === 'not-mentioned' ? (heardRatio > 0 ? 'mentioned-not-asked' : 'not-mentioned') : pattern === 'mentioned-not-asked' ? 'mentioned-not-asked' : null
  return {
    choice,
    text,
    isAnswer: item.answer === choice,
    verdict,
    tokens,
    phrases,
    heardRatio,
    unheardWords: content.filter((t) => t.heardAt.length === 0).map((t) => t.raw),
    conflicts,
    unasked,
    pattern,
    patternReason: reason,
    patternExpected: pattern !== null && expectedPatterns(item).includes(pattern),
  }
}

export function analyzeItem(item: ListeningItem): ChoiceAnalysis[] {
  return ([1, 2, 3, 4, 5] as const).map((c) => analyzeChoice(item, c))
}
