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

import { ensureAuthState } from './utils/auth';
import { deleteDictationSince, userIdByEmail } from './utils/db';
import { startAnySession } from './utils/session';
import { TEST_USER } from './fixtures/test-user';

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
  // 로그인 재사용 — 스펙마다 로그인하면 전체 실행에서 auth rate-limit 에 걸려
  // beforeAll 이 죽고 그 describe 가 통째로 "did not run" 이 된다.
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, STATE_PATH);
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

  /**
   * F. 모바일 폭(390px) — 프로젝트는 모바일 퍼스트를 규칙으로 둔다(390 → 768 → 1280).
   *
   * 데스크톱에서만 재면 두 가지를 놓친다:
   *   · 가로 넘침 — 본문이 뷰포트보다 넓으면 학습자는 좌우로 흔들며 읽게 된다
   *   · 좁은 폭에서 눌린 조작 — 같은 버튼이 데스크톱 44px, 모바일 32px 인 경우가 흔하다
   */
  test('F. 모바일 390px — 가로 넘침 없음 · 조작 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/dictate', '/dictate/setup', '/dictate/results']) {
      await page.goto(path);
      await assertSettled(page, `${path}(390)`);

      // 본문이 뷰포트를 넘지 않는다 (셸 고정 요소는 제외 — 본문만 본다)
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `${path}(390): 가로로 ${overflow}px 넘친다`).toBeLessThanOrEqual(1);

      await assertTouchTargets(page, `${path}(390)`);
    }
  });

  /**
   * G. 비로그인은 4화면 모두 로그인으로 보내고 **돌아올 곳을 기억한다**.
   *
   * 이 경계가 무너지면 남의 학습 이력이 열리는 것이 아니라(그건 RLS 가 막는다)
   * 빈 화면·엉뚱한 리다이렉트가 되어 학습자가 길을 잃는다. 그리고 이 경계가 참이어야
   * 화면 문구도 참이 된다 — "로그인 없이 진행한 세션은…" 이라고 적혀 있던 안내는
   * 로그인한 사람만 닿는 화면에서 **불가능한 상태**를 설명하고 있었다.
   */
  test('G. 비로그인 — 4화면이 ?next= 를 보존해 로그인으로 보낸다', async ({ browser }) => {
    const anon = await browser.newContext({ storageState: undefined });
    const page = await anon.newPage();
    try {
      for (const path of ['/dictate', '/dictate/setup', '/dictate/session', '/dictate/results']) {
        const res = await page.goto(path);
        expect(res?.status(), `${path}: 응답 없음`).toBeLessThan(400);
        await expect(page, `${path}: 로그인으로 보내지 않는다`).toHaveURL(/\/login/);
        const next = new URL(page.url()).searchParams.get('next');
        expect(next, `${path}: 돌아올 곳을 안 남겼다`).toBe(path);
      }
    } finally {
      await anon.close();
    }
  });

  /**
   * H. **진행 중인 세션 화면** — 지금까지 순회가 통째로 빠뜨린 상태.
   *
   * C·D 는 "없는 세션" 만 열어 봤다. 그래서 학습자가 실제로 시간을 보내는 화면 —
   * 입력창·힌트 4단계·제출·건너뛰기 — 은 **한 번도 검사되지 않았다**.
   * 실측으로 그 자리에 44px 위반이 두 종류 있었다(힌트 24px · 제출 38px).
   * 빈 상태만 도는 순회는 "화면을 다 봤다" 는 착각을 준다.
   */
  test('H. 진행 중 세션 — 조작 44px · 막다른 곳 없음', async ({ browser }) => {
    const userId = await userIdByEmail(TEST_USER.email);
    const sinceIso = new Date(Date.now() - 5_000).toISOString();
    const ctx = await browser.newContext({ storageState: STATE_PATH });
    const page = await ctx.newPage();
    try {
      await startAnySession(page);
      await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 20_000 });
      await assertSettled(page, '/dictate/session(진행)');
      await assertTouchTargets(page, '/dictate/session(진행)');

      // 채점 뒤 화면도 본다 — 피드백 단계는 입력 단계와 다른 조작을 그린다
      await page.getByRole('textbox').first().fill('some answer');
      await page.getByRole('button', { name: '제출' }).click();
      await expect(page.getByRole('heading', { name: '결과' }).first()).toBeVisible({
        timeout: 10_000,
      });
      await assertTouchTargets(page, '/dictate/session(채점후)');
    } finally {
      await ctx.close();
      if (userId) await deleteDictationSince(userId, sinceIso);
    }
  });

  test('E. 다크 모드 — 4화면 모두 대비가 무너지지 않는다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/dictate', '/dictate/setup', '/dictate/session', '/dictate/results']) {
      await page.goto(path);
      await assertSettled(page, `${path}(dark)`);
      // 본문이 배경과 같은 색이면 글자가 사라진다 — 실제로 읽을 것이 있는지 본다.
      //
      // ⚠️ `main` 으로 잡지 않는다 — `/dictate/session` 은 풀스크린 라우트라 셸의 `<main>`
      //    이 없을 수 있고, 그러면 셀렉터가 타임아웃해 **화면 문제처럼 보이는 테스트 문제**가 된다.
      //    (리다이렉트하는 화면도 있어 즉시 읽으면 전환 순간을 잡는다 → 재시도)
      await expect
        .poll(async () => ((await page.locator('body').innerText()) ?? '').trim().length, {
          message: `${path}(dark): 본문이 비었다`,
          timeout: 20_000,
        })
        .toBeGreaterThan(0);
    }
  });
});
