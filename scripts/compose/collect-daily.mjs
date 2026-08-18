// scripts/compose/collect-daily.mjs
//
// ACP §20 재저작 — ③ 발견의 수집을 **매일** 돌리기 위한 헤드리스 경로.
//
// 왜 매일이어야 하는가 (실측 2026-08-17):
//   RSS 는 최근분만 싣는다. 같은 12개 발행사에서 어제 항목 314건/10곳이 잡혔지만
//   5일 전 항목은 27건/3곳뿐이었다. 그런데 I15 발행 지연은 사건 후 48시간을 요구한다 —
//   즉 **오늘 수집해 두지 않으면 이틀 뒤 쓸 수 있게 익었을 때 피드에서 이미 내려가 있다.**
//   실제로 익은 것만으로 묶으면 사건 2건, 오늘분까지 있으면 23건이었다.
//   수집이 멈추면 파이프라인은 고장 나는 게 아니라 **굶는다** — 화면상 구별이 안 된다.
//
// 이 스크립트는 Admin ③ 발견의 "수집" 과 같은 collectStories 를 쓴다(경로가 갈리면
//   화면에서 되는 것이 배치에서 안 되는 상황이 생긴다). 다른 점은 두 가지다:
//   ① 피드 건강 기록 실패를 삼키지 않고 그대로 보고한다(서버 액션은 allSettled 로 삼킨다 —
//      기록이 조용히 실패하면 피드 표가 "한 번도 수집 안 됨" 이라고 거짓말한다).
//   ② 사람이 보지 않으므로 결과를 표준출력에 요약한다.
//
// 재실행 안전: 후보는 url 유일키로 upsert(ignoreDuplicates)라 몇 번을 돌려도 늘지 않는다.
//   보류(holding)된 기사도 저장해 두므로 48시간 뒤 저절로 익는다.
//
// 실행: pnpm dlx tsx scripts/compose/collect-daily.mjs [--commit]
//   스케줄 예: 매일 1회. cron/작업 스케줄러 어느 쪽이든 된다.

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const commit = process.argv.includes('--commit')
const TIMEOUT_MS = 12_000

const { createClient } = await import('@supabase/supabase-js')
const { collectStories, clusterStories } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const deps = {
  async fetchText(url, headers) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' })
      return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : '' }
    } catch (e) {
      // 네트워크 실패는 이 피드 하나의 문제다 — 수집 전체를 죽이지 않는다.
      return { ok: false, status: 0, text: '' }
    } finally {
      clearTimeout(timer)
    }
  },
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

const { data: feedRows, error: feedErr } = await db
  .from('article_compose_feeds')
  .select('id, source_key, url, label, enabled')
  .eq('enabled', true)
if (feedErr) throw new Error('피드 조회 실패: ' + feedErr.message)
if (!feedRows?.length) {
  console.log('활성 피드가 없습니다 — ② 피드에서 먼저 켜야 합니다.')
  process.exit(0)
}

console.log(`활성 피드 ${feedRows.length}개 수집 ${commit ? '' : '(dry-run)'}\n`)

const report = await collectStories(
  feedRows.map((f) => ({ sourceKey: f.source_key, url: f.url, label: f.label, enabled: true })),
  deps,
)

const members = [...report.pursue, ...report.singleLine].flatMap((c) => c.members)
const seen = [...members, ...report.holding]

console.log(`요청 ${report.requests} · 추적 가능 사건 ${report.pursue.length} · 단일계통 ${report.singleLine.length} · 보류 ${report.holding.length}`)
if (report.skipped.length) {
  console.log(`\n건너뛴 피드 ${report.skipped.length}:`)
  for (const s of report.skipped) console.log(`  - ${s.url}\n      ${s.reason}`)
}

if (!commit) {
  console.log('\n--commit 을 붙이면 후보와 피드 건강을 저장합니다.')
  process.exit(0)
}

// ① 피드 건강 — 실패를 삼키지 않는다.
const now = new Date().toISOString()
let healthFail = 0
for (const f of feedRows) {
  let host = ''
  try {
    host = new URL(f.url).host.toLowerCase()
  } catch {
    host = ''
  }
  const { error } = await db
    .from('article_compose_feeds')
    .update({
      robots_status: report.robots[host] ?? null,
      robots_at: now,
      last_polled_at: now,
      last_found: members.filter((m) => m.sourceKey === f.source_key).length,
      last_note: report.skipped.find((s) => s.url === f.url)?.reason ?? null,
    })
    .eq('id', f.id)
  if (error) {
    healthFail++
    console.error(`  ⚠ 피드 건강 기록 실패 (${f.source_key} ${f.url}): ${error.message}`)
  }
}

// ② 후보 보관 — 오늘 보류된 것이 이틀 뒤 익는다.
let stored = 0
const withDate = seen.filter((m) => m.published_at)
if (withDate.length) {
  const { error, count } = await db.from('article_compose_candidates').upsert(
    withDate.map((m) => ({
      source_key: m.sourceKey,
      publisher: m.publisher,
      wire: m.wire,
      title: m.title,
      url: m.url,
      published_at: m.published_at,
    })),
    { onConflict: 'url', ignoreDuplicates: true, count: 'exact' },
  )
  if (error) throw new Error('후보 저장 실패: ' + error.message)
  stored = count ?? 0
}

// ③ 실질 목록은 **보관된 익은 후보 전체**를 다시 묶은 결과다.
//    이번 수집분만 묶으면 거의 늘 0 이 나온다 — 갓 올라온 기사는 48시간 보류에 걸리기 때문이다.
//    그 0 을 그대로 보고하면 "굶은 것" 과 "고장난 것" 이 화면에서 똑같아 보인다.
const { data: ripeRows } = await db
  .from('article_compose_candidates')
  .select('source_key, publisher, wire, title, url, published_at')
  .eq('status', 'open')
  .lt('published_at', new Date(Date.now() - 48 * 3_600_000).toISOString())
  .order('published_at', { ascending: false })
  .limit(400)

const stored_clusters = clusterStories(
  (ripeRows ?? []).map((r) => ({
    sourceKey: r.source_key,
    publisher: r.publisher,
    wire: r.wire,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    holdMs: 0,
  })),
)
const pursuable = stored_clusters.filter((c) => c.worthPursuing)

console.log(`\n저장: 새 후보 ${stored} (수집 ${withDate.length}) · 익은 후보 ${(ripeRows ?? []).length}`)
console.log(`피드 건강 기록 ${feedRows.length - healthFail}/${feedRows.length}`)
console.log(`\n■ 지금 취재 가능한 사건 ${pursuable.length}건 (독립 2계통 이상)`)
for (const c of pursuable.slice(0, 12)) {
  console.log(`  · ${c.headline}`)
  console.log(`      계통 ${c.independentLines} · ${c.members.map((m) => m.publisher).join(', ')}`)
}
if (!pursuable.length) {
  console.log('  없음. 고장이 아니라 재료가 모자란 것이다 — 매일 돌면 저절로 늘어난다.')
}
if (healthFail) process.exitCode = 1
