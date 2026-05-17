// scripts/dict-fill/p4-enrich.ts
// LLM enrichment (Opus 4.7) for chunked dict-fill P4 targets.
//
// Reads each chunk under data/dict-fill/p4/chunks/ and writes a sibling
// enriched JSONL under data/dict-fill/p4/outputs/. Idempotent — skips
// any chunk whose output already exists.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// SUPABASE creds (unused here) live in root .env.local; ANTHROPIC_API_KEY lives in apps/web/.env.local.
loadDotenv({ path: resolve(__dirname, '../../.env.local') })
loadDotenv({ path: resolve(__dirname, '../../apps/web/.env.local'), override: false })

const INPUT_DIR = resolve(__dirname, '../../data/dict-fill/p4/chunks')
const OUTPUT_DIR = resolve(__dirname, '../../data/dict-fill/p4/outputs')
const MODEL = 'claude-opus-4-7'
const MAX_TOKENS = 16000

interface InputWord {
  word: string
  lemma_band: string
  frequency_band: string
  inflection_forms: string[]
}

const SYSTEM_PROMPT = `당신은 한국 영어 학습자를 위한 어휘 사전 편찬가입니다.
입력으로 영어 단어 리스트 (lemma + 굴절형 + 빈도 band) 를 받습니다.
각 단어의 다음 정보를 정확하고 한국 학습자에게 적합하게 작성합니다:

1. pos (품사): noun, verb, adjective, adverb, preposition, conjunction, pronoun, determiner, interjection, idiom, phrasal_verb 중 가장 일반적인 1개
2. meaning_ko: 간결하고 명확한 한국어 의미 (예: "버리다", "도착하다")
3. meanings_ko (다의어 배열): [{pos, sense_ko, sense_en, examples: [], register: 'neutral'}], 다의어면 2~5개 sense
4. example_en: 자연스러운 영어 예문 1개 (학습자 레벨 맞춤). lemma 자체 또는 굴절형이 포함될 것
5. ipa: 미국 발음 IPA (예: /əˈbændən/) — 반드시 /…/ 슬래시로 감쌀 것
6. synonyms: 2~5개 영어 동의어 lowercase (lemma/굴절형 제외)
7. antonyms: 0~3개 영어 반의어 (없으면 빈 배열)
8. cefr_level: A1/A2/B1/B2/C1/C2 중 1개 — lemma_band 정합:
   1k~2k → A1~B1, 3k~5k → B1~B2, 6k~9k → B2~C1
9. korean_learner_note: 한국 학습자가 자주 혼동/잘못 사용하는 경향 — 해당 시 한국어 한 문장, 없으면 null

출력 형식: 입력 단어 1개당 1줄의 JSON (JSONL). 주석/설명/마크다운/코드펜스 절대 추가 금지.`

interface OutputWord {
  word: string
  pos: string
  meaning_ko: string
  meanings_ko: unknown
  example_en: string
  ipa: string
  synonyms: string[]
  antonyms: string[]
  cefr_level: string
  korean_learner_note: string | null
}

async function enrichChunk(client: Anthropic, words: InputWord[]): Promise<OutputWord[]> {
  const userPrompt = `다음 영어 단어들의 정보를 작성하세요. 출력은 JSONL (한 줄에 1단어).\n\n${words.map((w) => JSON.stringify(w)).join('\n')}`
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
  const lines = text.split('\n').filter((line) => line.trim().startsWith('{'))
  const out: OutputWord[] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as OutputWord
      if (parsed.word && parsed.meaning_ko) out.push(parsed)
    } catch {
      // skip malformed line
    }
  }
  return out
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ABORT: ANTHROPIC_API_KEY missing')
    process.exit(1)
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity
  const allFiles = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.jsonl')).sort()
  const chunkFiles = isFinite(limit) ? allFiles.slice(0, limit) : allFiles
  console.log(`Chunks to process: ${chunkFiles.length} / ${allFiles.length}`)

  let totalSuccess = 0
  let totalFail = 0
  let totalCost = 0

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkFile = chunkFiles[i]
    const outputFile = chunkFile.replace('.jsonl', '-output.jsonl')
    const outputPath = resolve(OUTPUT_DIR, outputFile)
    if (fs.existsSync(outputPath)) {
      console.log(`[${i + 1}/${chunkFiles.length}] skip (exists): ${chunkFile}`)
      continue
    }
    const inputPath = resolve(INPUT_DIR, chunkFile)
    const inputLines = fs.readFileSync(inputPath, 'utf-8').split('\n').filter((l) => l.trim())
    const inputWords: InputWord[] = inputLines.map((l) => JSON.parse(l) as InputWord)
    console.log(`[${i + 1}/${chunkFiles.length}] ${chunkFile} (${inputWords.length} words)…`)

    try {
      const results = await enrichChunk(client, inputWords)
      fs.writeFileSync(outputPath, results.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8')
      const success = results.length
      const fail = inputWords.length - success
      totalSuccess += success
      totalFail += fail
      totalCost += success * 0.05
      console.log(`  + ${success} ok, ${fail} fail`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ! error: ${msg}`)
      totalFail += inputWords.length
      if (/rate.?limit/i.test(msg)) {
        console.log('  waiting 60s for rate limit…')
        await new Promise((r) => setTimeout(r, 60_000))
      }
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }

  console.log(`\n=== Final ===`)
  console.log(`Success: ${totalSuccess}`)
  console.log(`Fail: ${totalFail}`)
  console.log(`Estimated cost: $${totalCost.toFixed(2)}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
