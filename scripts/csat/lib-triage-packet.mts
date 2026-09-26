// scripts/csat/lib-triage-packet.mts
//
// **자동 단계(A) — 원문 한 편을 Claude 창 판정(B)용 「최소 정보 꾸러미」로 만든다. 버리지 않는다.**
//
// 설계(docs/source-check/criteria.md §13 · 2026-09-26 사용자 지시 「자동 + Claude, 최소 비용으로 내용 점검」):
//   A 자동 — 후보 창 3개(첫 창 + 정본 자로 잰 가장 쉬운 창 2개, 겹치지 않게) + 자동 지표
//   B Claude — 창만 읽고 보관/보류/폐기 + 칸 + **창마다 내용 판정**(보관 판정과 조각 내용 판정을 한 번에)
//   C Claude 전문 — B 의 보관이 아닌 것 · `escalate` 만 전문으로 다시(폐기는 되돌릴 수 없다)
//
// 창을 고르는 자는 발췌기와 같다(`lib-cefr-ruler`). 창 길이는 수능 지문 창 근처(약 220어).
// ⚠️ 창 선택은 **순서·표본**일 뿐이다 — 길이·난이도로 원문을 버리지 않는다(§0).
//
// 회차 4 검증(442편)에서 고친 것:
//   · 짧은 글(창 두 개 분량 이하)은 창으로 나누지 않고 **전문**을 준다 — 잘못 보관 3편이 모두 짧은 단신이었다.
//   · 숫자·기호가 빽빽한 창(표·방법 절)은 「쉬운 창」 후보에서 뺀다 — FRE 가 높게 나와 표가 뽑혔다(econstor · frontiers).

import { CEFR, type Ruler } from './lib-cefr-ruler.mts'

export const WINDOW_WORDS = 220
export const WINDOWS = 3
/** 이 어수 이하면 전문을 준다(창 두 개 분량). */
export const WHOLE_MAX_WORDS = WINDOW_WORDS * 2
/** 낱말 중 숫자·기호 토큰 비율이 이 이상이면 표·방법 절로 본다. */
export const NUMERIC_MAX = 0.12

const W = (s: string) => s.split(/\s+/).filter(Boolean)

/** 문장 나누기 — 약어에 너그럽게(판정자에게 보여 줄 창의 경계용이라 정밀할 필요는 없다). */
export function sentencesOf(text: string): string[] {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?]["”’)]?)\s+(?=[A-Z0-9"“‘(])|\n{2,}/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => W(s).length >= 3)
}

/** 숫자·기호 토큰 비율 — 영문자가 하나도 없는 토큰, 또는 숫자가 섞인 토큰. */
export function numericDensity(text: string): number {
  const toks = W(text)
  if (!toks.length) return 0
  return toks.filter((t) => !/[A-Za-z]/.test(t) || /\d/.test(t)).length / toks.length
}

export interface TriageWindow { s: number; e: number; words: number; cefr: string; fre: number; text: string; why: 'opening' | 'easiest' | 'whole' | 'fallback' }

/** 첫 창 + 가장 쉬운 창 두 개(겹치지 않게 · 표 같은 창 제외). 짧은 글은 전문 하나. 원문 순서로 돌려준다. */
export function pickWindows(text: string, ruler: Ruler, k = WINDOWS): TriageWindow[] {
  const all = W(String(text ?? ''))
  if (all.length <= WHOLE_MAX_WORDS) {
    const t = all.join(' ')
    const m = ruler(t)
    return [{ s: 0, e: 0, words: all.length, cefr: m.level, fre: m.fre, text: t, why: 'whole' }]
  }
  const sents = sentencesOf(text)
  const words = sents.map((s) => W(s).length)
  const cands: TriageWindow[] = []
  for (let s = 0; s < sents.length; s++) {
    let n = 0
    let e = s
    while (e < sents.length && n < WINDOW_WORDS) n += words[e++]!
    if (n < WINDOW_WORDS * 0.6) break
    const t = sents.slice(s, e).join(' ')
    if (s > 0 && numericDensity(t) >= NUMERIC_MAX) continue
    const m = ruler(t)
    cands.push({ s, e, words: n, cefr: m.level, fre: m.fre, text: t, why: s === 0 ? 'opening' : 'easiest' })
  }
  if (!cands.length) return [{ s: 0, e: 0, words: Math.min(700, all.length), cefr: '?', fre: 0, text: all.slice(0, 700).join(' '), why: 'fallback' }]
  const taken: TriageWindow[] = [cands[0]!]
  const rest = cands.slice(1).sort((a, b) => CEFR.indexOf(a.cefr as never) - CEFR.indexOf(b.cefr as never) || b.fre - a.fre)
  for (const c of rest) {
    if (taken.length >= k) break
    if (taken.every((t) => c.e <= t.s || c.s >= t.e)) taken.push(c)
  }
  return taken.sort((a, b) => a.s - b.s)
}
