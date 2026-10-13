// apps/web/tests/e2e/csat-v3-m1.spec.ts
//
// v3 M1 — 두 메뉴 · 지도 중심 홈 · 기출 탐구 조건 · 옛 주소 · 복귀. PC 1280 · 1440 라이트(다크 · 모바일 제외).
//   ① 레일은 「내 학습 지도 · 기출 탐구」 두 개뿐(목적별 · 유형별 · 회차별 줄 없음) · 자리마다 맞는 메뉴가 켜진다
//   ② /csat = 지도 홈: 첫 제안(data-kind) · 핵심 학습 지도 · 내 자료 · 기출 탐구 입구 · 진단 없이 탐구 가능
//   ③ 기출 탐구: 목적 조건 → 주소(purpose=) → 문항 칩이 ret 를 들고 감 → 「뒤로」 가 같은 조건으로 · 장면 이동 뒤에도 ret 유지
//   ④ 지도에서 온 문항의 「학습 지도로」 → 홈 첫 제안 「탐구에서 돌아왔어요」
//   ⑤ 옛 주소(?need= · ?tab=trap · ?view=continue · /csat/browse?type= · ?exam=)는 그대로 열리고, 무효 need 는 지도 홈
// CI 의 e2e 잡은 이 스펙을 돌리지 않는다 — 로컬 실행 결과로만 보고한다.
//   PLAYWRIGHT_BASE_URL=http://localhost:3219 pnpm --filter web exec playwright test csat-v3-m1
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const SHOTS = path.resolve('test-results-csat-learner/v3-m1')
const KINDS = ['error', 'withheld', 'return', 'resume', 'continue_check', 'continue_plan', 'goal', 'check', 'no_records', 'records_only', 'preparing']

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

async function login(page: Page) {
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
}
async function noOverflow(page: Page, what: string) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(o, `${what} 가로 넘침`).toBeLessThanOrEqual(0)
}
const q = (page: Page, k: string) => new URL(page.url()).searchParams.get(k)

