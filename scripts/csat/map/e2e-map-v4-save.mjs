#!/usr/bin/env node
// scripts/csat/map/e2e-map-v4-save.mjs
//
// 학습 지도 rev4.0 4차 — 계획 저장 여정 E2E(실제 개발 서버 · 승인 적용된 개발 DB · 실제 브라우저 1440px).
//   저장/복원: 서버 오류 · 네트워크 실패 뒤 확정 → 버전 1 · 새로고침 · 재로그인 · 다른 브라우저 문맥
//   변경 이력: 계획량 · 순서 · 사유 · 메모 → 버전 2(버전 1 보존) · 되돌리기 → 새 버전(지난 기록 유지)
//   동시 수정: 두 문맥에서 같은 버전 → 늦은 쪽 409 안내 → 새로 불러와 다시 조정 · 같은 요청 키 재전송 = 중복 없음 · 실패 뒤 내용 바꾸면 새 키
//   학습 데이터: 활동 이동 · 복귀 → 수행 수 반영(계획량 그대로) · 계획보다 더 한 수 표시 · 목표 변경 = 목표 이력 + As-Is 불변 · 다른 학습자 접근 불가 · 과거 보기 저장 없음
// 임시 계정(map-v4-e2e-save-* @example.com)만 만들고 끝 · 중단 시 지운다(Workspace · 계획 cascade). 시작 시 30분 넘은 E2E 잔여만 정리(다른 실행의 새 자료는 건드리지 않음).
//   node --env-file=<apps/web/.env.local> scripts/csat/map/e2e-map-v4-save.mjs [--base http://localhost:3002] [--out tmp/map-v4-save]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { cleanupLeftovers, onInterrupt } from './e2e-cleanup.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const argv = process.argv.slice(2)
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3002')
const OUT = path.join(ROOT, arg('--out', 'tmp/map-v4-save'))
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
fs.mkdirSync(OUT, { recursive: true })
{ const swept = await cleanupLeftovers(db, { minAgeMs: 30 * 60_000, log: () => {} }); if (swept.users || swept.exams) console.log(`지난 실행 잔여 정리 — 계정 ${swept.users} · TEST 시험 ${swept.exams}`) }
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 260)}`) }

const READY = 'M2409'
const users = []
const browser = await chromium.launch()
onInterrupt(async () => { await browser.close().catch(() => {}); for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {}) })
const PLAN_API = '/api/csat/diagnosis/map/plan'
try {
  const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
  const W1 = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W1.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const today = new Date().toISOString().slice(0, 10)

  async function makeUser(tag) {
    const email = `map-v4-e2e-save-${tag}-${Date.now()}@example.com`
    const password = `Ms-${crypto.randomBytes(9).toString('base64url')}-Aa1`
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    users.push(data.user.id)
    return { id: data.user.id, email, password }
  }
  async function login(u) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await ctx.newPage()
    page.setDefaultTimeout(240_000)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', u.email)
    await page.fill('input[type="password"]', u.password)
    await page.click('button[type="submit"]')
    await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
    return { ctx, page }
  }
  async function seed(page, u, goal) {
    const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: today, totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
    if (r.status() !== 200) throw new Error(`기록 실패 ${r.status()}`)
    const g = await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: goal } })
    if (g.status() !== 200) throw new Error('목표 실패')
    for (let i = 0; i < 60; i++) {
      if ((await must(db.from('csat_dx_snapshot').select('id').eq('user_id', u.id).limit(1), 'snapshot')).length) break
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  const open = async (page, q = '') => {
    await page.goto(`${BASE}/csat/diagnosis?tab=map${q}`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="plan-section"]').waitFor()
    await page.waitForLoadState('networkidle').catch(() => {})
    return page.locator('[data-testid="plan-section"]')
  }
  const state = async (sec) => ({ s: await sec.locator('[data-testid="plan-save-state"]').getAttribute('data-state'), text: await sec.locator('[data-testid="plan-save-state"]').innerText(), v: Number(await sec.getAttribute('data-saved-version')) })
  const waitSaved = async (page, v) => page.waitForFunction((v) => {
    const s = document.querySelector('[data-testid="plan-section"]')
    return s?.getAttribute('data-saved-version') === String(v) && s.querySelector('[data-testid="plan-save-state"]')?.getAttribute('data-state') === 'saved'
  }, v, { timeout: 120_000 })
  const shape = async (sec) => sec.locator('li[data-task]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-task')}:${e.getAttribute('data-planned')}`))
  const coreRow = (sec) => sec.locator('li[data-core="true"][data-planned]:not([data-planned=""])').first()
  const versions = async (uid) => must(db.from('learner_workspace_plan').select('plan_version, reason, note, restored_from, plan, client_key').eq('user_id', uid).order('plan_version'), 'versions')
  const plannedOf = (row, task) => row.plan.tasks.find((t) => t.task === task)?.planned ?? null
  // 계획 POST 요청 본문을 모은다(요청 키 재사용 검사)
  const watch = (page) => { const bodies = []; page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes(PLAN_API)) bodies.push(JSON.parse(r.postData() ?? 'null')) }); return bodies }
  const shot = (page, name) => page.locator('[data-testid="plan-section"]').screenshot({ path: path.join(OUT, `${name}.png`) })

  const A = await makeUser('a')
  const { ctx: ctxA, page: pA } = await login(A)
  await seed(pA, A, 80)
  let sec = await open(pA)
  const ws = await sec.getAttribute('data-ws')
  rec('0 · 저장 구조 설치 · 아직 확정 전', (await sec.getAttribute('data-store')) === 'installed' && (await state(sec)).s === 'none', await state(sec))
  const bodiesA = watch(pA)
  const recommended = await shape(sec)
  await shot(pA, 's0-none')

  // 20 · 서버 오류 → 저장 성공처럼 보이지 않음
  await pA.route(`**${PLAN_API}`, (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }) : r.continue()))
  await sec.locator('[data-testid="plan-save"]').click()
  await sec.locator('[data-testid="plan-error"]').waitFor()
  rec('20 · 서버 오류 → 오류 안내 · 「저장됨」 아님 · DB 0건', (await state(sec)).s !== 'saved' && (await versions(A.id)).length === 0, await state(sec))
  await shot(pA, 's20-server-error')
  await pA.unroute(`**${PLAN_API}`)
  // 18 · 네트워크 실패 → 같은 내용 재시도 = 같은 키 → 버전 1 하나
  await pA.route(`**${PLAN_API}`, (r) => (r.request().method() === 'POST' ? r.abort('failed') : r.continue()))
  await sec.locator('[data-testid="plan-save"]').click()
  await sec.locator('[data-testid="plan-error"][data-code="network"]').waitFor()
  rec('18 · 네트워크 실패 → 「저장됐는지 알 수 없음」 안내 · 「저장됨」 아님', (await state(sec)).s !== 'saved')
  await pA.unroute(`**${PLAN_API}`)
  await sec.locator('[data-testid="plan-save"]').click()
  await waitSaved(pA, 1)
  sec = pA.locator('[data-testid="plan-section"]')
  const st1 = await state(sec)
  rec('3·4 · 확정 → 서버 응답 뒤 「저장됨 · 버전 1」', st1.s === 'saved' && /저장됨 · 버전 1/.test(st1.text), st1)
  const keys = bodiesA.map((b) => b.clientKey)
  rec('18 · 서버 오류(5xx) · 네트워크 실패 뒤 같은 내용 재시도는 같은 키 — 저장됐을 수도 있어 새 키를 만들지 않는다', keys.length === 3 && new Set(keys).size === 1, keys)
  let vs = await versions(A.id)
  rec('18 · DB 버전 정확히 1개 · initial', vs.length === 1 && vs[0].plan_version === 1 && vs[0].reason === 'initial', vs.map((v) => [v.plan_version, v.reason]))
  rec('3 · 저장본 = 추천 계획', JSON.stringify(await shape(sec)) === JSON.stringify(recommended))
  await shot(pA, 's3-saved-v1')

  // 5 · 새로고침 · 6 · 재로그인 · 7 · 다른 브라우저 문맥
  sec = await open(pA)
  rec('5 · 새로고침 뒤 버전 1 · 순서 · 계획량 그대로', (await state(sec)).s === 'saved' && JSON.stringify(await shape(sec)) === JSON.stringify(recommended))
  await ctxA.clearCookies()
  await pA.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
  rec('6 · 로그아웃(세션 쿠키 삭제) → 로그인 화면', /\/login/.test(pA.url()), pA.url())
  // 로그인 화면이 다 뜬 뒤에 입력한다(덜 뜬 화면에서 제출하면 폼이 그냥 /login 으로 다시 간다)
  await pA.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await pA.fill('input[type="email"]', A.email)
  await pA.fill('input[type="password"]', A.password)
  await pA.click('button[type="submit"]')
  await pA.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  sec = await open(pA)
  rec('6 · 재로그인 뒤 버전 1 유지', (await state(sec)).v === 1 && JSON.stringify(await shape(sec)) === JSON.stringify(recommended))
  const { page: pB } = await login(A)
  let secB = await open(pB)
  rec('7 · 다른 브라우저 문맥 — 같은 계획 · 버전 1', (await state(secB)).s === 'saved' && (await state(secB)).v === 1 && JSON.stringify(await shape(secB)) === JSON.stringify(recommended))

  // 8~10 · 계획량 · 순서 변경 + 사유 · 메모 — 실패 뒤 내용을 바꾸면 새 키(19)
  const core = await coreRow(sec).getAttribute('data-task')
  const p0 = Number(await coreRow(sec).getAttribute('data-planned'))
  await sec.locator(`li[data-task="${core}"]`).getByRole('button', { name: /계획 한 문항 줄이기$/ }).click()
  await sec.locator('li[data-task]').first().getByRole('button', { name: /아래로$/ }).click()
  rec('8 · 바꾼 뒤 「아직 저장되지 않음」', (await state(sec)).s === 'dirty', await state(sec))
  const NOTE = 'E2E 메모 — 이번 주는 조금 줄여요 (긴 메모 표시 확인용 문장을 덧붙여 둡니다. 학습 기록은 그대로입니다.)'
  await sec.locator('[data-testid="plan-note"]').fill(NOTE)
  const bodiesBefore = bodiesA.length
  await pA.route(`**${PLAN_API}`, (r) => (r.request().method() === 'POST' ? r.abort('failed') : r.continue()))
  await sec.locator('[data-testid="plan-save"]').click()
  await sec.locator('[data-testid="plan-error"][data-code="network"]').waitFor()
  await pA.unroute(`**${PLAN_API}`)
  await sec.locator(`li[data-task="${core}"]`).getByRole('button', { name: /계획 한 문항 줄이기$/ }).click()
  await shot(pA, 's8-dirty')
  await sec.locator('[data-testid="plan-save"]').click()
  await waitSaved(pA, 2)
  sec = pA.locator('[data-testid="plan-section"]')
  const k2 = bodiesA.slice(bodiesBefore).map((b) => b.clientKey)
  rec('19 · 실패 뒤 계획을 바꿔 보내면 이전 요청 키를 쓰지 않음', k2.length === 2 && k2[0] !== k2[1], k2)
  vs = await versions(A.id)
  const v2 = vs.find((v) => v.plan_version === 2)
  rec('9 · 버전 2 생성 · 버전 1 보존(내용 그대로)', vs.length === 2 && plannedOf(vs[0], core) === p0 && plannedOf(v2, core) === p0 - 2, vs.map((v) => [v.plan_version, plannedOf(v, core)]))
  rec('8 · 순서 변경이 저장됨', v2.plan.order[0] !== JSON.parse(JSON.stringify(vs[0].plan.order))[0], [vs[0].plan.order.slice(0, 2), v2.plan.order.slice(0, 2)])
  rec('10 · 사유 · 메모 정확히 기록', v2.reason === 'learner_adjust' && v2.note === NOTE, { reason: v2.reason, note: v2.note })

  // 17 · 같은 요청 키 재전송 → 중복 버전 없음
  const last = bodiesA[bodiesA.length - 1]
  const replay = await pA.request.post(`${BASE}${PLAN_API}`, { data: last })
  const rj = await replay.json().catch(() => ({}))
  rec('17 · 같은 요청 키 재전송 → 200 · 재사용 · 버전 수 그대로', replay.status() === 200 && (await versions(A.id)).length === 2, { status: replay.status(), body: rj })

  // 13~16 · B 는 아직 버전 1 화면 — 늦은 저장은 409
  await secB.locator(`li[data-task="${core}"]`).getByRole('button', { name: /계획 한 문항 줄이기$/ }).click()
  const r409 = pB.waitForResponse((r) => r.url().includes(PLAN_API) && r.request().method() === 'POST')
  await secB.locator('[data-testid="plan-save"]').click()
  const s409 = (await r409).status()
  await secB.locator('[data-testid="plan-conflict"]').waitFor()
  rec('15 · 오래된 화면의 저장 → HTTP 409 · 충돌 안내 · DB 그대로', s409 === 409 && (await versions(A.id)).length === 2, s409)
  await shot(pB, 's15-conflict')
  await secB.getByRole('button', { name: '새로 불러오기' }).click()
  await pB.waitForFunction(() => document.querySelector('[data-testid="plan-section"]')?.getAttribute('data-saved-version') === '2', null, { timeout: 120_000 })
  await pB.reload({ waitUntil: 'domcontentloaded' })
  secB = await open(pB)
  // 새로 불러오면 버전 2 기준의 새 초안(이전 초안은 버전 1 열쇠라 쓰이지 않는다)
  rec('16 · 새로 불러온 뒤 버전 2 그대로 보임', (await state(secB)).v === 2 && (await state(secB)).s === 'saved', await state(secB))
  await secB.locator(`li[data-task="${core}"]`).getByRole('button', { name: /계획 한 문항 늘리기$/ }).click()
  await secB.locator('[data-testid="plan-save"]').click()
  await waitSaved(pB, 3)
  rec('16 · 다시 조정 · 저장 → 버전 3', (await versions(A.id)).length === 3)

  // 11 · 12 · 이력에서 버전 1 로 되돌리기 → 새 버전 · 지난 기록 유지
  sec = await open(pA)
  await sec.locator('[data-testid="plan-history"] summary').click()
  rec('11 · 이력 3개 보임 · 메모 표시', (await sec.locator('[data-testid="plan-history"] li[data-version]').count()) === 3 && (await sec.locator('[data-testid="plan-history"]').innerText()).includes('이번 주는 조금 줄여요'))
  await shot(pA, 's11-history')
  await sec.locator('[data-testid="plan-history"] li[data-version="1"] [data-testid="plan-restore"]').click()
  await waitSaved(pA, 4)
  vs = await versions(A.id)
  const v4 = vs.find((v) => v.plan_version === 4)
  rec('12 · 되돌리기 = 새 버전 4(restore · 버전 1 에서) · 1~3 보존', vs.length === 4 && v4.reason === 'restore' && v4.restored_from === 1 && JSON.stringify(v4.plan.order) === JSON.stringify(vs[0].plan.order) && plannedOf(v4, core) === p0, vs.map((v) => [v.plan_version, v.reason, v.restored_from]))
  sec = pA.locator('[data-testid="plan-section"]')
  rec('12 · 화면 = 버전 1 계획', JSON.stringify(await shape(sec)) === JSON.stringify(recommended))
  await shot(pA, 's12-restored')

  // 21~23 · 실제 활동(확인 문항 화면에서 풀이) → 복귀 → 수행 수 반영 · 계획량 · 저장본 그대로
  const before = { done: Number(await sec.locator(`li[data-task="${core}"]`).getAttribute('data-done')), planned: Number(await sec.locator(`li[data-task="${core}"]`).getAttribute('data-planned')), ach: await sec.locator(`li[data-task="${core}"]`).getAttribute('data-achievement') }
  const domsBefore = await pA.locator('[data-testid="need-domains"]').innerText()
  const go = sec.locator(`li[data-task="${core}"] [data-testid="plan-go"]`)
  const href = (await go.count()) ? await go.getAttribute('href') : null
  rec('21 · 계획에서 「활동 시작」 링크', !!href, href)
  if (href) {
    await pA.goto(`${BASE}${href.split('#')[0]}`, { waitUntil: 'domcontentloaded' })
    const panel = pA.locator('[data-testid="principle-panel"]')
    await panel.waitFor({ timeout: 120_000 }).catch(() => {})
    let answered = false
    if (await panel.count()) {
      await panel.getByRole('button', { name: '직접 확인하기' }).click().catch(() => {})
      await panel.locator('[data-claim]').first().click()
      await panel.locator('[data-support]').first().click()
      await panel.locator('[data-relation]').first().check().catch(() => {})
      const resp = pA.waitForResponse((r) => /\/api\/csat\/item\/.+\/task/.test(r.url()))
      await panel.getByRole('button', { name: '확인하기' }).click()
      answered = (await resp).status() === 200
    }
    rec('21 · 확인 문항 화면에서 실제 풀이 제출(200)', answered, href)
    sec = await open(pA)
    const row = sec.locator(`li[data-task="${core}"]`)
    const after = { done: Number(await row.getAttribute('data-done')), planned: Number(await row.getAttribute('data-planned')) }
    rec('22 · 복귀 뒤 수행 +1 · 계획량 그대로 · 저장 버전 그대로', after.done === before.done + 1 && after.planned === before.planned && (await state(sec)).v === 4 && (await state(sec)).s === 'saved', { before, after })
    rec('22 · 풀이 한 번으로 영역 근거(As-Is) 불변', (await pA.locator('[data-testid="need-domains"]').innerText()) === domsBefore)
    // 23 · 계획량을 수행보다 적게 → 「계획보다 N문항 더 했어요」(수행량 숨기지 않음)
    for (let i = 0; i < after.planned; i++) await row.getByRole('button', { name: /계획 한 문항 줄이기$/ }).click()
    const qty = await row.locator('[data-testid="plan-qty"]').innerText()
    rec('23 · 계획 0 · 수행 1 → 「계획보다 1문항 더 했어요」', /계획보다 \d+문항 더 했어요/.test(qty) && /수행 \d+/.test(qty), qty)
    await shot(pA, 's23-over-plan')
    await sec.locator('[data-testid="plan-reset"]').click()
  }

  // 24 · 목표 변경 → 목표 이력 행 + As-Is 불변 + 저장 계획 그대로
  const gvBefore = (await must(db.from('csat_map_goal_version').select('id').eq('user_id', A.id), 'gv')).length
  const doms1 = await pA.locator('[data-testid="need-domains"]').innerText()
  const g = await pA.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 60 } })
  sec = await open(pA)
  const gvAfter = await must(db.from('csat_map_goal_version').select('target_score').eq('user_id', A.id).order('id', { ascending: false }), 'gv')
  rec('24 · 목표 변경 → 목표 이력 +1(60점)', g.status() === 200 && gvAfter.length === gvBefore + 1 && gvAfter[0].target_score === 60, { before: gvBefore, after: gvAfter.length })
  rec('24 · 목표 변경이 영역 근거(As-Is) · 수행 기록을 바꾸지 않음', (await pA.locator('[data-testid="need-domains"]').innerText()) === doms1)

  // 과거 기준 보기에는 저장 상자 없음
  const yday = new Date(Date.now() - 86_400_000 * 2).toISOString().slice(0, 10)
  await pA.goto(`${BASE}/csat/diagnosis?tab=map&asof=${yday}`, { waitUntil: 'domcontentloaded' })
  await pA.locator('[data-testid="need-panel"]').waitFor()
  rec('과거 기준 보기 — 저장 · 되돌리기 버튼 없음', (await pA.locator('[data-testid="plan-save-box"], [data-testid="plan-restore"]').count()) === 0)

  // 25 · 다른 학습자 — 조회 · 수정 불가
  const C = await makeUser('c')
  const { page: pC } = await login(C)
  const gc = await (await pC.request.get(`${BASE}${PLAN_API}`)).json()
  rec('25 · 다른 학습자 API 조회 — A 의 계획 없음', !Object.keys(gc.byTemplate ?? {}).length, Object.keys(gc.byTemplate ?? {}))
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  await anon.auth.signInWithPassword({ email: C.email, password: C.password })
  const peek = await anon.from('learner_workspace_plan').select('id').eq('user_id', A.id)
  const upd = await anon.from('learner_workspace_plan').update({ note: 'x' }).eq('user_id', A.id).select('id')
  rec('25 · 다른 학습자 키로 A 계획 직접 조회 0행 · 수정 0행', (peek.data ?? []).length === 0 && (upd.data ?? []).length === 0, { peek: peek.error?.code ?? (peek.data ?? []).length, upd: upd.error?.code ?? (upd.data ?? []).length })
  const forged = await pC.request.post(`${BASE}${PLAN_API}`, { data: { ...last, userId: A.id, clientKey: crypto.randomUUID() } })
  rec('25 · 요청에 다른 사람 userId 를 넣으면 거절(알 수 없는 필드)', forged.status() === 400, forged.status())
  rec('25 · A 의 버전 수 그대로(4)', (await versions(A.id)).length === 4)
  console.log(`대표 Workspace ${ws} · 중심 TASK ${core}`)
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  const left = await db.from('learner_workspace').select('id', { count: 'exact', head: true }).in('user_id', users.length ? users : ['00000000-0000-0000-0000-000000000000'])
  console.log(`임시 계정 ${users.length}개 삭제 · 남은 Workspace ${left.count} · 캡처 ${path.relative(ROOT, OUT)}`)
  if (left.count) fail++
}
console.log(fail === 0 ? 'ALL PASS' : `FAIL ${fail}`)
process.exit(fail === 0 ? 0 : 1)
