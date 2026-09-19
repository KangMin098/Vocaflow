// apps/web/tests/e2e/utils/session.ts
//
// 받아쓰기 세션을 실제로 하나 시작한다 — 여러 스펙이 같은 절차를 쓴다.
//
// "오늘의 받아쓰기" 로 시작하지 않는 이유: 재료가 없으면 early return 이 되고 그러면
// 테스트가 **아무것도 검증하지 않은 채 초록**이 된다(실측: 3.9초 만에 통과했고 DB 에는
// 세션이 하나도 안 생겼다). 담아 둔 자료는 항상 있으므로 그쪽에서 시작한다.

import { expect, type Page } from '@playwright/test';

export async function startAnySession(page: Page): Promise<void> {
  await page.goto('/dictate/setup');
  const tabs = page.getByRole('tablist', { name: '받아쓸 자료 종류' }).getByRole('tab');
  await expect(tabs.first()).toBeVisible({ timeout: 20_000 });

  // 카탈로그가 도착할 때까지 기다린다. 탭마다 3초씩 보던 첫 구현은 서버가 바쁠 때
  // **로딩 중을 "자료 없음" 으로 읽어** 공용 헬퍼를 쓰는 테스트 4개가 같이 흔들렸다.
  // 탭 옆 숫자가 보유 수이므로, 하나라도 0이 아니게 되면 카탈로그가 온 것이다.
  await expect
    .poll(
      async () => {
        const labels = await tabs.allTextContents();
        return labels.some((t) => /[1-9]/.test(t));
      },
      { message: '자료 카탈로그가 도착하지 않았다', timeout: 30_000 },
    )
    .toBe(true);

  let opened = false;
  for (let i = 0; i < (await tabs.count()); i += 1) {
    await tabs.nth(i).click();
    const row = page.locator('main').last().locator("a[href*='/dictate/setup?']").first();
    if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await row.click();
      opened = true;
      break;
    }
  }
  expect(opened, '받아쓸 자료가 하나도 없다 — 검증 계정 자산을 확인하라').toBe(true);

  await page.getByRole('button', { name: /시작하기/ }).click({ timeout: 30_000 });
  await page.waitForURL(/\/dictate\/session\?sessionId=/, { timeout: 30_000 });
}
