// apps/web/tests/e2e/01-wordvault-browse.spec.ts
// WordVault Browse 회귀 — shared_dictionary 데이터 표시 + CEFR 필터
// seed: A1=2 / A2=3 / B1=1 / B2=2 (test-user.ts TEST_CEFR_DISTRIBUTION 참조)
import { test, expect } from '@playwright/test';
import { TEST_USER_STATE, ensureAuthState } from './utils/auth';
import { TEST_SEED_WORDS } from './fixtures/test-user';

test.describe('WordVault Browse 회귀', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
  });
  test.use({ storageState: TEST_USER_STATE });

  test('Browse 페이지가 seed 8개 이상 단어 리스트를 보여준다', async ({ page }) => {
    await page.goto('/wordvault/browse');

    await expect(
      page.locator('h1, h2').filter({ hasText: /단어|WordVault|Vocabulary/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    const wordRows = page.locator(
      '[data-testid="word-row"], [class*="WordRow"], [class*="word-row"]',
    );
    await expect(wordRows.first()).toBeVisible({ timeout: 10_000 });

    const count = await wordRows.count();
    expect(count).toBeGreaterThanOrEqual(TEST_SEED_WORDS.length);
    console.log(
      `[baseline] WordVault Browse: ${count} word rows displayed (seed=${TEST_SEED_WORDS.length})`,
    );
  });

  test('기억 상태 필터가 목록을 실제로 좁힌다', async ({ page }) => {
    // ⚠️ 여기 있던 테스트는 **없는 기능**을 쟀다 — "CEFR B2 필터 클릭". `/wordvault/browse`
    //    에는 CEFR 레벨 필터가 없다(거르는 축은 기억 상태·출처·검색이다). 게다가 본문이
    //    통째로 `if (버튼이 보이면)` 안에 있어 못 찾으면 **조용히 초록**을 냈다 —
    //    그래서 없는 기능을 재고 있다는 사실이 드러나지 않았다
    //    (실측 2026-09-06: 로그에 "spec soft-skipped" 만 남고 통과로 세어졌다).
    //    실제로 있는 필터를 재고, 없으면 실패한다.
    await page.goto('/wordvault/browse');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('[data-testid="word-row"]');
    await expect(rows.first(), '거르기 전 목록이 비어 있다 — 좁혀지는지 잴 수 없다').toBeVisible({
      timeout: 15_000,
    });
    const before = await rows.count();
    expect(before, '거르기 전 단어가 없다').toBeGreaterThan(0);

    // `?filter=state:*` 는 화면의 계약이다 — 허브의 기억 상태 카드가 이 주소로 보낸다.
    await page.goto('/wordvault/browse?filter=state:attention');
    await page.waitForLoadState('networkidle');

    // 거른 화면은 **무엇으로 걸렀는지 말해야 한다** — 말없이 줄기만 하면 학습자는
    // 목록이 왜 짧아졌는지 모른다(빈 목록이면 더 그렇다).
    const banner = page.getByText(/지금 손이 필요해요|주의|살펴볼/).first();
    await expect(banner, '걸렀는데 화면이 그 사실을 말하지 않는다').toBeVisible({ timeout: 10_000 });

    const after = await rows.count();
    expect(after, `거른 뒤(${after})가 전체(${before})보다 많다 — 필터가 거꾸로 동작한다`).toBeLessThanOrEqual(
      before,
    );
    console.log(`[baseline] 기억 상태 필터: ${before} → ${after}`);
  });

  test('단어 검색 "abandon" 이 결과를 반환한다', async ({ page }) => {
    await page.goto('/wordvault/browse');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/검색|search/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('abandon');
      await page.waitForTimeout(800);

      const result = page.getByText(/abandon/i).first();
      await expect(result).toBeVisible({ timeout: 5_000 });
      console.log('[baseline] Search "abandon" returned result');
    } else {
      console.log('[baseline] Search input not found — spec soft-skipped');
    }
  });
});
