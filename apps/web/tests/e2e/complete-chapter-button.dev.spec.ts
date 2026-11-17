// apps/web/tests/e2e/complete-chapter-button.dev.spec.ts
// T-0192 — 읽기 완료 버튼 저장 중·실패·재시도·44px·키보드. /dev/complete-chapter 하네스(fake 응답, DB·Auth 없음). 개발 서버 전용 — CI(next start) 대상 아님.
// 실제 Auth+DB 저장 경로는 r0-reading-completion(T-0005, 로컬 Supabase 필요)이 맡는다.
import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [1280, 1440]
const MIN = 44

async function height(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`no box: ${selector}`)
  return box.height
}

async function focusComplete(page: Page) {
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    if (await page.getByTestId('complete-chapter').evaluate((el) => el === document.activeElement)) return
  }
  throw new Error('Tab 으로 완료 버튼에 닿지 못함')
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('실패(ok=false): Enter → 저장 중 aria-busy → alert 안내 → 다시 시도 버튼, 포커스 유지', async ({ page }) => {
      await page.goto('/dev/complete-chapter?mode=fail&delay=600')
      const btn = page.getByTestId('complete-chapter')
      expect(await height(page, '[data-testid="complete-chapter"]')).toBeGreaterThanOrEqual(MIN)
      await focusComplete(page)
      const ring = await btn.evaluate((el) => getComputedStyle(el).boxShadow)
      expect(ring).not.toBe('none')
      await page.keyboard.press('Enter')
      await expect(btn).toHaveAttribute('aria-busy', 'true')
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('complete-chapter-error')).toContainText('읽던 곳은 그대로예요')
      await expect(page.getByTestId('harness-calls')).toHaveText('1')
      await expect(btn).toHaveText(/다시 시도/)
      await expect(btn).toBeFocused()
    })

    test('reject 뒤 Space 로 다시 시도 → 성공 · 다음 장 44px · 오류 사라짐', async ({ page }) => {
      await page.goto('/dev/complete-chapter?mode=flaky&delay=200')
      await focusComplete(page)
      await page.keyboard.press('Space')
      await expect(page.getByTestId('complete-chapter-error')).toHaveAttribute('role', 'alert')
      await expect(page.getByTestId('complete-chapter')).toHaveText(/다시 시도/)
      await expect(page.getByTestId('complete-chapter')).toBeFocused()
      await page.keyboard.press('Space')
      await expect(page.getByRole('button', { name: /다음 장/ })).toBeVisible()
      await expect(page.getByTestId('complete-chapter-error')).toHaveCount(0)
      await expect(page.getByTestId('harness-calls')).toHaveText('2')
      expect(await height(page, 'button:has-text("다음 장")')).toBeGreaterThanOrEqual(MIN)
      await expect(page.getByRole('button', { name: /다음 장/ })).toBeFocused()
    })

    test('책 완료: BookVault 조작 44px', async ({ page }) => {
      await page.goto('/dev/complete-chapter?mode=book&delay=100')
      await page.getByTestId('complete-chapter').click()
      await expect(page.getByRole('button', { name: /BookVault로/ })).toBeFocused()
      expect(await height(page, 'button:has-text("BookVault로")')).toBeGreaterThanOrEqual(MIN)
    })

    test('저장 중 장이 바뀌면 늦은 응답을 표시하지 않는다', async ({ page }) => {
      await page.goto('/dev/complete-chapter?mode=ok&delay=1200')
      await page.getByTestId('complete-chapter').click()
      await expect(page.getByTestId('complete-chapter')).toHaveAttribute('aria-busy', 'true')
      await page.getByTestId('harness-switch').click()
      await expect(page.getByTestId('harness-text')).toHaveText('harness-b')
      await page.waitForTimeout(1600)
      await expect(page.getByRole('button', { name: /다음 장/ })).toHaveCount(0)
      await expect(page.getByTestId('complete-chapter')).toHaveText(/이 장 완료/)
      await expect(page.getByTestId('complete-chapter')).not.toHaveAttribute('aria-busy', 'true')
    })
  })
}
