// apps/web/tests/e2e/42-csat-item-map.spec.ts
//
// **문항 해설의 「지문 지도」 런타임 회귀.**
//
// ── 왜 이 파일이 필요한가 (실측 2026-09-15) ───────────────────────────
// `/admin/kice/item/[slug]` 는 **동적 라우트**다. 접근성 전수 스윕(`10-a11y-sweep`)은 동적 세그먼트를
// 일부러 건너뛴다("시나리오 스펙의 몫"). 그리고 기존 CSAT 스펙(`41-…`)은 허브·유형·계획만 본다.
// 그래서 **이 화면은 런타임에서 한 번도 재진 적이 없다** — 대비도, 터치 타깃도, 가로 넘침도.
//
// 이 지도의 계약은 「클릭 → 분석매칭」이다. 그런데 지금까지 그것을 확인한 검사는
// **순수 모델**(`passage-map-model.test.ts`)뿐이고, 진짜 브라우저에서 칩을 눌러 다른 문장이
// 열리는지는 아무도 안 봤다. 모델이 맞아도 배선이 끊기면 화면은 조용히 안 움직인다.
//
// 지키는 계약:
//   ① 서버 렌더에 **이미 정답 근거가 열려 있다** — 클릭 0 으로 증명이 보인다는 설계
//   ② 칩을 누르면 **열린 문장이 바뀐다** — 이 화면의 존재 이유
//   ③ axe WCAG2 A/AA 위반 0 (라이트·다크)
//   ④ 터치 타깃 44px — 문자열이 아니라 실제 렌더 기하로 잰다
//   ⑤ 390px 에서 가로 넘침 없음
//   ⑥ 원문이 통째로 나오지 않는다 (경계는 DB 층에서도 잠기지만 화면에서도 본다)
//   ⑦ 콘솔 에러 0
//
//   · 계정: runtime-test-0705@vocaflow.dev
//   · 읽기 전용 — DB 에 아무것도 쓰지 않는다. 계측 이벤트는 **누르므로 남는다**(funnel_events).

import fs from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? (() => { throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local (CI: 저장소 시크릿)') })(),
};

const STATE_PATH = 'playwright-auth/.auth-csat-item-map.json';

/**
 * 지도가 있는 문항 하나. `skeleton-data/M2309.json` 에 실재하고 앵커 3개(정답 + 오답 2)를 갖는다.
 * 슬러그는 `#` 를 `-` 로 바꾼 것(`lib/csat/learner.ts` 의 `toItemSlug`).
 */
const ITEM_SLUG = 'M2309-42';

async function loginRuntimeUser(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(2_000);
    }
  }
}

async function axeViolations(page: Page) {
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('main')
    .analyze();
  return res.violations.map(
    (v) =>
      `${v.impact}/${v.id} ×${v.nodes.length} :: ${(v.nodes[0]?.failureSummary || v.help)
        .replace(/\s+/g, ' ')
        .slice(0, 140)}`,
  );
}

