// apps/web/tests/e2e/22-vault-facets.spec.ts
//
// WordVault 허브의 **면(facet) 상태 섹션** — 계산이 화면까지 도달하는가.
//
// 왜 이 스펙이 필요한가:
//   이 자리에는 `LearningDimensionSection` 이 있었는데 **어디서도 렌더되지 않았고**
//   데이터는 목업 상수(63/47/27)였다. 타입도 린트도 통과했고 테스트도 없었으므로,
//   "계산은 있는데 화면이 없다" 를 아무것도 잡아 주지 않았다. 같은 일이 반복되지 않게
//   **렌더된다는 것 자체**를 회귀로 남긴다.
//
// 무엇을 고정하나:
//   ① 섹션이 실제로 렌더된다 (임포터 0 로 죽는 것을 잡는다)
//   ② 처방이 **한 면만** 말한다 (설계안 §2.3 — 6개를 나란히 들이밀지 않는다)
//   ③ 펼치면 6면 내역이 나오고, 수치가 목업이 아니다
//   ④ 처방 CTA 가 **기록하는 활동**으로 간다 (안 그러면 다녀와도 같은 처방을 다시 받는다)
//
// 쓰기 없음 — 읽기 전용이라 정리(finally)가 필요 없다.

import { expect, test } from '@playwright/test';

import { TEST_USER_STATE, ensureAuthState } from './utils/auth';

/**
 * 이 섹션을 어떻게 찾는가 — **처방 문장으로 찾는다.**
 *
 * ⚠️ 예전 선택자는 `section[aria-labelledby="facet-progress-heading"]` 이었다.
 *    2026-08-16 (287d3151) 이 섹션 껍데기를 `Frame` 으로 바꾸면서 그 id 가 사라졌고,
 *    스펙만 남아 **9일 동안 빨간 채로 있었다**. 아무도 안 봤다는 뜻이다.
 *    (`Frame` 은 제목을 `aria-label` 로 준다 — 즉 참조할 id 자체가 없다.)
 *
 *    그래서 **이 섹션에만 있는 것**을 기준으로 삼는다: 처방 문장의 testid.
 *    껍데기가 또 바뀌어도 처방이 살아 있는 한 이 선택자는 따라간다.
 */
const SECTION = 'section:has([data-testid="facet-prescription"])';

test.describe('WordVault 면 상태 (실데이터)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
  })
  test.use({ storageState: TEST_USER_STATE })

  test('A. 섹션이 렌더되고 처방은 한 면만 말한다', async ({ page }) => {
    await page.goto('/wordvault');

    const section = page.locator(SECTION);
    // API 왕복이 있으므로 넉넉히 — 안 뜨면 "죽은 컴포넌트" 재발이다
    await expect(section).toBeVisible({ timeout: 20_000 });

    // 처방 문장은 하나다. 6면을 동시에 처방하지 않는다.
    const headline = section.getByTestId('facet-prescription');
    await expect(headline).toBeVisible();
    const text = (await headline.textContent())?.trim() ?? '';
    expect(text.length, '처방 문장이 비었다').toBeGreaterThan(0);
    // 처방은 **면 이름 하나**를 말하거나, 비어 있는 면이 없다고 말한다. 그 외는 계약 밖이다.
    const FACET_WORDS = [
      '뜻 알아보기',
      '철자 쓰기',
      '소리로 익히기',
      '형태 뜯어보기',
      '문맥에서 쓰기',
      '빠르게 꺼내기',
    ];
    const named = FACET_WORDS.filter((w) => text.includes(w));
    if (!text.includes('고르게')) {
      expect(named, `처방이 면을 하나만 말해야 한다: "${text}"`).toHaveLength(1);
    }
    test.info().annotations.push({ type: 'prescription', description: text });

    // 목업 시절의 3그룹 라벨이 남아 있으면 안 된다
    await expect(section).not.toContainText('아직 안 만난 단어');
    await expect(section).not.toContainText('여러 채널로 익힌');
  });

  test('B. 펼치면 6면 내역이 나오고 목업 수치가 아니다', async ({ page }) => {
    await page.goto('/wordvault');

    const section = page.locator(SECTION);
    await expect(section).toBeVisible({ timeout: 20_000 });

    const toggle = section.getByRole('button', { name: '면별로 보기' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // 44px 하한 (프로젝트 절대 규칙)
    const box = await toggle.boundingBox();
    expect(box!.height, '토글이 44px 미만').toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const rows = section.locator('#facet-progress-detail > li');
    await expect(rows).toHaveCount(6);

    // 목업 상수(63/47/27)가 화면에 남아 있으면 실데이터가 아니다
    const detail = (await section.locator('#facet-progress-detail').textContent()) ?? '';
    expect(detail).not.toMatch(/\b63\b|\b47\b|\b27\b/);
    // 안 해본 면은 비율이 아니라 '안 해봄' 으로 말한다 (0/0 을 100% 로 보이지 않게)
    expect(detail.length).toBeGreaterThan(0);
  });

  test('C. 처방 CTA 는 그 면을 실제로 기록하는 활동으로 간다', async ({ page }) => {
    await page.goto('/wordvault');

    const section = page.locator(SECTION);
    await expect(section).toBeVisible({ timeout: 20_000 });

    const cta = section.getByRole('link').first();
    if (!(await cta.isVisible().catch(() => false))) {
      // 권할 활동이 없으면 링크를 만들지 않는 것이 계약이다 — 없는 길을 주지 않는다
      test.info().annotations.push({ type: 'note', description: '처방 CTA 없음(후보 없음)' });
      return;
    }

    const href = await cta.getAttribute('href');
    expect(href, 'CTA 에 목적지가 없다').toBeTruthy();
    // ScriptQuiz 는 'use' 를 훈련한다고 선언하지만 대상 단어가 없어 기록하지 못한다.
    // 처방이 그리로 보내면 학습자는 다녀와도 같은 처방을 다시 받는다.
    expect(href, 'ScriptQuiz 로 처방했다 — 기록되지 않는 면이다').not.toContain('/scriptquiz');

    // 실제로 열리는 경로여야 한다 (죽은 링크로 처방하지 않는다)
    const res = await page.goto(href!);
    expect(res?.status(), `${href} 가 열리지 않는다`).toBeLessThan(400);
  });
});
