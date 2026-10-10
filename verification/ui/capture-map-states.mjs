// verification/ui/capture-map-states.mjs — 학습 지도 화면 근거(Work REQ-013 Q4): 기본 지도 · 전체 지도 · 노드 선택 · 단계 시트 · 목표 · 기록 없음 상태
//   node --env-file=D:/workspace/Vocaflow/apps/web/.env.local verification/ui/capture-map-states.mjs --base http://localhost:3000 --out verification/ui/UG-0002-REQ013
// 요청만 보낸다(서버를 띄우거나 끄지 않는다) · PC 1440 만(모바일은 현재 대상 아님) · 만들 수 없는 상태는 「미검증」으로 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const args = process.argv.slice(2)
const arg = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const BASE = arg('base', 'http://localhost:3000')
const OUT = path.resolve(arg('out', 'verification/ui/out'))
const { chromium } = createRequire('D:/workspace/Vocaflow/apps/web/package.json')('@playwright/test')
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!password) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 없음 — --env-file')
fs.mkdirSync(OUT, { recursive: true })
const rel = (f) => path.relative(path.resolve('.'), f).split(path.sep).join('/')

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)))
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
await page.fill('input[type="email"]', process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
await page.fill('input[type="password"]', password)
await page.click('button[type="submit"]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })

const states = []
const snap = async (name, note, fn) => {
  const rec = { state: name, note, ok: false, screenshot: null, facts: null, error: null }
  try {
    rec.facts = (await fn()) ?? null
    const f = path.join(OUT, `${name}.png`)
    await page.screenshot({ path: f, fullPage: true })
    rec.screenshot = rel(f)
    rec.ok = true
  } catch (e) {
    rec.error = String(e.message).split('\n')[0].slice(0, 200)
  }
  states.push(rec)
}
const text = (sel) => page.locator(sel).first().innerText({ timeout: 5000 }).catch(() => null)

await snap('basic-map', '기본 학습 지도(?tab=map)', async () => {
  await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.getByTestId('learner-map').waitFor({ timeout: 180_000 })
  await page.waitForTimeout(1200)
  return { headings: await page.locator('[data-testid="learner-map"] h2, [data-testid="learner-map"] h3').allInnerTexts(), goal: await text('[data-testid="goal-value"]') }
})
await snap('basic-map-no-records', '기록 없음 상태(이 계정은 시험 기록 0 · 목표 미설정)', async () => ({ exam: await text('[data-testid="position-exam"]'), goal: await text('[data-testid="goal-header"]') }))
await snap('step-sheet', '단계 카드(어휘·표현) → 단계 시트', async () => {
  await page.locator('[data-testid="learner-map"] button').filter({ hasText: '어휘·표현' }).first().click()
  const d = page.getByRole('dialog').first()
  await d.waitFor({ timeout: 10_000 })
  const t = await d.innerText()
  return { sections: t.split('\n').filter((l) => l.length < 30).slice(0, 25) }
})
await page.keyboard.press('Escape').catch(() => {})
await snap('goal-cta', '「목표 점수 정하기」 → 목표 설정', async () => {
  await page.getByRole('button', { name: /목표 점수 정하기|목표 정하기/ }).first().click({ timeout: 10_000 })
  await page.waitForTimeout(800)
  return { dialog: await page.getByRole('dialog').first().innerText({ timeout: 5000 }).catch(() => null) }
})
await page.keyboard.press('Escape').catch(() => {})
await snap('full-map', '전체 지도(?view=full)', async () => {
  await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForTimeout(2500)
  return { buttons: (await page.locator('main button').allInnerTexts()).filter(Boolean).slice(0, 40), headings: await page.locator('main h2, main h3').allInnerTexts() }
})
await snap('full-map-node', '전체 지도에서 노드 하나 선택 → 상세(팝업)', async () => {
  // 핵심 능력 열의 「근거 판단(A5)」 노드
  await page.getByText('근거 판단', { exact: true }).first().click({ timeout: 10_000 })
  await page.waitForTimeout(800)
  const pop = page.locator('[role="dialog"], [data-testid*="popup"], [class*="popup"]').first()
  return {
    popup: (await pop.innerText({ timeout: 5000 }).catch(() => null))?.slice(0, 1500) ?? null,
    overflow_x: await page.evaluate(() => {
      const el = [...document.querySelectorAll('main *')].find((e) => e.scrollWidth > e.clientWidth + 20 && getComputedStyle(e).overflowX !== 'visible')
      return el ? { scroll: el.scrollWidth, client: el.clientWidth } : null
    }),
  }
})
await browser.close()
const unverified = ['조회 실패(오류) 상태 — 오류를 주입할 수단이 없다', '근거 부족·재확인 문항 없음 상태 — 그런 기록을 가진 합성 계정이 없다(실제 학습자 기록 0)', '과제 시작 → 복귀 — 시작은 실제 기록을 남기므로 이 실행에서 누르지 않았다', '모바일 — 현재 대상 아님(데스크톱 전용 정책)']
const out = { at: new Date().toISOString(), base: BASE, viewport: '1440x900', account: '합성 테스트 계정(기록 0)', page_errors: errors, states, unverified }
fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify({ states: states.map((s) => ({ state: s.state, ok: s.ok, error: s.error })), page_errors: errors.length }, null, 1))
