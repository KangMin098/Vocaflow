// scripts/vocab/fix-ladder-above.mts
//
// **사다리 위(성인 수준) 권이 초등 칸에 앉아 있던 것을 바로잡는다.**
//
// ── 무슨 일이 있었나 (실측 2026-08-31) ──────────────────────────────
// `/library/vocab` 사다리 1단(초등 저학년)에 **주제 단어장 13권**이 앉아 있었다. 그 권들의
// 낱말 V-Level 중앙값은 **8~9**(성인 수준)였고, `mozzarella` · `sarsaparilla` · `distillery`
// 같은 낱말이 들어 있었다. 표본 문제도 아니었다 — 중앙값은 낱말 100% 실측이다.
//
// 원인은 발행 경로의 한 줄이었다(`lib/vcb/compose/publish.ts` `suggestedStep`):
//
//   return med >= 1 && med <= 7 ? Math.round(med) : null   ← 중앙값 8 도 null 이었다
//
// `resolveLadderStep` 에게 null 은 **"못 쟀다"** 라는 뜻이라 청사진 바닥을 쓴다. 주제
// 단어장의 바닥은 1단이므로, "재서 학령 밖임을 알아낸" 권이 **초등 칸의 답**이 됐다.
// 두 사실을 같은 값으로 내보낸 것이 사고였다(고침: `series.ts` 의 `aboveLadder`).
//
// ── 이 스크립트가 하는 일 ───────────────────────────────────────────
// 이미 발행된 세트 중 **각인된 중앙값이 사다리 위**인데 계단이 박혀 있는 것을 찾아
// 계단을 비운다. 계산은 정본 함수(`resolveLadderStep`)에 그대로 맡긴다 — 여기서 규칙을
// 다시 적으면 두 곳이 갈라진다.
//
// 계단이 비면 화면은 **'대상 수준'**(V-Level 실측)을 대신 적는다(`VocabColophon`).
// 학령 밖이라고 수준이 없는 게 아니다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · 중앙값이 **각인돼 있는 세트만** 본다(`curation_query.level`). 없으면 건너뛴다 —
//   `scripts/vocab/stamp-imprint.mts` 를 먼저 돌릴 것.
// · 계단을 **비우기만 한다.** 새 계단을 박지 않는다 — 그건 발행 경로가 할 일이다.
// · 기본은 드라이런. 실제로 고치려면 `--commit`.
// · **재실행 안전** — 두 번째 실행은 "고칠 것 0" 을 낸다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/fix-ladder-above.mts [--commit]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { resolveLadderStep } from '@vocaflow/library-pipeline/vocab-brand'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const COMMIT = process.argv.includes('--commit')

/** 사다리의 꼭대기 — `publish.ts` 의 `LADDER_TOP` 과 같은 값이어야 한다. */
const LADDER_TOP = 7
/** 학습자의 공용 서가에 뜨지 않는 칸. */
const HIDDEN = ['library_book', 'library_article']

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 (apps/web/.env.local)')
  process.exit(1)
}
const client = createClient(url, key, { auth: { persistSession: false } })

interface Row {
  id: string
  slug: string | null
  title: string
  ladder_step: number | null
  curation_query: {
    blueprint?: string
    level?: { median: number; min: number; max: number; measured: number }
  } | null
}

const { data, error } = await client
  .from('shared_word_sets')
  .select('id, slug, title, ladder_step, curation_query')
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN.join(',')})`)
if (error) throw new Error(`shared_word_sets: ${error.message}`)

const rows = (data ?? []) as Row[]
let noLevel = 0
const toFix: Array<{ id: string; slug: string; title: string; from: number; median: number }> = []

for (const r of rows) {
  const level = r.curation_query?.level
  if (!level || typeof level.median !== 'number') {
    noLevel += 1
    continue
  }
  const aboveLadder = level.median > LADDER_TOP
  // **정본 함수에 묻는다.** 규칙을 여기서 다시 적으면 두 곳이 갈라진다.
  const correct = resolveLadderStep({
    blueprint: r.curation_query?.blueprint ?? null,
    suggested: aboveLadder ? null : level.median,
    aboveLadder,
  })
  if (correct == null && r.ladder_step != null) {
    toFix.push({
      id: r.id,
      slug: r.slug ?? r.id,
      title: r.title,
      from: r.ladder_step,
      median: level.median,
    })
  }
}

for (const f of toFix) {
  console.info(
    `  ${f.slug.padEnd(34)} ${f.title.slice(0, 20).padEnd(22)}`
    + ` ${f.from}단 → 미배정 (낱말 중앙값 V${f.median})`,
  )
}

if (COMMIT && toFix.length > 0) {
  const { error: upErr } = await client
    .from('shared_word_sets')
    .update({ ladder_step: null })
    .in('id', toFix.map((f) => f.id))
  if (upErr) throw new Error(`계단 비우기 실패: ${upErr.message}`)
}

console.info('')
console.info(`발행 ${rows.length} · 각인 없음 ${noLevel} · 고칠 것 ${toFix.length}`)
console.info(COMMIT ? `  계단을 비웠다 ${toFix.length}건` : '  드라이런 — --commit 으로 실제 반영')
