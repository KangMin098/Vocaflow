// apps/web/tests/e2e/14-learner-quality.spec.ts
// 학습자 화면 품질 게이트 — 접근성(axe) · 터치 타겟 · 양 테마.
//
// 왜 상시로 두는가: 대비/터치 규칙은 "한 번 고치면 끝"이 아니라 화면을 더할 때마다 다시 깨진다.
// 이 스펙이 회귀 방어선이다 — 새 학습자 화면을 추가하면 SCREENS 에 한 줄 더한다.
//
// 판정 기준(왜 이 값인가):
//   · axe: WCAG 2.1 A/AA 태그, **main 안(학습자 콘텐츠)만** 검사한다. 사이드바 등 전역 크롬은
//     별도 소유라 여기서 실패시키면 남의 변경으로 이 스펙이 빨개진다.
//   · 라이트/다크 둘 다 — 다크에서만 깨지는 대비가 실제로 있었다(2026-08-09: 완독 배지 2.98:1).
//   · 터치 타겟 44px — CLAUDE.md "절대 하지 않을 것" 항목.
//
// 2026-08-09 이 게이트를 세우며 실제로 잡은 것:
//   토큰 원색을 작은 글자로 쓰면 AA 미달 → 면(tint/원색)과 글자(*-ink)를 분리하는 규칙을 세움
//   (--active-ink · --ios-*-ink · --learn-*-ink). Capsule/i+1 배지/탭/카드가 전부 여기 걸렸다.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-quality-user.json';

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

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('vocaflow-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(400);
}

async function axeViolations(page: Page) {
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('main')
    .analyze();
  return res.violations.map(
    (v) =>
      `${v.impact}/${v.id} ×${v.nodes.length} :: ${(v.nodes[0]?.failureSummary || v.help)
        .replace(/\s+/g, ' ')
        .slice(0, 120)}`,
  );
}

/** main 안에서 44px 미만인 인터랙티브 요소 (숨김 요소는 제외) */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const root = document.querySelector('main') ?? document.body;
    for (const el of Array.from(
      root.querySelectorAll('a,button,input,select,[role="tab"],[role="switch"]'),
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (r.height < 44) {
        out.push(
          `${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} "${(
            el.getAttribute('aria-label') ||
            el.textContent ||
            ''
          )
            .trim()
            .slice(0, 30)}"`,
        );
      }
    }
    return out;
  });
}

test.describe('학습자 화면 품질 게이트', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('만화 화면 — 접근성 위반 0 (라이트/다크)', async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const bookId = await page
      .locator('a[data-book-id]')
      .first()
      .getAttribute('data-book-id')
      .catch(() => null);

    const screens: Array<[string, string]> = [
      ['만화 카탈로그', '/comics/adapted'],
      ['복원 서가', '/comics/restored'],
    ];
    if (bookId) screens.push(['만화 상세', `/comics/adapted/${bookId}`]);

    for (const [name, path] of screens) {
      for (const theme of ['light', 'dark'] as const) {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await setTheme(page, theme);
        await page.waitForTimeout(700);
        const violations = await axeViolations(page);
        expect(violations, `${name}/${theme}`).toEqual([]);
      }
    }
  });

  test('도서 목록 — 접근성 위반 0 (라이트/다크)', async ({ page }) => {
    test.setTimeout(240_000);
    for (const theme of ['light', 'dark'] as const) {
      await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await setTheme(page, theme);
      await page.waitForTimeout(900);
      const violations = await axeViolations(page);
      expect(violations, `도서목록/${theme}`).toEqual([]);
    }
  });

  test('만화 리더 — 접근성 위반 0 (라이트/다크)', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const bookId = await page
      .locator('a[data-book-id]')
      .first()
      .getAttribute('data-book-id')
      .catch(() => null);
    if (!bookId) {
      console.log('[quality] 발행 만화 0 — 리더 검사 생략');
      return;
    }
    await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page
      .getByRole('link', { name: /만화로 먼저/ })
      .or(page.getByRole('button', { name: /만화로 먼저/ }))
      .first()
      .click();
    await page.waitForURL(/\/text\/[0-9a-f-]{36}\/comic/, { timeout: 90_000 });
    await page.waitForTimeout(4_200); // 컨트롤 자동 숨김 이후
    await page.keyboard.press('m'); // 컨트롤 노출 상태로 검사
    await page.waitForTimeout(600);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      await page.waitForTimeout(600);
      const violations = await axeViolations(page);
      expect(violations, `리더/${theme}`).toEqual([]);
    }
  });

  // 4회차(2026-08-09)에 **학습자 화면 전체**가 위반 0 이 됐다 — 전부 게이트에 넣는다.
  //   새 학습자 화면을 만들면 이 배열에 한 줄 추가하는 것이 이 루프의 유지 방식이다.
  //   (어드민·아케이드 게임 내부는 자체 팔레트라 이 게이트의 대상이 아니다.)
  test('메타·연습·자산 화면 — 접근성 위반 0 (라이트/다크)', async ({ page }) => {
    test.setTimeout(900_000);
    for (const path of [
      '/hub',
      '/dashboard',
      '/dictate',
      '/arcade',
      '/wordvault',
      '/flashcard',
      '/scriptquiz',
      '/plan',
      '/settings',
      '/library/scripts',
      '/library/vocab',
    ]) {
      for (const theme of ['light', 'dark'] as const) {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await setTheme(page, theme);
        await page.waitForTimeout(900);
        const violations = await axeViolations(page);
        expect(violations, `${path}/${theme}`).toEqual([]);
      }
    }
  });

  test('터치 타겟 — 학습자 콘텐츠 안에서 44px 미만 0', async ({ page }) => {
    test.setTimeout(240_000);
    for (const path of ['/comics/adapted', '/library/books', '/comics/restored']) {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(900);
      const small = await smallTargets(page);
      expect(small, `${path} 44px 미만`).toEqual([]);
    }
  });
});
