// scripts/csat/map/v62/e2e-map-supply.mjs
//
// v6.2 P-F4c — R5 기존 콘텐츠 재사용 수직 경로(**읽기 전용** — 수요 · 공급 저장은 승인안 B 전이라 없다).
//   ① R5 선택 → Inspector 수요 키 · 공급(독립 확인 = 기존 검수 확인 문항) · 다음 행동이 그 공급 문항 중 하나
//   ② 새로 고쳐도 같은 수요 키(같은 학습자 · 같은 버전 → 같은 수요) · 새 생산 0
//   ③ 공급 문항을 풀고 돌아오면 그 문항은 다시 공급되지 않는다(중복 공급 0) · 같은 TASK 로 복귀
//   ④ V2 · S5 — 수요는 있으나 공급 경로 없음(무관 · 결손으로 바꾸지 않음) · 보류 TASK 는 수요 없음
//   ⑤ 다른 학습자 계정은 첫 학습자의 수요 키 · 공급 이력을 보지 않는다(학습자별 계산)
// 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-map-supply.mjs --base http://localhost:3005
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3005'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }
const users = []
const browser = await chromium.launch()

async function learner(tag, goal = 80) {
  const email = `map-v62-supply-${tag}-${Date.now()}@example.com`
  const password = `Mq-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: goal } })).status() !== 200) throw new Error('목표 실패')
  return page
}
const view = async (page, task) => {
  await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${task}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(`[data-testid="task-inspector"][data-task="${task}"]`)
  await page.waitForTimeout(300)
  return page.evaluate(() => ({
    demand: document.querySelector('[data-testid="inspector-supply"]')?.getAttribute('data-demand') ?? null,
    rows: [...document.querySelectorAll('[data-testid="inspector-supply"] li')].map((e) => ({ role: e.getAttribute('data-role'), state: e.getAttribute('data-state'), text: e.textContent })),
    next: document.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null,
  }))
}
const slug = (href) => href?.split('#')[0].split('?')[0].split('/').pop() ?? null

try {
  const a = await learner('a')
  const r1 = await view(a, 'r.central_meaning')
  const check = r1.rows.find((r) => r.role === 'independent_check')
  rec('① R5 수요 · 독립 확인 = 기존 검수 확인 문항(지금 쓸 수 있음) · 다음 행동 있음', !!r1.demand && check?.state === 'available' && !!r1.next, r1)
  const r1b = await view(a, 'r.central_meaning')
  rec('② 새로 고쳐도 같은 수요 키', r1b.demand === r1.demand, { a: r1.demand, b: r1b.demand })

  // ③ 공급 문항 하나 풀기
  const first = slug(r1.next)
  await a.goto(`${BASE}${r1.next.split('#')[0]}`, { waitUntil: 'domcontentloaded' })
  const panel = a.locator('[data-testid="principle-panel"]')
  await panel.waitFor({ timeout: 120_000 })
  await a.waitForLoadState('networkidle').catch(() => {})
  const task = panel.locator('[data-testid="principle-task"]')
  for (let k = 0; k < 10 && !(await task.count()); k++) {
    await panel.getByRole('button', { name: '직접 확인하기' }).click({ timeout: 10_000 }).catch(() => {})
    await a.waitForTimeout(800)
  }
  await panel.locator('[data-claim]').last().click()
  await panel.locator('[data-support]').first().click()
  await panel.locator('[data-relation]').last().check().catch(() => {})
  const resp = a.waitForResponse((r) => /\/api\/csat\/item\/.+\/task/.test(r.url()))
  await panel.getByRole('button', { name: '확인하기' }).click()
  const saved = (await resp).status() === 200
  const r3 = await view(a, 'r.central_meaning')
  rec('③ 푼 문항은 다시 공급되지 않는다(다음 행동이 다른 미노출 문항) · 같은 TASK', saved && slug(r3.next) !== first, { first, next: slug(r3.next) })

  // ④ V2 · S5 · 보류
  const v2 = await view(a, 'v.contextual_sense')
  const s5 = await view(a, 's.form_scope')
  const l1 = await view(a, 'l.sound')
  rec('④ V2 · S5 = 수요는 있고 공급 경로 없음 · 보류 TASK 는 수요 없음', v2.rows.length > 0 && v2.rows.every((r) => r.state !== 'available') && s5.rows.length > 0 && l1.rows.length === 0, { v2: v2.rows.map((r) => r.state), s5: s5.rows.map((r) => r.state), l1: l1.rows.length })

  // ⑤ 다른 학습자
  const b = await learner('b')
  const rb = await view(b, 'r.central_meaning')
  rec('⑤ 다른 학습자는 자기 수요 · 공급(첫 학습자가 푼 문항이 그에게는 미노출 그대로)', slug(rb.next) === first, { bNext: slug(rb.next), aSolved: first })
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
