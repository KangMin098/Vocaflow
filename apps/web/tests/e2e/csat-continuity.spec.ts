// apps/web/tests/e2e/csat-continuity.spec.ts
//
// **기출분석공간 재설계 — 시나리오 테스트.** (docs/csat/ia-design.md §4 · 결과는 docs/csat/test-report.md)
//
//   니즈별 A1–A7 · 지속 학습 C1–C7 을 실제 화면에서 돈다. 각 시나리오는
//   ① 도착했는가 ② **클릭 수**(메인 진입 뒤부터 센다)가 목표 이하인가 를 본다.
//   클릭 수는 `click()` 을 부를 때마다 올리는 카운터다 — 결과는 콘솔에 `SCENARIO <id> clicks=<n>` 으로 남긴다.
//
// 학습 기록은 **서버 사본**(`/api/csat/state`)에 심는다. 새 브라우저 컨텍스트는 기기 기록(IndexedDB)이
// 비어 있으므로, 심은 기록이 보이면 곧 「다른 기기에서 이어진다」(C5)의 증명이다.
// 검증 계정은 공유된다 — 끝나면 심은 기록을 지운다.

import { expect, test, type Browser, type Page } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local (CI: 저장소 시크릿)')
    })(),
}
const DAY = 86_400_000

let storage: Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['storageState']>>

test.describe.configure({ mode: 'serial' })

// 시나리오가 끝나면 그 컨텍스트를 닫는다 — 열린 채 두면 1.5초 뒤 밀린 저장이 다음 시나리오의 심은 기록에 섞인다
const opened: { close: () => Promise<void> }[] = []
test.afterEach(async () => {
  while (opened.length) await opened.pop()!.close()
})
test.setTimeout(120_000)

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  storage = await ctx.storageState()
  await ctx.close()
})

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: storage })
  await ctx.request.delete('/api/csat/state')
  await ctx.close()
})

type Rec = Record<string, unknown>
const record = (over: Rec = {}): Rec => ({ version: 1, seed: 7, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], ...over })

/** 새 컨텍스트(= 새 기기) + 서버 기록 심기. record 가 null 이면 서버 기록을 지운다(첫 방문). */
async function fresh(browser: Browser, rec: Rec | null): Promise<{ page: Page; clicks: () => number; click: (sel: Parameters<Page['locator']>[0]) => Promise<void> }> {
  const ctx = await browser.newContext({ storageState: storage, viewport: { width: 1440, height: 900 } })
  opened.push(ctx)
  // 서버 저장은 합치기라(PUT = merge) 심기 전에 비운다 — 앞 시나리오의 기록이 섞이지 않게
  await ctx.request.delete('/api/csat/state')
  if (rec) {
    const res = await ctx.request.put('/api/csat/state', { data: { record: rec } })
    expect(res.ok(), '서버 기록 심기').toBeTruthy()
  }
  const page = await ctx.newPage()
  let n = 0
  return {
    page,
    clicks: () => n,
    click: async (sel) => {
      n += 1
      await page.locator(sel).first().click()
    },
  }
}

const report = (id: string, clicks: number, target: number) => console.log(`SCENARIO ${id} clicks=${clicks} target=${target}`)

test('C1/A1 첫 방문 — 처음이라면 카드에서 한 번에 해부 시작', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('continue-card')).toHaveAttribute('data-state', 'first', { timeout: 15_000 })
  await click('[data-testid="continue-start"]')
  await page.waitForURL(/\/csat\/dissect/)
  report('C1', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})

test('A2 킬러 유형 — 목적별 → 빈칸 줄 → 예시 문항', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-need="killer"]')
  await page.waitForURL(/need=killer/)
  await expect(page.getByTestId('need-chip')).toBeVisible()
  await click('button[aria-expanded]:has-text("빈칸 추론")')
  await click('a:has-text("출제 분석에서 열기")')
  await page.waitForURL(/\/csat\/item\//)
  report('A2', clicks(), 3)
  expect(clicks()).toBeLessThanOrEqual(3)
})

test('A3 오답 선지 설계 — 목적별 → 함정 줄 → 예시 문항', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-need="trap"]')
  await page.waitForURL(/tab=trap/)
  await click('[role="tabpanel"] button[aria-expanded]')
  await click('a:has-text("출제 분석에서 열기")')
  await page.waitForURL(/\/csat\/item\//)
  report('A3', clicks(), 3)
  expect(clicks()).toBeLessThanOrEqual(3)
})

test('A4 근거 문장 찾기 — 목적별 → 지도 있는 문항 → 근거 칩', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-need="evidence"]')
  await page.waitForURL(/status=map/)
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  await click('[aria-label="근거 고르기"] button')
  await expect(page.locator('[data-proof="passage-map"]')).toBeVisible()
  report('A4', clicks(), 3)
  expect(clicks()).toBeLessThanOrEqual(3)
})

test('A5 최근 기출부터 — 목적별 → 번호 칩', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-need="recent"]')
  await page.waitForURL(/from=\d{4}/)
  await expect(page.getByTestId('browse-title')).toContainText('최근 기출부터')
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  report('A5', clicks(), 2)
  expect(clicks()).toBeLessThanOrEqual(2)
})

