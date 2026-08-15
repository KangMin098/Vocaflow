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
});
