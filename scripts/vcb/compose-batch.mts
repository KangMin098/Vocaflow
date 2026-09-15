// scripts/vcb/compose-batch.mts
//
// **컴포저 배치 — 계획 파일 하나로 여러 권을 연달아 조립·채점·발행한다.**
//
// ── 왜 CLI 를 반복 호출하지 않는가 ──────────────────────────────────
// `compose-publish.mts` 는 한 번 뜰 때마다 **기존 발행 낱말 전량**을 읽는다
// (`fetchPublishedWords` — novelty 대조군). 20권을 낼 때 그것을 20번 하면 대부분의 시간이
// 거기 간다. 여기서는 한 번 읽어 **모든 권이 나눠 쓴다.**
//
// ⚠️ 그 공유에는 대가가 있다: 배치 안에서 먼저 낸 권은 **다음 권의 대조군에 들어가지 않는다.**
//    그래서 배치가 끝난 뒤 novelty 는 실제보다 후하게 나와 있다. 배치 직후 평가를 다시
//    돌려 확인할 것(`--recheck` 가 그 일을 한다).
//
// ── 안전 ────────────────────────────────────────────────────────────
// · 기본은 드라이런 — `--commit` 없이는 아무것도 쓰지 않는다.
// · **통과선 미달은 발행하지 않는다**(`--force` 없이는). 한 권이 막혀도 나머지는 계속 간다 —
//   막힌 권은 끝에 이유와 함께 모아 보고한다.
// · 발행은 slug 기준 멱등이다(`publishComposedSet`). 같은 계획을 다시 돌리면 같은 권이 갱신된다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/compose-batch.mts \
//     --plan scripts/vcb/data/compose-plan-<날짜>.json [--commit] [--only <slug,slug>]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { getBlueprint, type BlueprintParams } from '@/lib/vcb/compose/blueprints'
import { PASS_THRESHOLD } from '@/lib/vcb/compose/evaluate'
import { publishComposedSet } from '@/lib/vcb/compose/publish'
import { fetchPublishedWords } from '@/lib/vcb/compose/resolve'
import { dryRun } from '@/lib/vcb/compose/run'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const argv = process.argv.slice(2)
const arg = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const COMMIT = argv.includes('--commit')
const FORCE = argv.includes('--force')
const ONLY = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null

const planPath = arg('plan')
if (!planPath) {
  console.error('--plan <파일> 필요')
  process.exit(1)
}

interface PlanEntry {
  blueprint: string
  /** 왜 이 권을 내는가 — 계획 파일을 읽는 사람을 위한 줄. 산출물에는 안 들어간다. */
  why?: string
  params: BlueprintParams
}
const plan: PlanEntry[] = JSON.parse(fs.readFileSync(path.resolve(planPath), 'utf8')).volumes

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 (apps/web/.env.local)')
  process.exit(1)
}
const client = createClient(url, key, { auth: { persistSession: false } })

// 대조군은 **한 번만** 읽는다 — 위 머리 주석의 대가를 감수한 선택이다.
const existingWords = await fetchPublishedWords(client, { limitSets: 400 })
console.info(`novelty 대조군 ${existingWords.size.toLocaleString()}낱말 (발행 세트 전량)\n`)

const passed: string[] = []
const blocked: Array<{ slug: string; why: string[] }> = []
const failed: Array<{ slug: string; why: string }> = []

for (const entry of plan) {
  const slugHint = entry.params.slug ?? entry.blueprint
  if (ONLY && !ONLY.includes(slugHint)) continue
  if (!getBlueprint(entry.blueprint)) {
    failed.push({ slug: slugHint, why: `알 수 없는 blueprint: ${entry.blueprint}` })
    continue
  }

  try {
    const result = await dryRun(client, entry.blueprint, entry.params, {
      existingWords,
      maxPopulation: 8000,
      now: new Date().toISOString(),
    })
    const card = result.scorecard
    const slug = result.recipe.meta.slug
    const ok = card.passed && card.total >= PASS_THRESHOLD
    const mark = ok ? '✓' : '✗'
    console.info(
      `${mark} ${slug.padEnd(28)} ${result.recipe.meta.title.slice(0, 24).padEnd(26)}`
      + ` 낱말 ${String(card.entry_count).padStart(5)} · 목차 ${String(card.group_count).padStart(3)}`
      + ` · 총점 ${card.total.toFixed(2)}`,
    )

    if (!ok && !FORCE) {
      blocked.push({
        slug,
        why: card.blockers.length > 0 ? card.blockers : [`총점 ${card.total.toFixed(2)} < ${PASS_THRESHOLD}`],
      })
      continue
    }

    if (!COMMIT) {
      passed.push(slug)
      continue
    }

    const out = await publishComposedSet(client, result.set, {
      scorecard: card,
      existingWords,
      force: FORCE,
    })
    if (out.ok) {
      passed.push(slug)
      // 새로 낸 낱말은 **다음 권의 대조군에 넣는다** — 배치 안에서 서로를 복제하지 않게.
      for (const e of result.set.entries) existingWords.add(e.candidate.word)
    } else {
      failed.push({ slug, why: out.error ?? out.blocked_by?.join(' · ') ?? 'unknown' })
    }
  } catch (err) {
    failed.push({ slug: slugHint, why: err instanceof Error ? err.message : String(err) })
  }
}

console.info('')
console.info(`계획 ${plan.length} · ${COMMIT ? '발행' : '통과'} ${passed.length} · 통과선 미달 ${blocked.length} · 오류 ${failed.length}`)
for (const b of blocked) console.info(`  ✗ ${b.slug} — ${b.why.join(' · ')}`)
for (const f of failed) console.info(`  ! ${f.slug} — ${f.why}`)
if (!COMMIT) console.info('\n드라이런 — 아무것도 쓰지 않았다. 발행하려면 --commit.')
