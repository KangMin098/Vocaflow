// apps/web/tests/e2e/44-csat-trap-atlas.spec.ts
//
// **`/csat` 히어로 「오답 지도」의 런타임 회귀.**
//
// ── 무엇을 지키나 ─────────────────────────────────────────────────────
// 이 화면의 값어치는 「도착하자마자 센 것이 보인다」 하나다. 그런데 그 성질은 **조용히 사라진다** —
// 구운 JSON 을 못 읽어도, 하이드레이션이 깨져도, 칩 배선이 끊겨도 화면은 멀쩡히 뜨고 글자만
// 남는다. 그러면 이 화면은 다시 「텍스트 나열」이 되는데 아무도 모른다. 그래서 잰다:
//
//   ① 서버 HTML 에 막대와 수치가 이미 있다 (I6 — JS 없이도 크롤러가 읽을 것이 있다)
//   ② 아무것도 안 눌러도 증명이 **접힌 위**(1280×900)에서 끝난다 (I1·I2·I8)
//   ③ 칩을 누르면 분포가 **다시 세어진다** (I3) — 그리고 네트워크 왕복이 0
//   ④ 함정 줄을 펴면 **실제 기출 예시**가 나오고 그 문항으로 가는 문이 있다
//   ⑤ 막대가 **한 자**로 그려진다 — 「그 밖」이 자기 비율보다 길면 그림이 거짓말한다
//   ⑥ 390px 가로 넘침 0 · 터치 타깃 44px (실제 기하로)
//   ⑦ axe WCAG2 A/AA 위반 0 (라이트·다크)
//   ⑧ 콘솔 에러 0
//
//   · 계정: runtime-test-0705@vocaflow.dev
//   · 읽기 전용 — DB 에 쓰지 않는다. 계측 이벤트는 **누르므로 남는다**(funnel_events).

import fs from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-csat-atlas.json';

/** 데스크톱 접힘 기준 — CLAUDE.md I8 이 정한 뷰포트. */
const FOLD = { width: 1280, height: 900 };

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

/** 지금 그려진 줄들 — 이름과 개수. 「다시 세어졌나」는 이 배열이 바뀌는지로 본다. */
async function rows(page: Page): Promise<string[]> {
  return page
    .locator('ol[data-proof="trap-distribution"] > li')
    .evaluateAll((els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()));
}

