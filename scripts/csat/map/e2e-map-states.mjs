#!/usr/bin/env node
// scripts/csat/map/e2e-map-states.mjs
//
// 학습 지도 상태 E2E(2026-10-07 · Phase 1 봉인 검증) — 실제 개발 DB · 실제 기록 API · 실제 진단 엔진 · 실제 브라우저로
// 학생 상태 A(기록 없음) · B(분석 준비 중) · C(먼저 확인할 단계)를 열어 CTA 까지 확인하고, 1440px 캡처를 남긴다.
//
// ── 왜 dev-only fixture 인가 ──
// csat_exams.diagnosis_ready 는 관리자가 문항 태깅 검수(reviewed_at)를 끝낸 뒤 켜는 사람 게이트다(setExamReady).
// 2026-10-07 개발 DB: 태깅 10,266행 · 검수 0행 → ready 시험 0 → 어떤 학생도 상태 C 에 갈 수 없다. 검수를 흉내 내 운영 데이터를
// 바꾸지 않고, 이 실행 동안만 존재하는 TEST 시험(M2098 · 2098년 · kice — Reveal Gate canary 의 M2099 와 같은 방식)을 만든다:
//   원본 평가원 시험(M2409)의 문항 · 정답표 · 태깅 · 선지 함정을 복사하고, 이 TEST 시험의 태깅만 검수 완료로 · ready 를 켠다.
// fixture 는 UI 상태 검증용이다 — 교육적 근거 · 실제 진단 증거가 아니다. 실행이 끝나면(성공 · 실패 모두) 계정 · TEST 시험을 지운다.
// 이미 M2098 이 있으면 지우지 않고 멈춘다(이전 실행의 흔적을 사람이 확인).
//
// 실행: node --env-file=<apps/web/.env.local> scripts/csat/map/e2e-map-states.mjs [--base http://localhost:3000] [--out tmp/map-states]
// 개발 프로젝트(jajenrevcbmrpaliomxv)가 아니면 멈춘다. 종료 코드 0 = 모든 단언 통과.
import fs from 'node:fs'
import { cleanupLeftovers, onInterrupt } from './e2e-cleanup.mjs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { isKiceExam } from '../lib-exam-id.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const BASE = arg('--base', 'http://localhost:3000')
const OUT = path.resolve(ROOT, arg('--out', 'tmp/map-states'))
const SRC_EXAM = 'M2409'
const FX = 'M2098'
const DEV_REF = 'jajenrevcbmrpaliomxv'

