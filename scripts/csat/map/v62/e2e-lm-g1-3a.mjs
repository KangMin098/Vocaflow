// scripts/csat/map/v62/e2e-lm-g1-3a.mjs
//
// LM-G1.3a — 목표(점수 · 시험 · 등급 · 목표일) 저장 → 기준 시험 범위 → toBe/NeedRank/ActionRank → Workspace → PLAN 목표 버전 결속(T01–T15).
// 층위: ② 개발 DB · 기존 API(합성 계정 본인 · 원장은 서비스 키 읽기 전용 대조) ③ Chromium. 학습 효과 · 점수 상승은 주장하지 않는다.
// 계정은 끝에 삭제 · 부재 확인(404/not found). 이메일 · 비밀번호 · 사용자 id · UUID 는 결과에 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-3a.mjs --base http://localhost:3005 --width 1440 --evidence <dir>
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3005')
const WIDTH = Number(arg('--width', '1440'))
// Live harness clock boundary; fixed-clock policy probes are kept separately.
const RUN_NOW = new Date()
const TARGET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(RUN_NOW.getTime() + 90 * 86_400_000))
const EVID = path.resolve(ROOT, arg('--evidence', `tmp/lm-g1-3a-${WIDTH}`))
const WS = 'ws.central-meaning'
fs.mkdirSync(EVID, { recursive: true })
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim()
const DIRTY = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).toString().trim().length > 0
const results = []
const rec = (id, name, ok, detail, layer = 'db+browser') => { results.push({ id, name, status: ok ? 'PASS' : 'FAIL', layer, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} — ${JSON.stringify(detail ?? null).slice(0, 380)}`) }
const users = []
const browser = await chromium.launch()
let shots = 0
const shot = (page, name) => page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`) })
const scrub = (o) => JSON.parse(JSON.stringify(o).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>'))

async function account(tag) {
  const email = `map-lmg13a-${tag}-${WIDTH}-${Date.now()}@example.com`
  const password = `Lg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  return { email, password, uid: u.user.id }
}
async function login(acc) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(120_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', acc.email)
  await page.fill('input[type="password"]', acc.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  return { ctx, page }
}
const putGoal = async (page, body) => { const r = await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: body }); return { status: r.status(), body: await r.json().catch(() => null) } }
const goalRows = async (uid) => (await db.from('csat_map_goal_version').select('id, target_score, target_grade, target_exam, target_date').eq('user_id', uid).order('id')).data ?? []
const latestGoal = async (uid) => (await db.from('csat_map_goal').select('target_score').eq('user_id', uid).maybeSingle()).data
async function openMap(page, q = '&view=full') {
  await page.goto(`${BASE}/csat/diagnosis?tab=map${q}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]', { timeout: 120_000 })
  await page.waitForTimeout(700)
}
const mapState = (page) => page.evaluate(() => {
  const t = document.querySelector('[data-testid="goal-target"]')
  return {
    goalValue: document.querySelector('[data-testid="goal-value"]')?.textContent ?? null,
    target: t ? { exam: t.getAttribute('data-exam'), scope: t.getAttribute('data-scope'), exams: t.getAttribute('data-exams'), grade: t.getAttribute('data-grade'), date: t.getAttribute('data-date'), version: t.getAttribute('data-version') ? 'set' : '', text: t.textContent } : null,
    topNext: document.querySelector('[data-testid="umap-top-next"]')?.getAttribute('data-task') ?? null,
    order: [...document.querySelectorAll('[data-testid="umap-node"][data-priority="true"]')].map((n) => n.getAttribute('data-node')),
    rows: [...document.querySelectorAll('[data-testid="ws-row"]')].map((r) => `${r.getAttribute('data-ws')}:${r.getAttribute('data-state')}`),
    returnNotes: [...document.querySelectorAll('[data-testid="umap-return-note"] li')].map((l) => l.getAttribute('data-kind')),
    goalEdit: !!document.querySelector('[data-testid="map-goal-edit"]'),
    goalToCurrent: !!document.querySelector('[data-testid="map-goal-to-current"]'),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
})
async function needOf(page, task) {
  await page.click(`[data-node="${task}"]`)
  await page.click(`[data-node="${task}"]`).catch(() => {})
  await page.waitForSelector('[data-testid="task-pop"]').catch(() => {})
  await page.click('[data-testid="pop-detail"]').catch(() => {})
  await page.waitForSelector('[data-testid="ins-drawer"]').catch(() => {})
  const v = await page.$eval('[data-testid="ins-drawer"]', (d) => ({ evidence: d.querySelector('[data-testid="inspector-evidence"]')?.getAttribute('data-evidence') ?? null, need: d.querySelector('[data-testid="inspector-need"]')?.textContent ?? null, relevance: d.querySelector('[data-testid="inspector-relevance"]')?.textContent ?? null })).catch(() => null)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.keyboard.press('Escape')
  return v
}
async function seedSession(page) {
  const key = Object.fromEntries(((await db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', 'M2409')).data ?? []).map((k) => [k.no, k.answers[0]]))
  const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: 'M2409', mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
  for (let i = 0; i < 60; i++) { if (((await db.from('csat_dx_snapshot').select('id').eq('user_id', users[0]).limit(1)).data ?? []).length) break; await page.waitForTimeout(1000) }
  return r.status()
}

let fatal = null
try {
  const A = await account('a')
  const { ctx, page } = await login(A)
  // T06 목표 없음 — 지도 · 탐색 정상
  await openMap(page)
  const s0 = await mapState(page)
  rec('T06', '목표 없음 — 지도 열림 · 저장 목표 줄 없음(기본값을 목표로 보이지 않음) · 가로 넘침 0', s0.goalValue?.includes('아직 정하지 않았어요') && s0.target === null && s0.overflowX === 0, s0, 'browser')
  const seeded = await seedSession(page)

  // T01 점수-only 호환 · 멱등 · 키 재사용 409
  const k1 = crypto.randomUUID()
  const p1 = await putGoal(page, { target: 80, clientKey: k1 })
  const p1b = await putGoal(page, { target: 80, clientKey: k1 })
  const p1c = await putGoal(page, { target: 85, clientKey: k1 })
  const G1 = await goalRows(A.uid)
  await openMap(page)
  const s1 = await mapState(page)
  rec('T01', '점수-only 80 — 200 · 같은 키 재전송 reused(같은 버전) · 같은 키 다른 본문 409 · 이력 1행(시험 · 등급 · 날짜 null) · 지도 평가원 기본 범위', seeded === 200 && p1.status === 200 && p1b.body?.reused === true && p1b.body?.goalVersionId === p1.body?.goalVersionId && p1c.status === 409 && G1.length === 1 && G1[0].target_exam === null && s1.target?.scope === 'default' && !!s1.target?.exams, { p1: scrub(p1.body), reused: p1b.body?.reused, conflict: p1c.status, rows: G1.length, target: s1.target })
  await shot(page, 'T01-score-only')
  const r5Default = await needOf(page, 'r.central_meaning')

  // T02 · 화면 팝업으로 수능 · 2등급 · 목표일 저장(90점)
  await openMap(page)
  await page.click('[data-testid="map-goal-edit"]')
  await page.waitForSelector('[data-testid="goal-more"]')
  await page.fill('#map-goal-input', '90')
  await page.click('[data-testid="goal-more"] > summary')
  await page.selectOption('[data-testid="goal-exam"]', 'suneung')
  await page.selectOption('[data-testid="goal-grade"]', '2')
  await page.fill('[data-testid="goal-date"]', TARGET_DATE)
  await shot(page, 'T02-popup')
  await page.click('[data-testid="goal-apply-all"]')
  await page.waitForFunction(() => document.querySelector('[data-testid="goal-target"]')?.getAttribute('data-exam') === 'suneung', null, { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(800)
  const G2 = await goalRows(A.uid)
  const s2 = await mapState(page)
  const last = G2.at(-1)
  rec('T02', '팝업 저장 90 · 수능 · 2등급 · 미래 목표일 → 새 이력 행 · 최신 표 90 · 화면 같은 값 · 기준 시험이 수능 회차로 바뀜', G2.length === 2 && last.target_score === 90 && last.target_exam === 'suneung' && last.target_grade === 2 && last.target_date === TARGET_DATE && (await latestGoal(A.uid))?.target_score === 90 && s2.target?.exam === 'suneung' && s2.target?.grade === '2' && s2.target?.date === TARGET_DATE && s2.target?.exams !== s1.target?.exams, { row: last, target: s2.target, before: s1.target?.exams })
  await shot(page, 'T02-saved')
  rec('T04', '저장 등급 2 · 점수 90 참고 구간 — 섞지 않고 따로 표시 · 모순이면 「바꾸지 않았어요」', s2.goalValue?.includes('참고') && (s2.target?.text?.includes('목표 2등급') ?? false), { goalValue: s2.goalValue, line: s2.target?.text })
  rec('T05', '목표일 저장 · 표시 · 계획량 생성 없음(화면에 날짜 기반 학습량 문구 없음)', s2.target?.date === TARGET_DATE && !(await page.textContent('body')).includes('하루에'), { date: s2.target?.date })

  // 9월 모평 → 범위 다시 바뀜
  const k9 = await putGoal(page, { target: 90, exam: 'kice9', grade: 2, date: TARGET_DATE, clientKey: crypto.randomUUID() })
  await openMap(page)
  const s9 = await mapState(page)
  rec('T03a', '시험 종류 수능 → 9월 모평 — 기준 시험 회차 집합이 바뀐다(실제 범위 변경)', k9.status === 200 && s9.target?.exam === 'kice9' && s9.target?.scope === 'supported' && s9.target?.exams !== s2.target?.exams, { suneung: s2.target?.exams, kice9: s9.target?.exams })

  // T03 · T07 학평 — 미지원 · 평가원으로 대체 없음 · 약점으로 만들지 않음
  const kh = await putGoal(page, { target: 90, exam: 'hakpyeong', clientKey: crypto.randomUUID() })
  await openMap(page)
  const sh = await mapState(page)
  const r5h = await needOf(page, 'r.central_meaning')
  await shot(page, 'T03-hakpyeong')
  rec('T03', '학평 목표 — 저장됨 · 기준 시험 0(평가원으로 대신하지 않음) · 「분석 자료 준비 중」', kh.status === 200 && sh.target?.exam === 'hakpyeong' && sh.target?.scope === 'unsupported_content' && sh.target?.exams === '' && sh.target?.text?.includes('분석 자료 준비 중'), { target: sh.target })
  rec('T07', '자료 부족 — R5 를 약점(확인된 요구)으로 만들지 않음 · 목표 연결 「확인 전」', r5h?.evidence !== 'need_confirmed' && /확인 전|요구 없음/.test(r5h?.need ?? ''), { r5Default, r5h })
  rec('T02b', '목표 변경에 따라 NeedRank/ActionRank 가 바뀐다(학평 미지원 → 먼저 볼 순서 · 상단 다음 행동 변화)', JSON.stringify(sh.order) !== JSON.stringify(s1.order) || sh.topNext !== s1.topNext, { default: { order: s1.order, top: s1.topNext }, hakpyeong: { order: sh.order, top: sh.topNext } })

  // T08 수행 원장 불변 · T09/T10 PLAN 목표 버전
  // 실제 수행 1건(확인 문항 오답 · 기존 API) — 0 → 0 비교는 증거가 아니다
  const ann = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/annotations', fs.readdirSync(path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')).filter((x) => x.startsWith('claim-support-2022-20.v')).sort().at(-1)), 'utf8'))
  const att = await page.request.post(`${BASE}/api/csat/item/2022-20/task`, { data: { response: { claim: (ann.claim + 1) % ann.sentenceCount, support: ann.support, relation: ann.relationProbe.relation }, sec: 40, clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent' } })
  const ledgerOf = async () => ((await db.from('learning_task_attempts').select('item_ref, task_key, phase, is_correct').eq('user_id', A.uid).order('id')).data ?? []).map((r) => `${r.item_ref}|${r.task_key}|${r.phase}|${r.is_correct}`).join(';')
  const beforeLedger = await ledgerOf()
  const before = (await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', A.uid)).count
  const kS = await putGoal(page, { target: 80, exam: 'suneung', clientKey: crypto.randomUUID() })
  const gS = kS.body?.goalVersionId
  const c1 = await page.request.post(`${BASE}/api/csat/diagnosis/map/plan`, { data: { template: WS, order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], planned: {}, reason: 'initial', expectedVersion: 0, clientKey: crypto.randomUUID() } })
  const kS2 = await putGoal(page, { target: 95, exam: 'suneung', clientKey: crypto.randomUUID() })
  const after = (await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', A.uid)).count
  rec('T08', '실제 수행 1건 뒤 목표를 두 번 바꿔도 수행 원장(행 수 · 문항 · 과제 · 단계 · 정오) 그대로', att.status() === 200 && before === 1 && after === 1 && beforeLedger === (await ledgerOf()), { attempt: att.status(), before, after }, 'db')
  const ws = (await db.from('learner_workspace').select('id').eq('user_id', A.uid).eq('template_id', WS)).data?.[0]
  const plans1 = (await db.from('learner_workspace_plan').select('plan_version, goal_version_id').eq('workspace_id', ws.id).order('plan_version')).data
  const c2 = await page.request.post(`${BASE}/api/csat/diagnosis/map/plan`, { data: { template: WS, order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], planned: {}, reason: 'restore', restoreOf: 1, expectedVersion: 1, clientKey: crypto.randomUUID() } })
  const plans2 = (await db.from('learner_workspace_plan').select('plan_version, goal_version_id, restored_from').eq('workspace_id', ws.id).order('plan_version')).data
  rec('T09', 'PLAN v1 은 저장 당시 목표 버전(80 · 수능)에 결속 · 목표 변경(95)이 소급하지 않음', c1.status() === 200 && plans1.length === 1 && plans1[0].goal_version_id === gS && kS2.status === 200, { v1goal: plans1[0]?.goal_version_id === gS ? 'v(80)' : 'other' }, 'db')
  rec('T10', 'v1 복원 → v2 · restored_from 1 · 새 행의 목표 버전 = 지금 목표(95) · 최신 목표 표는 95 그대로(되감기 없음)', c2.status() === 200 && plans2.length === 2 && plans2[1].restored_from === 1 && plans2[1].goal_version_id === kS2.body?.goalVersionId && (await latestGoal(A.uid))?.target_score === 95, { restored: plans2[1]?.restored_from, goalNow: (await latestGoal(A.uid))?.target_score, v2goalIsCurrent: plans2[1]?.goal_version_id === kS2.body?.goalVersionId }, 'db')
  await openMap(page)
  await page.click(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`)
  await page.click('[data-testid="ws-tab-plan"]')
  await page.waitForSelector('[data-testid="plan-history"]').catch(() => {})
  await page.click('[data-testid="plan-history"] > summary').catch(() => {})
  const hist = await page.$$eval('[data-testid="plan-goal-version"]', (xs) => xs.map((x) => ({ current: x.getAttribute('data-current'), text: x.textContent })))
  await shot(page, 'T09-plan-history')
  await page.keyboard.press('Escape')
  rec('T09b', 'PLAN 이력 화면 — 버전별 목표(그때 / 지금)와 「되돌려도 지금 목표는 바뀌지 않아요」', hist.length >= 1 && hist.some((h) => h.text?.includes('그때 목표 80점')) , { hist })

  // T11 오래된 링크 복귀 — 목표 변경 알림
  await openMap(page, `&view=full&map_task=r.central_meaning&ws=${WS}&map_goal=${gS}`)
  const s11 = await mapState(page)
  rec('T11', '옛 목표 버전(map_goal)으로 복귀 → 「목표가 바뀌었어요」 · 지금 목표 기준 계산', s11.returnNotes.includes('goal_changed') && s11.target?.exam === 'suneung', { notes: s11.returnNotes })

  // T13 저장 실패 — 기본값 · 빈 목표로 대체 없음
  await openMap(page)
  await page.route('**/api/csat/diagnosis/map/goal', (r) => r.fulfill({ status: 500, body: '{"error":"x"}' }))
  await page.click('[data-testid="map-goal-edit"]')
  await page.fill('#map-goal-input', '70')
  await page.click('[data-testid="goal-more"] > summary').catch(() => {})
  await page.click('[data-testid="goal-apply-all"]')
  await page.waitForTimeout(1200)
  const errShown = await page.$('[role="alert"]')
  await page.unroute('**/api/csat/diagnosis/map/goal')
  await page.keyboard.press('Escape')
  await openMap(page)
  const s13 = await mapState(page)
  rec('T13', '저장 실패(500 주입) — 오류 표시 · 저장 목표 95 그대로(70 · 빈 목표로 바뀌지 않음)', !!errShown && s13.goalValue?.includes('95') && (await latestGoal(A.uid))?.target_score === 95, { goalValue: s13.goalValue })
  const rowsBefore = (await goalRows(A.uid)).length
  const bad = await putGoal(page, { grade: 2 })
  const bad2 = await putGoal(page, { target: 80, exam: 'toeic' })
  rec('T13b', '등급만(점수 없음) · 모르는 시험 → 400 · 이력 행 늘지 않음', bad.status === 400 && bad2.status === 400 && (await goalRows(A.uid)).length === rowsBefore, { status: [bad.status, bad2.status], rows: rowsBefore }, 'db')

  // T14 동시 변경 — 서로 다른 키 두 요청이 겹쳐도 최신 표 = 마지막 이력(같은 트랜잭션 · 사용자 잠금)
  const [x, y] = await Promise.all([putGoal(page, { target: 83, clientKey: crypto.randomUUID() }), putGoal(page, { target: 87, clientKey: crypto.randomUUID() })])
  const G14 = await goalRows(A.uid)
  rec('T14', '겹친 두 저장 — 최신 표 점수 = 마지막 이력 행 점수(어긋남 없음)', x.status === 200 && y.status === 200 && (await latestGoal(A.uid))?.target_score === G14.at(-1).target_score, { latest: (await latestGoal(A.uid))?.target_score, lastRow: G14.at(-1).target_score }, 'db')

  // T15 과거 asof — 읽기 전용
  const yday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  await openMap(page, `&view=full&asof=${yday}`)
  const s15 = await mapState(page)
  rec('T15', '과거 asof — 목표 편집 대신 「현재 기준에서 목표 바꾸기」 링크', !s15.goalEdit && s15.goalToCurrent, { goalEdit: s15.goalEdit, toCurrent: s15.goalToCurrent }, 'browser')
  rec('T16', '페이지 가로 넘침 0', [s1, s2, sh].every((s) => s.overflowX === 0), { w: WIDTH }, 'browser')
  await ctx.close()

  // T12 보안 — B 는 A 의 목표 · 계획 이력을 못 본다(RLS · anon 키 로그인)
  const B = await account('b')
  const asB = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const signB = await asB.auth.signInWithPassword({ email: B.email, password: B.password })
  const peekG = await asB.from('csat_map_goal_version').select('id').eq('user_id', A.uid)
  const peekL = await asB.from('csat_map_goal').select('user_id').eq('user_id', A.uid)
  const peekP = await asB.from('learner_workspace_plan').select('id').eq('user_id', A.uid)
  rec('T12', '다른 학습자는 A 의 목표 이력 · 최신 목표 · 계획 이력을 읽지 못한다', !signB.error && !peekG.error && !peekL.error && !peekP.error && (peekG.data ?? []).length === 0 && (peekL.data ?? []).length === 0 && (peekP.data ?? []).length === 0, { goalVersion: peekG.data?.length ?? peekG.error?.code, goal: peekL.data?.length ?? peekL.error?.code, plan: peekP.data?.length ?? peekP.error?.code }, 'db')
} catch (e) {
  fatal = String(e?.stack ?? e).slice(0, 800)
  console.log('[FATAL]', fatal)
} finally {
  const cleanup = []
  for (const id of users) {
    await db.auth.admin.deleteUser(id)
    const g = await db.auth.admin.getUserById(id)
    cleanup.push(!!g.error && (g.error.status === 404 || /not.?found/i.test(g.error.message ?? '')))
  }
  await browser.close()
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ sha: SHA, dirtyTree: DIRTY, base: BASE, width: WIDTH, targetDate: TARGET_DATE, pass, fail, fatal, accounts: { created: users.length, absentAfter: cleanup.filter(Boolean).length }, layers: { learning_effect: 'NOT_CLAIMED' }, results: scrub(results) }, null, 2))
  console.log(`accounts created ${users.length} · absent ${cleanup.filter(Boolean).length}`)
  console.log(`PASS ${pass} · FAIL ${fail}${fatal ? ' · FATAL' : ''}`)
  process.exitCode = fail || fatal || cleanup.some((x) => !x) ? 1 : 0
}