for (const width of [1280, 1440]) {
  test(`M1 두 메뉴 · 지도 홈 · 기출 탐구 · 복귀 ${width}`, async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await login(page)

    // ② 지도 홈
    await page.goto('/csat', { waitUntil: 'domcontentloaded' })
    const homeRoot = page.getByTestId('csat-home')
    await expect(homeRoot).toBeVisible({ timeout: 90_000 })
    await expect(homeRoot).not.toHaveAttribute('data-suggest', 'loading', { timeout: 30_000 })
    const kind = await page.getByTestId('home-suggest').getAttribute('data-kind')
    expect(KINDS).toContain(kind)
    await expect(page.getByTestId('home-map')).toBeVisible()
    await expect(page.getByTestId('home-mine').getByRole('link')).toHaveCount(5)
    await expect(page.getByTestId('home-explore-go')).toHaveAttribute('href', '/csat/browse')

    // ① 레일 — 두 메뉴만 · 지도 홈에서는 「내 학습 지도」 가 켜짐
    const rail = page.getByTestId('csat-rail')
    await expect(rail.locator('[data-need], [data-type], [data-exam]')).toHaveCount(0)
    await expect(page.getByTestId('rail-map')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('rail-browse')).not.toHaveAttribute('aria-current', 'page')
    await noOverflow(page, `${width} 홈`)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-testid="home-suggest"]').include('[data-testid="home-mine"]').include('[data-testid="home-explore"]').include('[data-testid="csat-rail"]').analyze()
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
    await page.screenshot({ path: `${SHOTS}/${width}-1-home.png` })

    // ③ 기출 탐구 — 메뉴 → 목적 조건 → 주소
    await page.getByTestId('rail-browse').click()
    await page.waitForURL(/\/csat\/browse/)
    await expect(page.getByTestId('rail-browse')).toHaveAttribute('aria-current', 'page')
    await page.locator('[data-testid="browse-purpose"] [data-purpose="killer"]').click()
    await expect(page.locator('[data-purpose="killer"]')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => q(page, 'purpose')).toBe('killer')
    await page.locator('[data-purpose="evidence"]').click()
    await expect.poll(() => q(page, 'status')).toBe('map')
    await page.screenshot({ path: `${SHOTS}/${width}-2-browse.png` })
    const browseUrl = new URL(page.url())
    // 목록 아래쪽 칩을 고른다 — 돌아왔을 때 스크롤 위치가 남는지 보려고
    // 페이지를 아래로 내린 뒤 화면 가운데의 칩을 고른다 — 돌아왔을 때 스크롤 위치가 남는지 보려고
    await page.evaluate(() => window.scrollTo(0, 1200))
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(600)
    const savedY = await page.evaluate(() => Math.round(window.scrollY))
    const chipIndex = await page.locator('[data-testid="csat-library"] a').evaluateAll((els) =>
      els.findIndex((el) => { const r = el.getBoundingClientRect(); return r.top > 120 && r.bottom < window.innerHeight - 40 }),
    )
    expect(chipIndex).toBeGreaterThanOrEqual(0)
    const chip = page.locator('[data-testid="csat-library"] a').nth(chipIndex)
    // 아무거나 한 문항도 같은 조건(ret)을 들고 간다
    expect(await page.getByTestId('browse-random').getAttribute('href')).toContain(`ret=${encodeURIComponent(`${browseUrl.pathname}${browseUrl.search}`)}`)
    const chipHref = await chip.getAttribute('href')
    expect(chipHref).toContain(`ret=${encodeURIComponent(`${browseUrl.pathname}${browseUrl.search}`)}`)
    await chip.click()
    await page.waitForURL(/\/csat\/item\//)
    // 문항 안에서 장면을 옮겨도 ret 는 남는다
    await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 90_000 })
    await page.locator('[data-testid="dock-scene"][aria-label="문항 성립"]').click()
    await expect.poll(() => q(page, 'ret')).toBe(`${browseUrl.pathname}${browseUrl.search}`)
    const backLink = page.getByTestId('item-back-home')
    await expect(backLink).toHaveAttribute('data-back', 'browse')
    await backLink.click()
    await page.waitForURL(/\/csat\/browse/)
    await expect(page.locator('[data-purpose="killer"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-purpose="evidence"]')).toHaveAttribute('aria-pressed', 'true')
    // 스크롤 위치 복귀 — 같은 조건 주소로 돌아오면 떠날 때 자리(±40px)
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 10_000 }).toBeGreaterThan(savedY - 40)
    expect(Math.abs((await page.evaluate(() => Math.round(window.scrollY))) - savedY)).toBeLessThanOrEqual(40)
    await page.screenshot({ path: `${SHOTS}/${width}-2b-browse-restored.png` })

    // ④ 지도에서 온 문항 → 「학습 지도로」 → 홈 복귀 첫 제안
    await page.goto('/csat/item/2026-34?scene=task&from=map', { waitUntil: 'domcontentloaded' })
    const toMap = page.getByTestId('item-back-map')
    await expect(toMap).toBeVisible({ timeout: 90_000 })
    await expect(toMap).toHaveAttribute('href', '/csat?from=item&item=2026-34')
    await expect(page.getByTestId('item-back-home')).toHaveAttribute('data-back', 'home')
    await toMap.click()
    await page.waitForURL(/\/csat\?from=item/)
    // 정상 복귀만 단언한다(실제 지도 loader). 지도 오류 분기는 HomeLanding.render.test 가 따로 본다
    await expect(page.getByTestId('home-suggest')).toHaveAttribute('data-kind', 'return', { timeout: 60_000 })
    await expect(page.getByTestId('home-map')).toHaveAttribute('data-map', 'ok')
    await expect(page.getByTestId('home-return-item')).toHaveAttribute('href', '/csat/item/2026-34?from=map')
    await expect(page.getByTestId('home-map-error')).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/${width}-3-return.png` })
    // 지도에서 시작한 과제로 복귀 — 지도에 있는 실제 과제 키 하나로: 문항 → 「학습 지도로」 주소가 task 를 싣고, 홈이 그 칸을 표시한다
    await page.goto('/csat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('home-map')).toHaveAttribute('data-map', 'ok', { timeout: 60_000 })
    const taskKey = await page.locator('[data-testid="home-map"] [data-task]').first().getAttribute('data-task')
    expect(taskKey).toBeTruthy()
    await page.goto(`/csat/item/2026-34?scene=task&from=map&task=${encodeURIComponent(taskKey!)}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('item-back-map')).toHaveAttribute('href', `/csat?from=item&item=2026-34&task=${encodeURIComponent(taskKey!)}`, { timeout: 90_000 })
    // 장면을 옮겨도 task 는 남는다
    await page.locator('[data-testid="dock-scene"][aria-label="원문 이해"]').click()
    await expect.poll(() => q(page, 'task')).toBe(taskKey)
    await page.getByTestId('item-back-map').click()
    await page.waitForURL(/task=/)
    await expect(page.getByTestId('home-return-task')).toHaveAttribute('data-found', 'true', { timeout: 60_000 })
    await expect(page.locator(`[data-task="${taskKey}"][data-returned="true"]`).first()).toBeInViewport()
    await page.screenshot({ path: `${SHOTS}/${width}-3b-return-task.png` })

    // M1 후속 — 지도 활동 복원: 지도에서 나가는 확인 · 활동 문항 링크는 from=map 을 싣는다
    await page.goto('/csat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('home-map')).toHaveAttribute('data-map', 'ok', { timeout: 60_000 })
    const outs = await page.locator('[data-testid="home-map"] a[href^="/csat/item/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
    for (const h of outs.filter((x) => /[?&](check=1|task=)/.test(x))) expect(h, h).toContain('from=map')
    // 실제 학습 묶음 · 단계 하나로 왕복: 문항 → 「학습 지도로」 가 ws · step 을 싣고, 홈이 그 단계 시트 · 묶음을 다시 연다
    const ws = await page.locator('[data-testid="home-map"] [data-ws^="ws."]').last().getAttribute('data-ws')
    const step = await page.locator('[data-testid="home-map"] [data-step]').first().getAttribute('data-step')
    expect(ws, '테스트 계정 지도에 학습 묶음이 있어야 한다').toBeTruthy()
    expect(step, '테스트 계정 지도에 단계가 있어야 한다').toBeTruthy()
    await page.goto(`/csat/item/2026-34?scene=task&from=map&task=${encodeURIComponent(taskKey!)}&ws=${ws}&step=${step}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('item-back-map')).toHaveAttribute('href', `/csat?from=item&item=2026-34&task=${encodeURIComponent(taskKey!)}&ws=${ws}&step=${step}`, { timeout: 90_000 })
    await page.getByTestId('item-back-map').click()
    await page.waitForURL(/step=/)
    await expect(page.locator(`[data-step-sheet="${step}"]`)).toBeVisible({ timeout: 60_000 })
    await page.screenshot({ path: `${SHOTS}/${width}-3c-restore-step.png` })
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-step-sheet]')).toHaveCount(0)
    if (await page.getByTestId('plan-section').count()) await expect(page.getByTestId('plan-section')).toHaveAttribute('data-ws', ws!)
    // 형식이 다른 문맥은 무시 — 시트가 열리지 않고 홈은 그대로
    await page.goto('/csat?ws=https://evil.example&step=admin', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('home-map')).toHaveAttribute('data-map', 'ok', { timeout: 60_000 })
    await expect(page.locator('[data-step-sheet]')).toHaveCount(0)

    // 서가에서 들어온 문항의 비교 상대 링크도 서가 조건(ret)을 잇는다
    const shelf = '/csat/browse?need=killer'
    await page.goto(`/csat/item/2026-38?scene=compare&ret=${encodeURIComponent(shelf)}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('v3-pair-list')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('v3-pair-option').first().click()
    const other = await page.getByTestId('v3-pair-go-other').getAttribute('href')
    expect(new URL(other!, 'http://x').searchParams.get('ret')).toBe(shelf)

    // 복귀 문맥은 문항 slug 형식만 — 다른 값이면 일반 지도 홈
    await page.goto('/csat?from=item&item=https://evil.example', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('csat-home')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('home-return')).toHaveCount(0)

    // ⑤ 옛 주소
    for (const legacy of ['/csat?need=killer', '/csat?tab=trap', '/csat?tab=type', '/csat?view=continue']) {
      await page.goto(legacy, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-csat-space]'), legacy).toBeVisible({ timeout: 60_000 })
      await expect(page.getByTestId('csat-home'), legacy).toHaveCount(0)
      // 옛 목적 조건(need · tab=trap)은 탐구 조건이라 「기출 탐구」, 옛 유형 표(tab=type) · 이어서 · 복습은 「내 학습 지도」
      await expect(page.getByTestId(legacy.includes('view=continue') || legacy.includes('tab=type') ? 'rail-map' : 'rail-browse'), legacy).toHaveAttribute('aria-current', 'page')
    }
    await page.goto('/csat?need=evil', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('csat-home')).toBeVisible({ timeout: 60_000 })
    for (const legacy of ['/csat/browse?type=R-BLANK', '/csat/browse?exam=2026', '/csat/browse?status=map', '/csat/browse?from=2023']) {
      await page.goto(legacy, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('csat-workspace'), legacy).toBeVisible({ timeout: 60_000 })
      await expect(page.getByTestId('rail-browse'), legacy).toHaveAttribute('aria-current', 'page')
    }
    await noOverflow(page, `${width} 서가`)
    expect(errors).toEqual([])
  })
}
