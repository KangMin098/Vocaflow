// packages/library-pipeline/src/analyze/lookup-enrich.ts
// LCP v2.0 — shared_dictionary lookup + Claude API enrichment

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DictionaryEntry {
  word: string
  meaning_ko: string | null
  cefr_level: string | null
  pos: string | null
  example_en: string | null
  /** NGSL global frequency rank (Phase 14.1) — lower = more common; null = not in NGSL 31K. */
  frequency_rank: number | null
  /** NGSL Project list memberships (Phase 14.5) — used by LV confidence weighting. */
  list_tags: string[]
}

export interface EnrichmentResult {
  entries: Map<string, DictionaryEntry>
  hitCount: number
  missCount: number
  llmCost: number
  enrichedCount: number
}

// CLAUDE.md §"Environment" — Haiku 4.5 모델 ID
const LLM_MODEL = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 50

// Claude Haiku 4.5 가격 (Anthropic 공시 기준 — 변동 시 환경변수로 분리 권장)
const PRICE_INPUT_PER_M = 1.0 // $1/M input tokens
const PRICE_OUTPUT_PER_M = 5.0 //         $5/M output tokens

export interface LookupOptions {
  /** ANTHROPIC_API_KEY 미설정 시 자동 skip (테스트 친화적) */
  skipLlm?: boolean
  /** Supabase IN 쿼리 한계 회피용 chunk 크기 (default 500) */
  lookupChunkSize?: number
}

/**
 * lemma 배열을 받아서:
 *  1) shared_dictionary bulk lookup (chunk 분할)
 *  2) miss 는 Claude Haiku 4.5 batch enrichment
 *  3) enriched 결과를 shared_dictionary 에 INSERT (다음 책에서 hit)
 */
export async function lookupAndEnrich(
  client: SupabaseClient,
  lemmas: string[],
  options: LookupOptions = {},
): Promise<EnrichmentResult> {
  const lookupChunkSize = options.lookupChunkSize ?? 500
  const lower = lemmas.map((l) => l.toLowerCase())
  const uniqueLower = [...new Set(lower)]

  // ① bulk lookup (chunk 분할 — Supabase IN 제약 회피)
  const entries = new Map<string, DictionaryEntry>()
  for (let i = 0; i < uniqueLower.length; i += lookupChunkSize) {
    const chunk = uniqueLower.slice(i, i + lookupChunkSize)
    const { data, error } = await client
      .from('shared_dictionary')
      .select('word, meaning_ko, cefr_level, pos, example_en, frequency_rank, list_tags')
      .in('word', chunk)
    if (error) {
      throw new Error(`shared_dictionary lookup failed: ${error.message}`)
    }
    for (const row of data ?? []) {
      entries.set(row.word as string, row as DictionaryEntry)
    }
  }

  const hitCount = entries.size
  const missing = uniqueLower.filter((w) => !entries.has(w))

  // ② LLM enrichment
  let llmCost = 0
  let enrichedCount = 0

  if (missing.length > 0 && !options.skipLlm) {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) {
      console.warn(
        `[lookup-enrich] ANTHROPIC_API_KEY 미설정 — ${missing.length}개 miss skip`,
      )
    } else {
      const { results, cost } = await enrichWithLlm(missing, apiKey)
      llmCost = cost

      // shared_dictionary 에 누적 INSERT
      if (results.length > 0) {
        const { data: inserted, error: rpcError } = await client.rpc(
          'enrich_shared_dictionary',
          { p_words: results },
        )
        if (rpcError) {
          console.warn(
            `[lookup-enrich] enrich_shared_dictionary failed: ${rpcError.message}`,
          )
        } else {
          enrichedCount = (inserted as number) ?? 0
        }
      }

      // 결과 map 에 통합
      for (const r of results) {
        entries.set(r.word, {
          word: r.word,
          meaning_ko: r.meaning_ko,
          cefr_level: r.cefr_level,
          pos: r.pos,
          example_en: r.example_en,
          // LLM enrichment 단계에서는 NGSL rank/list_tags 미생성 — Phase 14.1/14.5
          // batch import 또는 후속 hit lookup 으로 채워짐
          frequency_rank: null,
          list_tags: [],
        })
      }
    }
  }

  return {
    entries,
    hitCount,
    missCount: missing.length,
    llmCost,
    enrichedCount,
  }
}

interface LlmWordResult {
  word: string
  meaning_ko: string
  cefr_level: string
  pos: string
  example_en: string
}

async function enrichWithLlm(
  words: string[],
  apiKey: string,
): Promise<{ results: LlmWordResult[]; cost: number }> {
  const client = new Anthropic({ apiKey })
  const results: LlmWordResult[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const systemPrompt =
    'You are an English-Korean dictionary assistant. Return valid JSON only — no markdown fences, no explanations.'

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE)
    const userPrompt = buildPrompt(batch)

    try {
      const response = await client.messages.create({
        model: LLM_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens

      // text block 만 추출 (Anthropic 응답은 content blocks 배열)
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') continue
      const text = stripJsonFences(textBlock.text)

      const parsed = JSON.parse(text) as { words?: LlmWordResult[] }
      if (Array.isArray(parsed.words)) {
        // 검증: 요청한 단어만 받음 (LLM hallucination 방지)
        const requestedSet = new Set(batch)
        const valid = parsed.words.filter(
          (w) => w.word && requestedSet.has(w.word.toLowerCase()),
        )
        results.push(
          ...valid.map((w) => ({ ...w, word: w.word.toLowerCase() })),
        )
      }
    } catch (e) {
      console.warn(
        `[lookup-enrich] batch ${i}-${i + batch.length} failed:`,
        e,
      )
    }
  }

  const cost =
    (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_M

  return { results, cost }
}

/** Claude 가 가끔 ```json ... ``` markdown fence 로 감싸 응답 — 제거 */
function stripJsonFences(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')
  }
  return trimmed
}

function buildPrompt(words: string[]): string {
  return `Return a JSON object with key "words" containing dictionary entries for these English lemmas.

Words: ${JSON.stringify(words)}

For each word, provide:
- "word": the lemma in lowercase
- "meaning_ko": Korean meaning, concise, 1 line
- "cefr_level": exactly one of "A1","A2","B1","B2","C1","C2"
- "pos": part of speech in lowercase: "noun","verb","adjective","adverb","preposition","conjunction","pronoun","interjection"
- "example_en": short English example sentence using the word

Return format:
{"words": [{"word": "...", "meaning_ko": "...", "cefr_level": "...", "pos": "...", "example_en": "..."}, ...]}`
}
