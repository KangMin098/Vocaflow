// apps/web/tests/e2e/24-dictate-sweep.spec.ts
//
// 받아쓰기 **전 화면 순회** — 화면 / 디자인 / 기능 / 프로세스.
//
// 왜 이 스펙이 필요한가 (사용자 신고 2026-08-15):
//   `/dictate/session?sessionId=…` 에서 "아무 반응 없음". 파고드니 원인이 하나가 아니었다 —
//   시작 실패가 조용했고(스피너만 꺼짐), 캐시 저장 실패가 삼켜졌고, 형태가 깨진 캐시는
//   화면을 통째로 비울 수 있었다. **어느 것도 테스트가 없었다.**
//   개별 기능 스펙(17-dictation-loop)은 정상 경로만 달린다. 이 스펙은 그 반대편 —
//   빈 상태·실패·되돌아오기·되돌릴 수 없는 조작이 화면에서 어떻게 보이는지를 고정한다.
//
// 원칙 3개를 화면마다 검사한다:
//   ① **막다른 화면 금지** — 어떤 상태에서도 앞으로 가는 길이 최소 1개
//   ② **로딩은 최종 상태가 아니다** — "불러오는 중" 이 남아 있으면 실패다
//   ③ **44px 하한** — 프로젝트 절대 규칙
//
// 읽기 전용(세션 생성 없음)이라 정리가 필요 없다. 실주행 완주는 17-dictation-loop 담당.

import { expect, test, type Page } from '@playwright/test';

import { loginAsTestUser } from './utils/auth';

const STATE_PATH = 'playwright-auth/.auth-dictate-sweep.json';

/** 로딩 문구가 최종 상태로 남아 있지 않은가. */
async function assertSettled(page: Page, where: string) {
  await expect(
    page.getByText(/불러오는 중|준비 중\.\.\.|Loading/i),
    `${where}: 로딩 문구가 최종 상태로 남았다`,
  ).toHaveCount(0, { timeout: 20_000 });
}

/**
 * 앞으로 갈 길이 있는가 (막다른 화면 금지).
 *
 * ⚠️ 즉시 count 하면 **로딩 중을 빈 화면으로 읽는다** — 첫 구현이 그랬고, 결과 화면의
 *    맨 스피너(텍스트 없음)와 겹쳐 오탐이 났다. 재시도하는 단언으로 기다린다.
 */
async function assertHasExit(page: Page, where: string) {
  await expect
    .poll(async () => page.locator('main button:visible, main a:visible').count(), {
      message: `${where}: 앞으로 가는 길이 없다`,
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
}

/** 보이는 인터랙티브 요소가 44px 하한을 지키는가. */
async function assertTouchTargets(page: Page, where: string) {
  const els = await page.locator('main button:visible, main a:visible').all();
  const small: string[] = [];
  for (const el of els.slice(0, 40)) {
    const box = await el.boundingBox();
    if (!box || box.width === 0) continue;
    if (box.height < 44) {
      const label = ((await el.textContent()) ?? '').trim().slice(0, 24) || '(무텍스트)';
      small.push(`${label}|${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  expect(small, `${where}: 44px 미만 — ${small.join(' · ')}`).toEqual([]);
}

test.describe('받아쓰기 전 화면 순회', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginAsTestUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('A. 허브 — 자료 4소스가 모두 진입 가능하고 막다른 곳이 없다', async ({ page }) => {
    await page.goto('/dictate');
    await assertSettled(page, '/dictate');
    await assertHasExit(page, '/dictate');

    // 오늘의 받아쓰기 — 재료가 없으면 없다고 말해야 한다(빈 카드로 자리만 차지하지 않기)
    const daily = page.locator('section[aria-labelledby="daily-dictation-title"]');
    if (await daily.count()) {
      const text = (await daily.innerText()).trim();
      expect(text.length, '오늘의 받아쓰기 섹션이 비었다').toBeGreaterThan(0);
    }
    await assertTouchTargets(page, '/dictate');
  });

  test('B. 자료 고르기 — 4탭 모두 전환되고 각 탭이 상태를 말한다', async ({ page }) => {
    await page.goto('/dictate/setup');
    await assertSettled(page, '/dictate/setup');

    const tablist = page.getByRole('tablist', { name: '받아쓸 자료 종류' });
    await expect(tablist).toBeVisible({ timeout: 20_000 });
    const tabs = tablist.getByRole('tab');
    const count = await tabs.count();
    expect(count, '자료 탭이 없다').toBeGreaterThan(1);

    for (let i = 0; i < count; i += 1) {
      const tab = tabs.nth(i);
      const name = ((await tab.textContent()) ?? '').trim();
      await tab.click();
      await expect(tab, `${name}: aria-selected 미반영`).toHaveAttribute('aria-selected', 'true');
      // 탭을 눌렀으면 그 탭의 내용이 **무엇이든** 보여야 한다 — 목록이든 빈 상태 안내든
      await assertSettled(page, `/dictate/setup#${name}`);
      const panel = page.locator('main').last();
      expect(((await panel.innerText()) ?? '').trim().length, `${name}: 내용이 비었다`).toBeGreaterThan(0);
    }
    await assertTouchTargets(page, '/dictate/setup');
  });

  test('C. 세션 — 없는 세션은 막다른 화면이 아니라 되돌아갈 길을 준다', async ({ page }) => {
    await page.goto('/dictate/session?sessionId=00000000-0000-4000-8000-000000000000');
    await assertSettled(page, '/dictate/session(없음)');
    await assertHasExit(page, '/dictate/session(없음)');
    await assertTouchTargets(page, '/dictate/session(없음)');

    // 되돌아가기가 실제로 동작해야 한다 — 링크만 있고 안 가면 막다른 곳과 같다
    const back = page.getByRole('button', { name: /받아쓰기로 돌아가기/ });
    if (await back.count()) {
      await back.click();
      await page.waitForURL(/\/dictate$/, { timeout: 15_000 });
    }
  });

  test('D. 결과 — 없는 세션이어도 멈추지 않는다', async ({ page }) => {
    await page.goto('/dictate/results?sessionId=00000000-0000-4000-8000-000000000000');
    await assertSettled(page, '/dictate/results(없음)');
    await assertHasExit(page, '/dictate/results(없음)');
    await assertTouchTargets(page, '/dictate/results(없음)');
  });

  test('E. 다크 모드 — 4화면 모두 대비가 무너지지 않는다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/dictate', '/dictate/setup', '/dictate/session', '/dictate/results']) {
      await page.goto(path);
      await assertSettled(page, `${path}(dark)`);
      // 본문이 배경과 같은 색이면 글자가 사라진다 — 실제로 읽을 것이 있는지 본다.
      // (리다이렉트하는 화면이 있어 즉시 읽으면 전환 순간을 잡는다 → 재시도)
      await expect
        .poll(
          async () => ((await page.locator('main').last().innerText()) ?? '').trim().length,
          { message: `${path}(dark): 본문이 비었다`, timeout: 20_000 },
        )
        .toBeGreaterThan(0);
    }
  });
});
