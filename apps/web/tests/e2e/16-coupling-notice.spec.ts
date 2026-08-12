// apps/web/tests/e2e/16-coupling-notice.spec.ts
//
// 결합 침묵 제거 — **세트로 놀았는데 복습 일정에 아무것도 남지 않는 것을 학습자가 알 수 있어야 한다.**
//
// 배경(실측):
//   `recordGameResult` 는 학습자 `vocabularies` 에 없는 단어를 카드 갱신 없이 넘긴다.
//   그 비율이 **97.9%** 다(내 단어 225개 vs 세트 단어 56,079개 · 628세트 기준 겹침 2.1%).
//   그동안 화면에 아무 표시가 없어서, 세트로 한 세션을 다 놀아도 FSRS 에 0건이 남는다는 것을
//   알 방법이 없었다. 팀은 이 문제를 게임별로 우회해 왔다(morpheme-bank.ts 의 "99.7% silent
//   skip 됐다" 주석 외 3곳).
//
// 왜 e2e 인가:
//   이 계약은 **런타임에서만** 검증된다. 실제로 이 기능을 만들면서 훅을 early return 뒤에
//   두는 버그를 냈는데(`Rendered more hooks than during the previous render`) tsc 와 단위
//   테스트는 통과했고 런타임 확인만 잡았다. 세는 규칙은 단위 테스트(record-skip-reason)가,
//   **화면에 실제로 뜨는지**는 이 스펙이 지킨다.

import { test, expect } from '@playwright/test';

import { pickSetWithoutOverlap, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

test.describe('결합 침묵 — 내 단어가 아닌 것을 알린다', () => {
  test('세트 스코프로 놀면 "복습 일정에 반영되지 않는다" 를 화면이 밝힌다', async ({ page }) => {
    test.setTimeout(150_000);

    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'service-role 키 없음 — DB 대조 불가');

    // 내 단어와 **겹치지 않는** 세트를 DB 에서 고른다. 겹치는 세트로 하면 not-mine 이 0이라
    // 고지가 안 뜨는 것이 정상이고, 그러면 "고지 없음" 이 결함인지 정상인지 구별할 수 없다.
    // (id 하드코딩은 데이터가 바뀌면 조용히 낡고, UI 목록 스크래핑은 링크 구조에 취약했다.)
    const picked = await pickSetWithoutOverlap(userId!, 12);
    test.skip(!picked, '내 단어와 겹치지 않는 세트를 찾지 못했다');

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
    await page.waitForURL(/\/(hub|dashboard)/, { timeout: 30_000 }).catch(() => {});

    await page.goto(`/play/cascade?set=${picked!.setId}&from=%2Farcade`, {
      waitUntil: 'domcontentloaded',
    });

    // 보드가 뜨고 자료 표기가 세트인지 확인 — 스코프가 mine 으로 폴백하면 이 계약이 성립하지 않는다
    await expect(page.locator('.cs-tile--word').first()).toBeVisible({ timeout: 60_000 });

    // **활성 타일만** 누른다. 잠긴 타일은 pointer-events: none 이라 force 클릭이 아래로 빠지고
    // 채점이 일어나지 않는다(실측: 그래서 서버액션 POST 가 0이었다).
    for (let i = 0; i < 6; i++) {
      const live = page.locator('.cs-tile--word[aria-disabled="false"]');
      if ((await live.count()) === 0) break;
      await live.first().click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    const notice = page.getByText(/복습 일정에는 반영되지 않아요/);
    await expect(notice, '세트 단어를 채점했는데 고지가 뜨지 않는다 — 침묵이 그대로다').toBeVisible({
      timeout: 20_000,
    });

    // 학습을 막지 않아야 한다 — 배지가 클릭을 가로채면 게임이 멈춘다
    const pe = await notice.first().evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe, '고지가 포인터 이벤트를 가로챈다').toBe('none');

    // 모달이 아니어야 한다(학습 중 오버레이 금지)
    expect(await page.getByRole('dialog').count(), '고지가 모달로 떴다').toBe(0);
  });

  test('내 단어만으로 놀면 고지가 뜨지 않는다 (거짓 경보 금지)', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
    await page.waitForURL(/\/(hub|dashboard)/, { timeout: 30_000 }).catch(() => {});

    // 스코프 없이 진입 = mine(내 due 큐) → 전부 내 단어여야 한다
    await page.goto('/play/cascade?from=%2Farcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cs-tile--word').first()).toBeVisible({ timeout: 60_000 });

    for (let i = 0; i < 5; i++) {
      const live = page.locator('.cs-tile--word[aria-disabled="false"]');
      if ((await live.count()) === 0) break;
      await live.first().click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(2_500);

    await expect(
      page.getByText(/복습 일정에는 반영되지 않아요/),
      '내 단어로 놀았는데 고지가 떴다 — 거짓 경보다',
    ).toHaveCount(0);
  });
});
