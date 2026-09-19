// apps/web/tests/e2e/02-flashcard-session.spec.ts
// Flashcard 세션 회귀 — shared_dictionary 의 meaning_ko / ipa 표시 검증
import { test, expect } from '@playwright/test';
import { TEST_USER_STATE, ensureAuthState } from './utils/auth';

test.describe('Flashcard 세션 회귀', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
  });
  test.use({ storageState: TEST_USER_STATE });

  test('Flashcard Hub 에서 시작 가능', async ({ page }) => {
    await page.goto('/flashcard');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // ⚠️ `/시작|Start|학습/` 로 잡으면 안 된다 — 진단을 아직 안 한 계정의 허브에는
    //    **"진단 시작"(→ /diagnostic)** 이 먼저 있어서 `.first()` 가 그것을 집는다.
    //    (실측 2026-09-06: 세션 테스트가 그 버튼을 눌러 /diagnostic 으로 가 놓고
    //     "카드가 없다" 고 실패했다.) 목적지로 못박는다.
    const startable = page.locator('a[href^="/flashcard/play"]').first();
    await expect(startable).toBeVisible({ timeout: 10_000 });
    console.log('[baseline] Flashcard Hub loaded');
  });

  test('Flashcard 세션에서 단어 + 뜻 + 발음이 표시된다', async ({ page }) => {
    await page.goto('/flashcard');
    await page.waitForLoadState('networkidle');

    const startBtn = page.locator('a[href^="/flashcard/play"]').first();
    // ⚠️ 앞 판은 여기를 `if (보이면) { … }` 로 감싸 두었다. 시작 버튼이 안 보이면 본문을
    //    통째로 건너뛰고 **초록**을 냈다 — 즉 이 테스트는 오랫동안 아무것도 검증하지 않았다.
    //    (그래서 아래 선택자가 저장소에 없는데도 아무도 몰랐다.) 안 보이면 실패한다.
    await expect(startBtn, '허브에 시작 버튼이 없다 — 세션에 못 들어간다').toBeVisible({
      timeout: 10_000,
    });
    await startBtn.click();

    // 카드 또는 **빈 상태** 중 하나는 반드시 나온다. 빈 상태는 결함이 아니라 정상 분기라
    //    구별해서 적는다 — "못 쟀다" 를 "통과" 로 세지 않기 위해서다.
    const card = page.getByRole('button', { name: /카드 뒤집어 정답 확인|카드 앞면 보기/ }).first();
    const empty = page.getByText(/복습할 단어가 아직 없어요|학습할 단어가 아직 없어요|학습할 단어가 없어요|오늘의 학습이 완료됐어요/).first();
    await expect(card.or(empty), '카드도 빈 상태도 안 나왔다').toBeVisible({ timeout: 15_000 });

    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, '이 계정에 오늘 복습할 단어가 없다 — 카드 표시를 잴 수 없다');
      return;
    }

    // ── 앞면: 낱말 + 발음 ──
    //
    // ⚠️ 선택자를 `[data-testid="flashcard-word"], [class*="flashcard"]` 로 두었었는데
    //    **저장소에 그런 testid 도, flashcard 를 담은 클래스도 없다.** 한 번도 맞은 적이 없다.
    //    지금은 학습자가 실제로 인지하는 것(뒤집는 버튼)을 잡는다 — `Card.tsx` 의 role·aria-label.
    const front = (await card.textContent()) ?? '';
    expect(front.trim().length, '카드 앞면이 비어 있다').toBeGreaterThan(0);
    expect(/[A-Za-z]/.test(front), `앞면에 영어 낱말이 없다: "${front.slice(0, 40)}"`).toBe(true);

    // ── 뒤집으면 한국어 뜻 ──
    await card.click();
    await expect
      .poll(async () => /[가-힣]/.test((await card.textContent()) ?? ''), {
        timeout: 5_000,
        message: '카드를 뒤집었는데 한국어 뜻이 안 보인다',
      })
      .toBe(true);
  });
});
