// apps/web/tests/e2e/csat-v31-meaning.spec.ts
//
// v3.1 원문 이해 교수 — scene=meaning 안 선택적 탐구를 실화면에서 직접 조작한다. PC 1280 · 1440 라이트(다크 제외 — 사용자 결정).
//   의미 선택 → 지도 근거 강조 · 깊이(짧게 · 왜 · 깊이) · 관계 탐구 · 지도 문장 선택(0 · 1 · 여러 unit) · 메모리 초안 600자 초과 경고(자르지 않음) ·
//   문항 성립/설계로 이동 → 뒤로가기 복귀 시 선택 · 초안 유지 · URL allowlist 정규화 · 교수 설명 없는 문항의 기존 v3 화면 · 가로 넘침 · 페이지 오류.
// 결속 stale · 배포 레코드 변경 · 원문 분할 불일치는 서버 단위 회귀(lib/csat/meaning-support/__tests__)가 맡는다.
// CI 의 e2e 잡은 이 스펙을 돌리지 않는다 — 로컬 실행 결과로만 보고한다.
//   PLAYWRIGHT_BASE_URL=http://localhost:3218 pnpm --filter web exec playwright test csat-v31-meaning
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
const SHOTS = path.resolve('test-results-csat-learner/v31-meaning')

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

for (const width of [1280, 1440]) {
  test(`v3.1 원문 이해 탐구 ${width}`, async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await login(page)

    // 1) 진입 — 시작 의미 하나가 열려 있고, 지도는 그 의미의 문장을 비춘다
    await page.goto('/csat/item/2026-34?scene=meaning&from=map', { waitUntil: 'domcontentloaded' })
    const panel = page.getByTestId('ms-panel')
    await expect(panel).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('ms-whole')).not.toBeEmpty()
    await expect(page.getByTestId('ms-explain')).toBeVisible()
    await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
    // 깊이 '짧게' 에서는 구문 · 오해 예가 닫혀 있다(강제 단계 아님)
    await expect(page.getByTestId('ms-misunderstanding')).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/${width}-1-entry.png` })

    // 2) 다른 의미 선택 → URL meaning= 갱신 · 지도 강조 유지
    const units = page.getByTestId('ms-unit')
    const n = await units.count()
    expect(n).toBeGreaterThan(1)
    const second = units.nth(1)
    const secondId = await second.getAttribute('data-unit')
    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', secondId!)
    expect(new URL(page.url()).searchParams.get('meaning')).toBe(secondId)
    expect(new URL(page.url()).searchParams.get('from')).toBe('map')

    // 3) 깊이 — 왜 · 깊이 탐구를 열면 더 보인다
    await page.getByTestId('ms-depth').locator('[data-depth="deep"]').click()
    expect(new URL(page.url()).searchParams.get('depth')).toBe('deep')
    await expect(page.getByTestId('ms-limits')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/${width}-2-deep.png`, fullPage: true })

    // 4) 관계 탐구 — 있으면 고르고 두 의미 · 변화를 본다
    const relPick = page.getByTestId('ms-relation-pick')
    if (await relPick.count()) {
      await relPick.first().click()
      await expect(page.getByTestId('ms-relation')).toBeVisible()
      await relPick.first().click()
      await expect(page.getByTestId('ms-relation')).toHaveCount(0)
    }

    // 5) 지도 문장 선택 — 정확히 한 의미에 속한 문장이면 그 의미로 이동, 아니면 상태 문구
    const sentencePicks = page.getByTestId('map-sentence-pick')
    expect(await sentencePicks.count()).toBeGreaterThan(0)
    await sentencePicks.first().click()
    const pick = page.getByTestId('ms-pick')
    if (await pick.count()) await expect(pick).toBeVisible()
    else await expect(page.getByTestId('ms-explain')).toBeVisible()
    await units.nth(1).click()

    // 6) 메모리 초안 — 600자 초과는 경고만(자르지 않음)
    await page.getByTestId('ms-draft-open').click()
    const draft = page.getByTestId('ms-draft-text')
    await draft.fill('가'.repeat(605))
    await expect(draft).toHaveValue('가'.repeat(605))
    await expect(draft).toHaveAttribute('aria-invalid', 'true')
    await draft.fill('조건이 맞을 때만 이렇게 된다는 뜻')
    await page.getByTestId('ms-draft-compare-open').click()
    await expect(page.getByTestId('ms-draft-compare')).toBeVisible()

    // 7) 문항 성립으로 이동 → 뒤로가기 → 같은 의미 · 초안 유지
    await page.getByTestId('ms-go-judgment').click()
    expect(new URL(page.url()).searchParams.get('scene')).toBe('judgment')
    await expect(page.getByTestId('ms-panel')).toHaveCount(0)
    await page.goBack()
    await expect(page.getByTestId('ms-panel')).toBeVisible()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', secondId!)
    await expect(page.getByTestId('ms-draft-text')).toHaveValue('조건이 맞을 때만 이렇게 된다는 뜻')
    // 설계 재구성으로도 이어진다
    await page.getByTestId('ms-go-design').click()
    expect(new URL(page.url()).searchParams.get('scene')).toBe('design')
    await noOverflow(page, `${width} 설계`)

    // 8) URL allowlist — 모르는 의미 · 깊이는 기본으로
    await page.goto('/csat/item/2026-34?scene=meaning&meaning=evil&depth=max', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('ms-panel')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('ms-depth').locator('[data-depth="brief"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('ms-explain')).toBeVisible()

    // 9) 교수 설명이 없는 문항 — 기존 v3 의미 화면 그대로(빈 패널 없음)
    await page.goto('/csat/item/2026-31?scene=meaning', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('scene-nav')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('ms-panel')).toHaveCount(0)
    await expect(page.getByTestId('map-sentence-pick')).toHaveCount(0)

    // 접근성 — 새 패널만(serious · critical 0)
    await page.goto('/csat/item/2026-38?scene=meaning&depth=deep', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('ms-panel')).toBeVisible({ timeout: 90_000 })
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-testid="ms-panel"]').analyze()
    expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
    await noOverflow(page, `${width} 의미`)
    await page.screenshot({ path: `${SHOTS}/${width}-3-38-deep.png`, fullPage: true })

    expect(errors).toEqual([])
  })
}
