// apps/web/tests/e2e/11-comic-discovery.spec.ts
// CCP 발견 회귀 — 만화가 /library 에서 학습자가 고를 수 있는 포맷으로 노출되는지.
//   설계: docs/CCP_LIBRARY_INTEGRATION.md (P0 — 탭 · 포맷 facet · 배지 · 카드 진입)
//   ① /library 4탭에 '만화' 가 있고 탭 이동이 동작한다
//   ② /library/comics 카탈로그가 렌더되고 각 카드가 유효한 진입 경로를 갖는다
//   ③ 도서 탐색의 '포맷' 구획에서 만화 보유 도서로 결과를 좁힐 수 있다
// 카탈로그가 비어 있으면(발행 만화 0) 빈 상태를 단언하고 종료 — 콘텐츠 의존 false-fail 방지.
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-comic-user.json';

async function loginRuntimeUser(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800); // hydration
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(2_000);
    }
  }
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
  return errors;
}

/** 04-ui-smoke 와 동일한 환경 노이즈 필터 (auth refresh 경합 · dev 콜드 청크) */
function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
}

test.describe('CCP 발견 — 라이브러리 만화 탭 · 포맷 필터', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('라이브러리 탭에 만화가 있고, 카탈로그 카드가 유효한 진입 경로를 갖는다', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // ① 탭 — 도서/만화/스크립트/공용 단어장 4개
    const tabs = page.getByRole('tablist', { name: '라이브러리 탭' });
    await expect(tabs).toBeVisible({ timeout: 15_000 });
    const comicTab = tabs.getByRole('tab', { name: '만화' });
    await expect(comicTab).toBeVisible();

    await comicTab.click();
    await page.waitForURL(/\/library\/comics/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '만화', level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    // 활성 탭 표시(aria-selected) — 색상 단독 전달 금지 원칙의 접근성 계약
    await expect(tabs.getByRole('tab', { name: '만화' })).toHaveAttribute('aria-selected', 'true');

    // ② 카탈로그
    const all = page.getByRole('region', { name: '전체 만화' });
    const empty = page.getByText('아직 준비된 만화가 없어요');
    if (await empty.isVisible().catch(() => false)) {
      console.log('[comic] 발행 만화 0 — 빈 상태 단언 후 종료');
      await expect(page.getByRole('link', { name: '도서 보러 가기' })).toBeVisible();
    } else {
      await expect(all).toBeVisible({ timeout: 15_000 });
      const cards = all.getByRole('listitem');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);

      // 카드 진입 경로 — 등록: /text/[id]/comic · 미등록: 도서 상세(등록 흐름)
      const firstLink = cards.first().getByRole('link').first();
      const href = await firstLink.getAttribute('href');
      expect(href, `card href: ${href}`).toMatch(/^\/(text\/[^/]+\/comic|library\/books\/[^/]+)$/);
      console.log(`[comic] 카탈로그 ${count}편 · 첫 카드 → ${href}`);
    }

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  test('도서 탐색 — 포맷 구획의 만화 칩이 결과를 만화 보유 도서로 좁힌다', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const explorer = page.getByRole('region', { name: '전체 도서 탐색' });
    await expect(explorer).toBeVisible({ timeout: 15_000 });

    const comicChip = explorer.getByRole('button', { name: '만화로도 볼 수 있어요' });
    if (!(await comicChip.isVisible().catch(() => false))) {
      console.log('[comic] 발행 만화 0 — 포맷 구획 미노출(facet-adaptive) · 종료');
      return;
    }

    // 포맷 = 장르와 직교하는 축 (설계서 D3) — 구획 라벨이 '음성'이 아니라 '포맷'
    await expect(explorer.getByText('포맷', { exact: true })).toBeVisible();

    const items = explorer.getByRole('listitem');
    const before = await items.count();
    expect(before).toBeGreaterThan(0);

    // hydration 경합 대비 — aria-pressed 반영까지 재시도 (04-ui-smoke 패턴)
    await expect(async () => {
      if ((await comicChip.getAttribute('aria-pressed')) !== 'true') await comicChip.click();
      expect(await comicChip.getAttribute('aria-pressed')).toBe('true');
      const after = await items.count();
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThanOrEqual(before);
    }).toPass({ timeout: 30_000 });

    // 좁혀진 결과는 전부 만화 배지 보유 — 배지 없는 도서가 섞이면 필터가 거짓말
    const filtered = await items.count();
    const badges = await explorer.getByTitle('만화로 볼 수 있어요').count();
    expect(badges, `filtered=${filtered} badges=${badges}`).toBe(filtered);

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });
});
