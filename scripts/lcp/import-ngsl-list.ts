// scripts/lcp/import-ngsl-list.ts
//
// Phase 14.5 — Generic NGSL Project list_tags importer
//
// 한 list의 lemma family CSV (또는 NGSL-GR rank CSV) 를 읽어 shared_dictionary.list_tags
// 배열에 list_id 를 idempotent 하게 append.
//
// Supported lists (CLAUDE.md §"🗄 NGSL Project"):
//   ngsl_1.2 / tsl_1.2 / nawl_1.2 / ndl_1.1 / ngsl_gr_1.0 / bsl_1.20 / ngsl_spoken_1.2
//   fel_1.2 / bel_1.0   (Tier 3, 향후)
//
// CSV formats:
//   1) lemma-research (대다수): `## comment ...` 헤더 + 빈 줄 + `headword,form1,form2,...` 행
//   2) NGSL-GR_rank.csv: 단일 컬럼 word list (또는 word,rank 2 컬럼). headword 만 사용.
//
// Usage:
//   pnpm tsx scripts/lcp/import-ngsl-list.ts --list-id=tsl_1.2 \
//     --csv=packages/library-pipeline/data/ngsl/TSL_1.2_lemmatized_for_research.csv [--dry-run]

import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })
dotenvConfig({ path: resolve(process.cwd(), '.env') })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const VALID_LIST_IDS = new Set([
  'ngsl_1.2',
  'tsl_1.2',
  'nawl_1.2',
  'ndl_1.1',
  'ngsl_gr_1.0',
  'bsl_1.20',
  'ngsl_spoken_1.2',
  'fel_1.2',
  'bel_1.0',
  'moel_1.0',
])

const BATCH_SIZE = 500

// ─── CLI args ───────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

const listId = getArg('list-id')
const csvPath = getArg('csv')
const dryRun = process.argv.includes('--dry-run')

if (!listId || !csvPath) {
  console.error(
    'usage: pnpm tsx scripts/lcp/import-ngsl-list.ts --list-id=<id> --csv=<path> [--dry-run]',
  )
  process.exit(1)
}
if (!VALID_LIST_IDS.has(listId)) {
  console.error(
    `Invalid --list-id="${listId}". Allowed: ${[...VALID_LIST_IDS].join(', ')}`,
  )
  process.exit(1)
}

// ─── CSV parser (RFC 4180 — quoted field aware) ─────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"'
        i++
      } else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') i++
        row.push(field)
        field = ''
        if (row.some((f) => f.trim())) rows.push(row)
        row = []
      } else field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    if (row.some((f) => f.trim())) rows.push(row)
  }
  return rows
}

// ─── Load words ─────────────────────────────────────────────────────

function loadWords(path: string, lid: string): Set<string> {
  // Strip BOM
  const text = readFileSync(resolve(process.cwd(), path), 'utf-8').replace(/^﻿/, '')
  const words = new Set<string>()

  // Drop ## comment lines, keep meaningful data lines
  const dataText = text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('##'))
    .join('\n')
  const rows = parseCsv(dataText)
  if (rows.length === 0) {
    console.warn(`⚠️  [${lid}] Empty CSV`)
    return words
  }

  // Detect header: first row contains a column whose name matches a known header
  // (word/lemma/headword/wordid). If so, find the word column and use only that.
  // Prefer exact word|lemma|headword over generic id-like names (e.g. NGSL-GR has
  // `WordID,Word` → must pick "Word" not "WordID").
  const firstRow = rows[0].map((c) => c.trim())
  let headerWordIdx = firstRow.findIndex((c) => /^(word|lemma|headword)$/i.test(c))
  if (headerWordIdx < 0) {
    headerWordIdx = firstRow.findIndex((c) => /^wordid$/i.test(c))
  }

  let format: string
  if (headerWordIdx >= 0) {
    // Single-word-column format (NGSL-GR_rank.csv etc.)
    format = `CSV w/ header (col ${headerWordIdx} "${firstRow[headerWordIdx]}")`
    for (let i = 1; i < rows.length; i++) {
      const cell = rows[i][headerWordIdx]?.trim().toLowerCase()
      if (cell) words.add(cell)
    }
  } else {
    // Lemma-research format: each row is `headword,form1,form2,...` with no header.
    // Take every non-empty cell across all rows (covers TSL/NAWL/NDL/BSL/Spoken).
    format = 'lemma-research'
    for (const row of rows) {
      for (const cell of row) {
        const w = cell.trim().toLowerCase()
        if (w) words.add(w)
      }
    }
  }

  console.log(`📊 [${lid}] Loaded ${words.size} words (${format})`)
  return words
}

// ─── Apply list_tags append ─────────────────────────────────────────

async function applyTags(
  client: SupabaseClient,
  words: string[],
  lid: string,
): Promise<void> {
  let matched = 0
  let alreadyTagged = 0
  let missing = 0
  let errors = 0

  console.log(
    `\n🔄 Applying tag "${lid}" to ${words.length} words in batches of ${BATCH_SIZE}...\n`,
  )

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE)

    const { data: existing, error: fetchErr } = await client
      .from('shared_dictionary')
      .select('word, list_tags')
      .in('word', batch)

    if (fetchErr) {
      console.error(`  ❌ Batch ${i} fetch error: ${fetchErr.message}`)
      errors += batch.length
      continue
    }

    const existingMap = new Map<string, string[]>()
    for (const row of existing ?? []) {
      existingMap.set(row.word as string, (row.list_tags as string[] | null) ?? [])
    }
    missing += batch.length - existingMap.size

    const toUpdate: { word: string; nextTags: string[] }[] = []
    for (const [word, tags] of existingMap) {
      if (tags.includes(lid)) {
        alreadyTagged++
      } else {
        toUpdate.push({ word, nextTags: [...tags, lid] })
      }
    }

    for (const { word, nextTags } of toUpdate) {
      const { error: updErr } = await client
        .from('shared_dictionary')
        .update({ list_tags: nextTags, updated_at: new Date().toISOString() })
        .eq('word', word)
      if (updErr) {
        console.error(`  ❌ ${word}: ${updErr.message}`)
        errors++
      } else matched++
    }

    if (((i / BATCH_SIZE) | 0) % 5 === 0) {
      console.log(
        `  ${i + batch.length}/${words.length} — newly_tagged:${matched} already:${alreadyTagged} missing:${missing} errors:${errors}`,
      )
    }
  }

  console.log(
    `\n✅ Done — newly_tagged:${matched} already:${alreadyTagged} missing:${missing} errors:${errors}`,
  )
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `🌱 NGSL list import — ${dryRun ? 'DRY RUN' : 'LIVE'} — list_id="${listId}" csv="${csvPath}"\n`,
  )

  const words = [...loadWords(csvPath!, listId!)]

  if (dryRun) {
    console.log(`📋 Sample (first 15):`)
    words.slice(0, 15).forEach((w) => console.log(`   ${w}`))
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const client = createClient(url, key)
  await applyTags(client, words, listId!)

  const { count } = await client
    .from('shared_dictionary')
    .select('*', { count: 'exact', head: true })
    .contains('list_tags', [listId!])
  console.log(`\n📈 shared_dictionary tagged with "${listId}": ${count} rows`)
}

main().catch((err) => {
  console.error('💥 Failed:', err)
  process.exit(1)
})
