// scripts/derivational-seed.mjs
//
// Derivational dictionary seed (freq >= 50) — ADR 0001 Phase 2.
// Reads data/seed/derivational-candidates.json (produced by §1 SQL),
// applies an inflection-exclusion gate (§2), determines POS from the
// derivational suffix (§2), synthesises a conservative Korean meaning (§3),
// then either writes a dry-run plan or upserts rows idempotently (§4).
//
// Usage:
//   node scripts/derivational-seed.mjs --dry-run     # writes data/seed/seed-plan.json, no INSERT
//   node scripts/derivational-seed.mjs               # idempotent upsert (onConflict word, ignoreDuplicates)
//
// Invariants: idempotent (ignoreDuplicates), never UPDATEs existing rows,
// inflections excluded, base_word must exist in dict (guaranteed by §1 query).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient, arg } from './dict-common.mjs'
import { gateHeadwords, writeHold } from './dict/headword-gate.mjs'
import nodeFs from 'node:fs'

/** 게이트 보류분 격리 파일 — 자동 삭제하지 않는다. */
const HOLD_PATH = 'data/lexicon/derivational-seed.hold.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CANDIDATES = resolve(ROOT, 'data/seed/derivational-candidates.json')
const PLAN = resolve(ROOT, 'data/seed/seed-plan.json')

// ── Suffix → POS (longest / most-specific first so 'tion' beats 'ion', 'able' beats 'al') ──
// NOTE: verb suffixes -ate/-ize/-ise intentionally EXCLUDED. They produced false POS
// matches (unwise→'ise', inappropriate/illiterate→'ate' are adjectives) and pulled in
// British/American spelling variants (recognise/maximize), which belong to the
// spelling_variants pipeline (ADR 0001 Phase 1), not derivational seed.
const SUFFIX_POS = [
  ['tion', 'noun'], ['sion', 'noun'], ['ment', 'noun'], ['ness', 'noun'],
  ['hood', 'noun'], ['ship', 'noun'], ['able', 'adjective'], ['ible', 'adjective'],
  ['less', 'adjective'], ['ity', 'noun'], ['ism', 'noun'], ['ist', 'noun'],
  ['dom', 'noun'], ['ous', 'adjective'], ['ive', 'adjective'],
  ['ic', 'adjective'], ['al', 'adjective'],
  ['ly', 'adverb'], ['or', 'noun'],
  // -ry EXCLUDED: conflates -ory/-ary adjectives (regulatory, supplementary) with
  // -ry nouns (forestry, rivalry) → unreliable POS. Dropped to keep §6-F clean.
]

function detectSuffix(form) {
  for (const [sfx, pos] of SUFFIX_POS) {
    if (form.endsWith(sfx) && form.length > sfx.length + 1) return { suffix: `-${sfx}`, pos }
  }
  return null
}

// ── §2 inflection gate — true = pure inflection of base (exclude from seed) ──
function isInflection(form, base) {
  const y2ies = base.endsWith('y') ? base.slice(0, -1) + 'ies' : null
  const y2ied = base.endsWith('y') ? base.slice(0, -1) + 'ied' : null
  const y2ier = base.endsWith('y') ? base.slice(0, -1) + 'ier' : null
  const y2iest = base.endsWith('y') ? base.slice(0, -1) + 'iest' : null
  const eDrop = base.endsWith('e') ? base.slice(0, -1) : base
  const inflForms = new Set([
    base + 's', base + 'es', y2ies,
    base + 'ed', base + 'd', y2ied,
    base + 'ing', eDrop + 'ing',
    base + 'er', base + 'est', y2ier, y2iest,
  ].filter(Boolean))
  return inflForms.has(form)
}

// ── §3 conservative Korean meaning synthesis (clean transforms only, else null) ──
// base_meaning may carry multiple senses; use the first.
function synthMeaning(suffix, baseMeaning) {
  if (!baseMeaning) return null
  const m = baseMeaning.split(/[,;·/]/)[0].trim()
  if (!m) return null

  switch (suffix) {
    // 탈형용사 명사화: 한→함, 운→움, 은→음 (그 외 모호 → null)
    case '-ness':
    case '-ity':
    case '-hood':
      if (m.endsWith('한')) return m.slice(0, -1) + '함'
      if (m.endsWith('운')) return m.slice(0, -1) + '움'
      if (m.endsWith('은')) return m.slice(0, -1) + '음'
      return null
    // 탈동사 명사화: ~하다 → ~ (행위 명사). 그 외 → null
    case '-tion':
    case '-sion':
    case '-ment':
      if (m.endsWith('하다')) return m.slice(0, -2)
      return null
    // 부사화: 한→하게 (그 외 모호 → null)
    case '-ly':
      if (m.endsWith('한')) return m.slice(0, -1) + '하게'
      if (m.endsWith('하다')) return m.slice(0, -2) + '하게'
      return null
    // 나머지 접사(-ful/-less/-able/-ous/-ive/-or/-ist/-ship/-al/-ic/-ate/-ize…)
    // 는 규칙 합성 모호 → null (2차 LLM enrichment 대상)
    default:
      return null
  }
}

