// scripts/research/lm-g1-5a-independent/v2-browser.mjs
//
// LM-G1.5a — V2(문맥 의미 선택) 지원 경계를 실제 개발 DB · 기존 API · Chromium 으로 확인한다.
// 지금 합의 주석 · 출시가 0개이므로: 지도 V2 는 실행 링크 없이 「준비 중」 · 기록 API 는 V2 어휘 문항을 과제 없음으로 거절 · 원장 0행 · 문항 화면에 V2 과제 칸 없음.
// 쓰기는 합성 계정 본인의 기존 API 만(거절되는 요청) · 원장은 서비스 키로 읽기만. 계정은 끝에 삭제 · 부재 확인.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-5a.mjs --base http://localhost:3005 --width 1440 --evidence <dir>
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
const EVID = path.resolve(ROOT, arg('--evidence', `tmp/lm-g1-5a-${WIDTH}`))
const T = 'v.contextual_sense'
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim()
const DIRTY = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).toString().trim().length > 0
const startedAt = new Date().toISOString()
const results = []
const rec = (id, name, ok, detail, layer = 'db+browser') => { results.push({ id, name, status: ok ? 'PASS' : 'FAIL', layer, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`) }
const users = []
const browser = await chromium.launch()
let shots = 0
const shot = (page, name) => page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`) })

async function login() {
  const email = `map-lmg15a-${WIDTH}-${Date.now()}@example.com`
  const password = `Lg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
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

let fatal = null
try {
  const { ctx, page, uid } = await login()
  await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })
  await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full&map_task=${T}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]', { timeout: 120_000 })
  await page.waitForTimeout(700)

  // 키보드로 V2 노드 열기(V22)
  await page.focus(`[data-node="${T}"]`)
  await page.keyboard.press('Enter')
  await page.waitForSelector(`[data-testid="task-pop"][data-task="${T}"]`)
  const pop = await page.$eval('[data-testid="task-pop"]', (p) => ({
    next: p.querySelector('[data-testid="pop-next"]')?.getAttribute('href') ?? null,
    blocked: p.querySelector('[data-testid="pop-blocked"]')?.getAttribute('data-reason') ?? null,
    evidence: p.querySelector('[data-testid="pop-evidence"]')?.getAttribute('data-evidence') ?? null,
    claims: !!p.querySelector('[data-testid="pop-evidence-claims"]'),
    noWs: p.querySelector('[data-testid="pop-no-ws"]')?.textContent ?? null,
    focused: document.activeElement === p || p.contains(document.activeElement),
  }))
  await shot(page, 'v2-pop')
  rec('G01', 'V2 팝업 — 실행 링크 없음 · 막힘 사유 표시 · 증거 칩 없음(확인 키 없음) · 포커스가 팝업으로', !pop.next && !!pop.blocked && !pop.claims && pop.focused, pop, 'browser')

  await page.click('[data-testid="pop-detail"]')
  await page.waitForSelector('[data-testid="ins-drawer"] [data-testid="task-inspector"]')
  const drawer = await page.$eval('[data-testid="ins-drawer"]', (d) => ({
    next: d.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null,
    claims: !!d.querySelector('[data-testid="ins-evidence-claims"]'),
    evidence: d.querySelector('[data-testid="inspector-evidence"]')?.getAttribute('data-evidence') ?? null,
    text: d.textContent?.slice(0, 2000) ?? '',
  }))
  await shot(page, 'v2-drawer')
  rec('G02', 'V2 서랍 — 실행 링크 없음 · 증거 블록 없음 · 「통과 · 숙달」 표시 없음', !drawer.next && !drawer.claims && !/통과|숙달/.test(drawer.text), { next: drawer.next, claims: drawer.claims, evidence: drawer.evidence }, 'browser')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  if (await page.$('[data-testid="ins-drawer"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(250) }

  const topNext = await page.$eval('[data-testid="umap-top-next"]', (a) => a.getAttribute('data-task')).catch(() => null)
  const v2Links = await page.$$eval('a[href*="contextual"], a[data-task="v.contextual_sense"]', (xs) => xs.length)
  rec('G03', '상단 다음 행동 · 화면 링크 중 V2 실행 링크 0', topNext !== T && v2Links === 0, { topNext, v2Links }, 'browser')
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  rec('G04', '가로 넘침 0', overflowX === 0, { overflowX, w: WIDTH }, 'browser')

  // 기록 API — V2 어휘 문항(평가원) 제출은 과제 없음으로 거절 · 원장 0행(V15 · V18)
  const meta = { clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent', sec: 30 }
  const r = await page.request.post(`${BASE}/api/csat/item/M2609-30/task`, { data: { response: { misfit: 4, sense: 0, cue: [] }, ...meta } })
  const body = await r.json().catch(() => null)
  const L = await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', uid)
  rec('G05', '기록 API — V2 어휘 문항 제출은 과제 없음(400/no_task) · 이 계정 원장 0행', r.status() === 400 && body?.code === 'no_task' && L.error === null && L.count === 0, { status: r.status(), code: body?.code ?? null, rows: L.count }, 'db')

  // 문항 화면 — 확인 모드로 열어도 V2 과제 칸이 없다
  const itemResponse = await page.goto(`${BASE}/csat/item/M2609-30?check=1`, { waitUntil: 'domcontentloaded' })
  if(itemResponse?.status() !== 200) throw Error('Item page did not return 200'); await page.waitForSelector('[data-testid=analysis-theater]',{timeout:120000}); await page.waitForTimeout(700)
  const panel = await page.$('[data-testid="principle-panel"][data-task="contextual-sense"]')
  await shot(page, 'v2-item')
  rec('G06', '문항 화면(확인 모드) — V2 과제 칸 없음(합의 주석 · 출시 없음)', !panel, { panel: !!panel }, 'browser')
  await ctx.close()
} catch (e) {
  fatal = String(e?.stack ?? e).slice(0, 800)
  console.log('[FATAL]', fatal)
} finally {
  const cleanupResult = await cleanupOwnedAccounts(db.auth.admin, users)
  try { await browser.close() } catch { /* 이미 닫힘 */ }
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ sha: SHA, dirtyTree: DIRTY, base: BASE, width: WIDTH, startedAt, endedAt: new Date().toISOString(), pass, fail, fatal, accounts: { created: users.length, confirmedAbsent: cleanupResult.ok ? users.length : null }, layers: { expert_review: 'NOT_TESTED', learning_effect: 'NOT_CLAIMED' }, results }, null, 2))
  console.log(`accounts created ${users.length} · absent ${cleanupResult.ok ? users.length : 'UNCONFIRMED'}`)
  console.log(`PASS ${pass} · FAIL ${fail}${fatal ? ' · FATAL' : ''}`)
  process.exitCode = fail || fatal || !cleanupResult.ok ? 1 : 0
}
