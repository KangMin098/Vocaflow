// scripts/research/lm-g1-2-independent/vertical.mjs
//
// LM-G1.2 — R5 실제 수행 → 원자 저장 → 증거 판정 → MAP/Workspace 재계산 → PLAN 버전 → 다음 학습 수직 검증.
// 증거 층위: ② 개발 DB · 기존 API(쓰기는 합성 계정 본인의 기존 API 만 · 원장은 서비스 키로 **읽기만**) ③ 실제 Chromium. ④ 학습 효과는 PASS 로 만들지 않는다.
// 쓰기 경로(새 엔진 없음): 확인 · 바로잡기 /api/csat/item/{slug}/task(recordItemTaskAttempt) · 적용 /api/csat/practice/attempt(submitPractice)
//   · 목표 /api/csat/diagnosis/map/goal · 계획 /api/csat/diagnosis/map/plan(plan-commit RPC). 정답 · 오답은 주석(annotations)으로 만든다.
// 계정은 실행 끝에 삭제하고 부재를 확인한다(404/user_not_found 만 부재). 이메일 · 비밀번호 · 사용자 id · 응답 전문은 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-2.mjs --base http://localhost:3005 --width 1440 --evidence <dir>
import {cleanupOwnedAccounts} from '../lm-g1-1-independent/cleanup.mjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3005')
const WIDTH = Number(arg('--width', '1440'))
const EVID = path.resolve(ROOT, arg('--evidence', `tmp/lm-g1-2-${WIDTH}`))
const T = 'r.central_meaning'
const WS = 'ws.central-meaning'
const KEY = 'claim-support'
const ANN = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim()
const startedAt = new Date().toISOString()
const results = []
const rec = (id, name, ok, detail, layer = 'db+browser') => { results.push({ id, name, status: ok ? 'PASS' : 'FAIL', layer, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 420)}` : ''}`) }
const users = []
const browser = await chromium.launch()
let shots = 0
const shot = (page, name) => page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`) })
const slugOf = (href) => (href ? decodeURIComponent(href.split('#')[0].split('?')[0].split('/').pop()) : null)
const itemParam = (href) => { try { return new URL(href, BASE).searchParams.get('item') } catch { return null } }
const target = (href) => (href?.includes('/practice/') ? `practice:${itemParam(href)}` : `item:${slugOf(href)}`)

function annotation(slug) {
  const files = fs.readdirSync(ANN).filter((f) => f.startsWith(`claim-support-${slug.toLowerCase().replace('#', '-')}.v`)).sort()
  if (!files.length) throw new Error(`주석 없음 ${slug}`)
  return JSON.parse(fs.readFileSync(path.join(ANN, files.at(-1)), 'utf8'))
}
const meta = () => ({ clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent', sec: 40 })
async function answerItem(page, slug, ok) {
  const a = annotation(slug)
  const response = { claim: ok ? a.claim : (a.claim + 1) % a.sentenceCount, support: a.support, relation: a.relationProbe.relation }
  const r = await page.request.post(`${BASE}/api/csat/item/${slug}/task`, { data: { response, ...meta() } })
  const j = await r.json().catch(() => null)
  await page.waitForTimeout(1300)
  return { status: r.status(), isCorrect: j?.grade?.isCorrect ?? null }
}
async function transferOnce(page, itemId) {
  const r = await page.request.post(`${BASE}/api/csat/practice/attempt`, { data: { itemId, claim: 0, support: [1], relation: 'reason', option: null, confidence: 2, preview: false, ...meta() } })
  const j = await r.json().catch(() => null)
  await page.waitForTimeout(1300)
  return { status: r.status(), ok: r.status() === 200, err: r.status() === 200 ? null : (j?.error ?? j?.code ?? null) }
}
// 원장(읽기 전용 · 서비스 키) — 이 사용자 · 이 과제 키의 시도
async function ledger(uid) {
  const { data, error } = await db.from('learning_task_attempts').select('item_ref, task_key, phase, is_correct, received_at, session_id, activity').eq('user_id', uid).order('answered_at', { ascending: true })
  if (error) throw new Error(`원장 조회 실패 ${error.message}`)
  return data
}
async function planRows(uid) {
  const ws = await db.from('learner_workspace').select('id').eq('user_id', uid).eq('template_id', WS)
  if (ws.error) throw new Error(ws.error.message)
  if (!ws.data.length) return []
  const { data, error } = await db.from('learner_workspace_plan').select('plan_version, reason, restored_from, plan').eq('workspace_id', ws.data[0].id).order('plan_version')
  if (error) throw new Error(error.message)
  return data
}
async function login() {
  const email = `map-lmg12-${WIDTH}-${Date.now()}@example.com`
  const password = `Lg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  fs.writeFileSync(path.join(EVID,'owned-accounts.local.json'),JSON.stringify(users))
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(120_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  return { ctx, page, uid: u.user.id }
}
async function openMap(page, q = '') {
  await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full&map_task=${T}&ws=${WS}${q}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]', { timeout: 120_000 })
  await page.waitForTimeout(700)
}
async function surfaces(page, name) {
  const s = {}
  s.actionOrder = (await page.getAttribute(`[data-node="${T}"]`, 'aria-label'))?.match(/먼저 볼 순서 (\d+)/)?.[1] ?? null
  s.selected = await page.getAttribute('[data-testid="unified-map"]', 'data-selected')
  s.ws = await page.getAttribute('[data-testid="unified-map"]', 'data-ws')
  s.row = await page.$eval(`[data-testid="ws-row"][data-ws="${WS}"]`, (r) => ({ state: r.getAttribute('data-state'), link: r.getAttribute('data-link'), stage: r.querySelector('[class*="trackName"]')?.textContent ?? null, amount: r.querySelector('[class*="amountTxt"]')?.textContent ?? null, next: r.querySelector('[data-testid="ws-next"]')?.getAttribute('href') ?? null })).catch(() => null)
  await page.click(`[data-node="${T}"]`)
  await page.waitForSelector(`[data-testid="task-pop"][data-task="${T}"]`).catch(() => {})
  s.pop = await page.$eval('[data-testid="task-pop"]', (p) => ({ next: p.querySelector('[data-testid="pop-next"]')?.getAttribute('href') ?? null, evidence: p.querySelector('[data-testid="pop-evidence"]')?.getAttribute('data-evidence') ?? null, held: p.querySelector('[data-testid="pop-timing-held"]')?.textContent ?? null, stage: [...p.querySelectorAll('dd')][2]?.textContent ?? null })).catch(() => null)
  await page.click('[data-testid="pop-detail"]').catch(() => {})
  await page.waitForSelector('[data-testid="ins-drawer"] [data-testid="task-inspector"]').catch(() => {})
  s.drawer = await page.$eval('[data-testid="ins-drawer"]', (d) => ({ next: d.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null, evidence: d.querySelector('[data-testid="inspector-evidence"]')?.getAttribute('data-evidence') ?? null, need: d.querySelector('[data-testid="inspector-need"]')?.textContent ?? null })).catch(() => null)
  // 기출 근거 자세히(lifecycle 4칸 · 처방) — 있으면 열어 적용 진행을 읽는다
  if (await page.$('[data-testid="ins-drawer"] [data-testid="inspector-evidence-detail"]')) {
    await page.click('[data-testid="ins-drawer"] [data-testid="inspector-detail"] > summary').catch(() => {})
    await page.click('[data-testid="ins-drawer"] [data-testid="inspector-evidence-detail"]').catch(() => {})
    await page.waitForSelector('[data-step-sheet]', { timeout: 15_000 }).catch(() => {})
    s.sheet = await page.$eval('[data-step-sheet]', (e) => ({ next: e.querySelector('[data-testid="step-prescription"]')?.getAttribute('data-next') ?? null, transfer: e.querySelector('[data-testid="rx-transfer-state"]')?.getAttribute('data-progress') ?? null, transferDone: e.querySelector('[data-testid="rx-transfer-state"]')?.getAttribute('data-done') ?? null })).catch(() => null)
    if (name) await shot(page, `${name}-sheet`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
  if (name) await shot(page, `${name}-drawer`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  if (await page.$('[data-testid="ins-drawer"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(250) }
  await page.click(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`)
  await page.waitForSelector('[data-testid="ws-modal"]')
  s.modal = await page.$eval('[data-testid="ws-modal"]', (m) => ({ now: m.querySelector('[data-testid="ws-stage"][data-now="true"]')?.getAttribute('data-stage') ?? null, next: m.querySelector('[data-testid="ws-modal-next"]')?.getAttribute('href') ?? null }))
  await page.click('[data-testid="ws-tab-plan"]')
  await page.waitForSelector('[data-testid="ws-modal"] [data-testid="plan-section"]')
  s.plan = await page.$eval(`[data-testid="plan-section"]`, (sec) => { const li = sec.querySelector('li[data-task="r.central_meaning"]'); return { savedVersion: sec.getAttribute('data-saved-version'), draft: sec.getAttribute('data-draft'), saveState: sec.querySelector('[data-testid="plan-save-state"]')?.getAttribute('data-state') ?? null, text: li?.textContent ?? null, stage: li?.getAttribute('data-stage') ?? null, planned: li?.getAttribute('data-planned') ?? null, done: li?.getAttribute('data-done') ?? null, achievement: li?.getAttribute('data-achievement') ?? null, go: li?.querySelector('[data-testid="plan-go"]')?.getAttribute('href') ?? null } }).catch(() => null)
  if (name) await shot(page, `${name}-plan`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  s.top = await page.$eval('[data-testid="umap-top-next"]', (a) => ({ task: a.getAttribute('data-task'), href: a.getAttribute('href') })).catch(() => null)
  s.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return s
}
const agree = (s) => { const xs = [s.pop?.next, s.drawer?.next, s.row?.next, s.modal?.next, s.plan?.go].map((h) => (h ? target(h) : null)); return xs.every((x) => x === xs[0]) ? xs[0] : null }
const stageOf = (s) => (s.plan?.stage === s.modal?.now ? s.plan?.stage : `MISMATCH(${s.plan?.stage}/${s.modal?.now})`)
const snap = (s) => ({ needRank: s.drawer?.need?.match(/순서 (\d+)/)?.[1] ?? null, actionRankTop3: s.actionOrder, topAction: s.top?.task ?? null, draft: s.plan?.draft, stage: stageOf(s), target: agree(s), done: s.plan?.done, planned: s.plan?.planned, achievement: s.plan?.achievement, evidence: s.drawer?.evidence, row: s.row?.state, sheet: s.sheet, held: s.pop?.held })

async function commitPlan(page, body) {
  const r = await page.request.post(`${BASE}/api/csat/diagnosis/map/plan`, { data: body })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const planBody = (o) => ({ template: WS, order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], planned: {}, reason: 'initial', expectedVersion: 0, clientKey: crypto.randomUUID(), ...o })

let fatal = null
try {
  const { ctx, page, uid } = await login()
  // 2 목표 80 저장 · 원장
  const g = await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })
  const goalRow = await db.from('csat_map_goal').select('target_score').eq('user_id', uid)
  rec('R01', '목표 80 저장 — API 200 · 원장 1행(본인)', g.status() === 200 && goalRow.data?.[0]?.target_score === 80, { status: g.status(), rows: goalRow.data?.length ?? null }, 'db')
  await openMap(page)
  const s0 = await surfaces(page, '00-start')
  rec('R02', '시작 — R5 직접 확인 전 · 확인 단계 · 모든 표면 같은 확인 문항', s0.drawer?.evidence !== 'need_confirmed' && stageOf(s0) === 'check' && !!agree(s0), snap(s0), 'browser')

  // 4 FIND 2 독립 실패
  const find = []
  for (let i = 0; i < 2; i++) {
    await openMap(page)
    const s = await surfaces(page, null)
    const slug = slugOf(s.drawer?.next ?? s.pop?.next)
    find.push({ slug, ...(await answerItem(page, slug, false)) })
  }
  const L1 = await ledger(uid)
  const firsts = await db.from('learning_first_attempts').select('item_ref, task_key, phase, is_correct').eq('user_id', uid)
  rec('R03', 'FIND 2 실패 — 원자 저장(task_attempts 2 · first_attempts 2 · 같은 과제 키 · phase practice · 오답 · 서버 수신 시각)', find.every((f) => f.status === 200 && f.isCorrect === false) && L1.length === 2 && L1.every((r) => r.task_key === KEY && r.phase === 'practice' && r.is_correct === false && !!r.received_at && !!r.session_id) && (firsts.data ?? []).length === 2, { find, ledger: L1.map((r) => ({ item: r.item_ref, phase: r.phase, ok: r.is_correct })), firsts: firsts.data?.length }, 'db')
  await openMap(page)
  const s1 = await surfaces(page, '01-find-failed')
  const blocked = find.map((f) => f.slug)
  rec('R04', '지도 재계산 — R5 확인된 요구 · REPAIR · 모든 표면 같은 막힌 문항', s1.drawer?.evidence === 'need_confirmed' && stageOf(s1) === 'repair' && blocked.includes(agree(s1)?.split(':')[1]), snap(s1))

  // 7 REPAIR 2 실패
  for (const slug of blocked) await answerItem(page, slug, false)
  await openMap(page)
  const s2 = await surfaces(page, '02-repair-failed')
  const L2 = await ledger(uid)
  rec('R05', 'REPAIR 2 실패 — 원장 4행 · 수행 2 · 다음 REPAIR · 재시도 링크 = 막힌 문항', L2.length === 4 && s2.plan?.done === '2' && stageOf(s2) === 'repair' && blocked.includes(agree(s2)?.split(':')[1]), snap(s2))

  // 9 재시도 성공 → TRANSFER
  const fix = await answerItem(page, blocked[0], true)
  await openMap(page)
  const s3 = await surfaces(page, '03-repair-fixed')
  const t1 = itemParam(s3.plan?.go)
  rec('R06', 'REPAIR 정답 — 원장 정답 1 · TRANSFER 진입 · 0/2 · 적용 문항 링크 일치 · 성취 그대로', fix.isCorrect === true && stageOf(s3) === 'transfer' && s3.plan?.done === '0' && s3.plan?.planned === '2' && !!t1 && agree(s3) === `practice:${t1}` && s3.plan?.achievement === 'need_confirmed', snap(s3))

  // 6 PLAN v1 저장 · 멱등 · 충돌
  rec('R06u','TRANSFER 표시 단위는 지문 · 현재 소스 규칙과 일치',/계획\s*2지문/.test(s3.plan?.text ?? ''),{unitText:s3.plan?.text?.match(/계획.{0,18}/)?.[0]??null},'browser')

  // Supporting Workspace shows the core transfer policy; it cannot save another R5 policy.
  await openMap(page)
  await page.click('[data-testid="ws-row"][data-ws="ws.option-match"] [data-testid="ws-open"]')
  await page.click('[data-testid="ws-tab-plan"]')
  const support=page.locator('[data-testid=plan-section] [data-task="r.central_meaning"]')
  const count=await support.getByRole('button',{name:/계획 한 지문/}).count()
  const home=await support.getByRole('link',{name:'중심 Workspace에서 조정'}).getAttribute('href')
  rec('R06v','보조 R5는 전이 계획량 읽기 전용 · 중심 Workspace 연결',count===0&&home?.includes('ws=ws.central-meaning'),{stepperButtons:count,home},'browser')
  await shot(page,'03b-support-readonly-plan')
  const supportReq={template:'ws.option-match',order:['e.option_correspondence','v.semantic_relation',T],planned:{[T]:1},reason:'initial',expectedVersion:0,clientKey:crypto.randomUUID()}
  const supportBad=await commitPlan(page,supportReq)
  const supportGood=await commitPlan(page,{...supportReq,planned:{[T]:null},clientKey:crypto.randomUUID()})
  rec('R06w','보조 전이량 API 덮기422 · 참조 저장200 · 중심 정책2 유지',supportBad.status===422&&supportBad.body?.code==='planned_not_owned'&&supportGood.status===200,{bad:supportBad.status,good:supportGood.status},'db')
  await openMap(page)
  await page.click('[data-testid=\"ws-row\"][data-ws=\"'+WS+'\"] [data-testid=ws-open]')
  await page.click('[data-testid=ws-tab-plan]')
  const minButton=page.locator('[data-testid=plan-section] [data-task=\"r.central_meaning\"]').getByRole('button',{name:/계획 한 지문 줄이기$/})
  await minButton.click()
  const lowerBlocked=await minButton.isDisabled()
  const zero=await commitPlan(page,planBody({planned:{[T]:0}}))
  rec('R06x','전이 최소1 UI 일치 · 0 저장은422로 거절',lowerBlocked&&zero.status===422&&zero.body?.code==='planned_min',{lowerBlocked,status:zero.status},'browser')
  await page.click('[data-testid=plan-reset]')
  await openMap(page)
  const v1Body = planBody({ planned: { 'r.central_meaning': 2 } })
  const c1 = await commitPlan(page, v1Body)
  const c1b = await commitPlan(page, v1Body) // 같은 요청 재전송(응답 유실 재시도)
  const c1c = await commitPlan(page, { ...v1Body, note: '다른 본문' }) // 같은 키 · 다른 본문
  const stale = await commitPlan(page, planBody({ planned: { 'r.central_meaning': 2 }, reason: 'learner_adjust', expectedVersion: 0 })) // 낡은 버전
  const P1 = await planRows(uid)
  rec('R07', 'PLAN v1 저장 · 같은 요청 재전송 = 같은 버전(reused) · 같은 키 다른 본문 409 · 낡은 버전 409 · 행 1개', c1.status === 200 && c1b.status === 200 && c1b.body?.version === c1.body?.version && c1b.body?.reused === true && c1c.status === 409 && stale.status === 409 && P1.length === 1, { c1: c1.body, c1b: c1b.body, c1c: c1c.status, stale: stale.status, rows: P1.length }, 'db')

  await openMap(page)
  await page.route('**/api/csat/diagnosis/map/plan', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{"error":"x"}' }) : route.continue()))
  await page.click(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`)
  await page.click('[data-testid="ws-tab-plan"]')
  await page.waitForSelector('[data-testid="plan-section"]')
  await page.locator('[data-testid="plan-section"]').getByRole('button', { name: /계획 한 (문항|지문) 줄이기$/ }).first().click().catch(() => {})
  await page.click('[data-testid="plan-save"]').catch(() => {})
  await page.waitForTimeout(1500)
  const fail = await page.evaluate(() => ({ dirty: document.querySelector('[data-testid="plan-section"]')?.getAttribute('data-draft') === 'yes', err: !!document.querySelector('[data-testid="plan-error"]'), state: document.querySelector('[data-testid="plan-save-state"]')?.getAttribute('data-state') ?? null, saved: document.querySelector('[data-testid="plan-section"]')?.getAttribute('data-saved-version') ?? null }))
  await shot(page, '09-save-failure')
  await page.unroute('**/api/csat/diagnosis/map/plan')
  rec('R18', '저장 실패(500 주입) — 오류 표시 · 「저장됨」 아님 · 저장 버전 그대로 · 원장 행 그대로', fail.err && fail.state !== 'saved' && fail.saved === '1' && fail.dirty && (await planRows(uid)).length === 1, fail)
  await page.reload({ waitUntil: 'domcontentloaded' })
  // 11 TRANSFER 1회
  const tr1 = await transferOnce(page, t1)
  await openMap(page)
  const s4 = await surfaces(page, '04-transfer-1')
  const L4 = await ledger(uid)
  const trRows = L4.filter((r) => r.phase === 'transfer')
  rec('R08', 'TRANSFER 1회 — 원장 transfer 1행 · PLAN 1/2 · 여전히 적용 · 다음 링크는 다른 적용 문항', tr1.ok && trRows.length === 1 && s4.plan?.done === '1' && (s4.plan?.planned === '2' || s4.plan?.draft === 'yes') && s4.sheet?.transfer === '1/2' && stageOf(s4) === 'transfer' && agree(s4)?.startsWith('practice:') && itemParam(s4.plan?.go) !== t1, { tr1, rows: trRows.length, ...snap(s4) })
  rec('R18b', '저장 실패 뒤 초안은 남되(미저장 표시) 엔진은 저장 버전으로 계산 — 초안을 저장된 계획으로 보이지 않는다', s4.plan?.draft !== 'yes' || (s4.plan?.saveState === 'dirty' && s4.plan?.savedVersion === '1' && s4.sheet?.transfer === '1/2'), { draft: s4.plan?.draft, saveState: s4.plan?.saveState, saved: s4.plan?.savedVersion, engine: s4.sheet?.transfer })
  rec('R09', '1회 경험 ≠ 2지문 계획 완료 — lifecycle 4칸(기출 근거 자세히)도 적용 1/2 · 마침 아님', s4.sheet === null || s4.sheet === undefined ? false : s4.sheet.transfer === '1/2' && s4.sheet.transferDone === 'false' && s4.sheet.next === 'transfer', { sheet: s4.sheet ?? 'NOT_OPENED' })

  // 저장 PLAN 은 수행으로 덮이지 않음
  const P4 = await planRows(uid)
  rec('R10', '수행 뒤에도 저장 PLAN 은 자동으로 덮이지 않는다(버전 1 그대로)', P4.length === 1 && P4[0].plan_version === 1 && s4.plan?.savedVersion === '1', { versions: P4.map((p) => p.plan_version), ui: s4.plan?.savedVersion }, 'db')

  // 학습자 조정 — 적용 계획량 1 → v2 → 지도는 다시 확인으로
  const v2 = await commitPlan(page, planBody({ planned: { 'r.central_meaning': 1 }, reason: 'learner_adjust', expectedVersion: 1 }))
  await openMap(page)
  const s5 = await surfaces(page, '05-planned-1')
  rec('R11', '적용 계획량 1 로 조정(v2) → 운영 단계가 다시 확인으로 · 성취 그대로(조정 ≠ 숙달)', v2.status === 200 && v2.body?.version === 2 && stageOf(s5) === 'recheck' && s5.plan?.achievement === 'need_confirmed' && agree(s5)?.startsWith('item:'), { v2: v2.body, ...snap(s5) })

  const policyLedgerBefore = JSON.stringify(await ledger(uid))
  const goalBefore = await db.from('csat_map_goal_version').select('id').eq('user_id', uid).order('id')
  if (goalBefore.error) throw new Error('goal version read failed')
  const checkSave = await commitPlan(page, planBody({ planned: { 'r.central_meaning': 2 }, reason: 'learner_adjust', expectedVersion: 2 }))
  await openMap(page)
  const s5b = await surfaces(page, '05b-recheck-save')
  const goalAfter = await db.from('csat_map_goal_version').select('id').eq('user_id', uid).order('id')
  if (goalAfter.error) throw new Error('goal version read failed')
  rec('R11b','CHECK 운영량 저장 후에도 전이1 유지 · 수행 원장/목표 버전 불변',checkSave.status===200 && checkSave.body?.version===3 && stageOf(s5b)==='recheck' && s5b.sheet?.transfer==='1/1' && JSON.stringify(await ledger(uid))===policyLedgerBefore && JSON.stringify(goalAfter.data)===JSON.stringify(goalBefore.data),snap(s5b))
  // v1 복원 → v4(restore_of 1) → 다시 적용 1/2
  const v3 = await commitPlan(page, planBody({ planned: { 'r.central_meaning': 2 }, reason: 'restore', restoreOf: 1, expectedVersion: 3 }))
  const P6 = await planRows(uid)
  await openMap(page)
  const s6 = await surfaces(page, '06-restore-v1')
  rec('R12', 'v1 명시 복원 → v4 · restored_from 1 · 지도는 다시 적용 1/2', v3.status === 200 && P6.length === 4 && P6[3].restored_from === 1 && stageOf(s6) === 'transfer' && s6.plan?.done === '1', { v3: v3.body, rows: P6.map((p) => ({ v: p.plan_version, reason: p.reason, from: p.restored_from })), ...snap(s6) })

  // 13 두 번째 TRANSFER(다른 문항) → 다시 확인
  const t2 = itemParam(s6.plan?.go)
  const tr2 = await transferOnce(page, t2)
  await openMap(page)
  const s7 = await surfaces(page, '07-transfer-2')
  rec('R13', 'TRANSFER 2회(다른 문항) → 다시 확인 · 다음 = 안 본 확인 문항 · lifecycle 도 CHECK', tr2.ok && t2 !== t1 && stageOf(s7) === 'recheck' && agree(s7)?.startsWith('item:') && (s7.sheet ? s7.sheet.next === 'check' : true), { t1, t2, ...snap(s7) })

  // 15 새로운 미노출 CHECK 2개 정답(독립)
  const checks = []
  for (let i = 0; i < 2; i++) {
    await openMap(page)
    const s = await surfaces(page, null)
    const slug = agree(s)?.startsWith('item:') ? agree(s).split(':')[1] : null
    if (!slug || blocked.includes(slug)) { checks.push({ slug, skipped: true }); break }
    checks.push({ slug, ...(await answerItem(page, slug, true)) })
  }
  await openMap(page)
  const s8 = await surfaces(page, '08-check-passed')
  const firsts8 = await db.from('learning_first_attempts').select('item_ref, is_correct').eq('user_id', uid)
  rec('R14', '미노출 CHECK 2 정답 — 두 문항이 첫 시도 원장에 정답으로 · 직접 확인 재판정(resolved) · R5 요구가 REPAIR 아님 · 성취 resolved', checks.length === 2 && checks.every((c) => c.status === 200 && c.isCorrect === true) && checks.every((c) => (firsts8.data ?? []).some((f) => f.item_ref === c.slug.replace('-', '#') && f.is_correct === true)) && s8.drawer?.evidence === 'passed_current_policy' && s8.plan?.achievement === 'resolved', { checks, firsts: firsts8.data?.length, ...snap(s8), need: s8.drawer?.need })
  rec('R15', '재계산 뒤 Workspace 행 · 팝업 · 모달 · PLAN 이 같은 다음 행동(또는 같이 없음)', s8.plan?.stage === s8.modal?.now && (agree(s8) !== null || [s8.pop?.next, s8.row?.next, s8.plan?.go].every((x) => !x)), snap(s8))
  rec('R16', 'PLAN 저장 이력은 수행으로 바뀌지 않는다(4버전 유지) · 새 단계는 화면 계산(저장은 명시적으로만)', (await planRows(uid)).length === 4 && s8.plan?.savedVersion === '4', { ui: s8.plan?.savedVersion }, 'db')

  // 과거 asof · 저장 실패 표시
  const y = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  await openMap(page, `&asof=${y}`)
  const pastLinks = await page.$$eval('[data-testid="pop-next"], [data-testid="ws-next"], [data-testid="umap-top-next"], [data-testid="ws-modal-next"]', (xs) => xs.length)
  rec('R17', '과거 asof — 학습 시작 링크 0', pastLinks === 0, { pastLinks }, 'browser')
  rec('R19', '페이지 가로 넘침 0', [s0, s4, s8].every((s) => s.overflowX === 0), { w: WIDTH }, 'browser')
  await ctx.close()
} catch (e) {
  fatal = String(e?.stack ?? e).slice(0, 800)
  console.log('[FATAL]', fatal)
} finally {
  const cleanupResult=await cleanupOwnedAccounts(db.auth.admin,users)
  const cleanup=[{absent:cleanupResult.ok}]
  try{await browser.close()}catch{cleanupResult.ok=false;cleanup[0].absent=false}
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ sha: SHA, base: BASE, width: WIDTH, startedAt, endedAt: new Date().toISOString(), pass, fail, fatal, accounts: { created: users.length, confirmedAbsent: cleanupResult.ok ? users.length : null, cleanup: cleanupResult }, layers: { '4_learning_effect': 'NOT_CLAIMED' }, results }, null, 2))
  console.log(`accounts created ${users.length} · absent after cleanup ${cleanup.filter((c) => c.absent).length}`)
  console.log(`PASS ${pass} · FAIL ${fail}${fatal ? ' · FATAL' : ''}`)
  process.exitCode = fail || fatal || cleanup.some((c) => !c.absent) ? 1 : 0
}
