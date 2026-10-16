// scripts/research/lm-g1-3a-independent/independent-browser.mjs
//
// LM-G1.3a — 목표(점수 · 시험 · 등급 · 목표일) 저장 → 기준 시험 범위 → toBe/NeedRank/ActionRank → Workspace → PLAN 목표 버전 결속(T01–T15).
// 층위: ② 개발 DB · 기존 API(합성 계정 본인 · 원장은 서비스 키 읽기 전용 대조) ③ Chromium. 학습 효과 · 점수 상승은 주장하지 않는다.
// 계정은 끝에 삭제 · 부재 확인(404/not found). 이메일 · 비밀번호 · 사용자 id · UUID 는 결과에 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-3a.mjs --base http://localhost:3005 --width 1440 --evidence <dir>
import {sourceModule} from './source-loader.mjs'
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
  users.push(u.user.id); fs.writeFileSync(path.join(EVID,'owned-accounts.local.json'),JSON.stringify(users))
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

let fatal = null;
try {
 const A=await account('independent'); const {ctx,page}=await login(A); await openMap(page); await seedSession(page);
 const comparisons=[];const {composeV4}=sourceModule('apps/web/src/lib/csat/map/v4/compose.ts'),{ranksOf}=sourceModule('apps/web/src/lib/csat/map/v62/rank.ts');
 for(const [target,exam] of [[80,null],[90,null],[80,'suneung'],[90,'suneung'],[90,'kice6'],[90,'kice9'],[90,'hakpyeong']]){
  const saved=await putGoal(page,{target,exam,clientKey:crypto.randomUUID()});await openMap(page);
  const state=await mapState(page);const r5=await needOf(page,'r.central_meaning');
  const detail=await page.evaluate(()=>({version:document.querySelector('[data-testid="goal-target"]')?.getAttribute('data-version'),nextHref:document.querySelector('[data-testid="umap-top-next"]')?.getAttribute('href'),rows:[...document.querySelectorAll('[data-testid="ws-row"]')].map(r=>({ws:r.getAttribute('data-ws'),text:r.textContent,hrefs:[...r.querySelectorAll('a')].map(a=>a.getAttribute('href'))}))}));
  const runtimeData=await page.evaluate(()=>{const el=document.querySelector('[data-testid="umap-canvas"]');let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(let n=0;f&&n<80;n++,f=f.return){const d=f.memoizedProps?.data;if(d?.model&&d?.v4)return JSON.parse(JSON.stringify(d))}return null});if(!runtimeData)throw Error('Actual rendered MAP data unavailable');fs.writeFileSync(path.join(EVID,'runtime-'+target+'-'+exam+'.local.json'),JSON.stringify(runtimeData));
  const rawFlight=await page.evaluate(()=>window.__next_f?.filter(x=>x[0]===1).map(x=>x[1]).join('')??'');
  fs.writeFileSync(path.join(EVID,'flight-'+target+'-'+exam+'.local.txt'),rawFlight);
  const computed=composeV4(runtimeData,{score:runtimeData.model.goal,set:runtimeData.model.goalSet});const ranks=ranksOf(computed);const derived={score:runtimeData.model.goal,target:runtimeData.v4.target.goal,planGoalVersion:runtimeData.v4.saved.goalVersionId,referenceItems:runtimeData.v4.refItems.length,needRank:ranks.needRank,actionRank:ranks.actionRank,workspace:computed.plan};rec('BASIS-'+target+'-'+exam,'actual rendered score / scope goal / PLAN snapshot agree',derived.score===target&&derived.target.id===derived.planGoalVersion&&derived.target.score===target,{score:derived.score,goalVersion:derived.target.id,planGoalVersion:derived.planGoalVersion});fs.writeFileSync(path.join(EVID,'derived-'+target+'-'+exam+'.json'),JSON.stringify(scrub(derived),null,2));
  const rows=await goalRows(A.uid);const last=rows.at(-1);comparisons.push({target,exam,saved:saved.body,state,r5,detail,denominator:(state.target?.exams?.split(',').filter(Boolean).length??0)*45});
  rec('CMP-'+target+'-'+exam,'saved goal / actual reference scope / displayed version',saved.status===200&&last.target_score===target&&String(saved.body.goalVersionId)===detail.version&&state.goalValue?.includes(String(target))&&(exam==='hakpyeong'?state.target?.exams==='':!!state.target?.exams),comparisons.at(-1));
 }
 fs.writeFileSync(path.join(EVID,'comparisons.json'),JSON.stringify(scrub(comparisons),null,2));
 const raceKey=crypto.randomUUID();const race=await Promise.all([81,82].map(target=>putGoal(page,{target,clientKey:raceKey})));rec('HTTP-C','same key different concurrent bodies give exactly one200 and one409',race.filter(x=>x.status===200).length===1&&race.filter(x=>x.status===409).length===1,race);
 const sameKey=crypto.randomUUID();const same=await Promise.all([1,2].map(()=>putGoal(page,{target:83,clientKey:sameKey})));rec('HTTP-D','same key same concurrent bodies return one version',same.every(x=>x.status===200)&&same[0].body.goalVersionId===same[1].body.goalVersionId,same);
 await putGoal(page,{target:86,clientKey:crypto.randomUUID()});const replay=await putGoal(page,{target:83,clientKey:sameKey});rec('HTTP-F','old key replay after new goal does not reset current goal',replay.status===200&&replay.body.goalVersionId===same[0].body.goalVersionId&&(await latestGoal(A.uid)).target_score===86,replay);
 // More than 20 goals: old PLAN must never borrow current goal details.
 const first=await putGoal(page,{target:80,exam:'suneung',clientKey:crypto.randomUUID()});
 const planBody={template:WS,order:['r.central_meaning','r.discourse_function','r.discourse_structure'],planned:{},reason:'initial',expectedVersion:0,clientKey:crypto.randomUUID()};
 const committed=await page.request.post(BASE+'/api/csat/diagnosis/map/plan',{data:planBody});
 for(let i=0;i<22;i++){const p=await putGoal(page,{target:81+(i%10),exam:'suneung',clientKey:crypto.randomUUID()});if(p.status!==200)throw Error('history seed failed')}
 await openMap(page);await page.click('[data-testid="ws-row"][data-ws="'+WS+'"] [data-testid="ws-open"]');await page.click('[data-testid="ws-tab-plan"]');await page.click('[data-testid="plan-history"] > summary').catch(()=>{});
 const hist=await page.$$eval('[data-testid="plan-goal-version"]',xs=>xs.map(x=>x.textContent));await shot(page,'old-plan-outside20');
 rec('H21','old PLAN outside recent20 explicitly unavailable; no fabricated current values',committed.status()===200&&hist.some(x=>x.includes('과거 목표 상세 확인 불가')),hist);
 await page.keyboard.press('Escape');
 // Hold actual successful reply: while saving the visible score/scope/version stays old.
 await openMap(page);const before=await mapState(page);let release,started,handled;const wait=new Promise(r=>release=r),entered=new Promise(r=>started=r),finished=new Promise(r=>handled=r);
 await page.route('**/api/csat/diagnosis/map/goal',async route=>{const real=await route.fetch();started();await wait;await route.fulfill({response:real});handled()});
 await page.click('[data-testid="map-goal-edit"]');await page.fill('#map-goal-input','99');await page.click('[data-testid="goal-more"] > summary').catch(()=>{});await page.selectOption('[data-testid="goal-exam"]','kice6');const geometry=await page.evaluate(()=>{const names=['goal-exam','goal-grade','goal-date','goal-apply-all'];return Object.fromEntries(names.map(n=>{const e=document.querySelector('[data-testid="'+n+'"]'),r=e.getBoundingClientRect();return [n,{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}]}))});rec('UI-fields','date/select controls readable and save does not overlap',geometry['goal-date'].width>=140&&geometry['goal-date'].bottom<=geometry['goal-apply-all'].y,geometry);await shot(page,'goal-editor-readable');
 await page.click('[data-testid="goal-apply-all"]');await entered;
 const pending=await mapState(page);await shot(page,'pending-goal-coherent');rec('S01','pending actual write reply does not mix new score with old scope',pending.goalValue===before.goalValue&&pending.target?.exam===before.target?.exam,{before,pending});
 // Another tab saves a newer goal before first response arrives.
 const tab=await ctx.newPage();const newer=await putGoal(tab,{target:87,exam:'kice9',clientKey:crypto.randomUUID()});release();await finished;await page.unroute('**/api/csat/diagnosis/map/goal');await page.waitForFunction(()=>document.querySelector('[data-testid="goal-value"]')?.textContent.includes('87')&&document.querySelector('[data-testid="goal-target"]')?.getAttribute('data-exam')==='kice9',null,{timeout:30000});
 const final=await mapState(page);rec('S02','late reply refresh uses actual newest goal from another tab',newer.status===200&&final.goalValue?.includes('87')&&final.target?.exam==='kice9',{final});await shot(page,'latest-goal-after-late-reply');
 // Grade contradiction is explicit, never overwritten, for the reverse pair too.
 await putGoal(page,{target:80,grade:1,exam:'suneung',date:'2026-11-19',clientKey:crypto.randomUUID()});
 await openMap(page);const grade=await mapState(page);rec('GRADE80','explicit grade1 preserved against score80 reference2',grade.target?.grade==='1'&&grade.target?.text.includes('바꾸지 않았어요'),grade);
 const other=await browser.newContext({viewport:{width:WIDTH,height:900},timezoneId:'America/Los_Angeles'});const cookies=await ctx.cookies();await other.addCookies(cookies);const op=await other.newPage();await openMap(op);const tz=await mapState(op);rec('TZ-display','saved date calendar stable in another browser timezone',tz.target?.date==='2026-11-19',tz.target);await other.close();
 await ctx.close();
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