test('A6 유형별 — 메뉴 문장 삽입 → 번호 칩, 목적 축(A2)과 같은 서가에 닿는다', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-type="R-INSERT"]')
  await page.waitForURL(/type=R-INSERT/)
  const typeUrl = new URL(page.url())
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  report('A6', clicks(), 2)
  expect(clicks()).toBeLessThanOrEqual(2)

  // 목적 축: 킬러 유형 → 문장 삽입 줄 → 「서가에서 보기」 가 **같은 주소**로 가는가
  await page.goto('/csat?need=killer', { waitUntil: 'networkidle' })
  await page.locator('button[aria-expanded]:has-text("문장 삽입")').first().click()
  const href = await page.locator('a:has-text("전체 기출 서가")').first().getAttribute('href')
  expect(href).toBe(`${typeUrl.pathname}${typeUrl.search}`)
})

test('A7 회차별 — 메뉴 2026학년도 수능 → 31번', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-exam="2026"]')
  await page.waitForURL(/exam=2026/)
  await click('[data-testid="csat-library"] a[href="/csat/item/2026-31"]')
  await page.waitForURL(/\/csat\/item\/2026-31/)
  report('A7', clicks(), 2)
  expect(clicks()).toBeLessThanOrEqual(2)
})

test('C2/C5 재방문 · 다른 기기 — 서버에만 있는 멈춘 세트가 이어서 카드로 선다', async ({ browser }) => {
  const now = Date.now()
  const { page, click, clicks } = await fresh(
    browser,
    record({ completed: [{ id: '2026#31', at: now - 3_600_000 }], active: { items: ['2026#31', '2025#31', '2024#31'], index: 1, pairSeen: false, loci: {} }, updatedAt: now }),
  )
  await page.goto('/csat', { waitUntil: 'networkidle' })
  const card = page.getByTestId('continue-card')
  await expect(card).toHaveAttribute('data-state', 'return', { timeout: 15_000 })
  await expect(card).toContainText('세트 2/3')
  await click('[data-testid="continue-resume"]')
  await page.waitForURL(/\/csat\/dissect\?resume=1/)
  report('C2', clicks(), 1)
  report('C5', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})

test('C3 재방문(다음 날) — 오늘 복습이 카드에 보이고 한 번에 시작', async ({ browser }) => {
  const now = Date.now()
  const { page, click, clicks } = await fresh(
    browser,
    record({ completed: [{ id: '2026#31', at: now - DAY }], queue: [{ tag: 'tagA', source: '2026#31', due: now - 3_600_000 }, { tag: 'tagB', source: '2025#32', due: now - 7_200_000 }], updatedAt: now - DAY }),
  )
  await page.goto('/csat', { waitUntil: 'networkidle' })
  const card = page.getByTestId('continue-card')
  await expect(card).toHaveAttribute('data-state', 'return', { timeout: 15_000 })
  await expect(card).toContainText('오늘 복습 2개')
  await click('[data-testid="continue-next"]')
  await page.waitForURL(/\/csat\/dissect/)
  report('C3', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})

test('C4 공백 복귀(8일) — 밀린 복습 9개 중 오늘은 3개만, 나머지는 뒤로 민다', async ({ browser }) => {
  const now = Date.now()
  const queue = Array.from({ length: 9 }, (_, i) => ({ tag: `tag${i}`, source: '2026#31', due: now - (9 - i) * DAY }))
  const { page, click, clicks } = await fresh(browser, record({ completed: [{ id: '2026#31', at: now - 8 * DAY }], queue, updatedAt: now - 8 * DAY }))
  await page.goto('/csat', { waitUntil: 'networkidle' })
  const card = page.getByTestId('continue-card')
  await expect(card).toHaveAttribute('data-state', 'comeback', { timeout: 15_000 })
  await expect(page.getByTestId('comeback-due')).toContainText('밀린 복습 9개 중 오늘은 3개')
  // 압축이 서버 사본에도 반영됐는가(오늘 몫 ≤ 3)
  await page.waitForTimeout(2500)
  const saved = (await (await page.request.get('/api/csat/state')).json()) as { record: { queue: { due: number }[] } }
  expect(saved.record.queue.filter((q) => q.due <= Date.now()).length).toBeLessThanOrEqual(3)
  await click('[data-testid="continue-comeback"]')
  await page.waitForURL(/\/csat\/dissect/)
  report('C4', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})

test('C6 문항 해설에서 이 유형 목록으로 — 막다른 길이 없다', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat/item/2026-31', { waitUntil: 'networkidle' })
  await click('[data-testid="item-back-type"]')
  await page.waitForURL(/\/csat\/browse\?type=/)
  report('C6', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})

test('C7 Today 에서 — 기출 이어서 한 줄로 멈춘 자리', async ({ browser }) => {
  const now = Date.now()
  const { page, click, clicks } = await fresh(browser, record({ completed: [{ id: '2026#31', at: now - 3_600_000 }], active: { items: ['2026#31', '2025#31', '2024#31'], index: 1, pairSeen: false, loci: {} }, updatedAt: now }))
  await page.goto('/hub', { waitUntil: 'networkidle' })
  await click('[data-testid="today-csat-continue"]')
  await page.waitForURL(/\/csat\/dissect\?resume=1/)
  report('C7', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})
