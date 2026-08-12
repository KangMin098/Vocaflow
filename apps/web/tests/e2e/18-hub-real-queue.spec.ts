// apps/web/tests/e2e/18-hub-real-queue.spec.ts
//
// 모듈 허브가 **실제로 시작될 세션**을 말하는지 검증한다.
//
// 배경(실측 2026-08-12):
//   /flashcard · /spellforge 허브는 큐 분포(5/12/3/23 · 4/12/2/18)와 미리보기 단어를
//   상수로 갖고 있었다. 학습자가 누구든 같은 숫자를 봤다. 그걸 실데이터로 바꿨다.
//
// 왜 e2e 인가 — 이 화면은 두 번 런타임에서만 잡히는 결함을 냈다:
//   ① 순수 계산부를 server-only 파일에 두어 'use client' 허브가 그것을 import 하는 순간
//      **앱의 모든 라우트가 500** 이 됐다(모듈 그래프 오류). tsc·eslint 는 통과했다.
//   ② 그 전 커밋(play-scaffold)에서도 훅 순서 결함을 런타임만 잡았다.
//   단위 테스트(session-queue.test.ts)는 "합계가 맞나" 를 지키고, 이 스펙은
//   **그 계산이 실제 화면에 실데이터로 연결돼 있나** 를 지킨다.
//
// 핵심 계약: 화면이 말하는 "이번 세션 N장" = 버킷 4칸 합계 = 시작 링크가 담을 개수.
//   허브가 별도 쿼리로 개수를 세면 이 셋이 어긋난다(그래서 조회부가 play 라우트와
//   같은 fetchStudyVocabularies 를 쓴다 — session-queue-query.ts 주석 참조).

import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', RUNTIME_USER.email);
  await page.fill('input[type="password"]', RUNTIME_USER.password);
  await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
  await page.waitForURL(/\/(hub|dashboard)/, { timeout: 40_000 }).catch(() => {});
}

/**
 * 히어로 '이번 세션' 통계값.
 *
 * `getByText(/이번 세션/)` 로 찾으면 안 된다 — SpellForge 히어로 **설명문**이
 * "이번 세션에서 철자가 흔들리는 단어 17개를 만나요" 라서 통계값(20) 대신 17을 읽는다.
 * 실제로 그렇게 짰다가 이 스펙이 멀쩡한 화면을 불일치로 신고했다. 그래서 ModuleHero 가
 * `data-hero-stat={label}` 로 라벨을 선언하고, 테스트는 산문이 아니라 그 선언을 읽는다.
 */
async function sessionSize(page: Page): Promise<number> {
  const stat = page.locator('li[data-hero-stat="이번 세션"]');
  await expect(stat).toBeVisible({ timeout: 30_000 });
  const text = (await stat.innerText()).replace(/\s+/g, ' ');
  const m = text.match(/(\d+)/);
  expect(m, `'이번 세션' 값을 못 읽었다: ${text}`).not.toBeNull();
  return Number(m![1]);
}

/** TodayQueue 4칸의 숫자 합. */
async function bucketSum(page: Page): Promise<number> {
  const section = page.locator('section[aria-label="오늘의 학습 큐"]');
  await expect(section).toBeVisible({ timeout: 30_000 });
  const nums = await section.locator('li p.tabular-nums').allInnerTexts();
  expect(nums.length, '큐 카드가 4칸이 아니다').toBe(4);
  return nums.reduce((s, t) => s + Number(t.trim() || 0), 0);
}

