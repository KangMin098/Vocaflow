// scripts/vocab/reconcile-ladder.mts
//
// **발행 단어장의 계단을 정본 규칙 하나로 맞춘다** (`shared_word_sets.ladder_step`).
//
// ── 왜 하나로 합쳤나 (실측 2026-08-31) ──────────────────────────────
// 이 컬럼에 **규칙이 다른 writer 가 둘** 있었다:
//
//   · `lib/vcb/compose/publish.ts` — `resolveLadderStep` 을 쓴다. **청사진 바닥을 지킨다.**
//   · `scripts/vocab/backfill-ladder-step.mjs` — 낱말 중앙값을 그대로 계단으로 썼다.
//     바닥 규칙 참조가 **0회**였다.
//
// 그래서 발행 시점에 계단이 안 정해진 권은 backfill 이 바닥을 무시하고 앉혔다. 결과:
//
//   · `반대말 짝`(antonym-pair) → **2단**. 정본 사다리는 그 원리가 **4단에서 열린다** 고
//     못박고 있다("뜻이 겹치고 갈리는 자리").
//   · `함께 쓰는 말`(collocation) → 2단. 열리는 자리는 3단("중학 서술형이 덩어리를 요구").
//   · `해금`(unlock) · `챕터 부록`(chapter-companion) → 2단. 열리는 자리는 3단.
//
// 즉 **초등 고학년 칸에 중학 과제가 놓여 있었다.** 바닥 규칙은 "쉬운 낱말로 만들었어도
// 묶는 원리가 어려우면 그 권은 어려운 권이다" 라는 뜻인데, 그 규칙을 모르는 writer 가
// 나중에 덮어쓴 것이다.
//
// ── 이 스크립트가 정본이다 ──────────────────────────────────────────
// 발행 시점의 저작은 `publish.ts` 가 하고, **이미 발행된 것의 재도출은 여기만 한다.**
// 계산은 `resolveLadderStep` 에 그대로 맡긴다 — 규칙을 여기서 다시 적으면 셋이 갈라진다.
//
//   ① 청사진 바닥(`stepOpeningBlueprint`) 과 ② 낱말 실측 중앙값 중 **높은 쪽**.
//   중앙값이 사다리 위(V8+)면 **비운다** — 바닥으로 내려보내지 않는다.
//
// 이 스크립트가 대체한 것: `backfill-ladder-step.mjs`(바닥 무시) ·
// `fix-ladder-above.mts`(비우기만 함). 둘 다 지웠다 — 한 컬럼에 writer 가 여럿이면
// 반드시 다시 갈라진다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · 중앙값이 **각인된 세트만** 본다(`curation_query.level`). 없으면 건너뛰고 그 수를 알린다 —
//   `scripts/vocab/stamp-imprint.mts` 를 먼저 돌릴 것.
// · 기본은 드라이런. 실제로 고치려면 `--commit`.
// · **재실행 안전** — 두 번째 실행은 "고칠 것 0" 을 낸다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/reconcile-ladder.mts [--commit]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { resolveLadderStep, stepOpeningBlueprint } from '@vocaflow/library-pipeline/vocab-brand'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const COMMIT = process.argv.includes('--commit')

/** 사다리의 꼭대기 — `lib/vcb/compose/publish.ts` 의 `LADDER_TOP` 과 같은 값이어야 한다. */
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
    level?: { median: number }
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
let same = 0
const changes: Array<{
  id: string; slug: string; title: string
  from: number | null; to: number | null
  median: number; floor: number | null; why: string
}> = []

for (const r of rows) {
  const median = r.curation_query?.level?.median
  const blueprint = r.curation_query?.blueprint ?? null
  if (typeof median !== 'number') {
    noLevel += 1
    continue
  }
  const aboveLadder = median > LADDER_TOP
  const floor = stepOpeningBlueprint(blueprint)
  // **정본 함수에 묻는다.** 규칙을 여기서 다시 적으면 세 곳이 갈라진다.
  const correct = resolveLadderStep({
    blueprint,
    suggested: aboveLadder ? null : median,
    aboveLadder,
  })

  if (correct === r.ladder_step) {
    same += 1
    continue
  }
  const why = aboveLadder
    ? `낱말 중앙값 V${median} — 사다리 위`
    : floor != null && floor > median
      ? `청사진 바닥 ${floor}단 (중앙값 V${median} 보다 높다)`
      : `낱말 중앙값 V${median}`
  changes.push({
    id: r.id,
    slug: r.slug ?? r.id,
    title: r.title,
    from: r.ladder_step,
    to: correct,
    median,
    floor,
    why,
  })
}

changes.sort((a, b) => (a.to ?? 99) - (b.to ?? 99) || a.slug.localeCompare(b.slug))
for (const c of changes) {
  console.info(
    `  ${c.slug.padEnd(30)} ${c.title.slice(0, 18).padEnd(20)}`
    + ` ${String(c.from ?? '—').padStart(2)}단 → ${String(c.to ?? '미배정').padEnd(4)}  ${c.why}`,
  )
}

if (COMMIT) {
  for (const c of changes) {
    const { error: upErr } = await client
      .from('shared_word_sets')
      .update({ ladder_step: c.to })
      .eq('id', c.id)
    if (upErr) throw new Error(`계단 갱신 실패(${c.slug}): ${upErr.message}`)
  }
}

console.info('')
console.info(`발행 ${rows.length} · 각인 없음 ${noLevel} · 이미 맞음 ${same} · 고칠 것 ${changes.length}`)
console.info(COMMIT ? `  갱신함 ${changes.length}건` : '  드라이런 — --commit 으로 실제 반영')
