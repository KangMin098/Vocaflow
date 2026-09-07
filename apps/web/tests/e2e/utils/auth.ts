// apps/web/tests/e2e/utils/auth.ts
import { Page } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-user';

/**
 * 스펙들이 **함께 쓰는** 로그인 상태 파일.
 *
 * 스펙마다 다른 경로를 쓰면 전체 실행의 로그인 횟수가 스펙 수만큼 늘고, 그 횟수가
 * GoTrue 를 멈추게 하는 바로 그 압력이다(실측 2026-09-06: 연속 로그인 뒤
 * `POST /auth/v1/token` 이 25초 무응답). 한 벌을 공유하면 전체 실행에서 **로그인 1회**다.
 */
export const TEST_USER_STATE = 'playwright-auth/.auth-test-user.json';

/**
 * 한 번의 로그인 시도. 성공하면 목적지 URL 에 도달한 상태로 돌아온다.
 */
async function attemptLogin(page: Page, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(hub|wordvault|workspace|main)/, { timeout: 15_000 });
}

/**
 * 테스트 계정 로그인 — **한 번 실패했다고 스펙을 죽이지 않는다.**
 *
 * 왜 재시도가 필요한가 (실측 2026-09-06):
 * Supabase GoTrue 의 `POST /auth/v1/token?grant_type=password` 가 **응답을 주지 않고
 * 멈추는** 구간이 있다. 오류가 아니라 무응답이라 화면은 "로그인 중..." 버튼이 disabled 인
 * 채로 남고, `waitForURL` 이 15초에 타임아웃한다. 같은 시각 `curl` 로 직접 쳐도 25초 동안
 * **0 바이트**였고 `/auth/v1/health` 는 401 로 즉답했다 — 연결·DNS·TLS 가 아니라
 * 그 엔드포인트 하나다. 이때 스펙은 **엉뚱한 증상**으로 죽는다(테스트 본문은 시작도 못 한다).
 *
 * ⚠️ 그래서 백오프를 길게 잡는다. 이 멈춤이 한도 때문이라면 즉시 재시도는 한도를 더 밀어
 *    올릴 뿐이다 — 5초, 15초를 쉬고 두 번만 더 해 본다. 그래도 안 되면 **감춘 채 통과시키지
 *    않고** 마지막 오류를 그대로 던진다.
 */
export async function loginAsTestUser(page: Page) {
  const backoffMs = [0, 5_000, 15_000];
  let lastError: unknown;
  for (const wait of backoffMs) {
    if (wait) await page.waitForTimeout(wait);
    try {
      await attemptLogin(page, TEST_USER);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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
  /**
   * 어떤 계정으로 로그인하나. 기본은 `TEST_USER`.
   *
   * 스펙마다 자기 로그인을 복제하면 **재사용 로직도 함께 복제되지 않는다** — 실제로
   * 그렇게 갈라진 스펙이 rate-limit 에 걸려 로그아웃 상태로 훑고도 초록을 냈다
   * (2026-09-06: 낭비 축 · 전수 훑기 둘 다). 계정만 바꾸고 재사용은 여기 한 벌을 쓴다.
   */
  login: (page: Page) => Promise<void> = loginAsTestUser,
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
    await login(page);
    await page.context().storageState({ path: statePath });
  } finally {
    await page.close();
  }
}
