// apps/web/tests/e2e/21-textbook-practice.spec.ts
//
// **교재 문항을 실제로 풀어서 관측이 쌓이는지** — 화면 구동 + service-role 단언.
//
// ── 무엇을 막는 회귀인가 ─────────────────────────────────────────────
// `csat_item_attempts` 는 오래 0행이었다. 두 가지가 겹쳐 있었다:
//   ① 교재 서가에 **풀 자리가 없었다** — 재고만 보여 주고 `/hub` 로 돌려보냈다.
//   ② 풀 자리를 만든 뒤에도 **채점이 100% 실패했다** — `grade_dcp_item` 이 `question_id`
//      (FK→`quiz_questions`)에 `csat_dcp_items.id` 를 넣어 모든 INSERT 가 23503 으로 죽었다.
//      그 예외를 `gradeDcpItem` 이 `{correct:false}` 로 바꾸므로 **화면은 멀쩡했다** —
//      정답을 맞혀도 "아쉬워요" 가 떴을 뿐이다.
//
// 그래서 이 스펙은 **화면이 떴다** 를 보지 않는다. 문항을 실제로 제출하고,
// service-role 로 **행이 생겼는지 센다.** RPC 단위 통합 테스트
// (`dcp-grade-records.integration`)와 겹쳐 보이지만 덮는 구간이 다르다 —
// 그쪽은 DB 계약, 이쪽은 **RPC 부터 렌더·클릭·서버 액션까지 이어진 배선**이다.
// 이 저장소는 "DB 는 되는데 화면에서 안 눌리는" 결함을 여러 번 겪었다.
//
// ⚠️ 만든 응답은 finally 에서 지운다. 남기면 ① `derive_learner_stage` 가 흔들리고
//    ② `textbook_practice_items` 가 "이미 푼 문항" 을 빼므로 다음 실행이 볼 문항이 준다.

import { test, expect, type Page } from '@playwright/test';

import { countDcpAttemptsSince, deleteDcpAttemptsSince, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/** 사다리 3단 = V3. 실측상 순서·삽입 405 + 선택지 143 이라 두 갈래가 모두 나온다. */
const STEP = 3;
const PRACTICE_URL = `/library/textbooks/${STEP}/practice`;

// 로그인 상태는 `playwright-auth/` 에 둔다 — `test-results/` 는 실행 시작 때 통째로 지워지므로
// 동시 세션이 있으면 남의 실행이 이 파일의 로그인 상태를 지운다(2026-08-15 실측).
const STATE_PATH = 'playwright-auth/.auth-textbook-practice.json';

async function loginRuntimeUser(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  const email = page.locator('input[type="email"]');
  await email.waitFor({ state: 'visible' });
  await page.waitForTimeout(1000); // 하이드레이션 — controlled input 리셋 방지
  for (let i = 0; i < 3; i++) {
    await email.fill(RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    if ((await email.inputValue()) === RUNTIME_USER.email) break;
    await page.waitForTimeout(500);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('교재 연습 — 풀면 관측이 쌓인다', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });

  test.use({ storageState: STATE_PATH });

  test('계단 화면에서 연습으로 들어가 문항을 제출하면 attempt 가 생긴다', async ({ page }) => {
    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'SERVICE_ROLE_KEY 가 없어 DB 단언을 못 한다');
    const since = new Date(Date.now() - 5_000).toISOString();

    try {
      // ① 계단 화면에 **풀러 가는 문**이 실제로 있는지. 없던 것이 이 결함의 시작이었다.
      await page.goto(`/library/textbooks/${STEP}`, { waitUntil: 'networkidle' });
      const practiceLink = page.getByRole('link', { name: /문항 풀어 보기/ });
      await expect(practiceLink, '계단 화면에 연습 링크가 없다 — 재고만 보여 주던 상태로 돌아갔다').toBeVisible();
      await practiceLink.click();
      await page.waitForURL((u) => u.pathname === PRACTICE_URL, { timeout: 20_000 });

      // ② 빈 상태가 아니어야 한다. "못 불러왔다" 와 "없다" 는 화면이 구별해서 말한다.
      const empty = page.getByText(/문항을 불러오지 못했어요|아직 연습 문항이 없어요/);
      await expect(empty, '문항이 하나도 안 나왔다 — RPC 허용 목록이나 파서를 확인할 것').toHaveCount(0);

      const session = page.getByRole('region', { name: '구문 연습' });
      await expect(session).toBeVisible({ timeout: 20_000 });

      // ③ **제출한다.** 유형에 따라 조작이 다르다 —
      //    선택지 9종은 라디오, 순서는 그대로 제출, 삽입은 자리를 먼저 고른다.
      const radios = page.getByRole('radio');
      const slots = page.getByRole('button', { name: /번째 위치에 삽입/ });
      if (await radios.count()) {
        await radios.first().click();
      } else if (await slots.count()) {
        await slots.first().click();
      }
      const submit = page.getByRole('button', { name: '제출' });
      await expect(submit).toBeEnabled();
      await submit.click();

      // ④ 채점 결과가 뜬다. **정답/오답 어느 쪽이든 상관없다** — 우리가 보는 것은 기록이다.
      await expect(page.getByText(/정확해요|아쉬워요/)).toBeVisible({ timeout: 20_000 });

      // ⑤ **행이 생겼는가.** 화면이 뭐라 하든 이것이 사실이다.
      let attempts = 0;
      for (let i = 0; i < 10 && attempts < 1; i++) {
        attempts = await countDcpAttemptsSince(userId!, since);
        if (attempts < 1) await page.waitForTimeout(500);
      }
      expect(
        attempts,
        'attempt 가 안 남았다 — grade_dcp_item 이 예외를 던지고 화면이 그것을 오답으로 표시하고 있다',
      ).toBeGreaterThanOrEqual(1);

      // ⑥ 다음 문항으로 넘어가는 길이 있어야 세션이 이어진다.
      await expect(page.getByRole('button', { name: /다음|마치기/ })).toBeVisible();
    } finally {
      if (userId) await deleteDcpAttemptsSince(userId, since);
    }
  });

  test('연습 화면은 정답을 브라우저로 내보내지 않는다', async ({ page }) => {
    // 문항 행에는 `answer_key` 가 함께 있다. RPC 가 그 열을 빼는 것이 유일한 방어라,
    // 방어가 풀리면 **정답이 페이지 소스에 그대로 실린다.** 그건 문항 재고 전체를 버리는 일이다.
    await page.goto(PRACTICE_URL, { waitUntil: 'networkidle' });
    const html = await page.content();
    for (const key of ['answer_key', 'rationale_ko', 'source_order']) {
      expect(html, `${key} 가 페이지에 실려 있다 — 정답이 새고 있다`).not.toContain(key);
    }
  });
});
