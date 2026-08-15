// apps/web/tests/e2e/23-dictate-resume.spec.ts
//
// `/dictate/session?sessionId=…` 를 **URL 로 직접 열었을 때** 무엇이 보이는가.
//
// 왜 이 스펙이 필요한가 (사용자 신고 2026-08-15):
//   실제 사용자가 `/dictate/session?sessionId=17b3f91f-…` 에서 "아무 반응 없음" 을 겪었다.
//   그 세션은 DB 에 있고(source_kind='daily') 시도는 0건이었다.
//   구조상 **문항 목록은 시작한 기기의 localStorage 에만** 있고 DB 에는 없다 —
//   다른 브라우저·시크릿창·캐시 정리 후에는 복원할 방법이 없다.
//   화면이 그 사실을 말해 주지 않으면 학습자는 멈춘 화면 앞에서 이유를 알 수 없다.
//
// 무엇을 고정하나:
//   ① 캐시에 없는 sessionId → **막다른 화면이 아니라** 설명 + 앞으로 가는 길
//   ② sessionId 자체가 없는 경우도 같다
//   ③ 어떤 경우에도 "불러오는 중…" 에서 멈추지 않는다 (탈출구 없는 로딩 금지)

import { expect, test } from '@playwright/test';

import { loginAsTestUser } from './utils/auth';
import { deleteDictationSince, userIdByEmail } from './utils/db';
import { TEST_USER } from './fixtures/test-user';

/** DB 에 존재하지만 이 브라우저 캐시에는 없는 세션 (실제 신고 건) */
const REPORTED_SESSION = '17b3f91f-b6b1-444e-ac79-e29cbfa94e61';
/** 아예 존재하지 않는 세션 */
const GHOST_SESSION = '00000000-0000-4000-8000-000000000000';

async function assertNotStuck(page: import('@playwright/test').Page) {
  // 로딩 문구가 **최종 상태**로 남아 있으면 안 된다 — 그게 신고된 증상이다
  const stuck = page.getByText(/^세션을 불러오는 중|^불러오는 중/);
  await expect(stuck).toHaveCount(0, { timeout: 15_000 });
}

/** 로그인은 파일당 1회 — 테스트마다 하면 auth rate-limit 에 걸려 엉뚱하게 실패한다. */
const STATE_PATH = 'playwright-auth/.auth-dictate-resume.json';