function buildRow(c) {
  const det = detectSuffix(c.form)
  if (!det) return { skip: 'no_suffix', form: c.form }
  if (isInflection(c.form, c.base)) return { skip: 'inflection', form: c.form, base: c.base }

  const v = Math.min((c.base_v ?? 1) + 1, 10)
  const meaning = synthMeaning(det.suffix, c.base_meaning)
  return {
    row: {
      word: c.form,
      pos: det.pos,
      pos_set: [det.pos],
      senses: [],
      list_tags: [],
      source: 'derivational-seed',
      classified_by: 'claude_code_derivational',
      base_word: c.base,
      derivation_suffix: det.suffix,
      meaning_ko: meaning,
      cefr_level: c.base_cefr ?? null,
      v_level: v,
      example_en: null,
    },
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const candidates = JSON.parse(readFileSync(CANDIDATES, 'utf-8'))

  const rows = []
  const skips = { no_suffix: 0, inflection: 0 }
  const inflectionSamples = []
  for (const c of candidates) {
    const r = buildRow(c)
    if (r.skip) {
      skips[r.skip]++
      if (r.skip === 'inflection' && inflectionSamples.length < 20) inflectionSamples.push(r)
      continue
    }
    rows.push(r.row)
  }

  // ⛔ 표제어 유효성 게이트 (2026-08-17) — 만들어낸 파생형이 **실재 낱말인지** 확인한다.
  //   접미사 규칙만으로 형태를 합성하면 `brustly` 같은 비단어가 나온다. 사전·렉시콘에 근거가
  //   없으면 넣지 않고 격리 파일로 뺀다. 공통 게이트: scripts/dict/headword-gate.mjs
  const gate = await gateHeadwords(makeClient(), rows.map((r) => r.word))
  const held = new Set(gate.hold.map((h) => String(h.word).toLowerCase()))
  const kept = rows.filter((r) => !held.has(String(r.word).toLowerCase()))
  if (gate.hold.length) {
    writeHold(nodeFs, HOLD_PATH, gate.hold, { script: 'derivational-seed', at: new Date().toISOString() })
    const by = gate.hold.reduce((m, h) => ((m[h.reason] = (m[h.reason] ?? 0) + 1), m), {})
    console.log(`⛔ 표제어 게이트 보류 ${gate.hold.length} ${JSON.stringify(by)} → ${HOLD_PATH}`)
  }
  rows.length = 0
  rows.push(...kept)

  const withMeaning = rows.filter((r) => r.meaning_ko != null).length
  const stats = {
    candidates: candidates.length,
    seed_rows: rows.length,
    skipped_inflection: skips.inflection,
    skipped_no_suffix: skips.no_suffix,
    inflection_pollution_pct: +((skips.inflection / candidates.length) * 100).toFixed(2),
    meaning_fill: withMeaning,
    meaning_fill_rate: +((withMeaning / Math.max(rows.length, 1)) * 100).toFixed(1),
    pos_breakdown: rows.reduce((a, r) => ((a[r.pos] = (a[r.pos] ?? 0) + 1), a), {}),
  }

  if (dryRun) {
    writeFileSync(PLAN, JSON.stringify({ stats, inflectionSamples, rows }, null, 0), 'utf-8')
    console.log('[dry-run] plan ->', PLAN)
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  const client = makeClient()
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error, count } = await client
      .from('shared_dictionary')
      .upsert(batch, { onConflict: 'word', ignoreDuplicates: true, count: 'exact' })
    if (error) {
      console.error(`  ✗ batch ${i}-${i + batch.length} failed:`, error.message)
      process.exit(1)
    }
    inserted += count ?? 0
    console.log(`  ✓ batch ${i}-${i + batch.length} ok (cumulative inserted ~${inserted})`)
  }
  console.log(JSON.stringify({ ...stats, inserted }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
