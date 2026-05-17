// packages/library-pipeline/src/analyze/cefr-detect.ts
// LCP v2.0 — CEFR 3중 합의 알고리즘
//
// 시그널 1: Vocab distribution (50%) — 80 percentile lemma의 CEFR
// 시그널 2: Flesch-Kincaid (30%) — readability score → CEFR 매핑
// 시그널 3: LLM judgment (20%) — gpt-4o-mini로 첫 chapter 1500자 판정

import Anthropic from '@anthropic-ai/sdk'
// @ts-expect-error: text-readability has no types
import readability from 'text-readability'

// CLAUDE.md §"Environment" — Haiku 4.5
const LLM_MODEL = 'claude-haiku-4-5-20251001'
// Claude Haiku 4.5 가격
const PRICE_INPUT_PER_M = 1.0
const PRICE_OUTPUT_PER_M = 5.0
import type { ChapterSegment, CefrLevel } from '../types'
import type { BookLemmaIndex } from './extract-lemmas'
import type { DictionaryEntry } from './lookup-enrich'

const CEFR_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export interface CefrDetectionResult {
  level: CefrLevel
  confidence: number
  signals: {
    vocab: CefrLevel
    readability: CefrLevel
    llm: CefrLevel | null
  }
  llmCost: number
}

export interface DetectCefrOptions {
  skipLlm?: boolean
}

export async function detectBookCefr(
  chapters: ChapterSegment[],
  index: BookLemmaIndex,
  entries: Map<string, DictionaryEntry>,
  options: DetectCefrOptions = {},
): Promise<CefrDetectionResult> {
  const vocab = detectByVocabDistribution(index, entries)
  const readabilityCefr = detectByReadability(chapters)
  const llmResult = options.skipLlm
    ? { level: null, cost: 0 }
    : await detectByLlm(chapters)

  return aggregate(
    {
      vocab,
      readability: readabilityCefr,
      llm: llmResult.level,
    },
    llmResult.cost,
  )
}

// ─── Signal 1: vocab distribution ───
function detectByVocabDistribution(
  index: BookLemmaIndex,
  entries: Map<string, DictionaryEntry>,
): CefrLevel {
  const cefrCounts: Record<CefrLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  }
  let totalKnown = 0

  for (const [lemma, freq] of index.bookFrequency) {
    const entry = entries.get(lemma)
    const level = entry?.cefr_level as CefrLevel | undefined
    if (level && CEFR_ORDER.includes(level)) {
      cefrCounts[level] += freq
      totalKnown += freq
    }
  }

  if (totalKnown === 0) return 'B1'

  // 80 percentile 도달 CEFR
  let cumulative = 0
  for (const level of CEFR_ORDER) {
    cumulative += cefrCounts[level]
    if (cumulative / totalKnown >= 0.8) {
      return level
    }
  }
  return 'C2'
}

// ─── Signal 2: Flesch-Kincaid ───
function detectByReadability(chapters: ChapterSegment[]): CefrLevel {
  // chapter별 앞 5000자만 sample (대형 책 전체 측정은 느림)
  const sample = chapters.map((ch) => ch.content.slice(0, 5000)).join('\n\n')

  const fre = readability.fleschReadingEase(sample) as number

  // Flesch Reading Ease → CEFR 매핑
  // 참고: A1≈90+, A2≈80, B1≈70, B2≈55+, C1≈40+, C2≈40-
  if (fre >= 90) return 'A1'
  if (fre >= 80) return 'A2'
  if (fre >= 70) return 'B1'
  if (fre >= 55) return 'B2'
  if (fre >= 40) return 'C1'
  return 'C2'
}

// ─── Signal 3: LLM (Claude Haiku 4.5) ───
async function detectByLlm(
  chapters: ChapterSegment[],
): Promise<{ level: CefrLevel | null; cost: number }> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    console.warn('[cefr-detect] ANTHROPIC_API_KEY 미설정 — LLM 시그널 skip')
    return { level: null, cost: 0 }
  }

  const ch1 = chapters[0]
  if (!ch1) return { level: null, cost: 0 }

  const sample = ch1.content.slice(0, 1500)
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: 8,
      system:
        'You are a CEFR (Common European Framework) language level assessor.',
      messages: [
        {
          role: 'user',
          content: `Assess the CEFR level of this English text. Respond with ONLY one of: A1, A2, B1, B2, C1, C2. No explanation, no other text.\n\nText:\n${sample}`,
        },
      ],
    })

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const cost =
      (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
      (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return { level: null, cost }
    }
    const raw = textBlock.text.trim().toUpperCase()
    // 'A1' 같은 짧은 답을 그대로 받지만 가끔 'A1.' 또는 'Level: A1' 식 응답 대비 매칭
    const matched = raw.match(/\b(A1|A2|B1|B2|C1|C2)\b/)
    if (matched && matched[1]) {
      return { level: matched[1] as CefrLevel, cost }
    }
    return { level: null, cost }
  } catch (e) {
    console.warn('[cefr-detect] LLM judgment failed:', e)
    return { level: null, cost: 0 }
  }
}

// ─── Aggregation ───
function aggregate(
  signals: {
    vocab: CefrLevel
    readability: CefrLevel
    llm: CefrLevel | null
  },
  llmCost: number,
): CefrDetectionResult {
  const idx = (l: CefrLevel): number => CEFR_ORDER.indexOf(l)
  const v = idx(signals.vocab)
  const r = idx(signals.readability)
  const l = signals.llm ? idx(signals.llm) : null

  // 가중 평균
  let weightSum = 0.5 + 0.3
  let weightedIdx = v * 0.5 + r * 0.3
  if (l !== null) {
    weightedIdx += l * 0.2
    weightSum += 0.2
  }
  const avgIdx = Math.round(weightedIdx / weightSum)
  const finalLevel = CEFR_ORDER[Math.max(0, Math.min(5, avgIdx))]!

  // Confidence
  const diffs = [Math.abs(v - r)]
  if (l !== null) {
    diffs.push(Math.abs(v - l), Math.abs(r - l))
  }
  const maxDiff = Math.max(...diffs)

  let confidence: number
  if (maxDiff === 0) confidence = 0.95
  else if (maxDiff === 1) confidence = 0.8
  else if (maxDiff === 2) confidence = 0.65
  else confidence = 0.5

  return {
    level: finalLevel,
    confidence,
    signals,
    llmCost,
  }
}
