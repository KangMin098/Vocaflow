// apps/web/tests/e2e/25-arcade-ranking.spec.ts
//
// Game Lab 랭킹 (v08.6) — /arcade/ranking.
//
// ── 이 스펙이 지키는 계약 ────────────────────────────────────────
// ① **표본을 숨기지 않는다.** 이 DB 의 게임 참가자는 2명이다. 그 상태에서 "1위 🏆" 를
//    성취처럼 그리면 학습자는 한 번 기뻐하고 두 번째부터 앱의 모든 수치를 의심한다.
//    참가자 수가 화면에 있어야 하고, 혼자인 게임에서는 순위 대신 개인 최고를 말해야 한다.
// ② **점수를 게임 사이로 합산하지 않는다.** 같은 "점수" 가 게임마다 다른 단위이고
//    (cascade 0~900 · pairflip 0~1460 · scriptquiz 0~40) 풀 크기에 비례한다.
//    화면이 그 사실을 설명하지 않으면 학습자는 합산 랭킹을 기대하고, 그 기대는 틀린 것이다.
// ③ **도달 가능하다.** 만들어 두고 링크를 걸지 않으면 주소를 아는 사람만 가는 화면이다
//    (브리핑이 허브 카드에만 있던 것과 정확히 같은 실수).
// ④ **남의 학습 이력이 새지 않는다.** `scores` RLS 는 자기 행뿐이고 순위는 SECURITY DEFINER
//    RPC 의 집계로만 나온다. 화면에 원본 행(플레이 일시 목록 · 도서명 등)이 있으면 안 된다.
//
// 비로그인은 게이트만 확인한다 — 순위는 로그인 표면이다(RPC 가 authenticated 전용).

import { test, expect } from '@playwright/test';

// 아케이드 스펙과 **같은 계정**을 쓴다. 기본 e2e 계정(lexicon-test)의 게임 기록은
// dictation 2건뿐이라 — 아케이드 게임이 아니다 — 이 스펙의 핵심 단언
// ("혼자인 게임에서 1위라고 말하지 않는다")이 통째로 skip 된다. 그건 통과가 아니라
// **검증 공백**이고, 실제로 한 번 그 상태로 초록을 봤다.
// runtime-test-0705 은 아케이드 기록 55건을 갖는다(09·13 스펙이 쓰는 계정).
const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-arcade-ranking.json';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(800); // 하이드레이션 — controlled input 리셋 방지
  await page.fill('input[type="email"]', RUNTIME_USER.email);
  await page.fill('input[type="password"]', RUNTIME_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(hub|wordvault|workspace|main|arcade)/, { timeout: 30_000 });
}

test.describe('랭킹 — 비로그인', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('로그인 안내로 degrade 한다 — 빈 순위표를 성취처럼 그리지 않는다', async ({ page }) => {
    await page.goto('/arcade/ranking', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '랭킹', level: 1 })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('.rkp-gate')).toContainText('로그인');
    // 내 랭크 블록은 아예 그리지 않는다(빈 통계 카드 3장은 정보가 아니라 소음이다).
    await expect(page.locator('.rkp-me')).toHaveCount(0);
  });

  test('점수 비교 범위를 화면이 먼저 설명한다', async ({ page }) => {
    await page.goto('/arcade/ranking', { waitUntil: 'domcontentloaded' });
    // "전부 더해 줄 세우면 큰 단어장을 고른 사람이 1등이 된다" 는 것이 이 설계의 근거다.
    await expect(page.locator('.rkp-sub')).toContainText('게임 안에서만');
  });
});

