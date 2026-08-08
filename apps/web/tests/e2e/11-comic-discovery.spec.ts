// apps/web/tests/e2e/11-comic-discovery.spec.ts
// CCP 발견 회귀 — 만화가 /library 에서 학습자가 고를 수 있는 포맷으로 노출되는지.
//   설계: docs/CCP_LIBRARY_INTEGRATION.md (P0 — 탭 · 포맷 facet · 배지 · 카드 진입)
//   ① /library 4탭에 '만화' 가 있고 탭 이동이 동작한다
//   ② /comics 카탈로그가 렌더되고 각 카드가 유효한 진입 경로를 갖는다
//   ③ 도서 탐색의 '포맷' 구획에서 만화 보유 도서로 결과를 좁힐 수 있다
// 카탈로그가 비어 있으면(발행 만화 0) 빈 상태를 단언하고 종료 — 콘텐츠 의존 false-fail 방지.
import { test, expect, type Page } from '@playwright/test';

import { getComicProgress, userIdByEmail } from './utils/db';

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

/**
 * 카탈로그 첫 카드의 도서 id — 카드 href 는 등록 상태에 따라 상세/리더로 갈리므로
 * href 로 도서를 식별하면 상태에 따라 테스트가 조용히 공회전한다. data-book-id 로 고정한다.
 * 카탈로그가 비어 있으면 null.
 */
async function firstCatalogBookId(page: Page): Promise<string | null> {
  await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const card = page.locator('a[data-book-id]').first();
  if (!(await card.isVisible().catch(() => false))) return null;
  return card.getAttribute('data-book-id');
}

/** 04-ui-smoke 와 동일한 환경 노이즈 필터 (auth refresh 경합 · dev 콜드 청크) */
function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
}