test.describe('받아쓰기 세션 URL 직접 열기', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginAsTestUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('A. DB 에 있지만 이 기기 캐시엔 없는 세션 — 설명과 다음 길이 있다', async ({ page }) => {
    await page.goto(`/dictate/session?sessionId=${REPORTED_SESSION}`);

    await assertNotStuck(page);
    // 앞으로 가는 길이 최소 하나 (버튼이든 링크든)
    const actions = page.getByRole('button').or(page.getByRole('link'));
    expect(await actions.count()).toBeGreaterThan(0);
  });

  test('B. 존재하지 않는 세션도 같은 취급', async ({ page }) => {
    await page.goto(`/dictate/session?sessionId=${GHOST_SESSION}`);
    await assertNotStuck(page);
  });

  test('C. sessionId 없이 열어도 멈추지 않는다', async ({ page }) => {
    await page.goto('/dictate/session');
    await assertNotStuck(page);
  });

  /**
   * D. 신고의 본체 — **다른 브라우저에서 세션 URL 을 열면 이어서 풀 수 있는가.**
   *
   * 마이그레이션 20260815060000 이전에는 문항 목록이 시작한 기기의 localStorage 에만
   * 있어서 이 시나리오가 구조적으로 불가능했다. 캐시를 지운 새 컨텍스트로 그 상태를 만든다.
   */
  test('D. 캐시를 지운 새 컨텍스트에서 같은 세션을 이어서 푼다', async ({ browser }) => {
    const userId = await userIdByEmail(TEST_USER.email);
    const sinceIso = new Date(Date.now() - 5_000).toISOString();
    const starter = await browser.newContext({ storageState: STATE_PATH });
    const page = await starter.newPage();
    try {
      // 자료를 골라 세션을 **실제로** 시작한다.
      //
      // ⚠️ "오늘의 받아쓰기" 로 시작하지 않는다 — 재료가 없으면 early return 이 되고
      //    그러면 이 테스트는 **아무것도 검증하지 않은 채 초록**이 된다(첫 구현이 그랬다:
      //    3.9초 만에 통과했고 DB 에는 세션이 하나도 안 생겼다).
      //    담아 둔 자료는 항상 있으므로 그쪽에서 시작한다.
      await page.goto('/dictate/setup');
      const tabs = page.getByRole('tablist', { name: '받아쓸 자료 종류' }).getByRole('tab');
      await expect(tabs.first()).toBeVisible({ timeout: 20_000 });

      let opened = false;
      for (let i = 0; i < (await tabs.count()); i += 1) {
        await tabs.nth(i).click();
        const row = page.locator('main').last().locator('a[href*="/dictate/setup?"]').first();
        if (await row.isVisible().catch(() => false)) {
          await row.click();
          opened = true;
          break;
        }
      }
      expect(opened, '받아쓸 자료가 하나도 없다 — 검증 계정 자산을 확인하라').toBe(true);

      await page.getByRole('button', { name: /시작하기/ }).click({ timeout: 30_000 });
      await page.waitForURL(/\/dictate\/session\?sessionId=/, { timeout: 30_000 });
      const url = page.url();
      const sessionId = new URL(url).searchParams.get('sessionId');
      expect(sessionId, '세션 id 가 URL 에 없다').toBeTruthy();
      // 로컬 전용 세션(비로그인)이면 복원 대상이 아니다
      test.skip(!!sessionId?.startsWith('local-'), '비로그인 로컬 세션');

      // 첫 문항이 실제로 떴는지 — 여기가 신고된 "아무 반응 없음" 지점이다
      await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 20_000 });

      // ── 캐시가 없는 새 컨텍스트에서 같은 URL ──
      const fresh = await browser.newContext({ storageState: STATE_PATH });
      const other = await fresh.newPage();
      try {
        await other.goto(url);
        await assertNotStuck(other);
        // 문항이 떠야 한다. 못 찾음 화면이면 DB 복원이 끊긴 것이다.
        await expect(
          other.getByText('진행 중이던 받아쓰기를 못 찾았어요'),
          'DB 복원이 안 됐다 — 문항이 캐시에만 있다',
        ).toHaveCount(0);
        await expect(other.getByRole('textbox').first()).toBeVisible({ timeout: 20_000 });
      } finally {
        await fresh.close();
      }
    } finally {
      await starter.close();
      // 테스트가 만든 세션은 되돌린다 — 남기면 허브 "이어하기" 와 오늘의 받아쓰기
      // 문장 제외 집합이 다음 실행에서 달라진다.
      if (userId) await deleteDictationSince(userId, sinceIso);
    }
  });

  /**
   * E. 키보드로 이 화면을 쓸 수 있는가.
   *
   * 눈으로는 절대 안 보이는 결함이 여기 있었다 — `Tab` 이 "건너뛰기" 단축키여서
   *   ① 키보드 사용자는 **포커스를 옮길 수가 없었고**(2.1.1 · 2.1.2)
   *   ② 옮기려는 시도가 **문항을 건너뛰는 되돌릴 수 없는 조작**이었다.
   * 화면 어디에도 안내되지 않은 단축키였으므로 스크린샷으로도 리뷰로도 안 잡힌다.
   */
  test('E. Tab 이 포커스를 옮긴다 (문항을 건너뛰지 않는다)', async ({ browser }) => {
    const userId = await userIdByEmail(TEST_USER.email);
    const sinceIso = new Date(Date.now() - 5_000).toISOString();
    const ctx = await browser.newContext({ storageState: STATE_PATH });
    const page = await ctx.newPage();
    try {
      await page.goto('/dictate/setup');
      const tabs = page.getByRole('tablist', { name: '받아쓸 자료 종류' }).getByRole('tab');
      await expect(tabs.first()).toBeVisible({ timeout: 20_000 });
      let opened = false;
      for (let i = 0; i < (await tabs.count()); i += 1) {
        await tabs.nth(i).click();
        const row = page.locator('main').last().locator('a[href*="/dictate/setup?"]').first();
        if (await row.isVisible().catch(() => false)) {
          await row.click();
          opened = true;
          break;
        }
      }
      expect(opened, '받아쓸 자료가 없다').toBe(true);
      await page.getByRole('button', { name: /시작하기/ }).click({ timeout: 30_000 });
      await page.waitForURL(/\/dictate\/session\?sessionId=/, { timeout: 30_000 });

      const box = page.getByRole('textbox').first();
      await expect(box).toBeVisible({ timeout: 20_000 });

      // 첫 문항의 본문을 기준점으로 잡는다.
      //
      // ⚠️ 진행 표시(`문항 n/N`)로 재려던 첫 구현은 **옛 동작에서도 통과**했다 —
      //    정규식이 안 맞으면 `undefined === undefined` 라 단언이 공허해졌다.
      //    그래서 먼저 "잴 수 있는가" 를 단언하고, 그 다음에 값을 비교한다.
      const marker = page.locator('[data-testid="session-position"]');
      await expect(marker, '진행 표시를 못 찾는다 — 이 테스트는 아무것도 재지 못한다').toBeVisible({
        timeout: 20_000,
      });
      const before = (await marker.innerText()).trim();
      expect(before.length).toBeGreaterThan(0);

      // 입력창 밖으로 포커스를 옮긴 뒤 Tab — 여기가 예전에 건너뛰기였다
      const anchor = page.getByRole('button', { name: /다시 듣기|한 번만|재생/ }).first();
      await anchor.focus();
      const focusedBefore = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
      await page.keyboard.press('Tab');

      // ① 문항이 바뀌지 않았다 (Tab 이 건너뛰기가 아니다)
      expect(
        (await marker.innerText()).trim(),
        'Tab 이 문항을 건너뛰었다 — 키보드 내비게이션이 파괴적 조작이다',
      ).toBe(before);

      // ② 포커스가 **실제로 이동했다** (preventDefault 로 제자리에 묶이지 않는다)
      const focusedAfter = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
      expect(focusedAfter, 'Tab 을 눌러도 포커스가 그대로다 — 키보드로 화면을 돌 수 없다').not.toBe(
        focusedBefore,
      );
    } finally {
      await ctx.close();
      if (userId) await deleteDictationSince(userId, sinceIso);
    }
  });
});
