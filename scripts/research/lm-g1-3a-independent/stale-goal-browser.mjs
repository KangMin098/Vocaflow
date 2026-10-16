// scripts/research/lm-g1-3a-independent/stale-goal-browser.mjs
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

const ROOT = path.resolve(import.meta.dirname, '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3005')
const WIDTH = Number(arg('--width', '1440'))
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
  users.push(u.user.id);fs.writeFileSync(path.join(EVID,'owned-accounts.local.json'),JSON.stringify(users))
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

let fatal=null;
try{const A=await account('stale-goal');const {ctx,page}=await login(A);await putGoal(page,{target:80,exam:'suneung',clientKey:crypto.randomUUID()});const init=await page.request.post(BASE+'/api/csat/diagnosis/map/plan',{data:{template:WS,order:['r.central_meaning','r.discourse_function','r.discourse_structure'],planned:{},reason:'initial',expectedVersion:0,clientKey:crypto.randomUUID()}});if(init.status()!==200)throw Error('init PLAN');
for(const [target,exam] of [[80,'kice9'],[90,'kice6']]){await openMap(page);const oldGoal=Number(await page.getByTestId('goal-target').getAttribute('data-version'));await page.click('[data-testid="ws-row"][data-ws="'+WS+'"] [data-testid="ws-open"]');await page.click('[data-testid="ws-tab-plan"]');await page.getByTestId('plan-section').getByRole('button',{name:/계획 한 (문항|지문) 늘리기$/}).first().click();await page.getByTestId('plan-note').fill('old-goal-version-'+oldGoal);const changed=await putGoal(page,{target,exam,clientKey:crypto.randomUUID()});const before=(await db.from('learner_workspace_plan').select('plan_version,goal_version_id').eq('user_id',A.uid)).data;const got=page.waitForResponse(r=>r.url().endsWith('/api/csat/diagnosis/map/plan')&&r.request().method()==='POST');await page.getByTestId('plan-save').click();const response=await got;const after=(await db.from('learner_workspace_plan').select('plan_version,goal_version_id').eq('user_id',A.uid)).data;rec('OLD-'+target,'old rendered goal cannot silently bind user PLAN to newer goal',response.status()===409&&after.length===before.length,{oldGoal,newGoal:changed.body.goalVersionId,http:response.status(),requestExpected:response.request().postDataJSON().expectedGoalVersion??'absent',before:before.length,after});await shot(page,'stale-'+target);await openMap(page);await page.click('[data-testid="ws-row"][data-ws="'+WS+'"] [data-testid="ws-open"]');await page.click('[data-testid="ws-tab-plan"]');const note=await page.getByTestId('plan-note').inputValue();const oldKept=await page.evaluate(value=>Object.keys(localStorage).some(k=>k.endsWith(':note')&&localStorage.getItem(k)===value),'old-goal-version-'+oldGoal);rec('DRAFT-'+target,'same-score new goal does not inherit old draft; original remains stored',note===''&&oldKept,{note,oldKept})}await ctx.close();
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
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ sha: SHA, dirtyTree: DIRTY, base: BASE, width: WIDTH, pass, fail, fatal, accounts: { created: users.length, absentAfter: cleanup.filter(Boolean).length }, layers: { learning_effect: 'NOT_CLAIMED' }, results: scrub(results) }, null, 2))
  console.log(`accounts created ${users.length} · absent ${cleanup.filter(Boolean).length}`)
  console.log(`PASS ${pass} · FAIL ${fail}${fatal ? ' · FATAL' : ''}`)
  process.exitCode = fail || fatal || cleanup.some((x) => !x) ? 1 : 0
}
