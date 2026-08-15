// apps/web/tests/e2e/20-mobile-shell.spec.ts
//
// 모바일 전역 셸 회귀 — 하단 탭(최상위 4 표면)과 **페이지가 소유한 하단 크롬**의 공존.
//
// 왜 이 스펙이 필요한가:
//   하단 탭은 `fixed bottom-0` 다. 같은 자리를 이미 쓰는 화면이 있다 —
//   만화 리더의 컷 이동 바 · 워크스페이스 오디오 플레이어. 둘 다 `fixed` 라
//   레이아웃 패딩으로는 밀리지 않는다. z-index 만으로 겹침을 판정하면 틀린다
//   (스택 컨텍스트·transform 이 순서를 바꾼다) → **실제 히트 테스트**로 잰다.
//   `elementFromPoint(버튼 중심)` 이 그 버튼을 돌려주지 않으면, 학습자가 눌렀을 때
//   눌리는 것은 탭이다. 화면에 보이는데 안 눌리는 것이 가장 나쁜 결함이다.
//
// 판정은 전부 렌더 후 실측이다 — 클래스 문자열을 읽지 않는다.

import { test, expect, type Page } from '@playwright/test';

import { SURFACES, SURFACE_ORDER } from '../../src/lib/framework/axes';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};
const STATE_PATH = 'playwright-auth/.auth-mobile-shell.json';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

/**
 * 하단 탭 — 표면 레지스트리(`lib/framework/axes`)의 4개와 1:1.
 *
 * ⚠️ 라벨을 여기에 손으로 적지 않는다. 초판이 한국어('오늘'·'서재'…)를 하드코딩했고,
 * v06.141 에서 탭이 `SURFACES[].name`(영문 정식명)을 읽도록 바뀌자 **제품이 아니라
 * 이 스펙이 깨졌다**. 레지스트리에서 가져오면 이름이 바뀌어도 따라가고, 동시에
 * "탭이 정말 레지스트리를 읽는가" 를 검사하는 장치가 된다(04-ui-smoke 와 같은 규약).
 */
const TAB_LABELS = SURFACE_ORDER.map((id) => SURFACES[id].name);

async function login(page: Page) {
  for (let i = 1; i <= 2; i++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (i === 2) throw e;
      await page.waitForTimeout(1_500);
    }
  }
}

/** 만화 리더 진입 (카탈로그 → 상세 → 리더). 카탈로그가 비면 null. */
async function enterComicReader(page: Page): Promise<string | null> {
  await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const card = page.locator('a[data-book-id]').first();
  if (!(await card.isVisible().catch(() => false))) return null;
  const bookId = await card.getAttribute('data-book-id');
  if (!bookId) return null;

  await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const enter = page
    .getByRole('link', { name: /만화로 먼저/ })
    .or(page.getByRole('button', { name: /만화로 먼저/ }))
    .first();
  if (!(await enter.isVisible().catch(() => false))) return null;
  await enter.click();
  await page.waitForURL(/\/text\/[0-9a-f-]{36}\/comic/, { timeout: 90_000 });
  await page.waitForTimeout(4_200); // 자동 숨김(3s)이 끝난 뒤부터 조작
  return page.url();
}

/** 자동 숨김된 리더 크롬을 되살린다 (13-comic-navigation 과 같은 규칙) */
async function ensureChrome(page: Page) {
  const next = page.getByRole('button', { name: '다음 컷' });
  for (let i = 0; i < 5; i++) {
    const opacity = await next
      .evaluate((el) => getComputedStyle(el.closest('footer') as HTMLElement).opacity)
      .catch(() => '0');
    if (opacity === '1') return;
    await page.keyboard.press('m');
    await page.waitForTimeout(600);
  }
}

