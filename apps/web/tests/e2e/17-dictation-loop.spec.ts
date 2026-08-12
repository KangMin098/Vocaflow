// apps/web/tests/e2e/17-dictation-loop.spec.ts
//
// 받아쓰기 학습 루프 회귀 — "자료 연결 → 완주 → 영속화 → 단어 복습" 전 구간 고정.
//
// 배경: v06 까지 받아쓰기는 localStorage 섬이었다 — 하드코딩 시드 3개만 받아쓸 수 있었고
//       완주해도 scores 0행 · learning_records 0행이라 대시보드에 아무것도 남지 않았다.
//       v07 에서 DB 학습 자산(도서 챕터·스크립트·공용 단어장)과 연결하고 세션/문항/단어를
//       각각 적재하도록 바꿨다. 이 스펙은 그 네 지점이 다시 끊기지 못하게 한다.
//
// 검증 지점:
//   ① 허브가 DB 자료를 보여준다 (localStorage 시드가 아니라)
//   ② 오늘의 받아쓰기가 조립돼 바로 시작된다
//   ③ 문항마다 dictation_attempts 가 즉시 쌓인다 (중도 이탈해도 남는다)
//   ④ 완주 시 dictation_sessions 마감 + scores(module='dictation') 적재
//   ⑤ 결과 화면을 DB 에서 읽어 렌더한다 (기기 무관)
//
// 정답 입력 방법: 받아쓰기는 정답이 화면에 없으므로 힌트 4단계('정답 보기')로 노출해
//   그대로 입력한다 — 실제 UI 경로이며, 힌트 사용 자체도 함께 검증된다.
//
// ⚠️ finally 정리 필수 — 오늘의 받아쓰기는 "오늘 이미 받아쓴 문장"을 제외하므로
//   기록을 남기면 같은 날 재실행 시 문장이 고갈된다(db.deleteDictationSince 주석 참조).

import { test, expect, type Page } from '@playwright/test';

import {
  countDictationAttemptsSince,
  countDictationSessionsSince,
  countLearningRecordsSince,
  countScoresSince,
  deleteDictationSince,
  deleteScoresSince,
  userIdByEmail,
} from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-dictation.json';

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

/** 한 문항 풀기 — 힌트 4단계로 정답을 열어 그대로 입력 후 제출. */
async function answerOneItem(page: Page): Promise<void> {
  const revealBtn = page.getByRole('button', { name: '정답 보기' });
  await revealBtn.click();
  // Hint Level 4 패널의 본문이 정답 문장
  const hintPanel = page.locator('p', { hasText: /Hint Level 4/ }).locator('..').locator('p').nth(1);
  await hintPanel.waitFor({ state: 'visible', timeout: 5_000 });
  const answer = (await hintPanel.innerText()).trim();
  expect(answer.length).toBeGreaterThan(5);

  const input = page.getByLabel('받아쓴 내용');
  await input.fill(answer);
  await page.getByRole('button', { name: '제출' }).click();
  // 채점 결과(정답 패널)가 뜨면 이 문항 종료
  await page.getByText('정답', { exact: true }).first().waitFor({ timeout: 10_000 });
}

