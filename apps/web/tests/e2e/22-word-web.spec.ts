// apps/web/tests/e2e/22-word-web.spec.ts
//
// **낱말 그물이 실제 브라우저에서 뜨는가.**
//
// ── 왜 e2e 여야 하는가 ──────────────────────────────────────────────
// 파생어·유의어·반의어는 사전에 있었는데 어느 화면도 읽지 않던 칸이다(실측 2026-08-30).
// 배선 뒤 `renderToString` 단위 테스트로 렌더를 확인했지만, 그것은 **컴포넌트가 그린다**
// 는 증명이지 **학습자가 본다** 는 증명이 아니다 — 그 사이에는 select 컬럼 누락, 로그인,
// 세션, 데이터 없는 낱말이 있다. 이 저장소가 반복해서 겪은 자리다:
//   "발행은 DB 에서 성공으로 보이는데 화면에는 없었다"
//
// ── 왜 "N장 중 하나" 인가 ───────────────────────────────────────────
// 카탈로그 보유율이 파생어 58.8% · 유의어 71.1% · 반의어 51.5% 라 **낱말마다 있지 않다.**
// 특정 낱말을 찍어 두면 그 낱말이 세션에 안 나오는 날 스펙이 엉뚱하게 죽는다. 그래서
// 카드를 넘기며 **한 장이라도** 그물이 뜨는지 본다 — 배선이 끊기면 0장이 되므로 그것으로
// 충분히 갈린다.

import { test, expect } from '@playwright/test'
import { TEST_USER_STATE, ensureAuthState } from './utils/auth'

/** 그물 줄의 이름표 — 카드(파생어·비슷한 말·반대말)와 툴팁(파생·비슷·반대)이 다르다. */
const CARD_LABELS = /파생어|비슷한 말|반대말/

test.describe('낱말 그물 — 사전에 있던 것이 학습자 화면에 뜨는가', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
  });
  test.use({ storageState: TEST_USER_STATE });

  test('플래시카드 정답면에 파생어·유의어·반의어가 뜬다', async ({ page }) => {
    await page.goto('/flashcard')
    await page.waitForLoadState('networkidle')

    const startBtn = page.locator('button, a').filter({ hasText: /시작|Start/i }).first()
    if (!(await startBtn.isVisible().catch(() => false))) {
      test.skip(true, '학습할 카드가 없다 — 검증 계정에 단어를 넣고 다시 돌릴 것')
      return
    }
    await startBtn.click()
    await page.waitForTimeout(2_000)

    let seen = 0
    let flipped = 0
    // 12장이면 보유율 58.8% 기준으로 한 장도 안 나올 확률이 사실상 0 이다.
    for (let i = 0; i < 12; i += 1) {
      // ⚠️ **접근성 이름으로 잡는다.** 처음에 `[class*="flashcard"]` 로 썼더니 0장이 잡혀
      //    "그물이 안 뜬다" 로 보였는데, 실제로는 카드가 멀쩡히 있었고 **선택자가 틀린**
      //    것이었다. 클래스 이름은 스타일을 고치면 조용히 어긋난다 — 역할과 이름은 안 그렇다.
      const card = page.getByRole('button', { name: /카드 뒤집어/ }).first()
      if (!(await card.isVisible().catch(() => false))) break
      await card.click() // 정답면으로 뒤집기
      await page.waitForTimeout(400)
      flipped += 1

      const body = (await page.locator('body').textContent()) ?? ''
      if (CARD_LABELS.test(body)) {
        seen += 1
        const hit = body.match(CARD_LABELS)?.[0]
        console.log(`[word-web] ${flipped}장째에서 "${hit}" 확인`)
        break
      }

      // 다음 장 — 평가 버튼이 있으면 누르고, 없으면 더 볼 것이 없다.
      const next = page
        .locator('button')
        .filter({ hasText: /알아요|다시|쉬웠|어려|보통|Next|다음/i })
        .first()
      if (!(await next.isVisible().catch(() => false))) break
      await next.click()
      await page.waitForTimeout(600)
    }

    console.log(`[word-web] 카드 ${flipped}장 확인 · 그물 노출 ${seen}장`)
    expect(
      seen,
      `카드 ${flipped}장을 넘겼는데 낱말 그물이 한 번도 안 떴다 — `
        + 'dict-extras 의 select 에서 derived_forms·synonyms·antonyms 가 빠졌는지 확인할 것',
    ).toBeGreaterThan(0)
  })
})
