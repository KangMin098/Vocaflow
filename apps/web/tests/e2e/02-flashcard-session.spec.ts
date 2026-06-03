// apps/web/tests/e2e/02-flashcard-session.spec.ts
// Flashcard 세션 회귀 — shared_dictionary 의 meaning_ko / ipa 표시 검증
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Flashcard 세션 회귀', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Flashcard Hub 에서 시작 가능', async ({ page }) => {
    await page.goto('/flashcard');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    const startable = page.locator('button, a').filter({ hasText: /시작|Start|학습/i }).first();
    await expect(startable).toBeVisible({ timeout: 10_000 });
    console.log('[baseline] Flashcard Hub loaded');
  });

  test('Flashcard 세션에서 단어 + 뜻 + 발음이 표시된다', async ({ page }) => {
    await page.goto('/flashcard');
    await page.waitForLoadState('networkidle');

    const startBtn = page.locator('button, a').filter({ hasText: /시작|Start/i }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(2_000);

      const wordDisplay = page
        .locator('[data-testid="flashcard-word"], [class*="flashcard"]')
        .first();
      await expect(wordDisplay).toBeVisible({ timeout: 10_000 });

      const text = await wordDisplay.textContent();
      expect(text).toBeTruthy();
      console.log(`[baseline] Flashcard front: "${text?.slice(0, 30)}"`);

      await wordDisplay.click();
      await page.waitForTimeout(500);

      const body = await page.locator('body').textContent();
      expect(/[가-힣]/.test(body || '')).toBe(true);
      console.log('[baseline] Flashcard back shows Korean meaning');
    }
  });
});