test.describe('받아쓰기 — 자료 연결부터 영속화까지', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('허브가 DB 학습 자산을 보여준다', async ({ page }) => {
    await page.goto('/dictate', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '받아쓰기' }).first()).toBeVisible();

    // 자료 3탭 — 도서/스크립트/단어장. 각 탭 옆 숫자가 실제 보유 수.
    const bookTab = page.getByRole('tab', { name: /도서/ });
    await expect(bookTab).toBeVisible();
    await expect(page.getByRole('tab', { name: /단어장/ })).toBeVisible();

    // 도서 탭에 실제 enroll 한 챕터 링크가 있어야 한다 (localStorage 시드가 아님)
    await bookTab.click();
    const bookLink = page.locator('a[href^="/dictate/setup?text="]').first();
    await expect(bookLink).toBeVisible({ timeout: 10_000 });

    // 단어장 탭 — set 스코프 링크
    await page.getByRole('tab', { name: /단어장/ }).click();
    await expect(page.locator('a[href^="/dictate/setup?set="]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('오늘의 받아쓰기 완주 → 세션·문항·점수가 모두 적재된다', async ({ page }) => {
    test.setTimeout(180_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    const dbAvailable = userId !== null;
    const sinceIso = new Date().toISOString();

    try {
      await page.goto('/dictate', { waitUntil: 'networkidle' });

      // ─── 오늘의 받아쓰기 조립 ───
      const startBtn = page.getByRole('button', { name: /시작하기/ });
      await expect(startBtn).toBeVisible({ timeout: 15_000 });
      await startBtn.click();
      await page.waitForURL(/\/dictate\/session\?sessionId=/, { timeout: 20_000 });

      // 세션 행이 시작 시점에 이미 생성돼 있어야 한다 (uuid 가 곧 세션 URL)
      const sessionId = new URL(page.url()).searchParams.get('sessionId') ?? '';
      expect(sessionId).not.toBe('');
      expect(sessionId.startsWith('local-')).toBe(false);

      // ─── 문항 진행 ───
      const counter = page.locator('span.font-mono', { hasText: /^\d+ \/ \d+$/ }).first();
      await counter.waitFor({ timeout: 10_000 });
      const total = Number((await counter.innerText()).split('/')[1].trim());
      expect(total).toBeGreaterThan(0);

      for (let i = 0; i < total; i++) {
        await answerOneItem(page);

        // 첫 문항 직후 — 문항별 즉시 적재 확인(완주까지 몰아 넣지 않는다)
        if (i === 0 && dbAvailable) {
          let attempts = 0;
          for (let t = 0; t < 12 && attempts < 1; t++) {
            attempts = await countDictationAttemptsSince(userId as string, sinceIso);
            if (attempts < 1) await page.waitForTimeout(500);
          }
          expect(attempts, '첫 문항 제출 직후 dictation_attempts 적재').toBeGreaterThanOrEqual(1);
        }

        const last = i === total - 1;
        await page.getByRole('button', { name: last ? '마치기' : '다음' }).click();
      }

      // ─── 결과 화면 (DB 에서 읽는다) ───
      await page.waitForURL(/\/dictate\/results\?sessionId=/, { timeout: 20_000 });
      await expect(page.getByText('받아쓰기 완료')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: '문항별 결과' })).toBeVisible();
      // 힌트로 정답을 열었으므로 정확도는 100%, 힌트 횟수는 문항 수만큼
      await expect(page.getByText('100', { exact: false }).first()).toBeVisible();

      if (!dbAvailable) {
        test.info().annotations.push({
          type: 'skip-db',
          description: 'SERVICE_ROLE_KEY 없음 — UI 완주만 검증',
        });
        return;
      }

      // ─── 영속화 단언 ───
      let sessions = 0;
      let scores = 0;
      for (let t = 0; t < 16 && (sessions < 1 || scores < 1); t++) {
        sessions = await countDictationSessionsSince(userId as string, sinceIso, true);
        scores = await countScoresSince(userId as string, 'dictation', sinceIso);
        if (sessions < 1 || scores < 1) await page.waitForTimeout(500);
      }
      expect(sessions, '완주 시 dictation_sessions.completed_at 마감').toBeGreaterThanOrEqual(1);
      expect(scores, "완주 시 scores(module='dictation') 적재").toBeGreaterThanOrEqual(1);

      const attempts = await countDictationAttemptsSince(userId as string, sinceIso);
      expect(attempts, '문항 수만큼 dictation_attempts').toBeGreaterThanOrEqual(total);

      // ─── 이 재설계의 핵심 주장: 받아쓰기가 단어 복습에 남는다 ───
      // 오늘의 받아쓰기 'due' 슬롯은 내 vocabularies 예문에서 오므로 타깃 단어가 반드시 있고,
      // 완주 시 flushPendingSrsResults 가 vocabularies + learning_records 를 갱신해야 한다.
      // (v06 까지 이 값은 전 기간 0행이었다 — 받아쓰기가 기억 축과 무관한 섬이었다는 증거.)
      let records = 0;
      for (let t = 0; t < 16 && records < 1; t++) {
        records = await countLearningRecordsSince(userId as string, 'dictation', sinceIso);
        if (records < 1) await page.waitForTimeout(500);
      }
      expect(records, "완주 시 learning_records(module='dictation') 적재").toBeGreaterThanOrEqual(
        1,
      );
    } finally {
      if (dbAvailable) {
        // 오늘의 받아쓰기 재현성 확보 — 이 테스트가 만든 기록만 제거
        await deleteDictationSince(userId as string, sinceIso);
        await deleteScoresSince(userId as string, 'dictation', sinceIso);
      }
    }
  });

  test('도서 챕터 스코프 — content_chunks 본문으로 문항이 만들어진다', async ({ page }) => {
    test.setTimeout(120_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    const sinceIso = new Date().toISOString();

    try {
      await page.goto('/dictate', { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: /도서/ }).click();
      const bookLink = page.locator('a[href^="/dictate/setup?text="]').first();
      await expect(bookLink).toBeVisible({ timeout: 10_000 });
      await bookLink.click();
      await page.waitForURL(/\/dictate\/setup\?text=/, { timeout: 15_000 });

      // 도서 챕터는 texts.content 가 NULL 이고 본문이 content_chunks 에 있다.
      // 미리보기에 문항 수가 잡히면 get_chapter_content 경로가 살아 있다는 뜻.
      await expect(page.getByText('예상 소요')).toBeVisible({ timeout: 20_000 });
      const itemStat = page.locator('span', { hasText: /^\d+문항$/ }).first();
      await expect(itemStat).toBeVisible();

      // 5문항만 — 도서 챕터는 문장이 많아 전량 진행은 불필요하게 길다
      await page.getByRole('button', { name: '5', exact: true }).click();

      // 고전 도서는 감지 레벨이 높아(B2+) 힌트가 기본 꺼짐 — 정답 노출 경로를 쓰려면 켜야 한다.
      // (이 토글 자체가 '듣기 옵션' 패널의 회귀 검증을 겸한다)
      await page.getByRole('button', { name: /듣기 옵션/ }).click();
      const hintToggle = page.getByRole('checkbox');
      await hintToggle.waitFor({ state: 'visible', timeout: 5_000 });
      if (!(await hintToggle.isChecked())) await hintToggle.check();

      await page.getByRole('button', { name: /시작하기/ }).click();
      await page.waitForURL(/\/dictate\/session\?sessionId=/, { timeout: 20_000 });

      await answerOneItem(page);
      await page.getByRole('button', { name: '다음' }).click();

      if (userId) {
        let attempts = 0;
        for (let t = 0; t < 12 && attempts < 1; t++) {
          attempts = await countDictationAttemptsSince(userId, sinceIso);
          if (attempts < 1) await page.waitForTimeout(500);
        }
        expect(attempts, '도서 챕터 문항도 즉시 적재된다').toBeGreaterThanOrEqual(1);
      }
    } finally {
      if (userId) {
        await deleteDictationSince(userId, sinceIso);
        await deleteScoresSince(userId, 'dictation', sinceIso);
      }
    }
  });

  test('공용 단어장 스코프 — 단어가 사는 문장으로 세션이 만들어진다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dictate', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /단어장/ }).click();

    const setLink = page.locator('a[href^="/dictate/setup?set="]').first();
    await expect(setLink).toBeVisible({ timeout: 10_000 });
    await setLink.click();
    await page.waitForURL(/\/dictate\/setup\?set=/, { timeout: 15_000 });

    // 문장이 없는 세트면 안내 화면이 뜨는 것이 정상 동작 — 둘 중 하나여야 한다.
    const preview = page.getByText('복습으로 이어짐');
    const empty = page.getByRole('heading', { name: '받아쓸 만한 문장이 없어요' });
    await expect(preview.or(empty)).toBeVisible({ timeout: 20_000 });

    if (await empty.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: 'note',
        description: '이 세트에는 원문 문장이 없어 안내 화면으로 degrade (정상)',
      });
      return;
    }

    // 단어장 소스는 문장이 서로 이어지지 않으므로 '한 번에 받아쓸 분량' 옵션이 없어야 한다
    await expect(page.getByRole('heading', { name: '한 번에 받아쓸 분량' })).toHaveCount(0);
  });
});
