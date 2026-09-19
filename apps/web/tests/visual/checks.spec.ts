// apps/web/tests/visual/checks.spec.ts
import { test, expect } from '@playwright/test'
import { assertNoOverflow, assertScreen } from './checks'

test('layout guard detects overflow while allowing contained scroll', async ({ page }) => {
  await page.setContent('<main style="max-width:100%;overflow:auto"><div style="width:2000px">Wide table</div></main>')
  await assertNoOverflow(page)
  await page.locator('main').evaluate(element => { element.style.overflow = 'visible' })
  await expect(assertNoOverflow(page)).rejects.toThrow('가로 넘침')
})

test('screen guard rejects a login redirect and a missing target heading', async ({ page }) => {
  await page.route('https://design-check.invalid/**', route => route.fulfill({
    contentType: 'text/html', body: '<h1>로그인</h1>',
  }))
  await page.goto('https://design-check.invalid/login')
  await expect(assertScreen(page, '/csat', '다른 지문, 같은 설계.')).rejects.toThrow('다른 화면')
  await page.goto('https://design-check.invalid/csat')
  await expect(assertScreen(page, '/csat', '다른 지문, 같은 설계.')).rejects.toThrow()
})
