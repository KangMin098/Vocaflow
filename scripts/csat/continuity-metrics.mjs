#!/usr/bin/env node
// scripts/csat/continuity-metrics.mjs
//
// **기출분석공간 지속 학습 지표** — docs/csat/ia-design.md §5 의 정의를 funnel_events 로 계산한다.
// 읽기 전용. 분기 진단(PLATFORM_AUDIT)과 재설계 테스트 보고(docs/csat/test-report.md)가 읽는다.
//
//   node --tls-max-v1.2 scripts/csat/continuity-metrics.mjs [--days 30] [--json]
//
// 지표
//   홈 진입 상태 분포   csat_home_viewed.state          (first / return / comeback)
//   이어하기 사용률     csat_resume_clicked ÷ 이어서 카드가 설 만한 방문(state ≠ first)
//   복습 완료율         csat_review_done ÷ csat_review_started
//   재방문율 D1 · D7    첫 기출 활동일 뒤 1일째 · 7일 안에 다시 기출 이벤트가 있는 사용자 비율
//   경로 비율           csat_path_chosen.axis (need / type / exam)
//   막다른 길 해소      csat_item_back.to
//
// ⚠️ 표본이 작으면 비율은 뜻이 없다 — 분모를 늘 같이 적는다. 2026-09-24 기준 실사용은 사실상 0 이다.

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const days = Number(args[args.indexOf('--days') + 1]) > 0 && args.includes('--days') ? Number(args[args.indexOf('--days') + 1]) : 30
const asJson = args.includes('--json')

// --- 접속 (저장소 관례: apps/web/.env.local 을 직접 읽는다 — 값은 출력하지 않는다) ---
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
  }
}
const URL_ = process.env['NEXT_PUBLIC_SUPABASE_URL']
const KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!URL_ || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local).')
  process.exit(2)
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(URL_, KEY, { auth: { persistSession: false } })

const DAY = 86_400_000
const since = new Date(Date.now() - days * DAY).toISOString()

// 키셋 페이징(시각 기준) — OFFSET 은 뒤로 갈수록 느려진다(offset-paging-budget 회귀)
const rows = []
let cursor = since
for (;;) {
  const { data, error } = await db
    .from('funnel_events')
    .select('id, event, user_id, occurred_at, meta')
    .like('event', 'csat_%')
    .gt('occurred_at', cursor)
    .order('occurred_at', { ascending: true })
    .limit(1000)
  if (error) {
    console.error(`funnel_events 조회 실패: ${error.message}`)
    process.exit(1)
  }
  rows.push(...(data ?? []))
  if (!data || data.length < 1000) break
  cursor = data[data.length - 1].occurred_at
}

const props = (r) => (r.meta && typeof r.meta === 'object' ? (r.meta.props ?? r.meta) : {})
const of = (name) => rows.filter((r) => r.event === name)
const count = (list, key) => list.reduce((acc, r) => ((acc[props(r)[key] ?? '?'] = (acc[props(r)[key] ?? '?'] ?? 0) + 1), acc), {})
const ratio = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)}% (${a}/${b})` : `— (0/${b})`)

const home = of('csat_home_viewed')
const eligible = home.filter((r) => props(r).state !== 'first').length
const resume = of('csat_resume_clicked')
const started = of('csat_review_started').length
const done = of('csat_review_done').length

// 재방문: 사용자별 기출 활동 날짜(UTC 일)
const byUser = new Map()
for (const r of rows) {
  if (!r.user_id) continue
  const d = Math.floor(new Date(r.occurred_at).getTime() / DAY)
  const set = byUser.get(r.user_id) ?? new Set()
  set.add(d)
  byUser.set(r.user_id, set)
}
const today = Math.floor(Date.now() / DAY)
let d1Base = 0, d1 = 0, d7Base = 0, d7 = 0
for (const set of byUser.values()) {
  const first = Math.min(...set)
  if (first + 1 <= today) {
    d1Base += 1
    if (set.has(first + 1)) d1 += 1
  }
  if (first + 7 <= today) {
    d7Base += 1
    if ([...set].some((d) => d > first && d <= first + 7)) d7 += 1
  }
}

const report = {
  window_days: days,
  events: rows.length,
  users: byUser.size,
  home_state: count(home, 'state'),
  resume_rate: ratio(resume.length, eligible),
  resume_from: count(resume, 'from'),
  review_completion: ratio(done, started),
  revisit_d1: ratio(d1, d1Base),
  revisit_d7: ratio(d7, d7Base),
  path_axis: count(of('csat_path_chosen'), 'axis'),
  path_need: count(of('csat_path_chosen'), 'need'),
  item_back: count(of('csat_item_back'), 'to'),
}

if (asJson) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`기출분석공간 지속 학습 지표 — 최근 ${days}일 · 이벤트 ${report.events} · 사용자 ${report.users}`)
  for (const [k, v] of Object.entries(report)) if (!['window_days', 'events', 'users'].includes(k)) console.log(`  ${k.padEnd(18)} ${typeof v === 'string' ? v : JSON.stringify(v)}`)
}
