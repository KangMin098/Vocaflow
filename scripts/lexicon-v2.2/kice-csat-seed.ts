// scripts/lexicon-v2.2/kice-csat-seed.ts
//
// Phase 4 — UPSERT (멱등)
// aggregated CSV → Supabase 3 테이블 적재
//
// 적재 순서 (FK 정합 필수):
//   1. word_lexicon UPSERT (lemma, part_of_speech)
//   2. lexicon_source_tags UPSERT (lexicon_id, 'kice_csat')
//   3. word_frequency_stats UPSERT (lexicon_id, source, year_from, year_to)  raw_count > 0 만
//
// 트리거가 자동 처리: frequency_tier, appears_every_year
//
// 핸드오프 §7.1 정정사항:
//   - source_id → data_source_id (v2.1 schema)
//   - onConflict: lexicon_id,source → lexicon_id,source,year_from,year_to
//
// CLI:
//   --dry-run    : 적재 시뮬레이션만 (실제 UPSERT X)
//   --commit     : 실적용
//   --limit N    : 처음 N row 만 처리 (smoke test)

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import * as fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const IN_FILE = 'data/import/kice-csat-aggregated.csv'
const BATCH_SIZE = 50

const ARGS = process.argv.slice(2)
const IS_COMMIT = ARGS.includes('--commit')
const IS_DRY_RUN = !IS_COMMIT
const LIMIT_ARG = ARGS.find(a => a.startsWith('--limit'))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1] ?? ARGS[ARGS.indexOf(LIMIT_ARG) + 1] ?? '0', 10) : 0

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
    else if (c === '"') { inQuote = !inQuote }
    else if (c === ',' && !inQuote) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur)
  return result
}

interface AggRow {
  lemma: string
  pos: string
  meaning_ko: string
  meaning_ko_alt: string[]
  raw_count: number
  normalized_freq: number
  rank_in_source: number
  year_from: number
  year_to: number
  appears_every_year: boolean
  metadata: Record<string, unknown>
}

