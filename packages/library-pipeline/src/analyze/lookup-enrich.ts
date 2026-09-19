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
  /** VRL v3 V-Level 0~11 (Korean learner roadmap) — null = unclassified. */
  v_level: number | null
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
      .select(
        'word, meaning_ko, cefr_level, pos, example_en, frequency_rank, list_tags, v_level',
      )
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
      // ⚠️ 이 숫자를 "사전 구멍" 으로 읽지 말 것 — 2026-08-19 에 실제로 그렇게 오독했다.
      //   여기 miss 는 **정확 일치** 실패다. 학습자 경로는 `resolve_dict_headword` 로
      //   굴절·철자 변이를 푼다(실측 43편: 정확 일치 64.2% → 해소 후 95.6%).
      //   진짜 빠진 낱말은 `scripts/dict/drain-article-lemmas.mjs --export` 로 센다.
      console.warn(
        `[lookup-enrich] ANTHROPIC_API_KEY 미설정 — 정확 일치 miss ${missing.length}개 skip ` +
          `(대부분 굴절형이라 학습자 경로에서는 해소된다. 실제 갭은 drain-article-lemmas 로 확인)`,
      )
    } else {
      const { results, cost } = await enrichWithLlm(missing, apiKey)
      llmCost = cost

      // shared_dictionary 에 누적 INSERT
      //
      // ⚠️ 원래 `enrich_shared_dictionary` RPC 를 썼는데 **한 행도 넣은 적이 없었다.**
      //   RPC 본문이 `source='lcp_llm'` 을 하드코딩하는데(20260508120200), 그 나흘 전에
      //   생긴 `shared_dictionary_source_check`(20260504160708)가 그 값을 금지한다.
      //   아래 catch 가 `console.warn` 이라 103일 동안 조용히 흘러갔다.
      //   RPC 를 고치려면 마이그레이션이 필요하므로, 제약이 허용하는 값으로 직접 넣는다 —
      //   Claude Code 드레인(`scripts/dict/drain-article-lemmas.mjs`)과 **같은 표기**다.
      if (results.length > 0) {
        const { data: inserted, error: insErr } = await client
          .from('shared_dictionary')
          .upsert(
            results.map((r) => ({
              word: r.word,
              meaning_ko: r.meaning_ko,
              cefr_level: r.cefr_level || null,
              pos: r.pos || null,
              example_en: r.example_en || null,
              source: 'ai-generated',
              verified: false,
            })),
            { onConflict: 'word', ignoreDuplicates: true },
          )
          .select('word')
        if (insErr) {
          // 이제는 삼키지 않는다 — 되돌려 넣기가 실패하면 다음 글에서 또 돈을 쓴다.
          throw new Error(
            `shared_dictionary 보강 INSERT 실패: ${insErr.message} ` +
              `(source/cefr_level/pos 제약을 먼저 확인할 것)`,
          )
        }
        enrichedCount = inserted?.length ?? 0
      }

      // 결과 map 에 통합
      for (const r of results) {
        entries.set(r.word, {
          word: r.word,
          meaning_ko: r.meaning_ko,
          cefr_level: r.cefr_level,
          pos: r.pos,
          example_en: r.example_en,
          // LLM enrichment 단계에서는 NGSL rank/list_tags/v_level 미생성
          // — Phase 14.1/14.5 batch import 또는 VRL v3 후속 분류로 채워짐
          frequency_rank: null,
          list_tags: [],
          v_level: null,
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