for (const hub of [
  { path: '/flashcard', unit: '장', play: '/flashcard/play' },
  { path: '/spellforge', unit: '개', play: '/spellforge/play' },
]) {
  test.describe(`${hub.path} 허브 — 실 큐`, () => {
    test('히어로 개수 = 버킷 합계 (허브가 세션과 다른 숫자를 말하지 않는다)', async ({ page }) => {
      test.setTimeout(180_000);
      await login(page);
      await page.goto(hub.path, { waitUntil: 'domcontentloaded' });

      const size = await sessionSize(page);
      const sum = await bucketSum(page);
      expect(sum, `히어로는 ${size}, 버킷 합계는 ${sum} — 어긋났다`).toBe(size);
      // 검증 계정은 vocabularies 225행 시드 → 빈 화면이면 계약을 검증한 게 아니다
      expect(size, '세션이 0장이다 — 시드가 사라졌거나 조회가 실패했다').toBeGreaterThan(0);
    });

    test('길이를 바꾸면 표시 개수와 시작 링크가 함께 바뀐다 (죽은 컨트롤 금지)', async ({ page }) => {
      test.setTimeout(180_000);
      await login(page);
      await page.goto(hub.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('li[data-hero-stat="이번 세션"]')).toBeVisible({ timeout: 30_000 });

      // 10장(개) 버튼 — 세션이 10보다 커야 존재한다(작으면 '전체' 만 제공).
      //
      // ⚠️ count() 는 **기다리지 않는다**. 처음엔 곧바로 count()===0 이면 skip 했는데,
      // 스트리밍이 시작 카드까지 오기 전에 세면 0이라서 이 테스트가 **조용히 건너뛰어졌다**
      // (한 번은 통과, 다음 실행은 skip). 검증을 건너뛰는 skip 은 실패보다 위험하다 —
      // 초록색으로 보이면서 아무것도 지키지 않는다. 그래서 붙기를 기다린 뒤에 판단한다.
      const ten = page.getByRole('radio', { name: `10${hub.unit}` });
      await ten
        .first()
        .waitFor({ state: 'attached', timeout: 20_000 })
        .catch(() => {});
      test.skip((await ten.count()) === 0, '세션이 10 미만 — 길이 선택지가 없다');

      // 첫 클릭이 수화 전에 떨어지면 조용히 무시된다 — "보인다 ≠ 수화됨".
      // 실제로 SpellForge 에서 그랬다(콘텐츠가 많아 수화가 늦다). aria-checked 로 클릭이
      // 실제로 먹었는지 확인하고, 안 먹었으면 한 번 더 누른다.
      await ten.click();
      if ((await ten.getAttribute('aria-checked')) !== 'true') {
        await page.waitForTimeout(1_500);
        await ten.click();
      }
      await expect(ten, '길이 버튼이 선택 상태가 되지 않았다').toHaveAttribute('aria-checked', 'true');

      await expect
        .poll(() => sessionSize(page), { timeout: 15_000 })
        .toBe(10);
      expect(await bucketSum(page), '길이를 바꿨는데 버킷 합계가 따라오지 않았다').toBe(10);

      // 시작 링크가 그 길이를 실제로 넘기는지 — 예전 허브는 ?vocab/mode/length 를 넘기고도
      // play 라우트가 안 받아서 세 컨트롤 전부 무시됐다. 그 재발을 막는다.
      const cta = page.getByRole('link', { name: /시작하기/ });
      await expect(cta).toHaveAttribute('href', `${hub.play}?limit=10`);
    });
  });
}

test.describe('허브 기록 — 없는 기록을 만들지 않는다', () => {
  test('/wordblitz 는 기록이 없으면 최고점 숫자를 렌더하지 않는다', async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
    await page.goto('/wordblitz', { waitUntil: 'domcontentloaded' });

    // aria-label 은 '최고 점수'(h2 는 '최고 기록') — 접근성 라벨을 기준으로 잡는다
    const best = page.locator('aside[aria-label="최고 점수"]');
    await expect(best).toBeVisible({ timeout: 30_000 });
    const text = await best.innerText();

    // 기록이 있으면 숫자, 없으면 안내 문구 — 둘 중 하나여야 하고 0점은 안 된다.
    const hasInvite = /아직 기록이 없어요/.test(text);
    const num = text.match(/([\d,]+)\s*점/);
    expect(hasInvite || num != null, `최고 기록 카드가 비었다: ${text}`).toBe(true);
    if (num) {
      expect(Number(num[1].replace(/,/g, '')), '최고점이 0점으로 렌더됐다').toBeGreaterThan(0);
    }

    // 콤보는 저장되지 않는다 — 되살아나면 다시 없는 데이터를 보여주는 것이다
    await expect(page.getByText(/콤보\s*\d/), 'scores 에 없는 콤보가 화면에 있다').toHaveCount(0);
  });
});
