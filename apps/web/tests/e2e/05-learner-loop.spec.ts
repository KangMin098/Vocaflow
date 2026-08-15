// apps/web/tests/e2e/05-learner-loop.spec.ts
// 핵심 학습 루프 회귀 — "게임 완주 → DB 영속화"를 UI 구동 + service-role 단언으로 보장.
// 배경: ScriptQuiz 완주 결과가 sessionStorage 에만 쌓이고 소비자가 없어 scores 적재가
//       조용히 증발했던 결함(v06.139)이 재발하지 못하도록 고정한다.
//   흐름: 로그인 → /scriptquiz/play 직행(Drone Ch1·4문항) → 시작 → 키보드 '1'×4 →
//         완주 화면 → scores(module='scriptquiz') 신규 행을 service-role 로 확인.
import { test, expect, type Page } from '@playwright/test';

import {
  countDiagnosticSnapshotsSince,
  countScoresSince,
  latestScoreContent,
  resetDueCards,
  userIdByEmail,
} from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

// 가장 짧은 published 챕터 퀴즈 — "Tell Me, What is a Drone?" Ch1 (4문항, V3)
const DRONE_BOOK_ID = '6e8b3442-1404-4172-865b-3dcd6c5848d9';
const PLAY_URL = `/scriptquiz/play?book=${DRONE_BOOK_ID}&ch=1`;
const EXPECTED_Q = 4;

// 로그인은 파일당 1회(beforeAll) — 3중 로그인의 auth rate-limit·하이드레이션 플레이크 회피.
const STATE_PATH = 'playwright-auth/.auth-learner-loop.json';

