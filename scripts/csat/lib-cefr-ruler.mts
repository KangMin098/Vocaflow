// scripts/csat/lib-cefr-ruler.mts
//
// **지문 CEFR 을 적격 판정과 같은 자로 잰다 — 발췌 창 고르기 · 측정 스크립트가 함께 쓰는 정본 사본.**
//
// 정본은 `packages/library-pipeline/src/analyze/cefr-detect.ts` 다(DB 의 `cefr_level` 을 만든다):
//   신호 1 어휘(0.5) — lemma 빈도의 80 백분위 CEFR. **기능어·문장부호는 뺀다**(`extract-lemmas.ts` 와 같다).
//   신호 2 가독성(0.3) — Flesch Reading Ease → CEFR(90/80/70/55/40).
//   신호 3 LLM(0.2) — 여기서는 쓰지 않는다. 없으면 0.8 로 재정규화(정본 `aggregate` 와 같다).
// 실측 2026-09-24: 이 자가 PLOS 발췌본 DB 값을 **93% 재현**한다(`measure-band-rulers.mts`).
//
// ⚠️ 기능어를 **포함하면** 한 단계 낮게 나온다(기출 C1 17.8% → 0.6%). 기출 기준선과 DB 값을 서로 다른
//   자로 재어 「기출은 B2, 발췌본은 C1」처럼 보였던 사고가 있다 — 비교는 반드시 같은 자로 한다.
//   측정 목적으로 옛 자가 필요하면 `{ includeStopWords: true }`.

import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import type { SupabaseClient } from '@supabase/supabase-js'
import { processText } from '@vocaflow/wlp'

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Cefr = (typeof CEFR)[number]

const req = createRequire(resolve('packages/library-pipeline/package.json'))
const readabilityModule = req('text-readability')
const readability = readabilityModule.default ?? readabilityModule

export const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

/** 정본 `aggregate` 와 같은 가중·반올림(LLM 없음 → 0.8 재정규화). */
export const consensus = (vocab: Cefr, read: Cefr): Cefr => {
  const idx = (l: Cefr) => CEFR.indexOf(l)
  return CEFR[Math.max(0, Math.min(5, Math.round((idx(vocab) * 0.5 + idx(read) * 0.3) / 0.8)))]!
}

export type CefrMeasure = { level: Cefr; vocab: Cefr; read: Cefr; fre: number; hitRate: number }
export type Ruler = (text: string) => CefrMeasure

/** `shared_dictionary` 전량을 한 번 읽어 자를 만든다(약 5만 낱말 · 1,000행씩). */
export async function loadRuler(db: SupabaseClient, opts: { includeStopWords?: boolean } = {}): Promise<Ruler> {
  const dict = new Map<string, Cefr>()
  for (let from = ''; ; ) {
    let q = db.from('shared_dictionary').select('word, cefr_level').order('word').limit(1000)
    if (from) q = q.gt('word', from)
    const { data, error } = await q
    if (error) throw new Error(`사전 조회 — ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const level = row.cefr_level as string | null
      if (level && (CEFR as readonly string[]).includes(level)) dict.set(row.word as string, level as Cefr)
    }
    from = data.at(-1)!.word as string
    if (data.length < 1000) break
  }
  if (dict.size < 1000) throw new Error(`사전이 비었다(${dict.size}낱말) — 자를 만들 수 없다`)

  return (text: string): CefrMeasure => {
    const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
    let known = 0
    let seen = 0
    for (const token of processText(text).sentences.flatMap((s) => s.tokens)) {
      if (!opts.includeStopWords && (token.isStopWord || token.isPunctuation)) continue
      const lemma = (token.lemma ?? '').toLowerCase()
      if (!lemma || lemma.length < 2 || /\d/.test(lemma)) continue
      seen++
      const level = dict.get(lemma)
      if (!level) continue
      counts[level] += 1
      known += 1
    }
    let vocab: Cefr = 'B1' // 사전 적중이 0이면 정본과 같이 B1
    if (known) {
      let cum = 0
      vocab = 'C2'
      for (const level of CEFR) {
        cum += counts[level]
        if (cum / known >= 0.8) {
          vocab = level
          break
        }
      }
    }
    const fre = readability.fleschReadingEase(text) as number
    const read = byReadability(fre)
    return { level: consensus(vocab, read), vocab, read, fre, hitRate: known / Math.max(1, seen) }
  }
}
