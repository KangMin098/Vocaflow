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

// v3 M1(2026-10-13) — 상시 메뉴는 「내 학습 지도 · 기출 탐구」 두 개. 목적 · 유형 · 회차는 기출 탐구(서가)의 조건이라
//   아래 도달 경로는 「기출 탐구」 메뉴(`rail-browse`)부터 센다(메뉴 한 번 + 조건 + 칩). 옛 `/csat?need=` · `?tab=trap` 주소는 그대로 열린다.
test('C1/A1 첫 방문 — 지도 홈의 「처음이라면」 에서 한 번에 해부 시작', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('csat-home')).toBeVisible({ timeout: 15_000 })
  await click('[data-testid="home-start"]')
  await page.waitForURL(/\/csat\/dissect/)
  report('C1', clicks(), 1)
  expect(clicks()).toBeLessThanOrEqual(1)
})

test('A2 킬러 유형 — 기출 탐구 → 목적 킬러 유형 → 번호 칩', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat', { waitUntil: 'networkidle' })
  await click('[data-testid="rail-browse"]')
  await page.waitForURL(/\/csat\/browse/)
  await click('[data-purpose="killer"]')
  await expect.poll(() => new URL(page.url()).searchParams.get('purpose')).toBe('killer')
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  report('A2', clicks(), 3)
  expect(clicks()).toBeLessThanOrEqual(3)
})

test('A3 오답 선지 설계 — 기출 탐구 → 오답 설계 표 → 함정 줄 → 예시 문항', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat/browse', { waitUntil: 'networkidle' })
  await click('[data-purpose="trap"]')
  await page.waitForURL(/tab=trap/)
  await click('[role="tabpanel"] button[aria-expanded]')
  await click('a:has-text("출제 사고로 열기")')
  await page.waitForURL(/\/csat\/item\//)
  report('A3', clicks(), 3)
  expect(clicks()).toBeLessThanOrEqual(3)
})

test('A4 근거 문장 찾기 — 기출 탐구 → 목적 근거 문장 → 번호 칩 → 근거 칩', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat/browse', { waitUntil: 'networkidle' })
  await click('[data-purpose="evidence"]')
  await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('map')
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  await click('[aria-label="근거 고르기"] button')
  await expect(page.locator('[data-proof="passage-map"]')).toBeVisible()
  report('A4', clicks(), 3)
  expect(clicks()).toBeLessThanOrEqual(3)
})

test('A5 최근 기출부터 — 기출 탐구 → 목적 최근 기출 → 번호 칩', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat/browse', { waitUntil: 'networkidle' })
  await click('[data-purpose="recent"]')
  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toMatch(/^\d{4}$/)
  await expect(page.getByTestId('browse-title')).toContainText('최근 기출부터')
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  report('A5', clicks(), 2)
  expect(clicks()).toBeLessThanOrEqual(2)
})

test('A6 유형 — 기출 탐구 유형 조건 문장 삽입 → 번호 칩 · 옛 목적 화면의 「서가에서 보기」 와 같은 조건', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat/browse', { waitUntil: 'networkidle' })
  // 기출 찾기(2026-10-13) — 유형 · 회차 같은 상세 조건은 서가 도구줄이 아니라 「기출 찾기」 팝업에서 고친다(설계 §2).
  //   그래서 경로가 「찾기 → 유형 → 서가에 적용 → 칩」 4번이다(옛 선택 상자 경로 2번에서 늘었다 — DECISIONS 2026-10-13 기출 찾기).
  await click('[data-testid="browse-finder-open"]')
  await expect(page.getByTestId('item-finder')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await click('[data-cond="type-R-INSERT"]')
  await click('[data-testid="item-finder-apply"]')
  await expect.poll(() => new URL(page.url()).searchParams.get('type')).toBe('R-INSERT')
  const typeUrl = new URL(page.url())
  await click('[data-testid="csat-library"] a[href^="/csat/item/"]')
  await page.waitForURL(/\/csat\/item\//)
  report('A6', clicks(), 4)
  expect(clicks()).toBeLessThanOrEqual(4)

  // 옛 목적 화면(킬러 유형 → 문장 삽입 줄 → 「전체 기출 서가」)이 **같은 서가 조건**으로 가는가
  await page.goto('/csat?need=killer', { waitUntil: 'networkidle' })
  await page.locator('button[aria-expanded]:has-text("문장 삽입")').first().click()
  const href = await page.locator('a:has-text("전체 기출 서가")').first().getAttribute('href')
  expect(href).toBe(`${typeUrl.pathname}${typeUrl.search}`)
})

test('A7 회차 — 기출 탐구 회차 조건 2026학년도 수능 → 31번', async ({ browser }) => {
  const { page, click, clicks } = await fresh(browser, null)
  await page.goto('/csat/browse', { waitUntil: 'networkidle' })
  // 회차 조건 = 기출 찾기 팝업의 회차 열 → 「서가에 적용」(A6 와 같은 이유로 4번)
  await click('[data-testid="browse-finder-open"]')
  await expect(page.getByTestId('item-finder')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await click('[data-testid="item-finder-exams"] [data-exam="2026"]')
  await click('[data-testid="item-finder-apply"]')
  await expect.poll(() => new URL(page.url()).searchParams.get('exam')).toBe('2026')
  await click('[data-testid="csat-library"] a[href^="/csat/item/2026-31?"]')
  await page.waitForURL(/\/csat\/item\/2026-31/)
  report('A7', clicks(), 4)
  expect(clicks()).toBeLessThanOrEqual(4)
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
