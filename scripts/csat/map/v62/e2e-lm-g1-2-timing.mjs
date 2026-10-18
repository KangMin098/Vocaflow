// scripts/csat/map/v62/e2e-lm-g1-2-timing.mjs
//
// LM-G1.2 — 근접 해설 노출(반례 C · Codex PR #272 관찰) 실제 화면. 합성 계정 · 기존 API · 정책(2분 보호) 그대로.
//   ① 확인 문항 제출(오답) → ② 2분 안에 **다른 세션**(문항 해설 화면)에서 같은 문항 해설 열람 → ③ 지도:
//      그 시도는 독립 확인에서 보류(uncertain) — 팝업 · 드로어에 짧은 보류 사유 · 실패로 세지 않음(확인된 요구 아님)
// 계정은 끝에 삭제 · 부재 확인. 이메일 · 비밀번호 · id 는 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-2-timing.mjs --base http://localhost:3005 --evidence <dir>
import { cleanupOwnedAccounts } from '../../../research/lm-g1-1-independent/cleanup.mjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3005')
const EVID = path.resolve(ROOT, arg('--evidence', 'tmp/lm-g1-2-timing'))
const T = 'r.central_meaning'
const ANN = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const rec = (name, ok, detail) => { results.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${JSON.stringify(detail).slice(0, 400)}`) }
const users = []
const browser = await chromium.launch()
const slugOf = (href) => (href ? href.split('#')[0].split('?')[0].split('/').pop() : null)
let fatal = null
try {
  const email = `map-lmg12t-${Date.now()}@example.com`
  const password = `Lg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(120_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })
  // 지도가 내미는 첫 확인 문항
  await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${T}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]')
  await page.click(`[data-node="${T}"]`)
  await page.waitForSelector('[data-testid="task-pop"]')
  const href = await page.getAttribute('[data-testid="pop-next"]', 'href')
  const slug = slugOf(href)
  const files = fs.readdirSync(ANN).filter((f) => f.startsWith(`claim-support-${slug}.v`)).sort()
  const a = JSON.parse(fs.readFileSync(path.join(ANN, files.at(-1)), 'utf8'))
  const t0 = Date.now()
  const r = await page.request.post(`${BASE}/api/csat/item/${slug}/task`, { data: { response: { claim: (a.claim + 1) % a.sentenceCount, support: a.support, relation: a.relationProbe.relation }, sec: 40, clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent' } })
  // 다른 세션(해설 화면)에서 같은 문항 해설 열람 — 제출 뒤 2분 안
  await page.goto(`${BASE}${href.split('#')[0]}`, { waitUntil: 'domcontentloaded' })
  if (await page.waitForSelector('[data-testid="item-check-mode"]', { timeout: 60_000 }).catch(() => null)) await page.click('[data-testid="item-check-explain"]')
  await page.waitForSelector('[data-testid="item-back-map"]', { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(3000)
  let within = Date.now() - t0
  // 보류 근거를 원장에서 직접 읽는다(읽기 전용) — 세션 해설 · 도움 칸과 첫 시도의 시각 불확실 · 도움 표시
  let sess = await db.from('learning_sessions').select('id, item_ref, help_received_at, explanation_viewed_at, help_server_at, explanation_server_at, help_clock_suspect').eq('user_id', u.user.id)
  let first = await db.from('learning_first_attempts').select('session_id, item_ref, timing_uncertain, after_explanation, after_viewed_first, help_level').eq('user_id', u.user.id)
  // Explanation delivery is asynchronous; wait for the actual ledger acknowledgement, not a sleep.
  for (let n = 0; n < 40; n++) {
    if (sess.error || first.error) throw new Error('timing ledger read failed')
    const own = first.data?.[0]
    if ((sess.data ?? []).some(x => x.id !== own?.session_id && (!!x.help_received_at || !!x.explanation_viewed_at)) || own?.timing_uncertain === true) break
    await page.waitForTimeout(250)
    sess = await db.from('learning_sessions').select('id, item_ref, help_received_at, explanation_viewed_at, help_server_at, explanation_server_at, help_clock_suspect').eq('user_id', u.user.id)
    first = await db.from('learning_first_attempts').select('session_id, item_ref, timing_uncertain, after_explanation, after_viewed_first, help_level').eq('user_id', u.user.id)
  }
  within = Date.now() - t0
  const att = first.data?.[0] ?? null
  const other = (sess.data ?? []).filter((x) => x.id !== att?.session_id)
  const viewed = other.filter((x) => !!x.explanation_viewed_at || !!x.help_received_at).length
  const diag = { withinMs: within, sessions: (sess.data ?? []).map((x) => ({ same: x.id === att?.session_id, explained: !!x.explanation_viewed_at, helped: !!x.help_received_at, srv: !!(x.explanation_server_at || x.help_server_at) })), first: att && { timing_uncertain: att.timing_uncertain, after_explanation: att.after_explanation, after_viewed_first: att.after_viewed_first, help_level: att.help_level } }
  fs.writeFileSync(path.join(EVID, 'ledger-diagnosis.json'), JSON.stringify(diag, null, 2))
  rec('TC1 제출 200 · 2분 안 · 다른 세션의 해설/도움 기록 또는 첫 시도 시각 불확실 표시가 원장에 있다(보류 근거 실재)', r.status() === 200 && within < 120_000 && (viewed >= 1 || att?.timing_uncertain === true), diag)
  await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${T}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]')
  await page.waitForTimeout(600)
  await page.click(`[data-node="${T}"]`).catch(() => {})
  await page.waitForSelector('[data-testid="task-pop"]').catch(() => {})
  const pop = await page.$eval('[data-testid="task-pop"]', (p) => ({ evidence: p.querySelector('[data-testid="pop-evidence"]')?.getAttribute('data-evidence') ?? null, held: p.querySelector('[data-testid="pop-timing-held"]')?.textContent ?? null })).catch(() => null)
  await page.screenshot({ path: path.join(EVID, '01-timing-held-pop.png') })
  await page.click('[data-testid="pop-detail"]').catch(() => {})
  await page.waitForSelector('[data-testid="ins-drawer"]').catch(() => {})
  const drawer = await page.$eval('[data-testid="ins-drawer"]', (d) => ({ held: d.querySelector('[data-testid="inspector-timing-held"]')?.textContent ?? null, n: d.querySelector('[data-testid="inspector-timing-held"]')?.getAttribute('data-n') ?? null })).catch(() => null)
  await page.screenshot({ path: path.join(EVID, '02-timing-held-drawer.png') })
  rec('TC2 보류(uncertain) — 팝업 · 드로어에 짧은 보류 사유 · 확인된 요구 아님(실패로 세지 않음)', !!pop?.held && !!drawer?.held && drawer.n === '1' && pop.evidence !== 'need_confirmed', { pop, drawer })
  await ctx.close()
} catch (e) {
  fatal = String(e?.stack ?? e).slice(0, 600)
  console.log('[FATAL]', fatal)
} finally {
  const cleanup = await cleanupOwnedAccounts(db.auth.admin, users)
  const absent = cleanup.ok ? users.length : null
  await browser.close()
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ base: BASE, pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, fatal, accounts: { created: users.length, absentAfter: absent, cleanup }, results }, null, 2))
  console.log(`accounts created ${users.length} · absent ${absent}`)
  process.exitCode = fatal || results.some((r) => r.status === 'FAIL') || !cleanup.ok ? 1 : 0
}
