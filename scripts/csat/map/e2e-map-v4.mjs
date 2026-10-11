#!/usr/bin/env node
// scripts/csat/map/e2e-map-v4.mjs
//
// 학습 지도 rev4.0 「목표까지 필요한 학습」 E2E — 실제 개발 DB · 실제 기록 API · 실제 브라우저(1440px, 390px 캡처 1장).
//   A 목표 없음 · 기록 없음  C 목표 80 · 분석 준비 전 시험만  D 목표 80 · M2409(진단 반영) — 확인 문항으로 이동 · 목표 60 으로 변경
//   F 지난 시험(2024 시행) — 현재 기준 재분석 표시  P 과거 기준(?asof=) — 기준 뒤 기록 제외 · 정확 재현 아님 표시
// 임시 계정(@example.com — 합성 계정)만 만들고 끝에 지운다(기록 cascade). 개발 프로젝트가 아니면 멈춘다. 종료 코드 0 = 모든 단언 통과.
// e2e-map-goal.mjs 와 같은 도우미 · 같은 정리 방식.
//   node --env-file=<apps/web/.env.local> scripts/csat/map/e2e-map-v4.mjs [--base http://localhost:3002] [--out tmp/map-v4]
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
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3002')
const OUT = path.join(ROOT, arg('--out', 'tmp/map-v4'))
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

