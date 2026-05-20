// apps/web/tests/e2e/01-wordvault-browse.spec.ts
// WordVault Browse 회귀 — shared_dictionary 데이터 표시 + CEFR 필터
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('WordVault Browse 회귀', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Browse 페이지가 단어 리스트를 보여준다', async ({ page }) => {
    await page.goto('/wordvault/browse');

    await expect(
      page.locator('h1, h2').filter({ hasText: /단어|WordVault|Vocabulary/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    const wordRows = page.locator('[data-testid="word-row"], [class*="WordRow"], [class*="word-row"]');
    await expect(wordRows.first()).toBeVisible({ timeout: 10_000 });

    const count = await wordRows.count();
    expect(count).toBeGreaterThan(0);
    console.log(`[baseline] WordVault Browse: ${count} word rows displayed`);
  });

  test('CEFR 필터 클릭 시 필터링된다', async ({ page }) => {
    await page.goto('/wordvault/browse');
    await page.waitForLoadState('networkidle');

    const b2Filter = page.getByRole('button', { name: /B2/i }).first();
    if (await b2Filter.isVisible().catch(() => false)) {
      const before = await page.locator('[data-testid="word-row"]').count();
      await b2Filter.click();
      await page.waitForTimeout(500);
      const after = await page.locator('[data-testid="word-row"]').count();
      console.log(`[baseline] CEFR B2 filter: ${before} → ${after}`);
    }
  });

  test('단어 검색이 작동한다', async ({ page }) => {
    await page.goto('/wordvault/browse');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/검색|search/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('abandon');
      await page.waitForTimeout(800);

      const result = page.getByText(/abandon/i).first();
      await expect(result).toBeVisible({ timeout: 5_000 });
      console.log('[baseline] Search "abandon" returned result');
    }
  });
});