test.describe('랭킹 — 로그인', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('도달 경로 — Game Lab 목차에서 순위로 갈 수 있다', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href="/arcade/ranking"]').first();
    await expect(link).toBeVisible({ timeout: 60_000 });
    await link.click();
    await page.waitForURL(/\/arcade\/ranking/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '랭킹', level: 1 })).toBeVisible();
  });

  test('내 랭크 — 순위표마다 참가자 수가 함께 적힌다', async ({ page }) => {
    await page.goto('/arcade/ranking?period=all', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.rkp-me')).toBeVisible({ timeout: 60_000 });

    // 꼴찌가 최고 성적처럼 읽히면 안 된다. 2명 중 2위는 백분위 0 이고 이것을
    // "상위 100%" 로 옮기면 정확히 그 일이 벌어진다(실제로 만들었다가 잡았다).
    // 백분위는 표본이 충분할 때만 쓰므로 "상위 100%" 는 어떤 상태에서도 나올 수 없다.
    await expect(page.locator('.rkp-stats')).not.toContainText('상위 100%');

    // 순위표가 하나라도 그려졌으면 그 각각에 표본 고지가 있어야 한다.
    const boards = page.locator('section.rk');
    const n = await boards.count();
    expect(n, '게임별 순위 카드가 하나도 없다').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const note = boards.nth(i).locator('.rk-note, .rk-empty');
      await expect(note, `${i}번 순위표에 표본 고지가 없다`).toHaveCount(1);
      await expect(note).not.toHaveText('');
    }
  });

  test('혼자인 게임에서는 "1위" 가 아니라 개인 최고를 말한다', async ({ page }) => {
    await page.goto('/arcade/ranking?period=all', { waitUntil: 'domcontentloaded' });
    const rows = page.locator('.rkp-mine-line');
    const n = await rows.count();
    // skip 하지 않는다 — 이 계정이 아케이드 기록을 갖는 것이 픽스처의 전제다.
    // 비면 스펙은 초록으로 보이지만 아무것도 검증하지 않는다(실측으로 한 번 겪었다).
    expect(n, '내 랭크 줄이 없다 — 픽스처 계정의 아케이드 기록이 사라졌다').toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      const text = (await rows.nth(i).innerText()).trim();
      if (/아직 나만 기록했어요/.test(text)) {
        // 혼자인 줄에는 순위 표현이 없어야 한다.
        expect(text, `혼자인데 순위를 말한다: ${text}`).not.toMatch(/\d+위/);
        expect(text).toMatch(/내 최고/);
      } else {
        // 여럿인 줄에는 반드시 분모(N명 중)가 있다 — "3위" 만으로는 성취를 판단할 수 없다.
        expect(text, `분모 없는 순위: ${text}`).toMatch(/명 중 \d+위/);
      }
    }
  });

  test('기간 전환이 주소로 남는다 (공유·북마크·뒤로가기)', async ({ page }) => {
    await page.goto('/arcade/ranking', { waitUntil: 'domcontentloaded' });
    // 기본은 이번 주 — 신규 학습자도 상위에 들 수 있는 창이 기본이어야 한다.
    await expect(page.locator('.rkp-period[data-active] .rkp-period-label')).toHaveText('이번 주');
    await page.locator('.rkp-period', { hasText: '전체' }).click();
    await page.waitForURL(/period=all/, { timeout: 30_000 });
    await expect(page.locator('.rkp-period[data-active] .rkp-period-label')).toHaveText('전체');
  });

  test('남의 학습 이력이 새지 않는다 — 순위표는 집계만 그린다', async ({ page }) => {
    await page.goto('/arcade/ranking?period=all', { waitUntil: 'domcontentloaded' });
    const board = page.locator('section.rk').first();
    await expect(board).toBeVisible({ timeout: 60_000 });

    // 내 행이 아닌 줄에 이메일·uuid 가 있으면 RPC 가 집계를 넘어선 것이다.
    const html = await board.innerHTML();
    expect(html, '순위표에 이메일이 보인다').not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(html, '순위표에 uuid 가 보인다').not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  test('44px 터치 타겟 · 제목 계층 h1 → h2 → h3', async ({ page }) => {
    await page.goto('/arcade/ranking?period=all', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThan(0);

    const chip = page.locator('.rkp-period').first();
    const box = await chip.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('가로 스크롤 0 — 390 / 768 / 1280', async ({ page }) => {
    for (const w of [390, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/arcade/ranking?period=all', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: '랭킹', level: 1 })).toBeVisible({
        timeout: 30_000,
      });
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, `${w}px 에서 가로 스크롤 ${over}px`).toBeLessThanOrEqual(1);
    }
  });
});