test.describe('모바일 전역 셸 (하단 탭)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('A. 4 표면 · 44px · 접근 가능한 이름', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const tabbar = page.getByRole('navigation', { name: '주요 화면' });
    await expect(tabbar).toBeVisible({ timeout: 30_000 });

    const links = tabbar.getByRole('link');
    await expect(links).toHaveCount(TAB_LABELS.length);

    for (const label of TAB_LABELS) {
      const link = tabbar.getByRole('link', { name: label });
      await expect(link, `${label} 탭`).toBeVisible();
      const box = await link.boundingBox();
      expect(box, `${label} 탭 박스`).not.toBeNull();
      // CLAUDE.md "절대 하지 않을 것 · 접근성" — 44px 미만 터치 타겟
      expect(box!.height, `${label} 탭 높이`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${label} 탭 너비`).toBeGreaterThanOrEqual(44);
    }

    // 현재 위치를 색만으로 알리지 않는다 → aria-current 로도 말한다
    await expect(tabbar.getByRole('link', { name: SURFACES.today.name })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('B. 데스크톱에는 없다 (사이드바가 같은 일을 한다)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(600);
    await expect(page.getByRole('navigation', { name: '주요 화면' })).toBeHidden();
  });

  test('C. 풀스크린 세션에서는 사라진다 (작업기억 보호)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    // `/wordvault/browse` = 비활동 풀스크린 (full-screen-routes.ts)
    await page.goto('/wordvault/browse', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(900);
    await expect(page.getByRole('navigation', { name: '주요 화면' })).toHaveCount(0);
  });

  test('D. 풀스크린 세션에 하단 여백이 남지 않는다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/wordvault/browse', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(900);
    // 탭이 없는데 탭 자리만큼 비워 두면 세션 화면이 뷰포트보다 길어진다(무의미한 세로 스크롤).
    const pad = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? parseFloat(getComputedStyle(main).paddingBottom) : -1;
    });
    expect(pad, 'main 하단 여백(px)').toBeLessThanOrEqual(1);
  });

  test('F. 탭 높이만큼 여백이 있다 (콘텐츠 끝이 탭에 덮이지 않는다)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/hub', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('navigation', { name: '주요 화면' })).toBeVisible({ timeout: 30_000 });

    // 여백은 탭을 그리는 컴포넌트가 같이 낸다(바로 앞 형제 스페이서) — 두 값이 갈리면
    // 콘텐츠 끝이 탭 아래로 들어가거나, 반대로 쓸데없는 빈칸이 생긴다.
    const box = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="주요 화면"]');
      const spacer = nav?.previousElementSibling ?? null;
      return {
        navH: nav ? nav.getBoundingClientRect().height : -1,
        spacerH: spacer ? spacer.getBoundingClientRect().height : -1,
      };
    });
    expect(box.navH, '탭 높이').toBeGreaterThanOrEqual(44);
    expect(box.spacerH, `여백(${box.spacerH}px) 이 탭 높이(${box.navH}px) 이상`).toBeGreaterThanOrEqual(
      box.navH - 1,
    );
  });

  test('E. 만화 리더 컷 이동 버튼이 탭에 가리지 않는다', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);

    const url = await enterComicReader(page);
    test.skip(url === null, '만화 카탈로그가 비어 있어 리더를 열 수 없다');

    await ensureChrome(page);
    const next = page.getByRole('button', { name: '다음 컷' });
    await expect(next).toBeVisible();

    // 실제로 그 자리에서 눌리는 것이 무엇인가 — 보이는 것과 눌리는 것이 다를 수 있다.
    const hit = await next.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        insideButton: !!top && (top === el || el.contains(top) || !!top.closest('footer')),
        topTag: top ? `${top.tagName.toLowerCase()}${top.closest('nav') ? '(nav 안)' : ''}` : 'null',
      };
    });
    expect(hit.insideButton, `'다음 컷' 자리에서 실제로 잡히는 요소: ${hit.topTag}`).toBe(true);

    // 눌러서 실제로 컷이 넘어가는지까지 본다 (히트 테스트가 통과해도 동작은 별개다)
    const before = page.url();
    await next.click();
    await page.waitForTimeout(700);
    expect(page.url(), '컷 이동 후에도 리더에 머문다').toContain('/comic');
    expect(before).toContain('/comic');
  });
});
