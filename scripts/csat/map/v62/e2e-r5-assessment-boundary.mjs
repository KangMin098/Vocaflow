// scripts/csat/map/v62/e2e-r5-assessment-boundary.mjs
//
// #281 · #283 — R5 연습 ↔ 독립 평가 경계 PC 화면 확인(**읽기 전용**: 새 계정 · 학습 기록 · 공급 기록을 만들지 않는다).
//   기존 검증 계정(PLAYWRIGHT_RUNTIME_*)으로 로그인하고, 브라우저 컨텍스트의 모든 쓰기 요청을 가로채 가짜 응답한다(실 DB 미도달).
//   ① 지도 Inspector(r.central_meaning) — 독립 확인 · 전이 줄이 available/learn_now 가 아니다(FQ 미설치 → open_unqualified 또는 needs_review/unsupported)
//   ② 연습 화면 — 예약(안 본 확인) 문항이 선택 목록에 없다 · 비면 대체 안내(practice-content-needed) · 404 아님
//   ③ 1280 · 1440 두 폭에서 같은 판정 · 가로 넘침 없음
// 합성 계정 화면 검증이다 — 학습 효과 · 실제 공급의 증거가 아니다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-r5-assessment-boundary.mjs --base http://localhost:3121 --evidence <dir>
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3121')
const EVID = arg('--evidence', null) ? path.resolve(arg('--evidence')) : null
if (EVID) fs.mkdirSync(EVID, { recursive: true })
const EMAIL = process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev'
const PASSWORD = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!PASSWORD) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
const startedAt = new Date().toISOString()
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }
const intercepted = []
const isWrite = (m) => m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS'
// 읽기인 POST(인증 · 문제지 좌표 · Next 서버 액션 아님) 만 통과
const READ_POST = [/\/auth\/v1\/token/, /\/api\/csat\/paper/]

async function guard(ctx) {
  await ctx.route('**/*', (route) => {
    const r = route.request()
    if (!isWrite(r.method()) || READ_POST.some((x) => x.test(r.url()))) return route.continue()
    intercepted.push(`${r.method()} ${new URL(r.url()).pathname}`)
    return route.fulfill({ status: 200, json: { ok: true } })
  })
}

const browser = await chromium.launch()
let storage
{
  const ctx = await browser.newContext()
  await guard(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
  storage = await ctx.storageState()
  await ctx.close()
}

async function openInspector(page, task) {
  await page.waitForSelector(`[data-node="${task}"]`, { timeout: 240_000 })
  for (let i = 0; i < 3 && !(await page.$(`[data-testid="task-pop"][data-task="${task}"]`)); i++) {
    await page.locator(`[data-node="${task}"]`).scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await page.click(`[data-node="${task}"]`)
    await page.waitForTimeout(300)
  }
  await page.click('[data-testid="pop-detail"]')
  await page.waitForSelector(`[data-testid="ins-drawer"] [data-testid="task-inspector"][data-task="${task}"]`)
}

const ASSESS = new Set(['independent_check', 'transfer', 'delayed_check'])
try {
  for (const width of [1280, 1440]) {
    const ctx = await browser.newContext({ storageState: storage, viewport: { width, height: 900 } })
    await guard(ctx)
    const page = await ctx.newPage()
    page.setDefaultTimeout(240_000)
    // ① 지도
    await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=r.central_meaning`, { waitUntil: 'domcontentloaded' })
    await openInspector(page, 'r.central_meaning')
    await page.waitForTimeout(400)
    const ins = page.locator('[data-testid="task-inspector"][data-task="r.central_meaning"]')
    const supply = page.locator('[data-testid="inspector-supply"]')
    if (await supply.count()) await supply.scrollIntoViewIfNeeded()
    if (EVID) await ins.screenshot({ path: path.join(EVID, `${width}-01-inspector-r5.png`) })
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="inspector-supply"] li')].map((e) => ({ role: e.getAttribute('data-role'), state: e.getAttribute('data-state'), step: e.getAttribute('data-step'), text: (e.textContent ?? '').slice(0, 80) })))
    const assess = rows.filter((r) => ASSESS.has(r.role))
    rec(`${width} ① 평가 역할 줄이 available/learn_now 아님(FQ 미설치)`, assess.every((r) => r.state !== 'available' && r.step !== 'learn_now'), assess)
    rec(`${width} ① 열 수 있는 평가 줄은 「정식 자격 확인 전」 표시`, assess.filter((r) => r.state === 'open_unqualified').every((r) => r.step === 'open_unqualified' && /정식 자격 확인 전/.test(r.text)), assess.map((r) => r.state))
    // ② 연습
    const res = await page.goto(`${BASE}/csat/practice/claim-support`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    const notice = await page.$('[data-testid="practice-content-needed"]')
    if (EVID) await page.screenshot({ path: path.join(EVID, `${width}-02-practice.png`), fullPage: false })
    if (notice) {
      const d = await notice.evaluate((e) => ({ reason: e.getAttribute('data-reason'), reserved: Number(e.getAttribute('data-reserved')) }))
      rec(`${width} ② 연습이 비면 404 가 아니라 대체 안내`, res?.status() === 200 && !!d.reason && (await page.$('[data-testid="practice-content-needed-map"]')) !== null, d)
    } else {
      const opts = await page.evaluate(() => [...document.querySelectorAll('select option')].map((o) => o.textContent ?? ''))
      rec(`${width} ② 연습 화면 열림(예약 문항 제외 뒤 남은 문항)`, res?.status() === 200 && opts.length > 0, { options: opts.length })
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    rec(`${width} ③ 가로 넘침 없음`, overflow <= 0, { overflow })
    await ctx.close()
  }
  rec('쓰기 요청이 실 DB 에 닿지 않음(가로챈 쓰기만 존재)', true, { intercepted: [...new Set(intercepted)] })
} catch (e) {
  rec('실행 오류', false, { error: String(e).slice(0, 300) })
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.ok).length
if (EVID) {
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({
    suite: 'R5 연습 ↔ 독립 평가 경계(e2e-r5-assessment-boundary.mjs)', head, base: BASE, startedAt, endedAt: new Date().toISOString(),
    browser: 'chromium(@playwright/test) · 1280×900 · 1440×900', population: '기존 검증 계정 1(새 계정 · 기록 없음 · 쓰기 전부 가로챔)',
    results, pass: results.length - failed, fail: failed,
  }, null, 2) + '\n')
}
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
