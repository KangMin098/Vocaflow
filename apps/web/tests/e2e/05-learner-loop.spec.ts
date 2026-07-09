// apps/web/tests/e2e/05-learner-loop.spec.ts
// 핵심 학습 루프 회귀 — "게임 완주 → DB 영속화"를 UI 구동 + service-role 단언으로 보장.
// 배경: ScriptQuiz 완주 결과가 sessionStorage 에만 쌓이고 소비자가 없어 scores 적재가
//       조용히 증발했던 결함(v06.139)이 재발하지 못하도록 고정한다.
//   흐름: 로그인 → /scriptquiz/play 직행(Drone Ch1·4문항) → 시작 → 키보드 '1'×4 →
//         완주 화면 → scores(module='scriptquiz') 신규 행을 service-role 로 확인.
import { test, expect, type Page } from '@playwright/test';

import { countScoresSince, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

// 가장 짧은 published 챕터 퀴즈 — "Tell Me, What is a Drone?" Ch1 (4문항, V3)
const DRONE_BOOK_ID = '6e8b3442-1404-4172-865b-3dcd6c5848d9';
const PLAY_URL = `/scriptquiz/play?book=${DRONE_BOOK_ID}&ch=1`;
const EXPECTED_Q = 4;

async function loginRuntimeUser(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', RUNTIME_USER.email);
  await page.fill('input[type="password"]', RUNTIME_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('핵심 학습 루프 — 완주 영속화', () => {
  test('ScriptQuiz 완주 시 scores 행이 적재된다', async ({ page }) => {
    test.setTimeout(90_000); // 로그인 + 4문항 진행(각 1.1s) + DB 폴링(최대 10s) 여유
    const userId = await userIdByEmail(RUNTIME_USER.email);
    // service-role 키가 없는 환경(CI 시크릿 미주입 등)에서는 DB 단언을 건너뛰되 UI 완주는 검증.
    const dbAvailable = userId !== null;
    const sinceIso = new Date().toISOString();

    await loginRuntimeUser(page);

    // 직행 — 서버가 fetchChapterQuizSession 로 실 세션 로드
    await page.goto(PLAY_URL, { waitUntil: 'domcontentloaded' });

    // 시작 게이트 — 하이드레이션 전 클릭은 무시되므로 문항 전이 확인 후 재시도.
    // 문항 화면 마커 = 문제 유형 배지(4지선다/OX). 옵션은 타입별 마크업이 달라(4지선다 plain button /
    // OX role=radio) 배지로 감지가 안전.
    const startBtn = page.getByRole('button', { name: /시작하기/ });
    await startBtn.waitFor({ state: 'visible', timeout: 30_000 });
    const onQuestion = page.getByText(/4지선다|OX/).first();
    await startBtn.click();
    if (!(await onQuestion.isVisible().catch(() => false))) {
      try {
        await onQuestion.waitFor({ state: 'visible', timeout: 4_000 });
      } catch {
        if (await startBtn.isVisible().catch(() => false)) await startBtn.click();
        await onQuestion.waitFor({ state: 'visible', timeout: 10_000 });
      }
    }

    // 문항 진행 — 키보드 '1'(옵션 index 0, 양 타입 공통 handleAnswer) → 800ms O/X 오버레이 → 자동 진행.
    // window keydown 리스너라 포커스 비의존. 마지막 답 후 완주 전이. 완주 시 즉시 종료.
    const completion = page.getByText('오늘 잘 마쳤어요');
    for (let i = 0; i < EXPECTED_Q + 1; i++) {
      if (await completion.isVisible().catch(() => false)) break;
      await page.keyboard.press('1');
      await page.waitForTimeout(1100); // FEEDBACK_DURATION(800) + 렌더 여유
    }

    // 완주 화면 ("오늘 잘 마쳤어요" = result 스크린 도달 = 완주 확정)
    await expect(completion).toBeVisible({ timeout: 15_000 });

    if (!dbAvailable) {
      test.info().annotations.push({
        type: 'skip-db',
        description: 'SUPABASE_SERVICE_ROLE_KEY 미주입 — UI 완주만 검증(영속화 단언 생략)',
      });
      return;
    }

    // recordGameScore 는 fire-and-forget — 최대 ~10s 폴링
    let count = 0;
    for (let i = 0; i < 20; i++) {
      count = await countScoresSince(userId!, 'scriptquiz', sinceIso);
      if (count >= 1) break;
      await page.waitForTimeout(500);
    }
    expect(count, 'scriptquiz 완주 후 scores 행이 적재되어야 함').toBeGreaterThanOrEqual(1);
  });
});
