// scripts/vcb/compose-publish.mts
// 단어장 컴포저 CLI — blueprint 하나를 조립·채점하고(기본) `--commit` 시 발행한다.
//
// 어드민 화면(/admin/vocab/studio)과 **같은 코어**를 쓴다 (apps/web/src/lib/vcb/compose/*).
// 화면은 한 번에 하나를, 이 스크립트는 여러 개를 연달아 낼 때 쓴다.
//
// 실행 (레포 루트에서):
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/compose-publish.mts \
//     --blueprint unlock --book <uuid> --count 200 [--slug my-slug] [--commit] [--force]
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/compose-publish.mts --list
//
// 기본은 드라이런이다 — `--commit` 없이는 아무것도 쓰지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { BLUEPRINTS, getBlueprint, type BlueprintParams } from '@/lib/vcb/compose/blueprints'
import { PASS_THRESHOLD } from '@/lib/vcb/compose/evaluate'
import { publishComposedSet } from '@/lib/vcb/compose/publish'
import { fetchPublishedWords } from '@/lib/vcb/compose/resolve'
import { dryRun } from '@/lib/vcb/compose/run'

// apps/web/.env.local 만 실 키를 갖고 있다 (루트 .env.local 은 없다 — vitest.config.ts 주석 참조).
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const argv = process.argv.slice(2)
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const flag = (name: string): boolean => argv.includes(`--${name}`)

if (flag('list')) {
  const width = Math.max(...BLUEPRINTS.map((b) => b.id.length))
  for (const b of BLUEPRINTS) {
    const params = b.requires_params.length > 0 ? ` (요구: ${b.requires_params.join(', ')})` : ''
    console.info(`${b.taxon.padEnd(4)} ${b.id.padEnd(width)}  ${b.status.padEnd(9)} ${b.title}${params}`)
  }
  process.exit(0)
}

const blueprintId = arg('blueprint')
if (!blueprintId) {
  console.error('--blueprint <id> 필요. 목록은 --list.')
  process.exit(1)
}
if (!getBlueprint(blueprintId)) {
  console.error(`알 수 없는 blueprint: ${blueprintId}`)
  process.exit(1)
}

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 (apps/web/.env.local)')
  process.exit(1)
}

const params: BlueprintParams = {}
const num = (v: string | undefined): number | undefined => (v ? Number(v) : undefined)
if (arg('slug')) params.slug = arg('slug')
if (arg('title')) params.title = arg('title')
if (arg('count')) params.count = num(arg('count'))
if (arg('book')) params.book_id = arg('book')
if (arg('chapter-from')) params.chapter_from = num(arg('chapter-from'))
if (arg('chapter-to')) params.chapter_to = num(arg('chapter-to'))
if (arg('tag')) params.tags = [arg('tag')!]
if (arg('theme')) params.themes = [arg('theme')!]
if (arg('text')) params.text_ids = [arg('text')!]
if (arg('user')) params.user_id = arg('user')
if (arg('days')) params.days = num(arg('days'))
if (arg('per-day')) params.per_day = num(arg('per-day'))
// 커버리지 목표 — 개수 대신 "이 책의 몇 %" 로 지시한다 (unlock 전용).
if (arg('coverage')) params.coverage_target = num(arg('coverage'))
if (arg('v-min')) params.v_level_min = num(arg('v-min')) ?? null
if (arg('v-max')) params.v_level_max = num(arg('v-max')) ?? null

const client = createClient(url, key, { auth: { persistSession: false } })

const existingWords = await fetchPublishedWords(client, { limitSets: 120 })
const result = await dryRun(client, blueprintId, params, {
  existingWords,
  maxPopulation: 8000,
  now: new Date().toISOString(),
})

const card = result.scorecard
console.info(`\n[${blueprintId}] ${result.recipe.meta.title} — slug=${result.recipe.meta.slug}`)
console.info(`  단어 ${card.entry_count} · 목차 ${card.group_count} · 총점 ${card.total.toFixed(2)} (통과선 ${PASS_THRESHOLD})`)
for (const m of card.metrics.filter((x) => x.weight > 0)) {
  console.info(`   · ${m.id.padEnd(14)} ${m.score.toFixed(2)}  ${m.note}`)
}
if (result.set.coverage) {
  const c = result.set.coverage
  console.info(
    `  [커버리지] ${(c.achieved * 100).toFixed(1)}% 달성 / 목표 ${(c.target * 100).toFixed(0)}% — 토큰 ${c.tokens_covered}/${c.tokens_total}`,
  )
}
if (result.set.evidence?.sentence_unlock) {
  const e = result.set.evidence.sentence_unlock
  console.info(`  [증거] 해금 문장 ${e.ours} vs 빈도순 ${e.baseline} / 전체 ${e.total} (예산 ${e.budget}단어)`)
}
if (result.set.evidence?.future_encounters) {
  const e = result.set.evidence.future_encounters
  console.info(`  [증거] 향후 재등장 ${e.ours_mean.toFixed(2)} vs 빈도순 ${e.baseline_mean.toFixed(2)}`)
}
if (card.blockers.length > 0) {
  console.info('  [미달]')
  for (const b of card.blockers) console.info(`   ✗ ${b}`)
}
if (card.warnings.length > 0) {
  console.info('  [경고]')
  for (const w of card.warnings.slice(0, 5)) console.info(`   ! ${w}`)
}

if (!flag('commit')) {
  console.info('\n드라이런 — 아무것도 쓰지 않았다. 발행하려면 --commit.\n')
  process.exit(0)
}

const outcome = await publishComposedSet(client, result.set, {
  force: flag('force'),
  scorecard: card,
})

if (outcome.ok) {
  console.info(`\n✅ 발행 — ${outcome.slug} · ${outcome.published_count}단어 · set_id=${outcome.set_id}\n`)
  process.exit(0)
}

console.error(`\n❌ 발행 실패 — ${outcome.error}`)
for (const b of outcome.blocked_by ?? []) console.error(`   ✗ ${b}`)
process.exit(1)
