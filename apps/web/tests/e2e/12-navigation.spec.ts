// apps/web/tests/e2e/12-navigation.spec.ts
// 내비게이션 기본기 회귀 — "화면 이동 / 뒤로가기 / 닫기 / 페이지 네비게이션".
//   ① 사이드바 전 메뉴가 실제로 그 라우트로 이동하고 에러 화면이 아니다
//   ② 진입 라우트 리다이렉트 계약 (/library → /books · /comics → /adapted)
//   ③ 탭 이동 + aria-selected (라이브러리 3탭 · 만화 2탭)
//   ④ 브라우저 뒤로/앞으로 히스토리
//   ⑤ 페이지 내 되돌아가기(만화 상세 → 목록 · 리더 → 본문)
//   ⑥ 워크스페이스 ModePills 가 세션 라우트로 실제 이동
//
// ⚠️ dev 서버는 라우트별 콜드 컴파일이 수 초~수십 초라, 클릭 직후 URL 을 읽으면
//    "이동 안 함"으로 오판한다(2026-08-09 실측). 이동 판정은 전부 waitForURL 로 한다.
// ⚠️ Next 는 스트리밍이 시작된 뒤의 redirect() 를 소프트(클라) 리다이렉트로 처리한다.
//    문서 응답은 200 이고 URL 은 hydration 후에 바뀌므로 goto 결과로 판정하면 안 된다.
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-nav-user.json';

/** 사이드바에 등재된 전 메뉴 (components/layout/sidebar-config.ts 와 1:1) */
const MENU_ROUTES = [
  '/hub',
  '/dashboard',
  '/library',
  '/comics/adapted',
  '/comics/restored',
  '/text',
  '/wordvault',
  '/flashcard',
  '/wordblitz',
  '/pairflip',
  '/spellforge',
  '/arcade',
  '/scriptquiz',
  '/dictate',
  '/teacher',
  '/settings',
];

/** 진입 라우트 → 첫 탭 리다이렉트 계약 */
const REDIRECTS: Array<[string, RegExp]> = [
  ['/library', /\/library\/books$/],
  ['/comics', /\/comics\/adapted$/],
];

async function loginRuntimeUser(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
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

/** 환경 노이즈 (dev 콜드 청크 · auth refresh 경합 · 내비게이션 중단) */
function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError|ERR_ABORTED/.test(
        e,
      ),
  );
}

const ERROR_SCREEN = /페이지를 찾을 수 없어요|problem occurred|Application error/i;

