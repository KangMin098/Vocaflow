// scripts/dict-categories-fetch.mjs
//
// name_ko 가 NULL 인 dictionary_categories 행을 JSON 으로 export.
// AI 또는 사람이 번역한 뒤 dict-categories-update.mjs 로 다시 import.
//
// CLI:
//   node scripts/dict-categories-fetch.mjs                         # 모든 level
//   node scripts/dict-categories-fetch.mjs --level 1               # H1 만
//   node scripts/dict-categories-fetch.mjs --level 2 --limit 50    # H2 batch
//   node scripts/dict-categories-fetch.mjs --out exports/h1-todo.json

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { argv, cwd, exit, stdout } from 'node:process'

import { arg, makeClient } from './dict-common.mjs'

const supabase = makeClient()
const level = arg(argv, '--level')
const limit = parseInt(arg(argv, '--limit', '500'), 10)
const outPath = arg(argv, '--out')

let query = supabase
  .from('dictionary_categories')
  .select('id, name_en, level, parent_id, sort_order, cover_emoji')
  .is('name_ko', null)
  .order('level', { ascending: true })
  .order('id', { ascending: true })
  .limit(limit)

if (level) query = query.eq('level', parseInt(level, 10))

const { data, error } = await query
if (error) {
  console.error('  ✗ fetch 실패:', error.message)
  exit(1)
}

const payload = {
  generated_at: new Date().toISOString(),
  level: level ?? 'all',
  count: data?.length ?? 0,
  items: (data ?? []).map((r) => ({
    id: r.id,
    name_en: r.name_en,
    level: r.level,
    parent_id: r.parent_id,
    cover_emoji: r.cover_emoji,
    // 채울 필드 (번역 후 채움):
    name_ko: null,
  })),
}

const json = JSON.stringify(payload, null, 2)

if (outPath) {
  const abs = resolve(cwd(), outPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, json + '\n', 'utf8')
  console.error(`  ✓ ${payload.count} rows → ${abs}`)
} else {
  stdout.write(json + '\n')
}
