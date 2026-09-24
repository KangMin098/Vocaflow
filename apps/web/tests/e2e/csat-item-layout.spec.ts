// apps/web/tests/e2e/csat-item-layout.spec.ts
//
// **문항 해설 극장 재설계(2026-09-25) — 레이아웃과 기존 기능 회귀.**
//   왼쪽 열 = 기출문제 원본(기기의 문제지 추출본) · 탭 + 두 판 · 하단 도크 = 강의 차례.
//   기존 기능: 차례 이동 · 상영 · 근거 표시 · 탭 전환 · 같은 유형 이동.
// 스크린샷에는 평가원 지문이 찍힌다 → 저장소 밖(`test-results-csat-learner/` · gitignore · D15).
//   SHOT_PHASE=before|after 로 전/후를 나눠 남긴다.

import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Browser, type Page } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const PHASE = process.env.SHOT_PHASE || 'after'
const SHOTS = path.resolve('test-results-csat-learner/item-redesign')
const PAPERS = 'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출'

let storage: Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['storageState']>>

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
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

async function open(browser: Browser, slug: string, width = 1440, height = 900): Promise<Page> {
  const ctx = await browser.newContext({ storageState: storage, viewport: { width, height } })
  const page = await ctx.newPage()
  await page.goto(`/csat/item/${slug}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 90_000 })
  return page
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)

for (const [slug, width, height] of [
  ['M2706-31', 1440, 900],
  ['M2706-31', 390, 844],
] as const) {
  test(`${PHASE} 스크린샷 ${slug} ${width}px`, async ({ browser }) => {
    const page = await open(browser, slug, width, height)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(SHOTS, `${PHASE}-${slug}-${width}.png`), fullPage: width < 1000 })
    expect(await noOverflow(page)).toBe(true)
    await page.context().close()
  })
}

test.describe('재설계 뒤에만', () => {
  test.skip(PHASE !== 'after', '레이아웃 단언은 새 화면 기준')

  test('왼쪽 열 · 도크 · 탭 · 근거 · 상영 · 같은 유형', async ({ browser }) => {
    const page = await open(browser, 'M2706-31')
    // 왼쪽 열 — 새 기기라 문제지가 없다 → 놓는 칸
    await expect(page.getByRole('complementary', { name: '기출문제 원본' })).toBeVisible()
    await expect(page.getByTestId('item-paper-missing')).toBeVisible()
    await expect(page.getByTestId('paper-input')).toHaveCount(1)
    await expect(page.getByText('이 문항으로 무엇을 할까요?')).toBeVisible()

    // 도크 = 강의 차례 — 누르면 그 차례로, 화살표로 다음
    const dock = page.getByRole('navigation', { name: '이 문항을 읽는 차례' })
    const cards = dock.getByRole('button')
    expect(await cards.count()).toBeGreaterThan(3)
    await cards.nth(2).click()
    await expect(cards.nth(2)).toHaveAttribute('aria-current', 'step')
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(3)).toHaveAttribute('aria-current', 'step')

    // 근거 표시 — 지도의 앵커 칩
    const anchor = page.getByRole('button', { name: /답이 왜/ }).first()
    if (await anchor.count()) {
      await anchor.click()
      await expect(page.getByText('정답 근거').first()).toBeVisible()
    }

    // 탭 전환
    const tabs = page.getByRole('navigation', { name: '보기' })
    await tabs.getByRole('button', { name: '진행' }).click()
    await expect(page.getByRole('group', { name: '차례별 길이' })).toBeVisible()
    await tabs.getByRole('button', { name: '분석' }).click()
    await expect(page.getByText(/BLOCKS/)).toBeVisible()

    // 상영 — 누르면 상태가 바뀐다(음성이 없는 환경이면 알림이 뜬다)
    const play = page.getByRole('button', { name: /상영 시작|하이라이트만/ })
    if (await play.count()) {
      await play.click()
      await expect(page.getByRole('button', { name: /여는 중|멈춤|이어서|처음부터/ }).or(page.getByRole('status')).first()).toBeVisible({ timeout: 30_000 })
    }

    // 같은 유형 이동
    await tabs.getByRole('button', { name: '같은 유형' }).click()
    const other = page.locator('a[data-current="false"]').first()
    const href = await other.getAttribute('href')
    await other.click()
    await page.waitForURL((u) => u.pathname === href, { timeout: 60_000 })
    await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 90_000 })
    await page.context().close()
  })

  test('문제지를 놓으면 왼쪽 열에 발문 · 지문 · 선지', async ({ browser }) => {
    const file = fs.existsSync(PAPERS)
      ? fs.readdirSync(PAPERS).find((f) => f.includes('2026') && f.includes('영어') && f.endsWith('.pdf') && !f.includes('정답'))
      : undefined
    test.skip(!file, '로컬 문제지 PDF 없음')
    const page = await open(browser, '2026-32')
    await page.getByTestId('paper-input').setInputFiles(path.join(PAPERS, file!))
    await expect(page.getByTestId('item-paper').or(page.getByTestId('item-paper-crop'))).toBeVisible({ timeout: 90_000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(SHOTS, `after-2026-32-paper-1440.png`) })
    // 같은 회차 다른 문항 — 다시 놓지 않아도 보인다
    await page.goto('/csat/item/2026-21')
    await expect(page.getByTestId('item-paper').or(page.getByTestId('item-paper-crop'))).toBeVisible({ timeout: 90_000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(SHOTS, `after-2026-21-paper-390.png`), fullPage: true })
    expect(await noOverflow(page)).toBe(true)
    await page.context().close()
  })

  test('다른 문항에도 같은 골격', async ({ browser }) => {
    for (const slug of ['2025-24', 'M2609-40', '2024-37']) {
      const page = await open(browser, slug)
      await expect(page.getByRole('complementary', { name: '기출문제 원본' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: '보기' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: /이 문항을 읽는 차례|분석 블록으로 이동/ })).toBeVisible()
      expect(await noOverflow(page)).toBe(true)
      await page.context().close()
    }
  })
})
