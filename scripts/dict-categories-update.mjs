// scripts/dict-categories-update.mjs
//
// dict-categories-fetch.mjs 로 export 한 JSON 을 받아 dictionary_categories 의
// name_ko (+ 옵션 cover_emoji) 를 멱등 UPDATE.
//
// 멱등 보장:
//   - WHERE name_ko IS NULL 조건으로 보호 — 이미 채워진 행은 절대 덮어쓰지 X
//   - --force 플래그로만 덮어쓰기 (관리자 의도 명시)
//
// CLI:
//   node scripts/dict-categories-update.mjs data/dict-categories/h1-seed.json
//   node scripts/dict-categories-update.mjs <file> --force      # 기존 값도 덮어씀
//   node scripts/dict-categories-update.mjs <file> --dry-run    # 실 UPDATE X

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { argv, cwd, exit } from 'node:process'

import { makeClient } from './dict-common.mjs'

const supabase = makeClient()
const args = argv.slice(2)
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')
const filePath = args.find((a) => !a.startsWith('--'))

if (!filePath) {
  console.error('Usage: node scripts/dict-categories-update.mjs <file.json> [--force] [--dry-run]')
  exit(1)
}

const abs = resolve(cwd(), filePath)
const raw = readFileSync(abs, 'utf8')
const payload = JSON.parse(raw)
const items = Array.isArray(payload) ? payload : (payload.items ?? [])

if (items.length === 0) {
  console.error('  ⚠ 입력 파일에 items 없음')
  exit(0)
}

let updated = 0
let skipped = 0
let failed = 0

console.log(`  → ${items.length} rows ${dryRun ? '(dry-run)' : ''}${force ? ' [force]' : ''}`)

for (const item of items) {
  const { id, name_ko, cover_emoji } = item
  if (!id || !name_ko) {
    skipped += 1
    continue
  }

  const patch = { name_ko }
  if (cover_emoji !== undefined && cover_emoji !== null) patch.cover_emoji = cover_emoji

  if (dryRun) {
    console.log(`    ${id} → "${name_ko}"${cover_emoji ? ` ${cover_emoji}` : ''}`)
    updated += 1
    continue
  }

  let query = supabase.from('dictionary_categories').update(patch).eq('id', id)
  if (!force) query = query.is('name_ko', null)

  const { error, count } = await query.select('id', { count: 'exact', head: true })
  if (error) {
    console.error(`    ✗ ${id}: ${error.message}`)
    failed += 1
  } else if ((count ?? 0) === 0) {
    skipped += 1 // 이미 채워져 있음 + force 아님
  } else {
    updated += 1
  }
}

console.log('━'.repeat(50))
console.log(`  ✓ updated: ${updated}`)
console.log(`  · skipped: ${skipped} (이미 채워짐 — --force 없음)`)
if (failed > 0) console.log(`  ✗ failed:  ${failed}`)