const READY = 'M2409'
const users = []
const browser = await chromium.launch()
try {
  const keyOf = async (id) => Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', id), 'key')).map((k) => [k.no, k.answers[0]]))
  const readyKey = await keyOf(READY)
  let OFF = null
  for (const e of await must(db.from('csat_exams').select('id').eq('diagnosis_ready', false).eq('organizer', 'kice').order('id', { ascending: false }).limit(20), 'off')) {
    if ((await must(db.from('csat_dx_answer_key').select('no').eq('exam_id', e.id), 'n')).length === 45) { OFF = e.id; break }
  }
  const offKey = await keyOf(OFF)
  const answers = (key, wrong) => Object.fromEntries(Object.keys(key).map((no) => [no, wrong.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const W1 = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const today = new Date().toISOString().slice(0, 10)

  async function learner(tag, goal, records, viewport = { width: 1440, height: 1000 }) {
    const email = `map-v4-e2e-${tag}-${Date.now()}@example.com`
    const password = `Mv-${crypto.randomBytes(9).toString('base64url')}-Aa1`
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    users.push(data.user.id)
    const ctx = await browser.newContext({ viewport })
    const login = await ctx.newPage()
    login.setDefaultTimeout(240_000)
    await login.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await login.fill('input[type="email"]', email)
    await login.fill('input[type="password"]', password)
    await login.click('button[type="submit"]')
    await login.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
    await login.close()
    const page = await ctx.newPage()
    page.setDefaultTimeout(240_000)
    for (const r of records) {
      const res = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: r.exam, mode: 'live', takenAt: r.takenAt, totalMinutes: 70, clientKey: crypto.randomUUID(), choices: answers(r.key, r.wrong), flags: {} } })
      if (res.status() !== 200) throw new Error(`${tag} 기록 실패 ${res.status()}`)
    }
    if (goal !== null) {
      const res = await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: goal } })
      if (res.status() !== 200) throw new Error(`${tag} 목표 실패`)
    }
    // 기록 직후 스냅샷(축 관찰) 계산을 기다린다 — 그 전에는 화면이 「새 기록을 분석에 반영하는 중」을 보인다(단위 테스트 ⑤-2)
    for (let i = 0; records.length > 0 && i < 60; i++) {
      const snaps = await must(db.from('csat_dx_snapshot').select('id').eq('user_id', data.user.id).limit(1), 'snapshot')
      if (snaps.length > 0) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    return { page, ctx }
  }
  const open = async (page, q = '') => {
    await page.goto(`${BASE}/csat/diagnosis?tab=map${q}`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="need-panel"]').waitFor()
    await page.waitForLoadState('networkidle').catch(() => {})
    return page.locator('[data-testid="need-panel"]')
  }
  // 공통 — 실력 단정 낱말 · 퍼센트 · 막대 · 내부 코드 없음, 제목과 내용이 겹치지 않음, 가로 넘침 없음
  const common = async (page, panel, tag) => {
    const text = await panel.innerText()
    rec(`${tag} · 약점 · 실력 부족 단정 없음`, !/약점|실력이 부족|취약/.test(text), text.match(/약점|실력이 부족|취약/)?.[0] ?? '')
    rec(`${tag} · 퍼센트 · 숙달률 없음`, !/\d+\s*%/.test(text))
    rec(`${tag} · 내부 코드(A1 · R5 · 54라인 · TASK id) 없음`, !/\b[A-JPRSTVX]\d{1,2}\b|54\s*라인|[a-z]\.[a-z_]+\b/.test(text.replace(/rev4\.0-draft-\d+/g, '')), text.match(/\b[A-JPRSTVX]\d{1,2}\b|[a-z]\.[a-z_]+\b/)?.[0] ?? '')
    // 제목과 바로 다음 요소의 사각형이 실제로 교차하는가(같은 줄에 나란히 놓인 것은 겹침이 아니다)
    const overlap = await panel.evaluate((root) => {
      const bad = []
      for (const h of root.querySelectorAll('h2, h3')) {
        const next = h.nextElementSibling
        if (!next) continue
        const a = h.getBoundingClientRect()
        const b = next.getBoundingClientRect()
        const cross = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
        if (cross) bad.push(h.textContent)
      }
      return bad
    })
    rec(`${tag} · 제목과 내용이 겹치지 않음`, overlap.length === 0, overlap)
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    rec(`${tag} · 가로 넘침 없음`, !wide)
    return text
  }

  // A — 목표 없음 · 기록 없음
  {
    const { page } = await learner('a', null, [])
    const panel = await open(page)
    await common(page, panel, 'A')
    rec('A · 「시험 기록 없음」 + 기록하기 링크', /시험 기록 없음/.test(await panel.locator('[data-testid="need-records"]').innerText()) && (await panel.locator('[data-testid="need-record-cta"]').count()) === 1)
    rec('A · 목표 없음 — 순서 대신 안내(To-Be 없음)', (await panel.locator('[data-testid="need-no-goal"]').count()) === 1 && (await panel.getAttribute('data-goal-set')) === 'false')
    rec('A · 영역 근거는 목표 없이도 보임(「기록 없음」)', /기록 없음/.test(await panel.locator('[data-testid="need-domains"]').innerText()))
    rec('A · 보류 영역(듣기 · 실전) 진단 · 요구 없음 문구', /듣기 · 실전[\s\S]*진단 · 학습 요구를 만들지 않아요/.test(await panel.locator('[data-testid="need-domains"]').innerText()))
    await page.screenshot({ path: path.join(OUT, 'v4-A-1440.png'), fullPage: true })
  }

  // C — 목표 80 · 분석 준비 전 시험만
  {
    const { page } = await learner('c', 80, [{ exam: OFF, key: offKey, wrong: W1, takenAt: today }])
    const panel = await open(page)
    await common(page, panel, 'C')
    const recs = await panel.locator('[data-testid="need-records"]').innerText()
    rec('C · 분석 불가 시험 = 「이 시험은 분석 준비 중」(능력 부족 아님)', /이 시험은 분석 준비 중/.test(recs), recs.slice(0, 160))
    rec('C · 영역 상태 「분석 준비 중인 시험만 있음」', /분석 준비 중인 시험만 있음/.test(await panel.locator('[data-testid="need-domains"]').innerText()))
    rec('C · 근거로 쓴 시험 0회', /근거로 쓴 시험 0회/.test(await panel.locator('[data-testid="need-basis"]').innerText()))
    await page.screenshot({ path: path.join(OUT, 'v4-C-1440.png'), fullPage: true })
  }

  // D — 목표 80 · M2409(진단 반영)
  let dPage = null
  {
    const { page } = await learner('d', 80, [{ exam: READY, key: readyKey, wrong: W1, takenAt: today }])
    dPage = page
    const panel = await open(page)
    await common(page, panel, 'D')
    rec('D · 근거로 쓴 시험 1회', /근거로 쓴 시험 1회/.test(await panel.locator('[data-testid="need-basis"]').innerText()))
    rec('D · 시험 기록 「근거에 사용」', /근거에 사용/.test(await panel.locator('[data-testid="need-records"]').innerText()))
    rec('D · 오늘 시행한 기록에는 「지난 기록 재분석」 표시 없음(날짜 비교 회귀)', (await panel.locator('[data-testid="need-reanalyzed"]').count()) === 0)
    const doms = await panel.locator('[data-testid="need-domains"]').innerText()
    rec('D · 영역 근거가 기록에서 나옴(관찰 · 먼저 확인 · 기록 더 필요 중 하나)', /기출에서 관찰됨|먼저 확인할 후보|기록 더 필요/.test(doms), doms.slice(0, 200))
    const n80 = Number(await panel.locator('[data-testid="need-list"]').getAttribute('data-count'))
    rec('D · 목표 80 학습 요구 생성', n80 > 0, n80)
    const goCount = await panel.locator('[data-testid="need-list"] [data-testid="need-go"]').count()
    const firstGo = await panel.locator('[data-testid="need-list"] li').first().locator('[data-testid="need-go"]').count()
    rec('D · 지금 확인할 수 있는 항목이 있으면 그것이 맨 앞', goCount === 0 || firstGo === 1, { goCount, firstGo })
    const ws = await panel.locator('[data-testid="need-workspace"]').getAttribute('data-ws')
    rec('D · 대표 Workspace = 확인 콘텐츠가 있는 셋 중 하나', ['ws.central-meaning', 'ws.option-match', 'ws.evidence-locate'].includes(ws), ws)
    const stages = await panel.locator('[data-testid="need-workspace"] [data-stage]').evaluateAll((els) => els.map((e) => ({ k: e.getAttribute('data-stage'), ready: e.getAttribute('data-ready') })))
    rec('D · 확인 전 — 확인만 열리고 바로잡기 · 적용 · 다시 확인은 닫힘', stages.find((s) => s.k === 'check')?.ready === 'true' && stages.filter((s) => s.k !== 'check').every((s) => s.ready === 'false'), stages)
    const listBefore = await panel.locator('[data-testid="need-list"]').innerText()
    const domsBefore = doms
    await page.screenshot({ path: path.join(OUT, 'v4-D-1440-goal80.png'), fullPage: true })
    await panel.screenshot({ path: path.join(OUT, 'v4-D-panel-goal80.png') })

    // 목표 변경(60) — 화면에서 바꾸고 다시 계산
    await page.locator('[data-testid="map-goal-edit"]').click()
    const group = page.getByRole('group', { name: '목표 점수 정하기' })
    await group.waitFor()
    await group.getByRole('button', { name: /^60/ }).first().click()
    await page.waitForFunction(() => /목표 60점과 관련된/.test(document.querySelector('[data-testid="need-list"]')?.textContent ?? ''), null, { timeout: 60_000 })
    await page.keyboard.press('Escape').catch(() => {})
    const listAfter = await panel.locator('[data-testid="need-list"]').innerText()
    const domsAfter = await panel.locator('[data-testid="need-domains"]').innerText()
    rec('D · 목표 60 — 학습 요구 순서 · 관련도가 바뀜', listAfter !== listBefore, { before: listBefore.slice(0, 120), after: listAfter.slice(0, 120) })
    rec('D · 목표 변경이 영역 근거(As-Is)를 바꾸지 않음', domsAfter === domsBefore)
    await panel.screenshot({ path: path.join(OUT, 'v4-D-panel-goal60.png') })

    // 다음 행동 → 실제 확인 문항으로 이동
    const next = panel.locator('[data-testid="need-next"]')
    rec('D · 다음 행동 링크 하나', (await next.count()) === 1)
    if (await next.count()) {
      const href = await next.getAttribute('href')
      await next.click()
      await page.waitForURL((u) => u.pathname !== '/csat/diagnosis', { timeout: 120_000 })
      await page.waitForLoadState('domcontentloaded')
      const body = await page.locator('body').innerText()
      rec('D · 확인 문항 화면으로 이동 · 오류 없음', page.url().includes(href.split('?')[0]) && !/Application error|500|404/.test(body.slice(0, 400)), { href, url: page.url() })
      await page.screenshot({ path: path.join(OUT, 'v4-D-confirm-item.png') })
      // 기존 학습 경로로 돌아가기
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid="learner-map"]').waitFor()
      rec('D · 돌아오면 기존 학습 지도 · 지금 할 일 그대로', (await page.locator('[data-testid="focus-card"]').count()) === 1 && (await page.locator('[data-testid="read-path"]').count()) === 1)
    }
  }

  // F — 지난 시험(2024 시행) + 진단 반영
  {
    const { page } = await learner('f', 80, [{ exam: READY, key: readyKey, wrong: W1, takenAt: '2024-09-04' }])
    const panel = await open(page)
    await common(page, panel, 'F')
    const recs = await panel.locator('[data-testid="need-records"]').innerText()
    rec('F · 시행일 기준 시점 표시(2024.09.04 시행 · 입력일 따로)', /2024\.09\.04 시행/.test(recs) && /입력/.test(recs), recs.slice(0, 160))
    rec('F · 현재 기준으로 다시 읽었다는 표시', (await panel.locator('[data-testid="need-reanalyzed"]').count()) === 1)
    await page.screenshot({ path: path.join(OUT, 'v4-F-1440.png'), fullPage: true })
  }

  // P — 과거 기준 분석(?asof=어제) — 오늘 입력한 D 의 기록은 기준 뒤라 빠진다
  {
    const yday = new Date(Date.now() - 86_400_000 * 2).toISOString().slice(0, 10)
    const panel = await open(dPage, `&asof=${yday}`)
    rec('P · 과거 기준 — 「다시 분석 · 그대로 되살린 것 아님」 표시', /다시 분석한 것이에요/.test(await panel.locator('[data-testid="need-replay"]').innerText().catch(() => '')))
    rec('P · 기준 뒤에 입력된 기록 제외(시험 기록 없음)', /시험 기록 없음/.test(await panel.locator('[data-testid="need-records"]').innerText()))
    rec('P · 화면 모드 = past_reanalysis', (await panel.getAttribute('data-mode')) === 'past_reanalysis')
    rec('P · 과거 기준 보기에는 지금 할 행동 링크 없음 · 「지금 기준으로 보기」만', (await panel.locator('[data-testid="need-next"], [data-testid="need-go"]').count()) === 0 && (await panel.locator('[data-testid="need-now"]').count()) === 1)
    await panel.screenshot({ path: path.join(OUT, 'v4-P-panel-asof.png') })
  }

  // 390px 캡처(사용자 지시 2026-10-10 — 주요 뷰포트 1장) — D 와 같은 기록
  {
    const { page } = await learner('m', 80, [{ exam: READY, key: readyKey, wrong: W1, takenAt: today }], { width: 390, height: 844 })
    const panel = await open(page)
    await common(page, panel, 'M390')
    await panel.screenshot({ path: path.join(OUT, 'v4-D-panel-390.png') })
  }
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  console.log(`임시 계정 ${users.length}개 삭제 · 캡처 ${path.relative(ROOT, OUT)}`)
}
console.log(fail === 0 ? 'ALL PASS' : `FAIL ${fail}`)
process.exit(fail === 0 ? 0 : 1)