async function main(): Promise<void> {
  console.log(`[Phase 4] Mode: ${IS_COMMIT ? 'COMMIT' : 'DRY-RUN'}${LIMIT ? ` (limit=${LIMIT})` : ''}`)

  const text = fs.readFileSync(IN_FILE, 'utf-8')
  const lines = text.split('\n').filter(l => l.trim())

  let rows: AggRow[] = lines.slice(1).map(line => {
    const [lemma, pos, meaning_ko, alt_json, rc, nf, rank, yf, yt, aey, meta_json] = parseCsvLine(line)
    return {
      lemma, pos, meaning_ko,
      meaning_ko_alt: JSON.parse(alt_json) as string[],
      raw_count: parseInt(rc, 10),
      normalized_freq: parseFloat(nf),
      rank_in_source: parseInt(rank, 10),
      year_from: parseInt(yf, 10),
      year_to: parseInt(yt, 10),
      appears_every_year: aey === 'true',
      metadata: JSON.parse(meta_json) as Record<string, unknown>,
    }
  })

  if (LIMIT > 0) rows = rows.slice(0, LIMIT)
  console.log(`  Loaded ${rows.length} aggregated rows`)

  if (IS_DRY_RUN) {
    console.log('\n[DRY-RUN] 실제 UPSERT 미수행. --commit 으로 실행 시 적재.')
    console.log('  샘플 row 0:', JSON.stringify({
      lemma: rows[0].lemma, pos: rows[0].pos,
      meaning_ko: rows[0].meaning_ko,
      meaning_ko_alt: rows[0].meaning_ko_alt,
      raw_count: rows[0].raw_count,
      rank_in_source: rows[0].rank_in_source,
      metadata_keys: Object.keys(rows[0].metadata),
    }, null, 2))
    console.log('  샘플 row N-1:', JSON.stringify({
      lemma: rows[rows.length - 1].lemma,
      raw_count: rows[rows.length - 1].raw_count,
    }))
    // 검증 통계
    const tierDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0 }
    for (const r of rows) {
      let tier = 2
      if (r.raw_count >= 10) tier = 5
      else if (r.raw_count >= 4) tier = 4
      else if (r.raw_count >= 2) tier = 3
      tierDist[tier]++
    }
    console.log(`  Tier preview: T5=${tierDist[5]} T4=${tierDist[4]} T3=${tierDist[3]} T2=${tierDist[2]}`)
    return
  }

  // frequency_data_sources kice_csat id 조회
  const { data: srcRow, error: srcErr } = await supabase
    .from('frequency_data_sources').select('id')
    .eq('source_key', 'kice_csat').single()
  if (srcErr || !srcRow) {
    console.error('❌ frequency_data_sources.kice_csat row 부재:', srcErr)
    process.exit(1)
  }
  const sourceId = srcRow.id as number
  console.log(`  data_source_id (kice_csat) = ${sourceId}`)

  let okCount = 0
  let errCount = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // 1. word_lexicon UPSERT
    const lexiconBatch = batch.map(r => ({
      lemma: r.lemma,
      part_of_speech: r.pos,
      meaning_ko: r.meaning_ko,
      meaning_ko_alt: r.meaning_ko_alt,
    }))

    const { data: lexiconRows, error: lexErr } = await supabase
      .from('word_lexicon')
      .upsert(lexiconBatch, { onConflict: 'lemma,part_of_speech' })
      .select('id, lemma, part_of_speech')

    if (lexErr || !lexiconRows) {
      console.error(`  Batch ${i}: word_lexicon error:`, lexErr)
      errCount += batch.length
      continue
    }

    const idMap = new Map<string, string>()
    for (const lr of lexiconRows) {
      idMap.set(`${lr.lemma}|${lr.part_of_speech}`, lr.id)
    }

    // 2. lexicon_source_tags UPSERT
    const tagBatch = batch.map(r => ({
      lexicon_id: idMap.get(`${r.lemma}|${r.pos}`)!,
      source: 'kice_csat',
      metadata: r.metadata,
    })).filter(t => t.lexicon_id)

    const { error: tagErr } = await supabase
      .from('lexicon_source_tags')
      .upsert(tagBatch, { onConflict: 'lexicon_id,source' })

    if (tagErr) {
      console.error(`  Batch ${i}: lexicon_source_tags error:`, tagErr)
      errCount += batch.length
      continue
    }

    // 3. word_frequency_stats UPSERT (raw_count > 0 만, 트리거가 tier+appears_every_year 자동)
    const freqBatch = batch
      .filter(r => r.raw_count > 0)
      .map(r => ({
        lexicon_id: idMap.get(`${r.lemma}|${r.pos}`)!,
        source: 'kice_csat',
        data_source_id: sourceId,
        raw_count: r.raw_count,
        normalized_freq: r.normalized_freq,
        rank_in_source: r.rank_in_source,
        year_from: r.year_from,
        year_to: r.year_to,
        metadata: { years_appeared: (r.metadata as { years_appeared: number[] }).years_appeared },
      }))
      .filter(t => t.lexicon_id)

    const { error: freqErr } = await supabase
      .from('word_frequency_stats')
      .upsert(freqBatch, { onConflict: 'lexicon_id,source,year_from,year_to' })

    if (freqErr) {
      console.error(`  Batch ${i}: word_frequency_stats error:`, freqErr)
      errCount += batch.length
      continue
    }

    okCount += batch.length
    if ((Math.floor(i / BATCH_SIZE)) % 10 === 0) {
      console.log(`  Progress: ${i + batch.length}/${rows.length} (ok=${okCount}, err=${errCount})`)
    }

    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\n✅ Done. ok=${okCount}, err=${errCount}`)

  if (okCount > 0 && !LIMIT) {
    const { error: histErr } = await supabase.from('kice_csat_load_history').insert({
      year_from: rows[0].year_from,
      year_to: rows[0].year_to,
      total_files: 15,
      total_rows: rows.length,
      agg_rows: okCount,
      notes: `Sprint lexicon-v2.2-kice-13y. ok=${okCount}, err=${errCount}.`,
    })
    if (histErr) console.error('⚠️ history insert error:', histErr)
    else console.log('  History row inserted.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
