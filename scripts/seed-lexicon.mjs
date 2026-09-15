// scripts/seed-lexicon.mjs
//
// ⛔ 현재 실행 불가 (2026-08-12 확인) — 이 스크립트는 word_lexicon 에 적재하는데
//    그 테이블은 두 단계로 사라졌다:
//      ① lexicon-phase-1(20260520) 에서 **의도적으로 동결** — 새 단어는 shared_dictionary 로
//         (트리거 reject_word_lexicon_insert 가 삽입을 막았다)
//      ② 20260719161409_drop_unused_empty_tables 가 CASCADE 삭제
//    그 결과 lexicon_source_tags · word_frequency_stats 에 KICE 13년 빈도 5,421행 × 2 가
//    **단어 정체를 잃은 채** 남아 있다(lexicon_id uuid 가 가리킬 부모가 없고, 후속 정본
//    lexicon_clean 은 word(text) 키라 연결 불가. metadata 에는 years_appeared 만 있다).
//
//    재생성 경로는 살아 있다 — parse → aggregate → seed 3단계와 원천(xlsx/csv, gitignore)이
//    있으면 되살릴 수 있다. 단 적재 대상을 **lexicon_clean(word 키)로 재배선**해야 한다
//    (word_lexicon 복원은 동결 결정에 역행). 상세: docs/DB_SCHEMA.md §스키마 드리프트.
//
//    삭제하지 않고 남겨 둔 이유: 이것이 KICE 빈도를 되살리는 유일한 경로다.
//
// Lexicon v2.1 시드 스크립트 — CSV → 3 테이블 멱등 upsert.
//
// Phase A: word_lexicon (lemma+pos UNIQUE)
// Phase B: lexicon_source_tags (NCIC 22 + KICE raw_count>0 인 행만)
// Phase C: word_frequency_stats (raw_count > 0 만, trigger 가 tier/appears_every_year 자동 채움)
//
// 의존성: dict-common.mjs (env + Supabase client). csv-parse 미사용 (자체 파서).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { exit, argv } from 'node:process'
import { fileURLToPath } from 'node:url'

import { arg, makeClient, VALID_CEFR } from './dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ────────────────────────────────────────────────
// CLI 파싱
// ────────────────────────────────────────────────
const CSV_PATH = arg(argv, '--csv', resolve(__dirname, '../data/seed/sample_kice_frequency.csv'))
const DRY_RUN = argv.includes('--dry-run')
const VERBOSE = argv.includes('--verbose') || argv.includes('-v')
const BATCH_SIZE = parseInt(arg(argv, '--batch-size', '100'), 10)

// frequency_data_sources 시드 (schema-v2.1.sql 와 동일)
const KICE_RECENT_SOURCE_KEY = 'kice_csat_recent'
const YEAR_FROM = 2014
const YEAR_TO = 2024

const VALID_POS = new Set(['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'interj', 'phrase'])
const VALID_NCIC_GRADES = new Set(['elementary', 'middle', 'high_common', 'high_extended'])

// ────────────────────────────────────────────────
// CSV 파서 (단순 — quote/escape 미지원, sample CSV 구조 가정)
// ────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line, idx) => {
    const cells = line.split(',')
    const row = { _line: idx + 2 }
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim()
    })
    return row
  })
}

// ────────────────────────────────────────────────
// 행 검증 + 정규화
// ────────────────────────────────────────────────
function validateRow(row) {
  const errors = []
  const warnings = []

  // lemma
  const lemma = (row.lemma || '').toLowerCase().trim()
  if (!lemma) errors.push(`line ${row._line}: lemma empty`)

  // pos
  const pos = (row.pos || '').trim()
  if (!VALID_POS.has(pos)) errors.push(`line ${row._line}: invalid pos "${pos}"`)

  // meaning_ko
  const meaning_ko = (row.meaning_ko || '').trim()
  if (!meaning_ko) errors.push(`line ${row._line}: meaning_ko empty`)

  // meaning_ko_alt — 세미콜론 구분
  const altRaw = (row.meaning_ko_alt || '').trim()
  const meaning_ko_alt = altRaw ? altRaw.split(';').map((s) => s.trim()).filter(Boolean) : null

  // cefr
  const cefr = (row.cefr || '').trim()
  if (cefr && !VALID_CEFR.has(cefr)) errors.push(`line ${row._line}: invalid cefr "${cefr}"`)

  // ncic_grade
  const ncic_grade = (row.ncic_grade || '').trim()
  if (ncic_grade && !VALID_NCIC_GRADES.has(ncic_grade)) {
    errors.push(`line ${row._line}: invalid ncic_grade "${ncic_grade}"`)
  }

  // raw_count
  const rawCountStr = (row.kice_raw_count || '').trim()
  const raw_count = rawCountStr === '' ? 0 : parseInt(rawCountStr, 10)
  if (Number.isNaN(raw_count) || raw_count < 0) {
    errors.push(`line ${row._line}: invalid kice_raw_count "${rawCountStr}"`)
  }

  // years_appeared
  const yearsRaw = (row.kice_years_appeared || '').trim()
  const years_appeared = yearsRaw
    ? yearsRaw.split(';').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n))
    : []

  // years count vs raw_count 검사 — 한 해 여러번 출제 가능하므로 길이 ≠ raw_count 정상.
  // 단, years 길이 > raw_count 면 의심 (raw_count 가 낮은데 years 가 많음).
  if (years_appeared.length > 0 && raw_count > 0 && years_appeared.length > raw_count) {
    warnings.push(`line ${row._line}: years_appeared length (${years_appeared.length}) > raw_count (${raw_count})`)
  }

  // csat_first_year
  const fyStr = (row.csat_first_year || '').trim()
  const csat_first_year = fyStr === '' ? null : parseInt(fyStr, 10)

  return {
    errors,
    warnings,
    normalized: {
      lemma,
      pos,
      meaning_ko,
      meaning_ko_alt,
      ipa: (row.ipa || '').trim() || null,
      cefr_level: cefr || null,
      ncic_grade: ncic_grade || null,
      raw_count,
      years_appeared,
      csat_first_year,
    },
  }
}

