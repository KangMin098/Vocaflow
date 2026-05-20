// apps/web/tests/e2e/utils/auth.ts
import { Page } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-user';

export async function loginAsTestUser(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(hub|wordvault|workspace|main)/, { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.goto('/settings');
  const logoutBtn = page.getByRole('button', { name: /로그아웃|logout/i });
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  }
}