if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes(DEV_REF)) throw new Error('개발 프로젝트가 아니다 — 멈춘다')
// 문항 집합: 복사 원본은 평가원(kice) 시험이어야 한다 — 학평 문항을 섞지 않는다(exam-id 가드). TEST 시험 M2098 은 실제 회차 범위 밖 id 라 isKiceExam 이 false 다(의도)
if (!isKiceExam(SRC_EXAM)) throw new Error('복사 원본은 평가원 시험이어야 한다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

// 단계 → 과제 · 대응표(코드의 정본을 그대로 읽는다 — 단언이 코드와 따로 놀지 않게)
const lp = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/map/learner-path.ts'), 'utf8')
const STEPS = Object.fromEntries([...lp.matchAll(/\{ key: '([a-z-]+)', track: '(?:read|listen)', name: '([^']+)', axis: '\w', lines: \[([^\]]*)\]/g)].map((m) => [m[1], { name: m[2], lines: [...m[3].matchAll(/'([A-J]\d+)'/g)].map((x) => x[1]) }]))
const ps = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/map/prescription.ts'), 'utf8')
const STAGE = Object.fromEntries([...ps.matchAll(/'([A-J]\d+-\d)': '(\w+)'/g)].map((m) => [m[1], m[2]]))
if (Object.keys(STEPS).length !== 11 || Object.keys(STAGE).length !== 183) throw new Error(`정본 읽기 실패 steps=${Object.keys(STEPS).length} stage=${Object.keys(STAGE).length}`)

let fail = 0
const results = []
const rec = (name, ok, detail = '') => { if (!ok) fail++; results.push({ name, ok, detail }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220)}`) }
fs.mkdirSync(OUT, { recursive: true })
// 시작 전에 지난 실행의 잔여(30분 넘은 E2E 계정 · TEST fixture)를 지운다 — Windows 는 종료 신호가 node 에 닿지 않아(2026-10-11 실측) 신호 정리만으로는 보장되지 않는다
{ const swept = await cleanupLeftovers(db, { minAgeMs: 30 * 60_000, log: () => {} }); if (swept.users || swept.exams) console.log(`지난 실행 잔여 정리 — 계정 ${swept.users} · TEST 시험 ${swept.exams}`) }

// ── fixture ──
async function createFixture() {
  const exists = await must(db.from('csat_exams').select('id').eq('id', FX), 'fx check')
  if (exists.length) throw new Error(`${FX} 가 이미 있다 — 이전 실행 정리가 안 됐다(지우지 않고 멈춘다)`)
  const [ex] = await must(db.from('csat_exams').select('*').eq('id', SRC_EXAM), 'src exam')
  await must(db.from('csat_exams').insert({ ...ex, id: FX, label: 'TEST 학습 지도 상태 검증(자동 생성 · 실행 뒤 삭제)', year: 2098, exam_year: 2097, diagnosis_ready: false }), 'fx exam')
  const items = await must(db.from('csat_items').select('*').eq('exam_id', SRC_EXAM), 'src items')
  const idMap = Object.fromEntries(items.map((it) => [it.id, `${FX}-${it.no}`]))
  await must(db.from('csat_items').insert(items.map((it) => ({ ...it, id: idMap[it.id], exam_id: FX }))), 'fx items')
  const keys = await must(db.from('csat_dx_answer_key').select('*').eq('exam_id', SRC_EXAM), 'src keys')
  await must(db.from('csat_dx_answer_key').insert(keys.map((k) => ({ ...k, exam_id: FX }))), 'fx keys')
  const attrs = await must(db.from('csat_dx_item_attribute').select('*').in('item_id', Object.keys(idMap)), 'src attrs')
  const now = new Date().toISOString()
  await must(db.from('csat_dx_item_attribute').insert(attrs.map(({ id, ...a }) => ({ ...a, item_id: idMap[a.item_id], reviewed_at: now }))), 'fx attrs')
  const traps = await must(db.from('csat_dx_option_trap').select('*').in('item_id', Object.keys(idMap)), 'src traps')
  if (traps.length) await must(db.from('csat_dx_option_trap').insert(traps.map(({ id, ...t }) => ({ ...t, item_id: idMap[t.item_id] }))), 'fx traps')
  await must(db.from('csat_exams').update({ diagnosis_ready: true }).eq('id', FX), 'fx ready')
  const key = Object.fromEntries(keys.map((k) => [k.no, k.answers[0]]))
  const attrByNo = {}
  // 가중치 > 0 만 태그다 — 정본(검수 저장)은 0(해당 없음)도 행으로 남긴다(2026-10-08 M2409 pilot canon)
  for (const a of attrs) { if (!(a.weight > 0)) continue; const no = items.find((i) => i.id === a.item_id)?.no; (attrByNo[no] ??= []).push(a.attribute_code) }
  return { key, attrByNo, counts: { items: items.length, keys: keys.length, attrs: attrs.length, traps: traps.length } }
}
async function dropFixture() {
  const items = await must(db.from('csat_items').select('id').eq('exam_id', FX), 'fx items list')
  const ids = items.map((i) => i.id)
  if (ids.length) {
    await must(db.from('csat_dx_option_trap').delete().in('item_id', ids), 'drop traps')
    await must(db.from('csat_dx_item_attribute').delete().in('item_id', ids), 'drop attrs')
  }
  await must(db.from('csat_dx_answer_key').delete().eq('exam_id', FX), 'drop keys')
  await must(db.from('csat_items').delete().eq('exam_id', FX), 'drop items')
  await must(db.from('csat_exams').delete().eq('id', FX), 'drop exam')
}

// ── 계정 · 브라우저 ──
const users = []
async function newLearner(browser, tag) {
  const email = `map-state-${tag}-${Date.now()}@example.com`
  const password = `St-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const login = await ctx.newPage()
  login.setDefaultTimeout(240_000)
  await login.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await login.fill('input[type="email"]', email)
  await login.fill('input[type="password"]', password)
  await login.click('button[type="submit"]')
  await login.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
  // 로그인 뒤 /hub 의 끝나지 않는 이미지 요청이 같은 호스트 연결을 잡는다(별도 결함) — 그 탭을 닫고 지도로 바로 간다
  await login.close()
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  // 2026-10-08 목표 중심 재설계 — 목표를 정하지 않은 학습자는 「목표 정하기」가 단 하나의 할 일이다(e2e-map-goal 상태 A).
  // 이 E2E 의 상태 A·B·C 는 목표를 정한 뒤의 기록 · 분석 상태를 보는 자리라 목표 80 을 먼저 정한다
  const g = await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })
  if (g.status() !== 200) throw new Error(`목표 설정 실패 ${g.status()}`)
  return { page, ctx, id: data.user.id }
}
async function record(page, examId, choices) {
  const res = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, {
    data: { examId, mode: 'live', takenAt: '2026-09-20', totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} },
  })
  return { status: res.status(), body: await res.json().catch(() => ({})) }
}
async function openMap(page) {
  await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="learner-map"]')
  await page.waitForTimeout(1200)
}
const MAIN_FORBIDDEN = [/\b[A-J]\d{1,2}\b/, /0\.6|0\.8/, /54/, /현재 계산/, /호환/, /vNext/, /FIND|REPAIR|TRANSFER|CHECK/, /관찰 낮음|관찰 중간|관찰 높음/, /observation|diagnostic_need|prescription/]
async function mainChecks(page, label) {
  const txt = await page.locator('[data-testid="learner-map"]').innerText()
  const bad = MAIN_FORBIDDEN.filter((r) => r.test(txt)).map(String)
  rec(`${label} · 메인에 내부 코드 · 0.6/0.8 · 54라인 · 단계 코드 없음`, bad.length === 0, bad)
  const steps = await page.locator('[data-testid="read-path"] [data-step]').count()
  rec(`${label} · 읽기 길 7단계 · 듣기 4단계 따로`, steps === 7 && (await page.locator('[data-testid="listen-path"] [data-step]').count()) === 4, { steps })
  rec(`${label} · 「직접 확인됨」 없음(verified 전)`, !txt.includes('직접 확인됨'))
  const ctas = await page.locator('[data-testid="focus-cta"]').count()
  rec(`${label} · 지금 할 일 CTA 는 하나`, ctas === 1, { ctas })
}