/** 지금 열려 있는 문장 번호들 — aria-label 이 «근거가 여기 있어요» 를 달고 있는 항목. */
async function litSentences(page: Page): Promise<string[]> {
  return page
    .locator('li[aria-label*="근거가 여기 있어요"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
}

test.describe('기출 문항 해설 — 지문 지도', () => {
  test.beforeAll(async ({ browser }) => {
    // **미리 구운 세션이 있으면 로그인 폼을 거치지 않는다.**
    //
    // 이 머신은 «브라우저 → Supabase» 경로만 막힌다(같은 시각 node 는 401·로그인 성공,
    // 브라우저 폼은 "로그인 중..." 에서 멈춤 — 실측 2026-09-15). 그러면 화면 코드가 멀쩡해도
    // 검증을 못 한다. `scripts/e2e-session.mts` 가 Node 로 세션을 받아 쿠키로 구워 두면
    // 브라우저는 그걸 들고 시작한다.
    //
    // ⚠️ **건너뛴 사실을 크게 남긴다.** 조용히 건너뛰면 로그인이 깨져도 이 스펙은 초록이다.
    //    로그인 폼 자체의 회귀는 `20-auth-flows` 가 따로 본다 — 그쪽을 이 길로 검증하면 안 된다.
    if (fs.existsSync(STATE_PATH)) {
      console.log(`[42] 미리 구운 세션을 쓴다 (${STATE_PATH}) — 로그인 폼은 거치지 않았다`)
      return
    }
    // ⚠️ 훅 기본 제한은 **30초**인데 위 로그인은 2회 시도 × 25초라 **최대 50초+** 다.
    //    그래서 로그인이 조금만 느려도 훅이 먼저 죽고, 실패 메시지는 «beforeAll 시간 초과» 라
    //    **로그인이 문제인지 망이 문제인지 구별이 안 된다**(실측 2026-09-15: 망이 살아난 뒤에도
    //    같은 실패가 났고, 원인은 망이 아니라 이 숫자였다).
    test.setTimeout(150_000);
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('클릭 0 으로 정답 근거가 지문 위에 이미 열려 있다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(`/admin/kice/item/${ITEM_SLUG}`, { waitUntil: 'networkidle', timeout: 45_000 });

    // 지도 자체
    await expect(page.getByRole('heading', { name: '지문 지도' })).toBeVisible();

    // 문장 막대가 실제로 있다 — 0개면 골격을 못 읽은 것이고, 화면은 그래도 뜬다.
    const bars = page.locator('li[aria-label*="번째 문장"]');
    expect(await bars.count(), '문장 막대가 하나도 없다 — 골격을 못 읽었다').toBeGreaterThan(2);

    // **아무것도 안 누른 채로** 근거가 열려 있어야 한다.
    expect((await litSentences(page)).length, '첫 화면에 열린 근거가 없다').toBeGreaterThan(0);

    // 정답 칩이 눌린 상태로 온다
    const pressed = page.locator('button[aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toContainText('답이 왜');

    expect(
      errors.filter(
        (e) =>
          !/favicon|ResizeObserver|Download the React DevTools/i.test(e) &&
          !/fast ?refresh|hot-reloader|hot update|webpack-internal/i.test(e),
      ),
      '콘솔 에러',
    ).toEqual([]);
  });

  test('칩을 누르면 열리는 문장이 바뀐다 — 이 화면의 존재 이유', async ({ page }) => {
    await page.goto(`/admin/kice/item/${ITEM_SLUG}`, { waitUntil: 'networkidle', timeout: 45_000 });

    const before = await litSentences(page);
    expect(before.length, '처음부터 열린 것이 없으면 이 검사는 아무것도 안 지킨다').toBeGreaterThan(0);

    // 오답 칩 하나를 누른다.
    const reject = page.locator('button[aria-pressed="false"]').first();
    await expect(reject).toBeVisible();
    await reject.click();

    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1);
    const after = await litSentences(page);

    expect(after.length, '누른 뒤 열린 문장이 없다').toBeGreaterThan(0);
    // **다른 자리가 열려야 한다.** 같으면 매칭이 안 움직인 것이고, 그건 지도가 아니라 그림이다.
    expect(after, '칩을 눌렀는데 열린 문장이 그대로다').not.toEqual(before);
  });

  test('390px 에서 가로로 밀리지 않고 터치 타깃이 44px 이상이다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/kice/item/${ITEM_SLUG}`, { waitUntil: 'networkidle', timeout: 45_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `390px 에서 가로로 ${overflow}px 밀린다`).toBeLessThanOrEqual(1);

    // **문자열이 아니라 실제 기하로 잰다.** `min-h-[44px]` 가 있어도 부모가 줄이면 소용없다.
    const small = await page
      .locator('section button')
      .evaluateAll((els) =>
        els
          .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || '').slice(0, 24) }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44)
          .map(({ r, t }) => `${t} → ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
    expect(small, '44px 미만 터치 타깃').toEqual([]);
  });

  test.describe('axe — 라이트·다크', () => {
    for (const theme of ['light', 'dark'] as const) {
      test(`${theme} 테마 WCAG2 A/AA 위반 0`, async ({ page }) => {
        await page.goto(`/admin/kice/item/${ITEM_SLUG}`, { waitUntil: 'networkidle', timeout: 45_000 });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('vocaflow-theme', t);
        }, theme);
        // ⚠️ 전환이 끝난 뒤에 잰다 — 페이드 도중에 재면 조상 opacity 가 한 번 더 합성돼
        //    있지도 않은 대비 위반이 나온다(이 저장소가 2026-09-05 에 겪은 일).
        await page.waitForTimeout(500);
        expect(await axeViolations(page), `${theme} axe 위반`).toEqual([]);
      });
    }
  });

  test('다 보고 나면 다음 기출로 가는 문이 있다', async ({ page }) => {
    // 이 화면의 값어치는 **연달아 볼 때** 생긴다. 문이 없으면 유형 목록으로 되돌아가
    // 다시 고르는 두 걸음을 거쳐야 다음 지도에 닿는다.
    // 실측 2026-09-15: 802문항 중 **801**이 이 문을 받고, 그 801 전부가 지도로 이어진다
    // (없는 하나는 문항이 하나뿐인 유형 — 그때는 일부러 안 그린다).
    await page.goto(`/admin/kice/item/${ITEM_SLUG}`, { waitUntil: 'networkidle', timeout: 45_000 })
    const next = page.getByRole('link', { name: /같은 유형 다음 기출/ })
    await expect(next).toBeVisible()
    // 눌러서 도착한 곳이 **다른 문항**이어야 한다 — 제자리 링크는 앞길이 아니다.
    const href = await next.getAttribute('href')
    expect(href).toMatch(new RegExp('^' + '/admin/kice/item/'))
    expect(href).not.toContain(ITEM_SLUG)
  })

  // ── 오답 넷은 **하나도 빠지지 않는다** ──────────────────────────────
  //
  // 지도는 `how_to_reject` 안의 영어 조각이 **지문에서 찾힐 때만** 오답 칩을 얻는다(노출
  // 예산에 걸려 버려지기도 한다 — `scripts/csat/build-skeleton-data.mjs` §fitBudget).
  // 그런데 「지도가 있으면 산문 절을 안 그린다」는 조건이 **문항 단위**였다. 그래서 골격
  // 589문항 중 **136문항(23.1%)** — answer 앵커 하나뿐인 문항 — 에서 오답 분석
  // **544문단(평균 867자 · 최대 1,616자)** 이 화면에서 통째로 사라져 있었다. 지도는 정답 칩
  // 하나만 띄운 채 **멀쩡해 보였고**, 그래서 어느 검사에도 안 걸렸다.
  //
  // 여기서 재는 것은 「지도가 떴는가」가 아니라 **넷이 다 닿는가** 다. 앵커 수 1~5 를 한
  // 문항씩 덮어, 중복 제거(칩이 든 선지는 글에서 뺀다)와 누락 방지를 같은 식으로 잠근다.
  for (const [slug, anchors] of [
    ['2014A-25', 1],
    ['2014A-26', 2],
    ['2014A-23', 3],
    ['2014A-37', 4],
    ['2014A-24', 5],
  ] as const) {
    test(`앵커 ${anchors}개 문항 — 오답 넷이 칩이거나 글이거나`, async ({ page }) => {
      await page.goto(`/admin/kice/item/${slug}`, { waitUntil: 'networkidle', timeout: 45_000 });

      const group = page.getByRole('group', { name: '근거 고르기' });
      await expect(group, '지문 지도가 없다 — 골격이 안 읽혔다').toBeVisible();
      const chips = await group.locator('button[aria-pressed]').count();
      expect(chips, '칩 수가 골격의 앵커 수와 다르다').toBe(anchors);

      const prose = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: '나머지가 왜 아닌가' }) });
      const proseItems = (await prose.count()) ? await prose.locator('> ul > li').count() : 0;

      // 정답 칩 하나를 빼면 지도가 든 오답 수다. 나머지는 글로 내려와 있어야 한다.
      expect(
        chips - 1 + proseItems,
        `오답 넷 중 닿지 않는 것이 있다 — 칩 ${chips - 1} + 글 ${proseItems}`,
      ).toBe(4);

      // 글로 내려온 것이 있으면 «왜 칩이 아닌지» 를 말한다 — 말없이 두면 같은 문항이
      // 화면마다 다르게 보이는 것으로만 읽힌다.
      if (proseItems > 0) {
        await expect(page.getByText('지문에서 가리킬 문장을 찾지 못한 선지예요')).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: '나머지가 왜 아닌가' })).toHaveCount(0);
      }
    });
  }

  test('원문이 통째로 나오지 않는다', async ({ page }) => {
    await page.goto(`/admin/kice/item/${ITEM_SLUG}`, { waitUntil: 'networkidle', timeout: 45_000 });
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');

    // 저작권 고지가 있어야 한다 — 이 화면의 약속이다.
    expect(text).toContain('한국교육과정평가원');

    // 드러난 영어 조각의 총량이 지문 규모에 못 미쳐야 한다. 지문은 1,538자인데
    // 화면에 영어가 그만큼 있으면 그건 지문을 실은 것이다.
    const english = (text.match(/[A-Za-z][A-Za-z ,.;:'"()-]{9,}/g) || []).join('');
    expect(english.length, `영어 노출 ${english.length}자 — 지문을 실은 것으로 보인다`).toBeLessThan(700);
  });
});
