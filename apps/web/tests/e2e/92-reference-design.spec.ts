// apps/web/tests/e2e/92-reference-design.spec.ts
// 실제 라우트·테마·기존 저장값·body 포털·클라이언트 이동에서 두 디자인을 검증한다.

import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

const state = 'playwright-auth/.auth-reference-design.json'
const shots = path.resolve(__dirname, '../../../../docs/design/shots/reference-contract')

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(path.dirname(state), { recursive: true })
  fs.mkdirSync(shots, { recursive: true })
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } })
  await page.goto('/login')
  await page.getByLabel(/이메일/).fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
  const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
  if (!password) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD가 필요하다')
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 })
  await page.context().storageState({ path: state })
  await page.close()
})

test.use({ storageState: state })

async function expectPalette(page: Page, csat: boolean, dark: boolean) {
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--p').trim()))
    .toBe(csat ? (dark ? '#fcf9f5' : '#0d0d17') : (dark ? '#aa94ff' : '#542f9c'))
  await expect(page.locator('[data-design-scope="csat"]')).toHaveCount(csat ? 1 : 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

for (const width of [1440, 390]) {
  for (const dark of [false, true]) {
    test(`두 디자인과 팝업 ${width}px ${dark ? 'dark' : 'light'}`, async ({ page }) => {
      test.setTimeout(180000)
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await page.addInitScript(({ dark }) => {
        localStorage.setItem('vocaflow-skin', 'off')
        localStorage.setItem('vocaflow-theme', dark ? 'dark' : 'light')
      }, { dark })
      for (const route of ['/pricing', '/fit', '/hub', '/admin/csat', '/csat', '/csat/diagnosis?tab=map', '/csat/formulas']) {
        const response = await page.goto(`${route}${route.includes('?') ? '&' : '?'}skin=off`)
        expect(response?.status(), route).toBe(200)
        expect(new URL(page.url()).pathname).toBe(route.split('?')[0])
        const csat = route.startsWith('/csat')
        await expectPalette(page, csat, dark)
        if (route === '/csat') {
          await expect(page.getByTestId('continue-card')).not.toHaveAttribute('data-state', 'loading', { timeout: 30000 })
          await expect(page.getByTestId('ws-table').locator('[aria-busy="true"]')).toHaveCount(0)
          await expect(page.getByTestId('ws-new')).toHaveCSS('color', dark ? 'rgb(13, 13, 23)' : 'rgb(252, 249, 245)')
          if (width === 390) {
            const card = page.getByTestId('continue-card')
            await expect(card).toHaveCSS('position', 'relative')
            const box = await card.boundingBox()
            expect(box).not.toBeNull()
            expect(box!.x).toBeGreaterThanOrEqual(0)
            expect(box!.x + box!.width).toBeLessThanOrEqual(width)
          }
        }
        await page.evaluate(() => document.fonts.ready)
        if (route.includes('tab=map')) {
          await expect(page.locator('[data-map-cols]')).toBeVisible()
          const selected = page.locator('button[aria-pressed="true"]').first()
          await expect(selected).toHaveCSS('color', dark ? 'rgb(13, 13, 23)' : 'rgb(252, 249, 245)')
        }
        await page.screenshot({ path: path.join(shots, `${route.split('?')[0].replace(/\//g, '-') || 'home'}-${width}-${dark ? 'dark' : 'light'}.png`) })
        if (route === '/csat') {
          await page.getByTestId('ws-new').click()
          const dialog = page.getByRole('dialog')
          await expect(dialog).toBeVisible()
          expect(await dialog.evaluate(el => getComputedStyle(el).getPropertyValue('--p').trim())).toBe(dark ? '#fcf9f5' : '#0d0d17')
          // body 포털이며 레이아웃 표식의 자손이 아니어도 같은 토큰이어야 한다.
          expect(await dialog.evaluate(el => el.closest('[data-design-scope="csat"]') === null)).toBe(true)
          await page.screenshot({ path: path.join(shots, `csat-dialog-${width}-${dark ? 'dark' : 'light'}.png`) })
          await page.keyboard.press('Escape')
          await expect(dialog).not.toBeVisible()
        }
      }
      // 동일 (main) 그룹의 Next Link 이동에서도 CSAT 표식이 사라져야 한다.
      await page.locator('a[href="/hub"]:visible').first().click()
      await page.waitForURL('**/hub')
      await expectPalette(page, false, dark)
    })
  }
}

test('익명 랜딩도 저장값과 URL에 관계없이 Tines', async ({ browser }) => {
  test.setTimeout(120000)
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } })
  for (const width of [1440, 390]) {
    for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await page.addInitScript(({ dark }) => {
        localStorage.setItem('vocaflow-skin', 'off')
        localStorage.setItem('vocaflow-theme', dark ? 'dark' : 'light')
      }, { dark })
      await page.goto('/?skin=off')
      expect(new URL(page.url()).pathname).toBe('/')
      await expectPalette(page, false, dark)
      await page.screenshot({ path: path.join(shots, `home-${width}-${dark ? 'dark' : 'light'}.png`) })
    }
  }
  await page.close()
})
