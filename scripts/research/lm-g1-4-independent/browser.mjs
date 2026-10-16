// scripts/research/lm-g1-4-independent/browser.mjs
import { sourceModule } from './source-loader.mjs'
//
// LM-G1.4 — 증거 범위(evidenceView)가 R5 수행 흐름의 단계마다 팝업 · 상세 서랍 · Workspace 창에서 같은 값으로 보이는가.
// 증거 층위: ② 개발 DB · 기존 API(쓰기는 합성 계정 본인 · 원장은 서비스 키로 읽기만) ③ 실제 Chromium. ④ 학습 효과 · 지연 유지는 PASS 로 만들지 않는다.
// 흐름: 시작 → FIND 2 실패 → 바로잡기 성공 → 다른 글 적용 2 → 새 확인 2 정답. 따로 도움(hint) 뒤 확인 1건 계정.
// 계정은 실행 끝에 삭제하고 부재를 확인한다. 이메일 · 비밀번호 · 사용자 id 는 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-4.mjs --base http://localhost:3005 --width 1440 --evidence <dir>
import { cleanupOwnedAccounts } from '../lm-g1-1-independent/cleanup.mjs'
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
const EVID = path.resolve(ROOT, arg('--evidence', `tmp/lm-g1-4-${WIDTH}`))
const T = 'r.central_meaning'
const WS = 'ws.central-meaning'
const ANN = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim()
const DIRTY = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).toString().trim().length > 0
const startedAt = new Date().toISOString()
const results = []
const rec = (id, name, ok, detail, layer = 'db+browser') => { results.push({ id, name, status: ok ? 'PASS' : 'FAIL', layer, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 420)}` : ''}`) }
const users = []
const browser = await chromium.launch()
let shots = 0
const shot = async (page, name) => { await page.waitForTimeout(400); return page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`) }) }
const slugOf = (href) => (href ? decodeURIComponent(href.split('#')[0].split('?')[0].split('/').pop()) : null)
const itemParam = (href) => { try { return new URL(href, BASE).searchParams.get('item') } catch { return null } }

function annotation(slug) {
  const files = fs.readdirSync(ANN).filter((f) => f.startsWith(`claim-support-${slug.toLowerCase().replace('#', '-')}.v`)).sort()
  if (!files.length) throw new Error(`주석 없음 ${slug}`)
  return JSON.parse(fs.readFileSync(path.join(ANN, files.at(-1)), 'utf8'))
}
const meta = (helpLevel = 'independent') => ({ clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel, sec: 40 })
async function answerItem(page, slug, ok, helpLevel) {
  const a = annotation(slug)
  const response = { claim: ok ? a.claim : (a.claim + 1) % a.sentenceCount, support: a.support, relation: a.relationProbe.relation }
  const r = await page.request.post(`${BASE}/api/csat/item/${slug}/task`, { data: { response, ...meta(helpLevel) } })
  const j = await r.json().catch(() => null)
  await page.waitForTimeout(1300)
  return { status: r.status(), isCorrect: j?.grade?.isCorrect ?? null }
}
async function transferOnce(page, itemId) {
  const r = await page.request.post(`${BASE}/api/csat/practice/attempt`, { data: { itemId, claim: 0, support: [1], relation: 'reason', option: null, confidence: 2, preview: false, ...meta() } })
  await page.waitForTimeout(1300)
  return { status: r.status(), ok: r.status() === 200 }
}
async function login(tag) {
  const email = `map-lmg14-${tag}-${WIDTH}-${Date.now()}@example.com`
  const password = `Lg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id); fs.writeFileSync(path.join(EVID,'owned-accounts.local.json'),JSON.stringify(users))
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(120_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
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
const chipsOf = (el) => (el ? { check: el.getAttribute('data-check'), transfer: el.getAttribute('data-transfer'), delay: el.getAttribute('data-delay'), ledger: el.getAttribute('data-ledger'), text: [...el.querySelectorAll('li')].map((l) => l.textContent) } : null)
async function surfaces(page, name) {
  const s = {}
  await page.click(`[data-node="${T}"]`)
  await page.waitForSelector(`[data-testid="task-pop"][data-task="${T}"]`).catch(() => {})
  s.popNext = await page.getAttribute('[data-testid="pop-next"]', 'href').catch(() => null)
  s.pop = await page.$eval('[data-testid="task-pop"]', (p) => { const el = p.querySelector('[data-testid="pop-evidence-claims"]'); return el ? { check: el.getAttribute('data-check'), transfer: el.getAttribute('data-transfer'), delay: el.getAttribute('data-delay'), ledger: el.getAttribute('data-ledger'), text: [...el.querySelectorAll('li')].map((l) => l.textContent) } : null }).catch(() => null)
  s.popBounds=await page.$eval('[data-testid="task-pop"]',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight}});
  if (name) await shot(page, `${name}-pop`)
  await page.click('[data-testid="pop-detail"]').catch(() => {})
  await page.waitForSelector('[data-testid="ins-drawer"] [data-testid="ins-evidence-claims"]').catch(() => {})
  s.drawer = await page.$eval('[data-testid="ins-drawer"]', (d) => {
    const b = d.querySelector('[data-testid="ins-evidence-claims"]')
    const t = (id) => b?.querySelector(`[data-testid="${id}"]`)?.textContent ?? null
    const held = d.querySelector('[data-testid="inspector-timing-held"]')?.getAttribute('data-n') ?? null
    return b ? { held, check: b.getAttribute('data-check'), ledger: b.getAttribute('data-ledger'), checkText: t('ev-check'), repair: t('ev-repair'), transfer: t('ev-transfer'), delay: t('ev-delay'), claims: t('ev-claims'), notes: t('ev-notes'), scope: !!b.querySelector('[data-testid="ev-scope"]'), evidence: d.querySelector('[data-testid="inspector-evidence"]')?.getAttribute('data-evidence') ?? null } : null
  }).catch(() => null)
  const scopeSummary=page.locator('[data-testid="ins-drawer"] [data-testid="ev-scope"] > summary');
  const beforeScope=await scopeSummary.evaluate(e=>e.parentElement.open);await scopeSummary.focus();await page.keyboard.press('Enter');
  const toggledScope=await scopeSummary.evaluate(e=>e.parentElement.open);await page.keyboard.press('Enter');
  s.scopeAccess=await scopeSummary.evaluate(e=>({height:e.getBoundingClientRect().height,focusVisible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineStyle}));s.scopeAccess.keyboardToggle=toggledScope!==beforeScope;
  if (name) {
    await page.click('[data-testid="ins-drawer"] [data-testid="ev-scope"] > summary').catch(() => {})
    await page.$eval('[data-testid="ins-drawer"] [data-testid="ins-evidence-claims"]', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {})
    await shot(page, `${name}-drawer`)
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  if (await page.$('[data-testid="ins-drawer"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(250) }
  await page.click(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`)
  await page.waitForSelector('[data-testid="ws-modal"]')
  s.modal = await page.$eval('[data-testid="ws-modal"]', (m) => { const el = m.querySelector('[data-testid="ws-evidence-claims"]'); return el ? { check: el.getAttribute('data-check'), transfer: el.getAttribute('data-transfer'), delay: el.getAttribute('data-delay'), ledger: el.getAttribute('data-ledger'), text: [...el.querySelectorAll('li')].map((l) => l.textContent) } : null }).catch(() => null)
  s.modalBounds=await page.$eval('[data-testid="ws-modal"]',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight}});
  if (name) await shot(page, `${name}-modal`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  s.modalClosedAndFocus=await page.evaluate(()=>!document.querySelector('[data-testid="ws-modal"]')&&document.activeElement?.getAttribute('data-testid')==='ws-open');
  s.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return s
}
// 세 표면이 같은 값(지금 확인 · 다른 글 적용 · 지연)을 보이는가
const same = (s) => !!s.pop && !!s.modal && !!s.drawer && s.pop.check === s.modal.check && s.pop.check === s.drawer.check && s.pop.transfer === s.modal.transfer && JSON.stringify(s.pop.text) === JSON.stringify(s.modal.text)
const snap = (s) => ({ pop: s.pop, drawer: s.drawer && { check: s.drawer.check, checkText: s.drawer.checkText, repair: s.drawer.repair, transfer: s.drawer.transfer, claims: s.drawer.claims, notes: s.drawer.notes } })
const NO_FAIL_WORDS = /실패|부족|못했|틀렸어요/
const noFail = (s) => ![...(s.pop?.text ?? []), s.drawer?.delay ?? '', s.drawer?.transfer ?? '', s.drawer?.notes ?? ''].some((x) => NO_FAIL_WORDS.test(x))

let fatal = null
try {
  if (!process.argv.includes('--only-help')) {
  const { ctx, page, uid } = await login('flow')
  await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })
  await openMap(page)
  const s0 = await surfaces(page, '00-start')
  rec('V01', '시작 — 세 표면 같은 값 · 지금 확인 「아직 확인 전」 · 지연 NOT_ESTABLISHED · 실패 문구 없음', same(s0) && s0.pop.check === 'not_started' && s0.pop.delay === 'NOT_ESTABLISHED' && noFail(s0), snap(s0), 'browser')

  const find = []
  for (let i = 0; i < 2; i++) {
    await openMap(page)
    const s = await surfaces(page, null)
    const slug = slugOf(s.popNext)
    find.push({ slug, ...(await answerItem(page, slug, false)) })
  }
  await openMap(page)
  const s1 = await surfaces(page, '01-find-failed')
  rec('V02', 'FIND 2 실패 — 지금 확인 「연습이 필요하다고 확인됨」 · 혼자 푼 첫 확인 2 · 세 표면 같음', find.every((f) => f.status === 200 && f.isCorrect === false) && same(s1) && s1.pop.check === 'need_confirmed' && /혼자 푼 첫 확인 2/.test(s1.drawer?.claims ?? ''), snap(s1))

  const blocked = find.map((f) => f.slug)
  const fix = await answerItem(page, blocked[0], true)
  await openMap(page)
  const s2 = await surfaces(page, '02-repair-fixed')
  rec('V03', '바로잡기 정답 — 바로잡기 「맞혀 봤어요」 · 지금 확인은 그대로(바로잡기 ≠ 통과)', fix.isCorrect === true && /맞혀 봤어요/.test(s2.drawer?.repair ?? '') && s2.pop?.check === 'need_confirmed' && same(s2), snap(s2))

  // Independent audit of the exact DB-elected first row after a correct retry.
  const rendered = async () => page.evaluate(() => { const el=document.querySelector('[data-testid="umap-canvas"]');let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(let n=0;f&&n<80;n++,f=f.return){const d=f.memoizedProps?.data;if(d?.model&&d?.v4)return JSON.parse(JSON.stringify(d))}throw Error('Rendered data missing') });
  const {composeV4}=sourceModule('apps/web/src/lib/csat/map/v4/compose.ts');
  const dataAfterRetry=await rendered(),viewAfterRetry=composeV4(dataAfterRetry,{score:dataAfterRetry.model.goal,set:true});
  const rawFirst=await db.from('learning_first_attempts').select('attempt_id,item_ref,is_correct,phase,task_key').eq('user_id',uid).eq('task_key','claim-support').eq('phase','practice');if(rawFirst.error)throw rawFirst.error;
  const ev=viewAfterRetry.evidence[T];
  rec('I01','DB elected first ids map to the exact ledger outcomes, never the correct retry',rawFirst.data.length===2&&rawFirst.data.every(f=>ev.attempts.some(a=>a.attemptId===String(f.attempt_id)&&a.outcome===(f.is_correct?'correct':'incorrect')&&a.fields.independence==='CONFIRMED'))&&ev.attempts.filter(a=>a.claim==='independent_check').every(a=>a.outcome==='incorrect'),{firstRows:rawFirst.data.length,firstWrong:ev.attempts.filter(a=>a.claim==='independent_check'&&a.outcome==='incorrect').length,conditionSuccess:ev.attempts.filter(a=>a.claim==='condition_success').length});
  rec('I02','drawer distinguishes independent observations from correct successes',/첫 독립 관찰 중 맞힘 0 · 틀림 2/.test(s2.drawer?.claims??''),s2.drawer?.claims);
  const snapshots=[];
  for(const [target,exam] of [[80,'suneung'],[90,'kice6']]){const put=await page.request.put(BASE+'/api/csat/diagnosis/map/goal',{data:{target,exam,clientKey:crypto.randomUUID()}});if(put.status()!==200)throw Error('Goal change failed');await openMap(page);const d=await rendered();const v=composeV4(d,{score:d.model.goal,set:d.model.goalSet});snapshots.push({goal:d.v4.target.goal,scope:d.v4.target.scope,evidence:v.evidence[T],plan:v.plans[WS]});fs.writeFileSync(path.join(EVID,'runtime-'+target+'.local.json'),JSON.stringify(d))}
  rec('I03','different actual goal snapshots change scope without rewriting performance evidence',snapshots[0].goal.score===80&&snapshots[1].goal.score===90&&snapshots[0].scope.exam==='suneung'&&snapshots[1].scope.exam==='kice6'&&JSON.stringify(snapshots[0].evidence)===JSON.stringify(snapshots[1].evidence),{goals:snapshots.map(x=>({score:x.goal.score,exam:x.goal.exam})),evidenceUnchanged:JSON.stringify(snapshots[0].evidence)===JSON.stringify(snapshots[1].evidence)});
  const cut=new Date(Date.parse(dataAfterRetry.findAttempts.filter(a=>a.attemptId)[0].answeredAt)+1).toISOString();const historic=composeV4(dataAfterRetry,{score:80,set:true},cut).evidence[T];
  rec('I04','historical asof excludes future rows and does not reuse current annotation as historic proof',historic.attempts.length>0&&historic.attempts.every(a=>a.fields.instrument==='UNKNOWN'),{attempts:historic.attempts.length,instruments:historic.attempts.map(a=>a.fields.instrument)});
  const t1 = itemParam(s2.popNext)
  const tr1 = await transferOnce(page, t1)
  await openMap(page)
  const s3a = await surfaces(page, null)
  const tr2 = await transferOnce(page, itemParam(s3a.popNext))
  await openMap(page)
  const s3 = await surfaces(page, '03-transfer-2')
  rec('V04', '다른 글 적용 2 — 「해 봤어요 · 2 / 2편」 · 능력 판정 아님 문구 · 지금 확인 그대로', tr1.ok && tr2.ok && s3.pop?.transfer === 'experienced' && /2 \/ 2편/.test(s3.drawer?.transfer ?? '') && /판정은 아니에요/.test(s3.drawer?.transfer ?? '') && s3.pop?.check === 'need_confirmed' && same(s3), snap(s3))

  const checks = []
  for (let i = 0; i < 2; i++) {
    await openMap(page)
    const s = await surfaces(page, null)
    const slug = s.popNext && !s.popNext.includes('/practice/') ? slugOf(s.popNext) : null
    if (!slug || blocked.includes(slug)) { checks.push({ slug: slug ? 'blocked' : null, skipped: true }); break }
    checks.push({ slug, ...(await answerItem(page, slug, true)) })
  }
  await openMap(page)
  const s4 = await surfaces(page, '04-check-passed')
  rec('V05', '새 확인 2 정답 — 지금 확인 「통과(지금 기준)」 · 지연 확인은 여전히 「아직 근거 없음」(통과 ≠ 지연 유지)', checks.length === 2 && checks.every((c) => c.isCorrect === true) && s4.pop?.check === 'passed' && /문항 4개/.test(s4.drawer?.checkText ?? '') && s4.pop?.delay === 'NOT_ESTABLISHED' && /아직 근거 없음/.test(s4.drawer?.delay ?? '') && same(s4), { checks: checks.map((c) => c.isCorrect), ...snap(s4) })
  rec('V06', '도구 범위(보는 것 · 보지 않는 것) 표시 · 단계마다 실패 문구 없음', [s0, s1, s2, s3, s4].every((s) => s.drawer?.scope && noFail(s)), null, 'browser')
  rec('V07', '페이지 가로 넘침 0', [s0, s1, s4].every((s) => s.overflowX === 0), { w: WIDTH }, 'browser')
  rec('I06','instrument scope disclosure has 44px target, keyboard toggle and visible focus',[s0,s1,s2,s3,s4].every(s=>s.scopeAccess.height>=44&&s.scopeAccess.keyboardToggle&&s.scopeAccess.focusVisible&&s.scopeAccess.outline!=='none'),[s0,s1,s2,s3,s4].map(s=>s.scopeAccess));
  const fits=r=>r&&r.x>=-1&&r.y>=-1&&r.right<=r.width+1&&r.bottom<=r.height+1;
  rec('I05','PC popup/modal fit, Escape closes and restores Workspace opener focus',[s0,s1,s2,s3,s4].every(s=>fits(s.popBounds)&&fits(s.modalBounds)&&s.modalClosedAndFocus),[s0,s1,s2,s3,s4].map(s=>({pop:s.popBounds,modal:s.modalBounds,closedAndFocus:s.modalClosedAndFocus})));
  await ctx.close()
  }

  // 먼저 보기(viewed_first) 뒤 확인 — 독립 확인으로 세지 않음
  const h = await login('help')
  await openMap(h.page)
  const h0 = await surfaces(h.page, null)
  const hs = slugOf(h0.popNext)
  const ha = await answerItem(h.page, hs, true, 'viewed_first')
  await openMap(h.page)

  const h1 = await surfaces(h.page, '05-help')
  const L = await db.from('learning_task_attempts').select('help_level, is_correct, task_key, phase, answered_at, received_at').eq('user_id', h.uid)
  const viaHold = h1.drawer?.held !== null && h1.drawer?.held !== undefined
  const viaIneligible = /혼자 확인은 아님/.test(h1.drawer?.claims ?? '') && /도움 · 해설 뒤 수행/.test(h1.drawer?.notes ?? '')
  rec('V08', '먼저 보기(viewed_first) 뒤 정답 — 원장 viewed_first 1행 · 혼자 푼 첫 확인 0 · 지금 확인 그대로 · (보류 또는 INELIGIBLE 사유) · 실패 문구 없음', ha.status === 200 && (L.data ?? []).some((r) => r.help_level === 'viewed_first') && !/혼자 푼 첫 확인/.test(h1.drawer?.claims ?? '') && h1.pop?.check === 'not_started' && (viaHold || viaIneligible) && noFail(h1) && same(h1), { ledger: (L.data ?? []).map((r) => ({ help: r.help_level, key: r.task_key, phase: r.phase, ans: !!r.answered_at, recv: !!r.received_at })), ha, held: h1.drawer?.held, path: viaHold ? 'held(prior-help)' : viaIneligible ? 'INELIGIBLE' : 'none', ...snap(h1) })
  await h.ctx.close()
} catch (e) {
  fatal = String(e?.stack ?? e).slice(0, 800)
  console.log('[FATAL]', fatal)
} finally {
  const cleanupResult = await cleanupOwnedAccounts(db.auth.admin, users)
  try { await browser.close() } catch { /* 이미 닫힘 */ }
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ sha: SHA, dirtyTree: DIRTY, base: BASE, width: WIDTH, startedAt, endedAt: new Date().toISOString(), pass, fail, fatal, accounts: { created: users.length, confirmedAbsent: cleanupResult.ok ? users.length : null }, layers: { delayed_retention: 'NOT_ESTABLISHED', learning_effect: 'NOT_CLAIMED' }, results }, null, 2))
  console.log(`accounts created ${users.length} · absent ${cleanupResult.ok ? users.length : 'UNCONFIRMED'}`)
  console.log(`PASS ${pass} · FAIL ${fail}${fatal ? ' · FATAL' : ''}`)
  process.exitCode = fail || fatal || !cleanupResult.ok ? 1 : 0
}
