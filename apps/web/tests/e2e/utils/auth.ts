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

/**
 * 로그인 상태를 **재사용**한다 — 신선하면 다시 로그인하지 않는다.
 *
 * 왜: 스펙마다 beforeAll 에서 로그인하면 전체 실행에서 로그인이 스펙 수만큼 일어나고,
 * Supabase auth rate-limit 에 걸린다. 그때 스펙은 **엉뚱한 증상**으로 죽는다 —
 * beforeAll 이 waitForURL 타임아웃으로 실패하고 그 describe 전체가 "did not run" 이 된다.
 * (실측 2026-08-15: 받아쓰기 순회 7건 중 6건이 그렇게 통째로 안 돌았다.)
 *
 * @param maxAgeMs 이 시간보다 오래된 상태는 버린다(세션 만료로 인한 조용한 실패 방지)
 */
export async function ensureAuthState(
  browser: import('@playwright/test').Browser,
  statePath: string,
): Promise<void> {
  // 나이로 추측하지 않고 **실제로 유효한지** 확인한다. 시간 기준을 쓰면 아직 멀쩡한
  // 상태를 버리고 불필요하게 로그인해 rate-limit 을 자초한다(첫 구현이 그랬다).
  const fs = await import('node:fs');
  if (fs.existsSync(statePath)) {
    const ctx = await browser.newContext({ storageState: statePath });
    const probe = await ctx.newPage();
    try {
      await probe.goto('/dictate', { waitUntil: 'domcontentloaded' });
      if (!/\/login/.test(probe.url())) return; // 아직 유효 — 재사용
    } catch {
      /* 확인 실패 → 새로 로그인 */
    } finally {
      await ctx.close();
    }
  }
  const page = await browser.newPage({ storageState: undefined });
  try {
    await loginAsTestUser(page);
    await page.context().storageState({ path: statePath });
  } finally {
    await page.close();
  }
}
