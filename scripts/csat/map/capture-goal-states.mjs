#!/usr/bin/env node
// scripts/csat/map/capture-goal-states.mjs
//
// 학습 지도 목표 중심 재설계(2026-10-08) — 학습자 상태별로 같은 계정을 여러 서버에서 1440px 로 찍는다(전후 비교 · 상태 E2E 의 재료).
//   A 목표 설정 전(기록 없음) · B 목표 80 · 기록 없음 · C 목표 80 · 분석 준비 전 시험 기록 · D 목표 80 · 분석된 시험 1회(먼저 확인)
//   F 목표 80 · 분석된 시험 2회(이전 ↔ 최근 비교)
// 상태 E(직접 확인된 원인)는 지금 DB 에 verified_diagnosis 를 만드는 경로가 없어 만들지 않는다 — 화면 계약만 단위 테스트로 본다.
// 계정은 실행이 끝나면 지운다(기록 cascade). 개발 프로젝트가 아니면 멈춘다.
//   node --env-file=<apps/web/.env.local> scripts/csat/map/capture-goal-states.mjs --base http://localhost:3002 [--base http://localhost:3000] [--out tmp/map-goal] [--tag after]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const argv = process.argv.slice(2)
const bases = argv.flatMap((a, i) => (a === '--base' ? [argv[i + 1]] : []))
const OUT = path.join(ROOT, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'tmp/map-goal')
const TAG = argv.includes('--tag') ? argv[argv.indexOf('--tag') + 1] : 'run'
if (!bases.length) throw new Error('--base 가 필요하다')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
fs.mkdirSync(OUT, { recursive: true })

const READY = 'M2409'
const users = []
async function login(browser, base, email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const p = await ctx.newPage()
  p.setDefaultTimeout(240_000)
  await p.goto(`${base}/login`, { waitUntil: 'networkidle' })
  await p.fill('input[type="email"]', email)
  await p.fill('input[type="password"]', password)
  await p.click('button[type="submit"]')
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
  await p.close()
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  return { page, ctx }
}
async function account(tag) {
  const email = `map-goal-${tag}-${Date.now()}@example.com`
  const password = `Mg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  return { email, password, id: data.user.id }
}

const browser = await chromium.launch()
const shots = []
try {
  const readyKey = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
  if (Object.keys(readyKey).length !== 45) throw new Error(`${READY} 정답표가 45문항이 아니다`)
  const offExam = (await must(db.from('csat_exams').select('id').eq('diagnosis_ready', false).eq('organizer', 'kice').order('id', { ascending: false }).limit(20), 'off'))
  let OFF = null
  for (const e of offExam) { if ((await must(db.from('csat_dx_answer_key').select('no').eq('exam_id', e.id), 'n')).length === 45) { OFF = e.id; break } }
  const offKey = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', OFF), 'offkey')).map((k) => [k.no, k.answers[0]]))
  const answers = (key, wrong) => Object.fromEntries(Object.keys(key).map((no) => [no, wrong.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  // 문장 관계 쪽 오답 패턴(e2e-map-states 와 같은 근거) · 두 번째 회차는 몇 문항 덜 틀린다
  const W1 = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const W2 = new Set([23, 32, 33, 36, 37, 38, 39])

  const STATES = [
    { key: 'A', goal: null, records: [] },
    { key: 'B', goal: 80, records: [] },
    { key: 'C', goal: 80, records: [{ exam: OFF, key: offKey, wrong: W1, takenAt: '2026-09-20' }] },
    { key: 'D', goal: 80, records: [{ exam: READY, key: readyKey, wrong: W1, takenAt: '2026-09-20' }] },
    { key: 'F', goal: 80, records: [{ exam: READY, key: readyKey, wrong: W1, takenAt: '2026-09-06' }, { exam: READY, key: readyKey, wrong: W2, takenAt: '2026-09-27' }] },
  ]
  for (const st of STATES) {
    const acc = await account(st.key.toLowerCase())
    // 기록 · 목표는 첫 서버로 한 번만(같은 DB) — 다른 서버는 같은 계정으로 보기만 한다
    const first = await login(browser, bases[0], acc.email, acc.password)
    for (const r of st.records) {
      const res = await first.page.request.post(`${bases[0]}/api/csat/diagnosis/sessions`, { data: { examId: r.exam, mode: 'live', takenAt: r.takenAt, totalMinutes: 70, clientKey: crypto.randomUUID(), choices: answers(r.key, r.wrong), flags: {} } })
      if (res.status() !== 200) throw new Error(`${st.key} 기록 실패 ${res.status()} ${await res.text()}`)
    }
    if (st.goal !== null) {
      const res = await first.page.request.put(`${bases[0]}/api/csat/diagnosis/map/goal`, { data: { target: st.goal } })
      if (res.status() !== 200) throw new Error(`${st.key} 목표 실패 ${res.status()}`)
    }
    await first.ctx.close()
    for (const base of bases) {
      const { page, ctx } = await login(browser, base, acc.email, acc.password)
      await page.goto(`${base}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(1500)
      const port = new URL(base).port
      const file = path.join(OUT, `${TAG}-${port}-${st.key}.png`)
      await page.screenshot({ path: file, fullPage: false })
      shots.push(file)
      await ctx.close()
    }
    console.log(`· 상태 ${st.key} 캡처`)
  }
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  console.log(JSON.stringify({ shots: shots.map((s) => path.relative(ROOT, s)), cleaned: users.length }))
}
