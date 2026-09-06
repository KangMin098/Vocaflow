// apps/web/tests/e2e/03-admin-curation.spec.ts
// Admin Curation 회귀 — 단어장 마스터 / 큐레이션 화면 접근
import { test, expect } from '@playwright/test';
import { TEST_USER_STATE, ensureAuthState } from './utils/auth';

test.describe('Admin Curation 회귀', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
  });
  test.use({ storageState: TEST_USER_STATE });

  test('단어장 마스터 화면 접근', async ({ page }) => {
    await page.goto('/admin/vocabulary');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/admin/vocabulary');
    console.log('[baseline] Admin vocabulary page accessible');
  });

  test('Admin 대시보드 접근', async ({ page, request }) => {
    const response = await request.get('/api/admin/shared-word-sets').catch(() => null);

    if (response && response.ok()) {
      const data = await response.json();
      console.log(
        `[baseline] shared_word_sets count: ${Array.isArray(data) ? data.length : 'n/a'}`,
      );
    } else {
      await page.goto('/admin');
      await expect(page.locator('body')).toBeVisible();
      console.log('[baseline] Admin dashboard accessible');
    }
  });
});
