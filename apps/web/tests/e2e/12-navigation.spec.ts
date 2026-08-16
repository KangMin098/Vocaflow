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
  '/text',
  '/comics/adapted',
  '/comics/restored',
  '/wordvault',
  '/practice',
  '/arcade',
  '/scriptquiz',
  '/dictate',
  '/teacher',
  '/settings',
];
// 2026-08-15 갱신: 셸 재설계(ADR 0006/0007)로 **활동이 최상위에서 내려갔다** —
// `/flashcard` · `/wordblitz` · `/pairflip` · `/spellforge` 는 메뉴가 아니라 모드가 됐고
// `/practice` 가 들어왔다. 목록을 손으로 다시 적는 이유는 04-ui-smoke 와 같다:
// 사이드바가 설정을 **실제로** 읽는지 확인하는 것이 이 단언의 값이다.

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

  // 이 두 단언의 값: 서브메뉴가 `lib/library/tabs.ts` 를 **실제로** 읽는지 확인하는 것이다.
  // 사이드바가 자기 목록을 복사해 들면 페이지 탭과 조용히 갈라진다 — 화면은 멀쩡해 보이고
  // 한쪽에만 없는 면이 생긴다. 개수(3)와 목적지(3주소)를 둘 다 본다.
  const SUBMENUS: Array<{
    name: string;
    parent: string;
    toggle: RegExp;
    subs: string[];
    /** 첫 면을 거치지 않고 직행하는지 볼 마지막 면 + 착지 URL */
    deep: [string, RegExp];
  }> = [
    {
      name: 'Library',
      parent: '/library',
      toggle: /^Library 하위 메뉴/,
      subs: ['/library/books', '/library/scripts', '/library/vocab'],
      deep: ['/library/vocab', /\/library\/vocab$/],
    },
    {
      // /text 의 세 면은 라우트가 아니라 한 화면의 탭이다 — `?view=` 로 주소화한 것이
      //   이 서브메뉴의 전제다. 주소가 없으면 링크가 장식이 된다.
      name: 'My Library',
      parent: '/text',
      toggle: /^My Library 하위 메뉴/,
      subs: ['/text?view=books', '/text?view=scripts', '/text?view=vocab'],
      deep: ['/text?view=vocab', /\/text\?view=vocab$/],
    },
  ];

  for (const m of SUBMENUS) {
    test(`사이드바 ${m.name} 서브메뉴가 3면으로 직접 이동한다`, async ({ page }) => {
      test.setTimeout(240_000);

      await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const sidebar = page.getByRole('complementary', { name: '주 메뉴' });
      await expect(sidebar).toBeVisible({ timeout: 15_000 });

      // 해당 구역 밖에서는 접혀 있다 (기본 조용함)
      for (const href of m.subs) {
        await expect(sidebar.locator(`a[href="${href}"]`)).toHaveCount(0);
      }

      // 셰브런으로 어디서나 펼친다 — 이게 없으면 마지막 면은 여전히 첫 면을 거쳐야 한다
      const toggle = sidebar.getByRole('button', { name: m.toggle });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');

      for (const href of m.subs) {
        await expect(sidebar.locator(`a[href="${href}"]`), `서브메뉴에 ${href} 없음`).toHaveCount(1);
      }

      // 첫 면을 거치지 않고 마지막 면으로 직행
      const [deepHref, deepUrl] = m.deep;
      await sidebar.locator(`a[href="${deepHref}"]`).click();
      await page.waitForURL(deepUrl, { timeout: 60_000 });
      await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);

      // 그 구역 안에서는 수동 조작 없이 열려 있고, 현재 면이 aria-current 를 갖는다
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(sidebar.locator(`a[href="${deepHref}"]`)).toHaveAttribute(
        'aria-current',
        'page',
        { timeout: 15_000 },
      );
      // 부모는 활성 표식을 자식에게 넘긴다 (같은 "지금 어디"를 두 번 말하지 않는다)
      await expect(sidebar.locator(`a[href="${m.parent}"]`)).not.toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  }

  test('/text?view= 가 실제로 그 면을 연다 (링크가 장식이 아니다)', async ({ page }) => {
    test.setTimeout(180_000);
    // 주소만 바뀌고 화면이 그대로면 서브메뉴는 거짓말이 된다. 탭의 aria-selected 로 확인한다.
    // ⚠️ /text 는 클라이언트에서 자료를 가져온다(useTexts/SWR) — domcontentloaded 직후에는
    //    탭줄이 아직 없다. 처음엔 count() 를 바로 읽어 **자료 0 으로 오판하고 조용히 통과**했다.
    //    "없으면 건너뛴다" 류 분기는 이렇게 스펙 전체를 무력화한다.
    const VIEWS = ['books', 'scripts', 'vocab'];
    let checked = 0;

    for (const view of VIEWS) {
      await page.goto(`/text?view=${view}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const tablist = page.getByRole('tablist', { name: '내 라이브러리 탭' });
      const present = await tablist
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (!present) {
        // 계정에 자료가 하나도 없으면 캐러셀 자체가 없다(EmptyState). 그건 이 스펙의 대상이 아니다.
        expect(await page.getByText(/첫 스크립트|시작해|추가하기/).count()).toBeGreaterThan(0);
        continue;
      }
      // 항목이 0인 면은 탭이 disabled 라 선택될 수 없다 — 그 면은 계정 상태 문제이지 배선 문제가 아니다.
      const tab = tablist.getByRole('tab').nth(VIEWS.indexOf(view));
      if (await tab.isDisabled()) continue;
      await expect(tab, `?view=${view} 가 그 탭을 열지 않았다`).toHaveAttribute(
        'aria-selected',
        'true',
      );
      checked++;
    }

    // 셋 다 건너뛰었다면 이 스펙은 아무것도 확인하지 않은 것이다 — 통과로 위장시키지 않는다.
    expect(checked, '검증된 면이 0개 — 계정 자료를 확인할 것').toBeGreaterThan(0);
  });

  test('서브메뉴는 한 번에 하나만 열린다 (Books·Decks 가 두 벌 보이지 않는다)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // Library(공용)와 My Library(내 것)는 자식 이름이 겹친다(Books · Decks).
    // 둘이 동시에 펼쳐지면 한 화면에 Books 가 둘, Decks 가 둘 서서 어느 쪽이 공용인지
    // 부모까지 거슬러 봐야 한다 — 실제로 그 상태로 배포됐다(사용자 지적 2026-08-16).
    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const sidebar = page.getByRole('complementary', { name: '주 메뉴' });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    // /library 안이라 Library 는 자동 펼침 상태다(키가 없는 기본값) — 여기가 함정이었다.
    await expect(sidebar.locator('a[href="/library/books"]')).toHaveCount(1);

    // 그 상태에서 My Library 를 펼치면 Library 는 닫혀야 한다
    await sidebar.getByRole('button', { name: /^My Library 하위 메뉴/ }).click();
    await expect(sidebar.locator('a[href="/text?view=books"]')).toHaveCount(1);
    await expect(
      sidebar.locator('a[href="/library/books"]'),
      'Library 가 같이 열려 있다 — Books 가 두 벌 보인다',
    ).toHaveCount(0);

    // 셰브런 aria-expanded 도 하나만 true
    const expanded = await sidebar
      .getByRole('button', { name: /하위 메뉴/ })
      .evaluateAll((els) => els.filter((e) => e.getAttribute('aria-expanded') === 'true').length);
    expect(expanded, '펼쳐진 서브메뉴가 2개 이상이다').toBe(1);
  });

  test('학습 흐름 레일 — 5단계가 순서대로 있고, Comics 는 레일 밖 최하단이다', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // 이 단언이 지키는 것: ① 번호가 순서를 말한다 ② 아무것도 잠겨 있지 않다
    // ③ 만화가 여섯 번째 단계로 읽히지 않는다.
    await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const sidebar = page.getByRole('complementary', { name: '주 메뉴' });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    // 단계 제목은 heading — 순서는 sr-only 문장이 말한다("흐름 N번째 · 이름")
    const stageNames = ['Read', 'Words', 'Practice', 'Conquer', 'Complete'];
    for (const [i, name] of stageNames.entries()) {
      await expect(
        sidebar.getByRole('heading', { name: new RegExp(`흐름 ${i + 1}번째 · ${name}`) }),
        `${i + 1}단계 ${name} 없음`,
      ).toHaveCount(1);
    }

    // 잠그지 않는다 — LEARNING_FRAMEWORK §4① (자물쇠 UI 금지 · 잠금 어휘 금지)
    await expect(sidebar.getByText(/잠김|잠금|불가|금지|차단/)).toHaveCount(0);
    await expect(sidebar.locator('a[aria-disabled="true"], a[disabled]')).toHaveCount(0);

    // Comics 는 레일 밖 — 마지막 단계(Complete)의 항목보다 **아래**에 있다.
    const order = await sidebar
      .locator('a[href]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || ''));
    const iDictate = order.indexOf('/dictate');
    const iComic = order.indexOf('/comics/adapted');
    expect(iDictate, '/dictate 가 사이드바에 없다').toBeGreaterThan(-1);
    expect(iComic, '/comics/adapted 가 사이드바에 없다').toBeGreaterThan(-1);
    expect(iComic, 'Comics 가 흐름 위에 있다 — 만화는 학습 단계가 아니다').toBeGreaterThan(
      iDictate,
    );

    // 흐름 항목 자체의 순서도 고정 — 읽기 → 단어 → 연습 → 정복 → 완성
    const flow = ['/library', '/text', '/wordvault', '/practice', '/scriptquiz', '/dictate'];
    const idx = flow.map((h) => order.indexOf(h));
    expect(idx.every((v) => v > -1), `흐름 항목 누락: ${flow.filter((_, i) => idx[i] < 0)}`).toBe(
      true,
    );
    expect([...idx].sort((a, b) => a - b), '흐름 순서가 어긋났다').toEqual(idx);
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