const expectedFind = (stepKey) =>
  Object.entries(STAGE).filter(([id, st]) => st === 'FIND' && STEPS[stepKey].lines.includes(id.split('-')[0])).map(([id]) => id)

const browser = await chromium.launch()
let fx = null
// 중단(Ctrl+C · 종료 신호)돼도 임시 계정 · TEST fixture 를 지운다 — 2026-10-10 중단된 실행이 diagnosis_ready=true 인 M2098 을 남겼다
onInterrupt(async () => { await browser.close().catch(() => {}); for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {}); if (fx) await dropFixture() })
try {
  // ── 상태 A: 기록 없음 ──
  {
    const { page } = await newLearner(browser, 'a')
    await openMap(page)
    rec('A · 「지금 먼저 확인할 것」 = 기출 시험 기록하기', (await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')) === 'record' && (await page.locator('[data-testid="focus-card"]').innerText()).includes('기출 시험 기록하기'))
    await mainChecks(page, 'A')
    await page.screenshot({ path: path.join(OUT, '1-state-a-no-records.png'), fullPage: true })
    await page.locator('[data-testid="focus-cta"]').click()
    await page.waitForURL(/modal=new/)
    const dialog = await page.getByText('새 시험 기록').first().isVisible().catch(() => false)
    rec('A · CTA 「시험 기록 시작」 → 기록 창이 열림', dialog, page.url().replace(BASE, ''))
    await page.screenshot({ path: path.join(OUT, '1b-state-a-cta-record-modal.png') })
  }
  // ── 상태 B: 기록 있음 · 분석 준비 전(ready 아닌 실제 평가원 시험) ──
  // M2409 는 2026-10-08 pilot canon 으로 켜졌다 — 정답표 45개가 있고 꺼져 있는 평가원 시험을 실행 때 고른다(하나 켜질 때마다 깨지지 않게)
  {
    const { page } = await newLearner(browser, 'b')
    const offExams = (await must(db.from('csat_exams').select('id').eq('diagnosis_ready', false), 'b exams')).map((e) => e.id).filter((id) => isKiceExam(id) && id !== FX)
    let B_EXAM = null
    for (const id of offExams.sort().reverse()) {
      const n = (await must(db.from('csat_dx_answer_key').select('no').eq('exam_id', id), 'b key n')).length
      if (n === 45) { B_EXAM = id; break }
    }
    if (!B_EXAM) throw new Error('꺼져 있고 정답표가 있는 평가원 시험이 없다')
    const keys = await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', B_EXAM), 'b key')
    const choices = Object.fromEntries(keys.map((k) => [k.no, k.answers[0]]))
    const r = await record(page, B_EXAM, choices)
    rec('B · 실제 기록 API 저장(ready 아닌 시험)', r.status === 200 && r.body.ready === false, { status: r.status, ready: r.body.ready })
    await openMap(page)
    const card = await page.locator('[data-testid="focus-card"]').innerText()
    rec('B · 「기록은 잘 저장됐어요 · 분석 준비 중」', (await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')) === 'pending' && card.includes('기록은 잘 저장됐어요'))
    const badges = await page.locator('[data-testid="read-path"] [data-step]').allInnerTexts()
    rec('B · 단계 상태 = 분석 준비 중(약점 · 진단 표시 없음)', badges.every((b) => b.includes('분석 준비 중')), badges.slice(0, 2))
    await mainChecks(page, 'B')
    await page.screenshot({ path: path.join(OUT, '2-state-b-pending.png'), fullPage: true })
    await page.locator('[data-testid="focus-cta"]').click()
    await page.waitForURL(/tab=records/)
    rec('B · CTA 「시험 기록 보기」 → 시험 기록 탭', /tab=records/.test(page.url()) && !/modal=new/.test(page.url()), page.url().replace(BASE, ''))
  }
  // ── 상태 C: 먼저 확인할 단계(dev-only fixture 시험 · 실제 엔진) ──
  fx = await createFixture()
  rec('C · fixture 시험 생성(원본 복사 · 이 시험만 검수 완료 · ready)', fx.counts.items > 0 && fx.counts.keys === 45 && fx.counts.attrs > 0, fx.counts)
  {
    const { page } = await newLearner(browser, 'c')
    // 문장 관계가 낮게 관찰되도록 — 실제 정본 M2409(2026-10-08 pilot canon) E2E 에서 「문장 관계」 단계로 확인된 오답 패턴(P2 · 흐름 · 선지)을 쓴다.
    // 태그에서 유도하면 태그가 바뀔 때마다 축 관측 routing(V · X 구분 · S 직접)으로 흔들린다 — 이 상태는 「안정적인 단계 하나」를 보는 자리다.
    const P2 = new Set([20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44])
    const choices = {}
    for (let no = 1; no <= 45; no++) {
      const wrong = P2.has(no)
      choices[no] = wrong ? (fx.key[no] % 5) + 1 : fx.key[no]
    }
    const r = await record(page, FX, choices)
    rec('C · 실제 기록 API 저장(ready 시험 → 진단 반영)', r.status === 200 && r.body.ready === true, { status: r.status, ready: r.body.ready, raw: r.body.raw })
    await openMap(page)
    const focusKind = await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')
    const card = await page.locator('[data-testid="focus-card"]').innerText()
    rec('C · 「지금 먼저 확인할 것」 = 단계 하나', focusKind === 'step', { focusKind, card: card.slice(0, 80) })
    // 확정 문구 · provisional 문구(「현재 기록에서는 … 약점으로 확정된 것은 아니에요」) 모두 「약점 확정 아님」을 밝힌다
    rec('C · 「약점으로 확정된 것은 아니에요」', card.includes('약점으로 확정된 것은 아니에요'))
    rec('C · 다음 후보는 최대 하나 · CTA 아님(동등한 CTA 여러 개 금지)', (await page.locator('[data-testid="focus-card"] button').count()) <= 2 && (await page.locator('[data-testid="focus-cta"]').count()) === 1)
    const focusStep = await page.locator('[data-testid="read-path"] li[data-e="focus"] [data-step]').getAttribute('data-step').catch(() => null)
    rec('C · 길 위에 「먼저 확인」 단계가 정확히 하나', (await page.locator('[data-testid="read-path"] li[data-e="focus"]').count()) === 1, { focusStep })
    await mainChecks(page, 'C')
    await page.screenshot({ path: path.join(OUT, '3-state-c-focus.png'), fullPage: true })
    // 확인 시작 → 그 단계의 실제 확인하기(FIND) 과제
    await page.locator('[data-testid="focus-cta"]').click()
    await page.waitForSelector('[data-step-sheet]')
    await page.waitForTimeout(500)
    const sheetStep = await page.locator('[data-step-sheet]').getAttribute('data-step-sheet')
    rec('C · 확인 시작 → 같은 단계 시트', sheetStep === focusStep, { sheetStep, focusStep })
    const want = await must(db.from('csat_map_task').select('id, title').in('id', expectedFind(sheetStep)), 'find titles')
    // 과제 목록의 제목만 — 생애주기 줄(LifecycleStrip)의 단계 이름(확인하기 · 바로잡기 …)도 li strong 이라 함께 잡히던 낡은 셀렉터(2026-10-10 발견)
    const shown = await page.locator('#step-check li [class*="taskMain"] > strong').allInnerTexts()
    rec('C · 「지금 확인할 것」 = 그 단계의 확인하기(FIND) 과제 전부 · 그것만', want.length > 0 && JSON.stringify([...shown].sort()) === JSON.stringify(want.map((w) => w.title).sort()), { shown, want: want.map((w) => w.id) })
    const sheetTxt = await page.locator('[data-step-sheet]').innerText()
    rec('C · 원인 확인 전 — 바로잡기 · 다른 문제에 적용하기 · 다시 확인하기는 잠금(이어지는 학습으로만)', sheetTxt.includes('원인이 확인되면 이어지는 학습') && (await page.locator('#step-check input[type="checkbox"]').count()) === want.length)
    rec('C · 시트 첫 부분에 라인 코드 없음(상세 근거는 접힘)', !/\b[A-J]\d{1,2}\b/.test(sheetTxt.split('상세 근거 보기')[0]))
    await page.screenshot({ path: path.join(OUT, '4-state-c-cta-find.png') })
    await page.locator('#step-check').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT, '5-state-c-find-tasks.png') })
    // 시트 「상세 근거」 — 여기에만 내부 정보
    await page.getByRole('button', { name: '상세 근거 보기' }).click()
    await page.waitForTimeout(300)
    rec('C · 상세 근거(펼침)에만 기존 라인 · 표시 기준', /현재 계산/.test(await page.locator('[data-step-sheet]').innerText()))
    await page.keyboard.press('Escape')
    // ── 상태 D 게이트: verified_diagnosis 가 없으면 맞춤 학습이 열리지 않는다 ──
    const journeyNow = await page.locator('[aria-current="step"]').innerText().catch(() => '')
    rec('D 게이트 · 여정 현재 위치 = 「먼저 확인할 것」(원인 확인 · 맞춤 학습 아님)', journeyNow.includes('먼저 확인할 것'), journeyNow)
    // 기출 상세 분석
    await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-map-cols]')
    await page.waitForTimeout(1200)
    rec('상세 · 「기출 상세 분석」 · 학습 지도로', (await page.locator('body').innerText()).includes('기출 상세 분석'))
    await page.screenshot({ path: path.join(OUT, '7-detail-analysis.png') })
  }
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  if (fx) await dropFixture().then(() => console.log('fixture 삭제')).catch((e) => rec('fixture 삭제', false, e.message))
  const left = await must(db.from('csat_exams').select('id').eq('id', FX), 'left')
  rec('정리 · TEST 시험 남지 않음', left.length === 0)
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1))
  console.log(fail ? `\n실패 ${fail}` : '\n모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