async function loginRuntimeUser(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  const email = page.locator('input[type="email"]');
  await email.waitFor({ state: 'visible' });
  await page.waitForTimeout(1000); // 하이드레이션 — controlled input 리셋 방지
  // fill 이 하이드레이션 리렌더로 지워질 수 있어 값 확정까지 재시도
  for (let i = 0; i < 3; i++) {
    await email.fill(RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    if ((await email.inputValue()) === RUNTIME_USER.email) break;
    await page.waitForTimeout(500);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('핵심 학습 루프 — 완주 영속화', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('ScriptQuiz 완주 시 scores 행이 적재된다', async ({ page }) => {
    test.setTimeout(90_000); // 로그인 + 4문항 진행(각 1.1s) + DB 폴링(최대 10s) 여유
    const userId = await userIdByEmail(RUNTIME_USER.email);
    // service-role 키가 없는 환경(CI 시크릿 미주입 등)에서는 DB 단언을 건너뛰되 UI 완주는 검증.
    const dbAvailable = userId !== null;
    const sinceIso = new Date().toISOString();

    // 직행 — 서버가 fetchChapterQuizSession 로 실 세션 로드 (세션은 storageState)
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

    // 이 경로는 **큐레이션 도서 챕터**(enroll 없음 → texts.id 없음)라 예전에는 콘텐츠를
    // 남길 자리가 없어 "어떤 도서를 학습했나" 를 어떤 쿼리로도 답할 수 없었다.
    // content_ref 가 그것을 받는다 — 조용히 되돌아가면 콘텐츠 진행률·리포트가 통째로 죽는다.
    const content = await latestScoreContent(userId!, 'scriptquiz', sinceIso);
    expect(content?.type, "큐레이션 챕터 완주는 'book' 으로 귀속되어야 함").toBe('book');
    expect(content?.id, '학습한 도서를 식별할 수 있어야 함').toBe(DRONE_BOOK_ID);
    expect(content?.chapter, '챕터 번호가 남아야 함').toBe(1);
  });

  test('Flashcard 완주 시 scores 행이 적재된다', async ({ page }) => {
    test.setTimeout(120_000); // 카드당 recall 3s × due 큐(≤10) + 폴링 여유
    const userId = await userIdByEmail(RUNTIME_USER.email);
    // flashcard 는 due 큐(SRS 상태)에 의존 — service-role 로 due 를 리셋해야 반복 가능.
    // 키가 없으면 due 를 보장할 수 없어 스킵(scriptquiz 는 정적 콘텐츠라 무관).
    test.skip(userId === null, 'SUPABASE_SERVICE_ROLE_KEY 미주입 — due 큐 리셋 불가');
    const resetN = await resetDueCards(userId!);
    expect(resetN, 'due 카드가 최소 1장 있어야 완주 가능').toBeGreaterThanOrEqual(1);
    const sinceIso = new Date().toISOString();

    // 파라미터 없는 진입 = 사용자 SRS due 큐 (fetchDueFlashcardWords)
    await page.goto('/flashcard/play', { waitUntil: 'domcontentloaded' });

    const completion = page.getByText('오늘의 학습이 완료됐어요');
    const firstJudgeYes = page.getByRole('button', { name: /떠올렸어요/ }); // FirstJudge → flipped
    const goodBtn = page.getByRole('button', { name: /기억나요/ }); // SRSBar good 평가

    // 카드별 결정론적 흐름: recall(3s 자동) → FirstJudge "떠올렸어요" 클릭(→flipped) →
    // SRSBar "기억나요" 클릭(→다음 카드). Space 타이밍 대신 버튼 출현 대기로 안정화.
    // due 큐 ≤10 + 여유 루프. 완주 시 즉시 종료.
    for (let card = 0; card < 16; card++) {
      if (await completion.isVisible().catch(() => false)) break;
      // recall 종료 후 FirstJudge 출현 대기 (미출현 = 완주 전이 or 지연)
      try {
        await firstJudgeYes.waitFor({ state: 'visible', timeout: 6_000 });
      } catch {
        if (await completion.isVisible().catch(() => false)) break;
        continue;
      }
      await firstJudgeYes.click();
      await goodBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await goodBtn.click();
      await page.waitForTimeout(700); // 마이크로 폴즈 → 다음 카드 recall 시작
    }

    await expect(completion).toBeVisible({ timeout: 15_000 });

    let count = 0;
    for (let i = 0; i < 20; i++) {
      count = await countScoresSince(userId!, 'flashcard', sinceIso);
      if (count >= 1) break;
      await page.waitForTimeout(500);
    }
    expect(count, 'flashcard 완주 후 scores 행이 적재되어야 함').toBeGreaterThanOrEqual(1);
  });

  test('진단 완료 시 V-Level snapshot 이 기록된다(개인화 체인)', async ({ page }) => {
    test.setTimeout(120_000); // ~40문항 이진 응답 + 분석 + 폴링
    const userId = await userIdByEmail(RUNTIME_USER.email);
    // 진단 완료의 핵심 산출물(snapshot·profile 갱신)은 DB 로만 검증 가능 — 키 없으면 스킵
    test.skip(userId === null, 'SUPABASE_SERVICE_ROLE_KEY 미주입 — snapshot 단언 불가');
    const sinceIso = new Date().toISOString();

    await page.goto('/diagnostic', { waitUntil: 'domcontentloaded' });

    // 시작 — 주 V-Level 진단
    const startBtn = page.getByRole('button', { name: /진단 시작/ }).first();
    await startBtn.waitFor({ state: 'visible', timeout: 30_000 });
    const knowBtn = page.getByRole('button', { name: /알아요/ });
    await startBtn.click();
    try {
      await knowBtn.waitFor({ state: 'visible', timeout: 6_000 });
    } catch {
      if (await startBtn.isVisible().catch(() => false)) await startBtn.click();
      await knowBtn.waitFor({ state: 'visible', timeout: 10_000 });
    }

    // 문항 진행 — 전부 "알아요"(이진). 문항 소진 시 버튼이 사라짐(submitting→results).
    for (let q = 0; q < 60; q++) {
      if (!(await knowBtn.isVisible().catch(() => false))) break;
      await knowBtn.click();
      await page.waitForTimeout(250);
    }

    // 질문 단계 종료 확인(분석/결과로 전이)
    await expect(knowBtn).toHaveCount(0, { timeout: 20_000 });

    // 핵심 단언 — analyze_and_apply 가 diagnostic snapshot 을 기록(= profile 갱신)
    let snaps = 0;
    for (let i = 0; i < 30; i++) {
      snaps = await countDiagnosticSnapshotsSince(userId!, sinceIso);
      if (snaps >= 1) break;
      await page.waitForTimeout(600);
    }
    expect(snaps, '진단 완료 후 diagnostic snapshot 이 기록되어야 함').toBeGreaterThanOrEqual(1);
  });
});
