#!/usr/bin/env node
// scripts/csat/map/v4/perf-map-load.mjs
//
// GAP-15 측정 — 기록이 많은 학습자의 학습 지도(/csat/diagnosis?tab=map) 서버 응답 시간. 임시 계정 하나(map-v4-perf-*)에
// 실제 기록 API 로 시험 N회를 넣고, 같은 서버에서 페이지를 R회 받아 시간을 잰다. 끝나면 계정을 지운다(기록 cascade).
//   node --env-file=<apps/web/.env.local> scripts/csat/map/v4/perf-map-load.mjs [--base http://localhost:3002] [--sessions 15] [--runs 7] [--label after]
// 결과 한 줄(JSON)을 출력한다. --ab <이전 load.ts> <이후 load.ts>: 같은 학습자 한 명으로 두 코드를 번갈아(라운드 --rounds) 갈아 끼우며 잰다 —
//   학습자를 따로 만들면 기록 직후 스냅샷 계산 부하가 섞여 비교가 흔들렸다(2026-10-11 실측). 끝나면 이후 코드로 되돌린다.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { cleanupLeftovers, onInterrupt } from '../e2e-cleanup.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const argv = process.argv.slice(2)
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3002')
const N = Number(arg('--sessions', '15'))
const R = Number(arg('--runs', '7'))
const LABEL = arg('--label', 'run')
const AB = argv.includes('--ab') ? [argv[argv.indexOf('--ab') + 1], argv[argv.indexOf('--ab') + 2]] : null
const ROUNDS = Number(arg('--rounds', '3'))
const LOAD = path.join(ROOT, 'apps/web/src/lib/csat/map/load.ts')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, w) => { const r = await q; if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data }

const users = []
const browser = await chromium.launch()
onInterrupt(async () => { await browser.close().catch(() => {}); for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {}) })
try {
  const exams = (await must(db.from('csat_exams').select('id').eq('organizer', 'kice').order('id', { ascending: false }).limit(40), 'exams')).map((e) => e.id)
  const keyed = []
  for (const id of exams) {
    const k = await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', id), 'key')
    if (k.length === 45) keyed.push({ id, key: Object.fromEntries(k.map((r) => [r.no, r.answers[0]])) })
    if (keyed.length >= N) break
  }
  const email = `map-v4-perf-${Date.now()}@example.com`
  const password = `Pf-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
  for (let i = 0; i < N; i++) {
    const e = keyed[i % keyed.length]
    const wrong = new Set([20 + (i % 10), 31, 33, 37])
    const choices = Object.fromEntries(Object.keys(e.key).map((no) => [no, wrong.has(Number(no)) ? (e.key[no] % 5) + 1 : e.key[no]]))
    const day = new Date(Date.UTC(2025, 0, 1 + i * 7)).toISOString().slice(0, 10)
    const res = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: e.id, mode: 'live', takenAt: day, totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
    if (res.status() !== 200) throw new Error(`기록 실패 ${res.status()}`)
  }
  // 기록 직후 스냅샷 계산이 끝나기를 기다린다(그 부하가 측정에 섞이지 않게)
  for (let i = 0; i < 120; i++) {
    const snaps = await must(db.from('csat_dx_snapshot').select('id').eq('user_id', users[0]), 'snap')
    if (snaps.length >= N) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  const measure = async () => {
    await page.request.get(`${BASE}/csat/diagnosis?tab=map`) // 컴파일 · 캐시 데우기(측정에서 뺀다)
    const ms = []
    for (let i = 0; i < R; i++) {
      const t = performance.now()
      const res = await page.request.get(`${BASE}/csat/diagnosis?tab=map`)
      await res.body()
      if (res.status() !== 200) throw new Error(`페이지 ${res.status()}`)
      ms.push(Math.round(performance.now() - t))
    }
    return ms
  }
  const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  if (!AB) {
    const ms = await measure()
    console.log(JSON.stringify({ label: LABEL, sessions: N, runs: R, median: med(ms), ms }))
  } else {
    const src = AB.map((p) => fs.readFileSync(p, 'utf8'))
    const all = { before: [], after: [] }
    try {
      for (let r = 0; r < ROUNDS; r++) for (const [k, i] of r % 2 ? [['after', 1], ['before', 0]] : [['before', 0], ['after', 1]]) {
        fs.writeFileSync(LOAD, src[i])
        await new Promise((res) => setTimeout(res, 6000))
        all[k].push(...await measure())
      }
    } finally { fs.writeFileSync(LOAD, src[1]) }
    console.log(JSON.stringify({ sessions: N, rounds: ROUNDS, perRound: R, before: { median: med(all.before), n: all.before.length }, after: { median: med(all.after), n: all.after.length }, raw: all }))
  }
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  const left = await cleanupLeftovers(db, { dry: true, log: () => {} })
  console.log(`임시 계정 정리 · 남은 E2E 계정 ${left.users} · TEST 시험 ${left.exams}`)
}
