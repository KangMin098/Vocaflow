// apps/web/tests/e2e/13-comic-navigation.spec.ts
// 만화 화면 기본 조작 회귀 — 카탈로그 · 상세 · 리더 컨트롤 · 이탈/복귀 · 종료 CTA · Restored 탭.
//
// 리더는 일반 페이지와 다른 규칙이 둘 있어서 테스트도 그에 맞춰야 한다:
//   ① 컨트롤(크롬)은 3초 뒤 자동 숨김 — opacity 0 + pointer-events-none 으로만 숨기므로
//      Playwright 에는 "보이는데 클릭 불가(element is not stable)" 로 보인다.
//      → 컴퓨티드 opacity 로 판정하고 'm' 키(또는 focus)로 되살린 뒤 조작한다.
//   ② 모든 컷에 정본 대사가 있는 건 아니다(캡션만 있는 컷 존재) → 대사 단언은 조건부.
import { test, expect, type Page } from '@playwright/test';

import { getComicProgress, serviceClient, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-comic-nav.json';

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

/** 카탈로그 첫 카드의 도서 id (href 는 등록 상태에 따라 갈리므로 data-book-id 로 고정) */
async function firstBookId(page: Page): Promise<string | null> {
  await page.goto('/comics/adapted', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const card = page.locator('a[data-book-id]').first();
  if (!(await card.isVisible().catch(() => false))) return null;
  return card.getAttribute('data-book-id');
}

/** 상세 → 리더 진입 */
async function enterReader(page: Page, bookId: string) {
  await page.goto(`/comics/adapted/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page
    .getByRole('link', { name: /만화로 먼저/ })
    .or(page.getByRole('button', { name: /만화로 먼저/ }))
    .first()
    .click();
  await page.waitForURL(/\/text\/[0-9a-f-]{36}\/comic/, { timeout: 90_000 });
  await page.waitForTimeout(4_200); // 자동 숨김(3s)이 끝난 뒤부터 조작
}

/** 자동 숨김된 컨트롤을 되살린다 */
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

/** 현재 컷 번호 (1-based) */
async function panelNo(page: Page): Promise<number> {
  const t = await page
    .getByText(/컷 \d+ \/ \d+/)
    .first()
    .innerText()
    .catch(() => '');
  const m = t.match(/컷 (\d+) \//);
  return m ? Number(m[1]) : -1;
}

test.describe('만화 화면 기본 조작', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('상세 — 목록 복귀 · 단어장 연결 · 원문 카드 이동', async ({ page }) => {
    test.setTimeout(240_000);
    const bookId = await firstBookId(page);
    if (!bookId) {
      console.log('[comic-nav] 카탈로그 0 — 종료');
      return;
    }
    const detail = `/comics/adapted/${bookId}`;

    // 목록 복귀
    await page.goto(detail, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByRole('link', { name: /만화 목록/ }).first().click();
    await page.waitForURL(/\/comics\/adapted$/, { timeout: 30_000 });

    // 3종 체계 연결 — 이 책의 단어장
    await page.goto(detail, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByRole('link', { name: /이 책의 단어장 보기/ }).click();
    await page.waitForURL(/\/library\/books\/[0-9a-f-]{36}/, { timeout: 60_000 });

    // 포맷 선택 — 원문 카드는 워크스페이스로
    await page.goto(detail, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page
      .getByRole('link', { name: /원문으로 읽기/ })
      .or(page.getByRole('button', { name: /원문으로 읽기/ }))
      .first()
      .click();
    await page.waitForURL(/\/text\/[0-9a-f-]{36}/, { timeout: 90_000 });
  });

  test('리더 컨트롤 — 자동 숨김/복귀 · 컷 이동 · 뷰·몰입 토글 · stave 점프', async ({ page }) => {
    test.setTimeout(300_000);
    const bookId = await firstBookId(page);
    if (!bookId) return;
    await enterReader(page, bookId);

    // 자동 숨김이 실제로 일어난다(몰입) — 그리고 'm' 으로 되살아난다
    const hidden = await page
      .getByRole('button', { name: '다음 컷' })
      .evaluate((el) => getComputedStyle(el.closest('footer') as HTMLElement).opacity);
    expect(hidden, '3초 뒤 컨트롤이 숨어야 한다(몰입 설계)').toBe('0');
    await ensureChrome(page);

    // 숨은 컨트롤은 focus 로도 되살아나야 한다 — 키보드 사용자가 갇히지 않는 장치
    await page.keyboard.press('m'); // 다시 숨김
    await page.waitForTimeout(600);
    await page
      .getByRole('button', { name: '다음 컷' })
      .evaluate((el) => (el as HTMLElement).focus());
    await page.waitForTimeout(600);
    const afterFocus = await page
      .getByRole('button', { name: '다음 컷' })
      .evaluate((el) => getComputedStyle(el.closest('footer') as HTMLElement).opacity);
    expect(afterFocus, 'focus 시 컨트롤이 다시 보여야 한다').toBe('1');

    // 다음/이전 컷
    const p0 = await panelNo(page);
    await page.getByRole('button', { name: '다음 컷' }).click();
    await expect
      .poll(() => panelNo(page), { timeout: 10_000 })
      .toBe(p0 + 1);
    await ensureChrome(page);
    await page.getByRole('button', { name: '이전 컷' }).click();
    await expect
      .poll(() => panelNo(page), { timeout: 10_000 })
      .toBe(p0);

    // ⚠️ 회귀 고정 — 버튼을 마우스로 누른 뒤에도 화살표 넘김이 살아 있어야 한다.
    //    이전 구현은 "컨트롤에 포커스가 있으면 단축키 양보" 라서 버튼 클릭 후 화살표가 죽었다.
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => panelNo(page), { timeout: 10_000 })
      .toBe(p0 + 1);
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(() => panelNo(page), { timeout: 10_000 })
      .toBe(p0);

    // 뷰 전환(페이지 넘김 ↔ 세로 스크롤)
    await ensureChrome(page);
    const viewBtn = page.getByRole('button', { name: /세로 스크롤 모드로|페이지 넘김 모드로/ });
    const label0 = await viewBtn.getAttribute('aria-label');
    await viewBtn.click();
    await expect
      .poll(
        () =>
          page
            .getByRole('button', { name: /세로 스크롤 모드로|페이지 넘김 모드로/ })
            .getAttribute('aria-label'),
        { timeout: 10_000 },
      )
      .not.toBe(label0);
    await page.getByRole('button', { name: /세로 스크롤 모드로|페이지 넘김 모드로/ }).click();
    await page.waitForTimeout(700);

    // 몰입(dim) 토글 — aria-pressed 로 상태 전달(색만으로 알리지 않는다)
    await ensureChrome(page);
    const dim = page.getByRole('button', { name: /어두운\(몰입\) 모드로|밝은 모드로/ });
    const pressed0 = await dim.getAttribute('aria-pressed');
    await dim.click();
    await expect
      .poll(
        () =>
          page
            .getByRole('button', { name: /어두운\(몰입\) 모드로|밝은 모드로/ })
            .getAttribute('aria-pressed'),
        { timeout: 10_000 },
      )
      .not.toBe(pressed0);
    await page.getByRole('button', { name: /어두운\(몰입\) 모드로|밝은 모드로/ }).click();

    // stave 레일 점프 — 다음 stave 첫 컷으로
    await ensureChrome(page);
    const staves = page.getByRole('button', { name: /컷, (읽음|현재|남음)$/ });
    const staveCount = await staves.count();
    expect(staveCount, 'stave 레일이 없다').toBeGreaterThan(1);
    const before = await panelNo(page);
    await staves.nth(1).click();
    await expect.poll(() => panelNo(page), { timeout: 15_000 }).toBeGreaterThan(before);
  });

  test('리더 이탈 — 본문 복귀 후 뒤로가기로 리더 복귀', async ({ page }) => {
    test.setTimeout(240_000);
    const bookId = await firstBookId(page);
    if (!bookId) return;
    await enterReader(page, bookId);

    await ensureChrome(page);
    await page.getByRole('link', { name: /본문/ }).first().click();
    await page.waitForURL(/\/text\/[0-9a-f-]{36}(\?|$)/, { timeout: 60_000 });
    expect(page.url()).not.toContain('/comic');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/text\/[0-9a-f-]{36}\/comic/, { timeout: 30_000 });
  });

  test('마지막 컷 — 종료 화면과 유입 CTA(본문·퀴즈)', async ({ page }) => {
    test.setTimeout(240_000);
    const bookId = await firstBookId(page);
    if (!bookId) return;

    const userId = await userIdByEmail(RUNTIME_USER.email);
    const client = serviceClient();
    if (!userId || !client) {
      console.log('[comic-nav] SERVICE_ROLE 키 없음 — 종료 화면 검증 생략');
      return;
    }
    const before = await getComicProgress(userId, bookId);
    const total = before?.panelsTotal ?? 0;
    if (!before || total <= 0) {
      console.log('[comic-nav] 진도 없음 — 종료 화면 검증 생략');
      return;
    }

    try {
      // 마지막 컷 다음(=종료 화면) 위치로 진도를 옮긴 뒤 리더 진입
      await client
        .from('comic_read_progress')
        .update({ last_index: total })
        .eq('user_id', userId)
        .eq('library_book_id', bookId);

      await enterReader(page, bookId);
      await expect(page.getByText('여기까지 잘 읽었어요')).toBeVisible({ timeout: 20_000 });
      // 폭죽/트로피 대신 다음 단계로 — 만화는 종착지가 아니다(설계서 R5)
      await expect(page.getByRole('link', { name: /본문 읽기/ })).toBeVisible();
      await page.getByRole('link', { name: /퀴즈로 확인/ }).click();
      await page.waitForURL(/\/scriptquiz/, { timeout: 60_000 });
    } finally {
      await client
        .from('comic_read_progress')
        .update({ last_index: before.lastIndex })
        .eq('user_id', userId)
        .eq('library_book_id', bookId);
    }
  });

  test('Restored 탭 — 서가가 열리고, 호가 있으면 리더 왕복이 된다', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/comics/restored', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('tablist', { name: '만화 탭' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/페이지를 찾을 수 없어요|problem occurred/i)).toHaveCount(0);

    const issue = page.locator('a[href^="/comics/restored/"]').first();
    if (!(await issue.isVisible().catch(() => false))) {
      console.log('[comic-nav] 복원 만화 0편 — 서가 렌더까지만 검증');
      return;
    }
    const href = await issue.getAttribute('href');
    await issue.click();
    await page.waitForURL(new RegExp(href!.replace(/\//g, '\\/')), { timeout: 60_000 });
    await page.getByRole('link', { name: /복원 만화|서가|목록/ }).first().click();
    await page.waitForURL(/\/comics\/restored$/, { timeout: 30_000 });
  });
});