test.describe('내비게이션 기본기', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('사이드바 전 메뉴가 해당 라우트로 이동하고 에러 화면이 아니다', async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const sidebar = page.getByRole('complementary', { name: '주 메뉴' });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    // 사이드바가 노출하는 href 집합이 기대 메뉴와 일치하는지 (항목 누락/오타 감지)
    const hrefs: string[] = [];
    for (const link of await sidebar.getByRole('link').all()) {
      const h = await link.getAttribute('href');
      if (h && h !== '#' && !hrefs.includes(h)) hrefs.push(h);
    }
    for (const route of MENU_ROUTES) {
      expect(hrefs, `사이드바에 ${route} 없음`).toContain(route);
    }

    for (const href of MENU_ROUTES) {
      await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await sidebar.locator(`a[href="${href}"]`).first().click();
      // 리다이렉트 라우트는 목적지까지 허용 (예: /comics → /comics/adapted)
      await page.waitForURL((u) => u.pathname === href || u.pathname.startsWith(`${href}/`), {
        timeout: 60_000,
      });
      await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);
    }
  });

  test('진입 라우트가 첫 탭으로 리다이렉트된다', async ({ page }) => {
    test.setTimeout(120_000);
    for (const [from, expected] of REDIRECTS) {
      // 소프트 리다이렉트는 내비게이션 중단(ERR_ABORTED)을 낼 수 있어 goto 실패는 무시하고 URL 로 판정
      await page.goto(from, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
      await page.waitForURL(expected, { timeout: 30_000 });
    }
  });

  test('탭 이동과 활성 표시(aria-selected)가 맞다', async ({ page }) => {
    test.setTimeout(180_000);
    const tabSets: Array<[string, string, string[]]> = [
      ['/library/books', '라이브러리 탭', ['/library/books', '/library/scripts', '/library/vocab']],
      ['/comics/adapted', '만화 탭', ['/comics/adapted', '/comics/restored']],
    ];

    for (const [start, tablistName, expectedHrefs] of tabSets) {
      await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const tablist = page.getByRole('tablist', { name: tablistName });
      await expect(tablist).toBeVisible({ timeout: 15_000 });
      await expect(tablist.getByRole('tab')).toHaveCount(expectedHrefs.length);

      for (const href of expectedHrefs) {
        await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page
          .getByRole('tablist', { name: tablistName })
          .locator(`a[href="${href}"]`)
          .first()
          .click();
        await page.waitForURL((u) => u.pathname.startsWith(href), { timeout: 60_000 });
        await expect(
          page.getByRole('tablist', { name: tablistName }).locator(`a[href="${href}"]`).first(),
        ).toHaveAttribute('aria-selected', 'true');
      }
    }
  });

  test('브라우저 뒤로/앞으로가 방문 순서를 복원한다', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.goto('/wordvault', { waitUntil: 'domcontentloaded', timeout: 45_000 });

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/comics\/adapted$/, { timeout: 30_000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/library\/books$/, { timeout: 30_000 });
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/comics\/adapted$/, { timeout: 30_000 });

    await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);
    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  test('페이지 내 되돌아가기 — 만화 상세 → 목록, 리더 → 본문', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const bookId = await page
      .locator('a[data-book-id]')
      .first()
      .getAttribute('data-book-id')
      .catch(() => null);
    if (!bookId) {
      console.log('[nav] 발행 만화 0 — 종료');
      return;
    }

    // 상세 → 목록
    await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByRole('link', { name: /만화 목록/ }).first().click();
    await page.waitForURL(/\/comics\/adapted$/, { timeout: 30_000 });

    // 상세 → 리더 → 본문 복귀
    await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page
      .getByRole('link', { name: /만화로 먼저/ })
      .or(page.getByRole('button', { name: /만화로 먼저/ }))
      .first()
      .click();
    await page.waitForURL(/\/text\/[0-9a-f-]{36}\/comic/, { timeout: 90_000 });

    const backToText = page.getByRole('link', { name: /본문/ }).first();
    await expect(backToText, '리더에 본문 복귀 경로가 없다').toBeVisible({ timeout: 20_000 });
    await backToText.click();
    // 본문 워크스페이스(/text/[id]) 로 — 리더에 갇히지 않는다
    await page.waitForURL(/\/text\/[0-9a-f-]{36}(\?|$)/, { timeout: 60_000 });
    await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);
  });

  test('워크스페이스 ModePills 가 세션 라우트로 실제 이동한다', async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto('/text', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2_000);
    const hrefs = await page
      .locator('a[href^="/text/"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || ''));
    const textHref = hrefs.find((h) => /^\/text\/[0-9a-f-]{36}/.test(h));
    if (!textHref) {
      console.log('[nav] 내 스크립트 없음 — 종료');
      return;
    }

    await page.goto(textHref, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const pills = page.getByRole('navigation', { name: '학습 단계 선택' });
    await expect(pills).toBeVisible({ timeout: 20_000 });

    const pillHrefs = await pills
      .getByRole('link')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || ''));
    expect(pillHrefs.length).toBeGreaterThan(4);

    // 워크스페이스를 떠나는 pill(단어·카드·블리츠)은 from= 복귀 파라미터를 실어야 한다
    const leaving = pillHrefs.filter((h) => !h.startsWith(textHref.split('?')[0]));
    for (const h of leaving) {
      if (h === '/scriptquiz') continue; // 자료 스코프 없는 허브 진입
      expect(h, `세션 이탈 pill 에 from= 없음: ${h}`).toContain('from=');
    }

    // 대표 2개만 실제 이동 검증 (dev 콜드 컴파일이 느려 전수는 비쌈)
    const samples = [
      pillHrefs.find((h) => h.includes('/comic')),
      leaving.find((h) => h.includes('/flashcard/play')),
    ].filter(Boolean) as string[];

    for (const h of samples) {
      await page.goto(textHref, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await pills.locator(`a[href="${h}"]`).first().click();
      const target = h.split('?')[0];
      await page.waitForURL((u) => u.pathname === target, { timeout: 90_000 });
      await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);
    }
  });
});
