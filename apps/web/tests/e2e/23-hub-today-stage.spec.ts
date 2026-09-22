// apps/web/tests/e2e/23-hub-today-stage.spec.ts
//
// 플랫폼 메인(/hub) 회귀 — 2026-09-22 재설계가 지켜야 하는 계약 3가지.
// (파일 이름은 이력 때문에 남긴다 — v06.200 「오늘의 무대」 스펙이 이 자리에 있었다.)
//
//   ① 홍보 면의 책은 **실제 발행 도서**다 — 홍보 자리는 지어낸 표지·제목이 들어가기 가장 쉬운 곳이다.
//   ② 「오늘」 정의는 하나 — 배너 옆 패널의 흐름 진행이 셸 띠와 같다(v06.108 META Opt A).
//      패널은 같은 모델(`buildWayfinder`)을 읽으므로, 둘이 다르면 누군가 모델을 하나 더 만든 것이다.
//   ③ 자동으로 넘어가는 배너에는 멈춤 단추가 있다(WCAG 2.2.2).

import { test, expect, type Page } from '@playwright/test'

import { serviceClient } from './utils/db'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? (() => { throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local (CI: 저장소 시크릿)') })(),
}
const STATE_PATH = 'playwright-auth/.auth-hub-portal.json'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration — 클릭이 빠르면 네이티브 폼 전송이 된다
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test.describe('플랫폼 메인 — /hub', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('① 새로 들어온 고전은 발행된 실제 도서다', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' })
    const shelf = page.locator('section[aria-label="새로 들어온 고전"] a[href^="/library/books/"]')
    await expect(shelf.first()).toBeVisible({ timeout: 30_000 })

    const ids = (await shelf.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '')))
      .map((h) => h.replace('/library/books/', ''))
    expect(ids.length).toBeGreaterThan(0)

    const c = serviceClient()
    test.skip(!c, 'service-role 키가 없으면 DB 대조를 못 한다')
    const { data, error } = await c!.from('library_books').select('id').in('id', ids).eq('status', 'published')
    expect(error).toBeNull()
    expect((data ?? []).length, '선반에 발행되지 않은 도서가 섞였다').toBe(ids.length)
  })

  test('② 패널의 오늘 흐름 진행 = 셸 띠의 진행', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    const flow = page.locator('[data-today-flow]')
    const ribbon = page.locator('[aria-label="오늘 상태"] [data-today-progress]')
    if ((await flow.count()) === 0 || (await ribbon.count()) === 0) {
      test.skip(true, '오늘 처방 흐름이 없는 상태(미진단·수동계획)')
      return
    }
    const a = (await flow.first().innerText()).match(/(\d+)\s*\/\s*(\d+)/)
    const b = ((await ribbon.first().getAttribute('data-today-progress')) ?? '').match(/(\d+)\s*\/\s*(\d+)/)
    expect(a && b, '진행 표기를 읽지 못했다').toBeTruthy()
    expect(`${a![1]}/${a![2]}`).toBe(`${b![1]}/${b![2]}`)
  })

  test('③ 배너에는 멈춤 단추가 있다', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' })
    const carousel = page.locator('[aria-roledescription="carousel"]')
    await expect(carousel).toBeVisible({ timeout: 30_000 })
    await expect(carousel.getByRole('button', { name: /자동 넘김/ })).toBeVisible()
  })
})