// ────────────────────────────────────────────────
// Phase 함수 — supabase===null 이면 dry-run
// ────────────────────────────────────────────────
async function phaseA_lexicon(supabase, rows) {
  console.log(`\n[Phase A] word_lexicon — ${rows.length} rows`)
  const payload = rows.map((r) => ({
    lemma: r.lemma,
    part_of_speech: r.pos,
    meaning_ko: r.meaning_ko,
    meaning_ko_alt: r.meaning_ko_alt,
    ipa: r.ipa,
    cefr_level: r.cefr_level,
  }))

  if (VERBOSE && payload[0]) console.log('  sample payload[0]:', JSON.stringify(payload[0]))

  if (!supabase) {
    console.log(`  [dry-run] would upsert ${payload.length} rows`)
    // mock lexicon_id map for downstream phases
    const map = new Map()
    rows.forEach((r) => map.set(`${r.lemma}|${r.pos}`, `mock-uuid-${r.lemma}-${r.pos}`))
    return map
  }

  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('word_lexicon')
      .upsert(batch, { onConflict: 'lemma,part_of_speech' })
    if (error) {
      console.error(`  ✗ Phase A batch ${i}: ${error.message}`)
      exit(1)
    }
  }
  console.log(`  ✓ upserted ${payload.length}`)

  // lexicon_id map build
  const lemmaPosList = rows.map((r) => `(${JSON.stringify(r.lemma)},${JSON.stringify(r.pos)})`)
  const { data, error: selErr } = await supabase
    .from('word_lexicon')
    .select('id, lemma, part_of_speech')
    .in('lemma', rows.map((r) => r.lemma))
  if (selErr) {
    console.error(`  ✗ Phase A id fetch: ${selErr.message}`)
    exit(1)
  }
  const map = new Map()
  for (const row of data) map.set(`${row.lemma}|${row.part_of_speech}`, row.id)
  return map
}

async function phaseB_sourceTags(supabase, rows, lexiconIdMap) {
  // NCIC 22 + KICE (raw_count > 0) 별도 처리
  const ncicPayload = rows
    .filter((r) => r.ncic_grade)
    .map((r) => ({
      lexicon_id: lexiconIdMap.get(`${r.lemma}|${r.pos}`),
      source: 'ncic_basic',
      metadata: { grade: r.ncic_grade },
    }))

  const kicePayload = rows
    .filter((r) => r.raw_count > 0)
    .map((r) => ({
      lexicon_id: lexiconIdMap.get(`${r.lemma}|${r.pos}`),
      source: 'kice_csat',
      metadata: r.csat_first_year ? { first_year: r.csat_first_year } : {},
    }))

  const total = ncicPayload.length + kicePayload.length
  console.log(`\n[Phase B] lexicon_source_tags — NCIC ${ncicPayload.length} + KICE ${kicePayload.length} = ${total}`)

  if (VERBOSE) {
    console.log('  sample NCIC payload[0]:', JSON.stringify(ncicPayload[0]))
    console.log('  sample KICE payload[0]:', JSON.stringify(kicePayload[0]))
  }

  if (!supabase) {
    console.log(`  [dry-run] would upsert ${total} rows`)
    return
  }

  for (const [label, payload] of [['NCIC', ncicPayload], ['KICE', kicePayload]]) {
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('lexicon_source_tags')
        .upsert(batch, { onConflict: 'lexicon_id,source' })
      if (error) {
        console.error(`  ✗ Phase B ${label} batch ${i}: ${error.message}`)
        exit(1)
      }
    }
  }
  console.log(`  ✓ upserted ${total}`)
}