test.describe('기출 허브 — 오답 지도', () => {
  test.beforeAll(async ({ browser }) => {
    // 미리 구운 세션이 있으면 로그인 폼을 거치지 않는다(사유는 `42-csat-item-map` 머리말).
    // ⚠️ 건너뛴 사실을 크게 남긴다 — 조용히 건너뛰면 로그인이 깨져도 이 스펙은 초록이다.
    if (fs.existsSync(STATE_PATH)) {
      console.log(`[44] 미리 구운 세션을 쓴다 (${STATE_PATH}) — 로그인 폼은 거치지 않았다`);
      return;
    }
    test.setTimeout(150_000);
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('클릭 0 으로 센 결과가 접힌 위에서 끝난다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.setViewportSize(FOLD);
    await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });

    const list = page.locator('ol[data-proof="trap-distribution"]');
    await expect(list).toBeVisible();

    const all = await rows(page);
    // 「아홉 가지」를 말하려면 아홉 줄 + 그 밖이 있어야 한다.
    expect(all.length, '막대 줄이 너무 적다 — 구운 지도를 못 읽었다').toBeGreaterThanOrEqual(9);
    expect(all.join(' '), '「그 밖」이 없다 — 60% 라고 말하면서 나머지를 지운 셈이다').toContain('그 밖');

    // 수치가 실제로 찍혔나 — 구운 값을 못 읽으면 이름만 남고 0 이 된다.
    expect(all[0], '첫 줄에 개수가 없다').toMatch(/\d/);

    // **증명이 접힌 위에서 끝난다** (I8). 목록의 아래끝이 900 안에 있어야 한다.
    const bottom = await list.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
    expect(bottom, `막대가 접힌 아래로 내려갔다 (bottom=${bottom} > ${FOLD.height})`).toBeLessThanOrEqual(
      FOLD.height,
    );

    expect(
      errors.filter(
        (e) =>
          !/favicon|ResizeObserver|Download the React DevTools/i.test(e) &&
          !/fast ?refresh|hot-reloader|hot update|webpack-internal/i.test(e),
      ),
      '콘솔 에러',
    ).toEqual([]);
  });

  test('서버 HTML 에 이미 수치가 있다 — JS 없이도 읽을 것이 남는다', async ({ browser }) => {
    // 히어로가 클라이언트에서만 그려지면 크롤러에게 이 화면은 빈 껍데기다(I6).
    const ctx = await browser.newContext({ storageState: STATE_PATH, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/csat', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const html = await page.content();
    expect(html, '서버 HTML 에 막대가 없다').toContain('data-proof="trap-distribution"');
    expect(html, '서버 HTML 에 함정 이름이 없다').toMatch(/어휘 함정|부분 사실|반대 진술/);
    await ctx.close();
  });

  test('칩을 누르면 분포가 다시 세어진다 — 네트워크 왕복 없이', async ({ page }) => {
    await page.setViewportSize(FOLD);
    await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });

    const before = await rows(page);
    expect(before.length).toBeGreaterThan(3);

    // **이 화면의 존재 이유**: 값을 바꾸면 결과가 바뀐다(I3).
    // 왕복이 있으면 「200ms 안에」를 지킬 수 없으므로 요청 수도 함께 센다.
    let requests = 0;
    page.on('request', (r) => {
      if (!/_next\/(static|image)|\.map$|favicon/.test(r.url())) requests += 1;
    });

    const chip = page.locator('button[aria-pressed="false"]').first();
    await expect(chip).toBeVisible();
    const t0 = Date.now();
    await chip.click();
    await expect
      .poll(async () => (await rows(page)).join('|'), { timeout: 2_000 })
      .not.toBe(before.join('|'));
    const elapsed = Date.now() - t0;

    const after = await rows(page);
    expect(after, '칩을 눌렀는데 분포가 그대로다').not.toEqual(before);
    expect(elapsed, `반응이 느리다 (${elapsed}ms)`).toBeLessThan(1_000);
    expect(requests, `칩 한 번에 네트워크 요청 ${requests}건 — 구운 값을 안 쓰고 있다`).toBeLessThanOrEqual(2);
  });

  test('막대가 한 자로 그려진다 — 「그 밖」이 자기 비율보다 길지 않다', async ({ page }) => {
    // 실측 2026-09-15: 1위(12.1%)만 기준으로 삼았더니 그 밖(24.4%)이 컨테이너를 넘어
    // **꽉 찬 막대**가 됐다. 수치는 맞는데 그림이 거짓말하는 종류라 눈으로는 안 잡힌다.
    await page.setViewportSize(FOLD);
    await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });

    // ⚠️ 비율은 **`data-pct` 에서** 읽는다. 글자에서 읽으면 「389」와 「12.1%」가 붙어
    //    `38912.1` 로 잡힌다 — 이 검사가 처음에 그걸로 헛돌았다(실측 2026-09-15).
    const bars = await page.locator('ol[data-proof="trap-distribution"] > li[data-pct]').evaluateAll((els) =>
      els
        .map((e) => {
          const box = e.querySelector('span.relative');
          const fill = box && box.firstElementChild;
          return {
            pct: Number(e.getAttribute('data-pct')),
            w: fill ? fill.getBoundingClientRect().width : 0,
            box: box ? box.getBoundingClientRect().width : 0,
          };
        })
        .filter((b) => Number.isFinite(b.pct) && b.pct > 0 && b.box > 0),
    );
    expect(bars.length).toBeGreaterThanOrEqual(5);

    // 폭 / 비율 이 모든 줄에서 같아야 한다(최소 폭에 걸린 아주 작은 줄은 뺀다).
    const ratios = bars.filter((b) => b.w / b.box > 0.03).map((b) => b.w / b.box / b.pct);
    const spread = Math.max(...ratios) / Math.min(...ratios);
    expect(spread, `막대 자가 줄마다 다르다 (최대/최소 = ${spread.toFixed(2)})`).toBeLessThan(1.05);
    for (const b of bars) expect(b.w, '막대가 상자를 넘었다').toBeLessThanOrEqual(b.box + 1);
  });

  test('함정을 펴면 실제 기출 예시와 그 문항으로 가는 문이 있다', async ({ page }) => {
    await page.setViewportSize(FOLD);
    await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });

    const row = page.locator('ol[data-proof="trap-distribution"] button[aria-expanded]').first();
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');

    // 잡는 법 한 줄 — 없으면 이름만 늘려 준 셈이다.
    await expect(page.getByText('잡는 법').first()).toBeVisible();
    // **실제 기출로 이어져야 한다.** 예시가 없으면 「센 것」이 주장으로만 남는다.
    const link = page.locator('a[href^="/csat/item/"]').first();
    await expect(link).toBeVisible();
    await expect(page.getByText('버리는 법').first()).toBeVisible();
  });

  test('390px 에서 가로로 밀리지 않고 터치 타깃이 44px 이상이다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `390px 에서 가로로 ${overflow}px 밀린다`).toBeLessThanOrEqual(1);

    const small = await page
      .locator('main button, main a')
      .evaluateAll((els) =>
        els
          .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || '').replace(/\s+/g, ' ').slice(0, 24) }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44)
          .map(({ r, t }) => `${t} → ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
    expect(small, '44px 미만 터치 타깃').toEqual([]);
  });

  test.describe('axe — 라이트·다크', () => {
    for (const theme of ['light', 'dark'] as const) {
      test(`${theme} 테마 WCAG2 A/AA 위반 0`, async ({ page }) => {
        await page.setViewportSize(FOLD);
        await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('vocaflow-theme', t);
        }, theme);
        // ⚠️ 전환이 끝난 뒤에 잰다 — 페이드 도중에 재면 조상 opacity 가 한 번 더 합성돼
        //    있지도 않은 대비 위반이 나온다(이 저장소가 2026-09-05 에 겪은 일).
        await page.waitForTimeout(500);
        // 펼친 상태도 함께 본다 — 접혀 있는 동안만 초록인 검사는 반쪽이다.
        await page.locator('ol[data-proof="trap-distribution"] button[aria-expanded]').first().click();
        await page.waitForTimeout(300);
        expect(await axeViolations(page), `${theme} axe 위반`).toEqual([]);
      });
    }
  });
});