test.describe('CCP 발견 — 만화 메뉴 · 포맷 필터', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('사이드바 만화 메뉴로 들어가고, 카탈로그 카드가 유효한 진입 경로를 갖는다', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // ① 만화는 /library 하위 탭이 아니라 사이드바 최상위 메뉴다(2026-08-09 결정)
    const tabs = page.getByRole('tablist', { name: '라이브러리 탭' });
    await expect(tabs).toBeVisible({ timeout: 15_000 });
    await expect(tabs.getByRole('tab', { name: '만화' })).toHaveCount(0);

    // 사이드바 루트는 <aside aria-label="주 메뉴"> → 암묵 role 은 complementary(navigation 아님)
    const sidebar = page.getByRole('complementary', { name: '주 메뉴' });
    const comicMenu = sidebar.getByRole('link', { name: /^만화/ });
    await expect(comicMenu).toBeVisible({ timeout: 15_000 });

    await comicMenu.click();
    // /comics 는 첫 탭(Adapted)으로 리다이렉트 — /library 와 같은 패턴
    await page.waitForURL(/\/comics\/adapted$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '만화', level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    // 메뉴 하나(Comics) 안에서 출처로 나뉜다 — Adapted(도서 각색) · Restored(원본 복원)
    const comicTabs = page.getByRole('tablist', { name: '만화 탭' });
    await expect(comicTabs.getByRole('tab', { name: /Adapted/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(comicTabs.getByRole('tab', { name: /Restored/ })).toBeVisible();

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

      // 카드 진입 경로 — 등록: /text/[id]/comic · 미등록: 만화 상세(프리뷰 + 등록 흐름)
      const firstLink = cards.first().getByRole('link').first();
      const href = await firstLink.getAttribute('href');
      expect(href, `card href: ${href}`).toMatch(/^\/(text\/[^/]+\/comic|comics\/adapted\/[^/]+)$/);
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

  test('만화 상세 — 프리뷰 + 포맷 선택이 뜬다', async ({ page }) => {
    test.setTimeout(90_000);

    const bookId = await firstCatalogBookId(page);
    if (!bookId) {
      console.log('[comic] 카탈로그 0 — 종료');
      return;
    }
    await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 프리뷰 — 서버 하드캡(≤5)을 넘지 않는다
    const preview = page.getByRole('region', { name: '만화 미리보기' });
    await expect(preview).toBeVisible({ timeout: 15_000 });
    const shots = preview.locator('img');
    const shotCount = await shots.count();
    expect(shotCount).toBeGreaterThan(0);
    expect(shotCount).toBeLessThanOrEqual(5);

    // 포맷 선택 — 권장은 정확히 1개 (선택 피로 방지 · 설계서 D5)
    const choice = page.getByRole('region', { name: '학습 방식 선택' });
    await expect(choice).toBeVisible();
    await expect(choice.getByText('만화로 먼저')).toBeVisible();
    await expect(choice.getByText('원문으로 읽기')).toBeVisible();
    await expect(choice.getByText('지금 추천')).toHaveCount(1);

    // 시작 어포던스는 등록 상태에 따라 형태가 다르다 —
    //   미등록: <button>(클릭 시 enroll_library_book) · 등록: <a>(리더 직행).
    // 계정이 이 도서를 등록하고 나면 영구히 link 이므로 둘 다 허용한다(상태 의존 false-fail 차단).
    const startBtn = choice.getByRole('button', { name: /만화로 먼저/ });
    const startLink = choice.getByRole('link', { name: /만화로 먼저/ });
    const enrolled = await startLink.isVisible().catch(() => false);
    await expect(enrolled ? startLink : startBtn).toBeVisible();

    console.log(`[comic] 상세 프리뷰 ${shotCount}컷 · 포맷 선택 렌더 OK (등록=${enrolled})`);
  });

  test('만화 리더 — 컷과 정본 대사가 뜨고 진도가 서버에 남는다', async ({ page }) => {
    test.setTimeout(150_000);

    const bookId = await firstCatalogBookId(page);
    if (!bookId) {
      console.log('[comic] 카탈로그 0 — 종료');
      return;
    }
    await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 시작 — 미등록이면 enroll 후, 등록이면 곧장 리더로.
    //   ⚠️ 이 경로가 조용히 죽어 있었다(2026-08-09): library_books.cefr_level 이 NULL 이면
    //      enroll_library_book 이 예외를 던져 만화를 아예 볼 수 없었다. 그 회귀를 여기서 잡는다.
    const choice = page.getByRole('region', { name: '학습 방식 선택' });
    await choice
      .getByRole('link', { name: /만화로 먼저/ })
      .or(choice.getByRole('button', { name: /만화로 먼저/ }))
      .first()
      .click();

    await page.waitForURL(/\/text\/[0-9a-f-]{36}\/comic/, { timeout: 90_000 });

    // 리더 렌더 — 컷 위치 표시 + 정본 대사(verbatim 버블은 blur→tap-reveal 이라 DOM 에는 있다)
    await expect(page.getByText(/컷 \d+ \/ \d+/)).toBeVisible({ timeout: 20_000 });
    const panelImgs = await page.locator('img').count();
    expect(panelImgs).toBeGreaterThan(0);

    // 진도 영속 — 몇 컷 넘긴 뒤 comic_read_progress 에 기록되는지 service-role 로 단언
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
    }

    const userId = await userIdByEmail(RUNTIME_USER.email);
    if (!userId) {
      console.log('[comic] SERVICE_ROLE 키 없음 — UI 단언까지만');
      return;
    }
    await expect(async () => {
      const p = await getComicProgress(userId, bookId);
      expect(p, 'comic_read_progress row').not.toBeNull();
      expect(p!.lastIndex).toBeGreaterThan(0);
      expect(p!.panelsTotal).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });

    const prog = await getComicProgress(userId, bookId);
    console.log(`[comic] 리더 OK · 진도 ${prog?.lastIndex}/${prog?.panelsTotal}`);
  });
});

test.describe('CCP 발견 — 비로그인 유입 경로', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('비로그인도 만화 프리뷰를 보고, 시작은 로그인으로 유도된다', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const detailLink = page.locator('a[href^="/comics/adapted/"]').first();
    if (!(await detailLink.isVisible().catch(() => false))) {
      console.log('[comic] 비로그인 카탈로그 비어 있음 — 종료');
      return;
    }
    const href = await detailLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 유입 자산: 등록 전에도 컷이 보여야 한다 (G3 해소의 핵심)
    await expect(page.getByRole('region', { name: '만화 미리보기' })).toBeVisible({
      timeout: 15_000,
    });

    // 시작은 로그인으로 — next 로 이 페이지에 되돌아온다
    const choice = page.getByRole('region', { name: '학습 방식 선택' });
    const loginLink = choice.getByRole('link', { name: /만화로 먼저/ });
    await expect(loginLink).toBeVisible();
    const loginHref = await loginLink.getAttribute('href');
    expect(loginHref, `login href: ${loginHref}`).toMatch(/^\/login\?next=%2Fcomics%2Fadapted%2F/);
  });
});