async function phaseC_freqStats(supabase, rows, lexiconIdMap, dataSourceId) {
  const eligible = rows.filter((r) => r.raw_count > 0)
  console.log(`\n[Phase C] word_frequency_stats — ${eligible.length} rows (raw_count > 0)`)

  const payload = eligible.map((r) => ({
    lexicon_id: lexiconIdMap.get(`${r.lemma}|${r.pos}`),
    data_source_id: dataSourceId,
    source: KICE_RECENT_SOURCE_KEY,
    year_from: YEAR_FROM,
    year_to: YEAR_TO,
    raw_count: r.raw_count,
    metadata: { years_appeared: r.years_appeared },
    // frequency_tier, appears_every_year — 트리거 자동 채움 (제외)
  }))

  if (VERBOSE && payload[0]) console.log('  sample payload[0]:', JSON.stringify(payload[0]))

  if (!supabase) {
    console.log(`  [dry-run] would upsert ${payload.length} rows (tier+appears_every_year via trigger)`)
    return
  }

  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('word_frequency_stats')
      .upsert(batch, { onConflict: 'lexicon_id,source,year_from,year_to' })
    if (error) {
      console.error(`  ✗ Phase C batch ${i}: ${error.message}`)
      exit(1)
    }
  }
  console.log(`  ✓ upserted ${payload.length}`)
}

async function postValidation(supabase) {
  if (!supabase) {
    console.log('\n[Validation] skipped (dry-run)')
    return
  }
  console.log('\n[Validation]')

  const { count: lexCount } = await supabase
    .from('word_lexicon')
    .select('*', { count: 'exact', head: true })
  console.log(`  word_lexicon total: ${lexCount}`)

  const { data: nullTier, error: tierErr } = await supabase
    .from('word_frequency_stats')
    .select('id')
    .is('frequency_tier', null)
    .limit(1)
  if (tierErr) {
    console.error(`  ✗ tier check: ${tierErr.message}`)
  } else if (nullTier && nullTier.length > 0) {
    console.error('  ✗ frequency_tier NULL detected — trigger may not be applied')
  } else {
    console.log('  ✓ all frequency_tier populated (trigger OK)')
  }

  // Tier distribution
  const { data: dist } = await supabase
    .from('word_frequency_stats')
    .select('frequency_tier')
  if (dist) {
    const counts = {}
    for (const r of dist) counts[r.frequency_tier] = (counts[r.frequency_tier] || 0) + 1
    console.log(`  Tier distribution: ${JSON.stringify(counts)}`)
  }
}

async function fetchDataSourceId(supabase) {
  if (!supabase) return -1
  const { data, error } = await supabase
    .from('frequency_data_sources')
    .select('id')
    .eq('source_key', KICE_RECENT_SOURCE_KEY)
    .single()
  if (error || !data) {
    console.error(`  ✗ frequency_data_sources lookup failed — apply schema-v2.1.sql first`)
    exit(1)
  }
  return data.id
}

// ────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────
async function main() {
  console.log(`seed-lexicon — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'} mode`)
  console.log(`  CSV: ${CSV_PATH}`)

  if (!existsSync(CSV_PATH)) {
    console.error(`✗ CSV not found: ${CSV_PATH}`)
    exit(1)
  }

  const text = readFileSync(CSV_PATH, 'utf8')
  const raw = parseCsv(text)
  console.log(`  loaded ${raw.length} rows`)

  // Validation pass
  const normalized = []
  let errCount = 0
  let warnCount = 0
  for (const row of raw) {
    const { errors, warnings, normalized: n } = validateRow(row)
    if (errors.length) {
      errors.forEach((e) => console.error(`  ✗ ${e}`))
      errCount += errors.length
    }
    if (warnings.length && VERBOSE) {
      warnings.forEach((w) => console.warn(`  ⚠ ${w}`))
      warnCount += warnings.length
    } else {
      warnCount += warnings.length
    }
    if (!errors.length) normalized.push(n)
  }
  if (errCount > 0) {
    console.error(`✗ ${errCount} validation errors — abort`)
    exit(1)
  }
  console.log(`  ✓ ${normalized.length} rows validated (${warnCount} warnings)`)

  const supabase = DRY_RUN ? null : makeClient()
  const dataSourceId = await fetchDataSourceId(supabase)

  const lexiconIdMap = await phaseA_lexicon(supabase, normalized)
  await phaseB_sourceTags(supabase, normalized, lexiconIdMap)
  await phaseC_freqStats(supabase, normalized, lexiconIdMap, dataSourceId)
  await postValidation(supabase)

  console.log(`\n✓ Done${DRY_RUN ? ' (no DB changes)' : ''}.`)
}

main().catch((e) => {
  console.error(`✗ unexpected error: ${e.stack || e.message}`)
  exit(1)
})
