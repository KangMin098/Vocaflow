// apps/web/tests/e2e/45-csat-trap-atlas.spec.ts
//
// **기출 분석 학습자 화면 셋(허브 · 유형 · 계획)의 런타임 회귀.**
//
// ── 무엇을 지키나 ─────────────────────────────────────────────────────
// 세 화면의 값어치는 「도착하자마자 센 것이 보인다」 하나다. 그런데 그 성질은 **조용히 사라진다** —
// 구운 JSON 을 못 읽어도, 하이드레이션이 깨져도, 칩 배선이 끊겨도 화면은 멀쩡히 뜨고 글자만
// 남는다. 그러면 이 화면들은 다시 「텍스트 나열」이 되는데 아무도 모른다. 그래서 잰다:
//
//   ① 서버 HTML 에 막대와 수치가 이미 있다 (I6 — JS 없이도 크롤러가 읽을 것이 있다)
//   ② 아무것도 안 눌러도 증명이 **접힌 위**(1280×900)에서 끝난다 (I1·I2·I8)
//   ③ 값을 바꾸면 결과가 **다시 세어진다** (I3) — 그리고 네트워크 왕복이 0
//      (허브·유형: 유형 칩 / 계획: 읽기 속도 칩)
//   ④ 함정 줄을 펴면 **실제 기출 예시**가 나오고 그 문항으로 가는 문이 있다
//   ⑤ 막대가 **한 자**로 그려진다 — 「그 밖」이 자기 비율보다 길면 그림이 거짓말한다
//   ⑥ 유형 화면의 산문은 **지운 것이 아니라 접은 것**이고, 배수가 전부 ×로 뜨지 않는다
//   ⑦ 계획 화면의 띠가 문항 수만큼 칸을 갖고, 「빠르게」가 시간을 **줄인다**
//   ⑧ 390px 가로 넘침 0 · 터치 타깃 44px (`utils/tap-target.ts` 단일 출처)
//   ⑨ axe WCAG2 A/AA 위반 0 (라이트·다크) · 콘솔 에러 0
//
//   · 계정: runtime-test-0705@vocaflow.dev
//   · 읽기 전용 — DB 에 쓰지 않는다. 계측 이벤트는 **누르므로 남는다**(funnel_events).

import fs from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

import { TAP_MIN, TAP_MIN_TEXT_WIDTH, describeOffender, scanTapTargets } from './utils/tap-target';

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

test.describe('기출 분석 — 허브·유형·계획', () => {
  test.beforeAll(async ({ browser }) => {
    // 미리 구운 세션이 있으면 로그인 폼을 거치지 않는다(사유는 `42-csat-item-map` 머리말).
    // ⚠️ 건너뛴 사실을 크게 남긴다 — 조용히 건너뛰면 로그인이 깨져도 이 스펙은 초록이다.
    if (fs.existsSync(STATE_PATH)) {
      console.log(`[45] 미리 구운 세션을 쓴다 (${STATE_PATH}) — 로그인 폼은 거치지 않았다`);
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

    // ⚠️ 지도의 제목이 이 화면의 **h1** 이어야 한다. 히어로를 컴포넌트로 뽑으면서 기본값
    //    `h2` 를 그대로 쓰면 화면에 h1 이 하나도 남지 않는데(실측 2026-09-15 에 실제로 그랬다),
    //    **axe 의 wcag2a/aa 로는 안 잡힌다** — 빈 h1 은 best-practice 규칙이다.
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1, '허브에 h1 이 없다').toHaveCount(1);
    await expect(h1).toHaveAttribute('id', 'trap-atlas-h');

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

    // ⚠️ 규칙을 여기 다시 쓰지 않는다 — `utils/tap-target.ts` 가 단일 출처다.
    //    베껴 썼다가 **문장 속 인라인 링크 예외**를 빠뜨려 144건이 거짓 양성으로 잡혔다
    //    (실측 2026-09-15 · 유형 화면의 문항 인용 링크). 규칙은 한 곳에만 있어야 한다.
    const offenders = await page.evaluate(scanTapTargets, {
      min: TAP_MIN,
      minTextWidth: TAP_MIN_TEXT_WIDTH,
    });
    expect(offenders.map(describeOffender), '터치 타깃 규칙 위반').toEqual([]);
  });

  // ── 유형 화면 ───────────────────────────────────────────────────────
  // 같은 지도를 **이 유형으로 좁혀** 다시 그린다. 여기서 지켜야 할 것은 하나 더 있다:
  // 산문을 **지우지 않고 접었다**는 것 — 접은 게 아니라 지운 것이면 분석이 사라진 셈이다.
  test.describe('유형 화면 — 센 것이 먼저, 산문은 접혀서', () => {
    // 오답 460개가 **전부 이름을 받은** 유형이다(그 밖 0). 배수 분모 결함이 여기서 드러났다.
    const TYPE = 'R-BLANK';

    test('센 것 둘이 접힌 위에 있고 산문은 접혀 있다', async ({ page }) => {
      await page.setViewportSize(FOLD);
      await page.goto(`/csat/${TYPE}`, { waitUntil: 'networkidle', timeout: 45_000 });

      // ① 근거 자리 분포 ② 오답 구성 — 둘 다 **센 것**이다.
      await expect(page.locator('[data-proof="answer-locus"]')).toBeVisible();
      const atlas = page.locator('ol[data-proof="trap-distribution"]');
      await expect(atlas).toBeVisible();
      const bottom = await atlas.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
      expect(bottom, `오답 구성이 접힌 아래로 내려갔다 (bottom=${bottom})`).toBeLessThanOrEqual(FOLD.height);

      // 산문은 **지운 것이 아니라 접은 것**이다 — 손잡이가 있고, 열면 내용이 나온다.
      const fold = page.locator('details', { hasText: '분석 원문 읽기' }).first();
      await expect(fold).toBeVisible();
      expect(await fold.evaluate((el) => (el as HTMLDetailsElement).open), '산문이 처음부터 펴져 있다').toBe(
        false,
      );
      await fold.locator('summary').click();
      await expect(fold.getByRole('heading', { name: /근거 자리/ })).toBeVisible();
    });

    test('배수가 전부 「유난히 잦다」로 뜨지 않는다', async ({ page }) => {
      // 실측 2026-09-15: 분모를 안 맞춰 R-BLANK 의 여섯 줄이 모두 ×1.3 이상으로 떴다.
      // **전부 유난하면 아무것도 유난하지 않다** — 그 화면은 아무 말도 안 하는 것이다.
      await page.setViewportSize(FOLD);
      await page.goto(`/csat/${TYPE}`, { waitUntil: 'networkidle', timeout: 45_000 });

      const lifts = await page
        .locator('ol[data-proof="trap-distribution"] > li[data-pct] button')
        .evaluateAll((els) =>
          els
            .map((e) => (e.lastElementChild?.textContent || '').trim())
            .filter((t) => /^[×÷]|비슷|이 유형만/.test(t)),
        );
      expect(lifts.length, '배수 칸이 없다 — showLift 배선이 끊겼다').toBeGreaterThanOrEqual(4);
      const high = lifts.filter((t) => t.startsWith('×')).length;
      expect(high, `모든 줄이 ×로 떴다 (${lifts.join(' ')})`).toBeLessThan(lifts.length);
    });

    test('절차의 「막히면」이 접혀 있다 — 단계 수가 두 배로 보이지 않게', async ({ page }) => {
      await page.goto(`/csat/${TYPE}`, { waitUntil: 'networkidle', timeout: 45_000 });
      const onFail = page.locator('summary', { hasText: '여기서 막히면' });
      const n = await onFail.count();
      expect(n, '「막히면」 손잡이가 하나도 없다').toBeGreaterThan(0);
      // 펴 두면 화면이 두 배로 길어지고 "이걸 다 외워야 하나" 가 된다.
      const open = await page
        .locator('details:has(summary:text-is("여기서 막히면 →"))')
        .evaluateAll((els) => els.filter((e) => (e as HTMLDetailsElement).open).length);
      expect(open, '「막히면」이 처음부터 펴져 있다').toBe(0);
    });

    test('유형 화면도 390px 에서 밀리지 않고 44px 를 지킨다', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/csat/${TYPE}`, { waitUntil: 'networkidle', timeout: 45_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `390px 에서 가로로 ${overflow}px 밀린다`).toBeLessThanOrEqual(1);
      const offenders = await page.evaluate(scanTapTargets, {
        min: TAP_MIN,
        minTextWidth: TAP_MIN_TEXT_WIDTH,
      });
      expect(offenders.map(describeOffender), '터치 타깃 규칙 위반').toEqual([]);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`유형 화면 ${theme} axe WCAG2 A/AA 위반 0`, async ({ page }) => {
        await page.setViewportSize(FOLD);
        await page.goto(`/csat/${TYPE}`, { waitUntil: 'networkidle', timeout: 45_000 });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('vocaflow-theme', t);
        }, theme);
        await page.waitForTimeout(500);
        // 접은 것을 펴 놓고도 본다 — 접혀 있는 동안만 초록인 검사는 반쪽이다.
        await page.locator('details', { hasText: '분석 원문 읽기' }).first().locator('summary').click();
        await page.waitForTimeout(300);
        expect(await axeViolations(page), `${theme} axe 위반`).toEqual([]);
      });
    }
  });

  // ── 계획 화면 ───────────────────────────────────────────────────────
  // 여기 있던 것은 숫자 두 개였다(합계 · 쓸 수 있는 시간). 맞는 말인데 **할 수 있는 일이 없다.**
  // 띠가 「몇 번에서 끊기는가」를 찍고, 속도 칩이 그것을 **자기 속도로** 다시 그린다.
  test.describe('계획 화면 — 시간이 몇 번에서 바닥나는가', () => {
    test('띠가 접힌 위에 있고 칸 수가 문항 수와 맞는다', async ({ page }) => {
      await page.setViewportSize(FOLD);
      await page.goto('/csat/plan', { waitUntil: 'networkidle', timeout: 45_000 });

      const bar = page.locator('[data-proof="plan-timeline"]');
      await expect(bar).toBeVisible();
      const bottom = await bar.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
      expect(bottom, `띠가 접힌 아래로 내려갔다 (bottom=${bottom})`).toBeLessThanOrEqual(FOLD.height);

      // 칸 수 = 절차가 있는 문항 수. 0 이면 띠가 빈 상자이고, 그래도 화면은 멀쩡히 뜬다.
      const cells = bar.locator('span[data-no]');
      expect(await cells.count(), '띠에 칸이 없다 — 시간 예산을 못 읽었다').toBeGreaterThan(10);

      // 칸 폭의 합이 띠를 채운다(초과분은 넘어가므로 100% 이상일 수 있다).
      const fill = await cells.evaluateAll((els) =>
        els.reduce((a, e) => a + e.getBoundingClientRect().width, 0),
      );
      const box = await bar.evaluate((el) => el.getBoundingClientRect().width);
      expect(fill / box, '칸이 띠를 거의 안 채운다 — 폭 계산이 틀렸다').toBeGreaterThan(0.9);

      // ⚠️ **칸이 실제로 칠해졌는가.** 실측 2026-09-15: `color-mix` 의 둘째 인자로 쓴 변수가
      //    이 자리에서 안 풀려 색이 통째로 무효가 됐고 띠가 **투명**했다. 그래도 화면은 뜨고
      //    `data-proof` 도 그대로라 계측기는 「증명 1개」로 보고했다 — 눈으로만 잡히던 결함이다.
      const transparent = await cells.evaluateAll(
        (els) =>
          els
            .map((e) => getComputedStyle(e).backgroundColor)
            .filter((c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent').length,
      );
      expect(transparent, '띠의 칸이 투명하다 — 증명이 보이지 않는다').toBe(0);
    });

    test('속도를 바꾸면 띠가 다시 그려진다 — 네트워크 왕복 없이', async ({ page }) => {
      await page.setViewportSize(FOLD);
      await page.goto('/csat/plan', { waitUntil: 'networkidle', timeout: 45_000 });

      const heading = page.locator('#plan-time-h');
      const before = (await heading.textContent()) ?? '';
      const widths = () =>
        page
          .locator('[data-proof="plan-timeline"] span[data-no]')
          .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width * 10)));
      const w0 = await widths();

      let requests = 0;
      page.on('request', (r) => {
        if (!/_next\/(static|image)|\.map$|favicon/.test(r.url())) requests += 1;
      });

      // 「빠르게」 — 읽는 속도를 올리면 **걸리는 시간은 줄어야 한다.** 한 번 뒤집어 썼던 자리다.
      const t0 = Date.now();
      await page.getByRole('button', { name: '빠르게' }).click();
      await expect.poll(async () => (await widths()).join(','), { timeout: 2_000 }).not.toBe(w0.join(','));
      const elapsed = Date.now() - t0;

      const after = (await heading.textContent()) ?? '';
      expect(after, '속도를 바꿨는데 문구가 그대로다').not.toBe(before);
      expect(elapsed, `반응이 느리다 (${elapsed}ms)`).toBeLessThan(1_000);
      expect(requests, `속도 한 번에 네트워크 요청 ${requests}건`).toBeLessThanOrEqual(2);

      // 빠르게 읽으면 칸의 합이 줄어야 한다(늘면 배율을 곱하는 방향이 뒤집힌 것이다).
      const w1 = await widths();
      expect(
        w1.reduce((a, b) => a + b, 0),
        '「빠르게」를 골랐는데 시간이 늘었다 — 배율 방향이 뒤집혔다',
      ).toBeLessThan(w0.reduce((a, b) => a + b, 0));
    });

    test('계획 화면도 390px 에서 밀리지 않고 44px 를 지킨다', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/csat/plan', { waitUntil: 'networkidle', timeout: 45_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `390px 에서 가로로 ${overflow}px 밀린다`).toBeLessThanOrEqual(1);
      const offenders = await page.evaluate(scanTapTargets, {
        min: TAP_MIN,
        minTextWidth: TAP_MIN_TEXT_WIDTH,
      });
      expect(offenders.map(describeOffender), '터치 타깃 규칙 위반').toEqual([]);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`계획 화면 ${theme} axe WCAG2 A/AA 위반 0`, async ({ page }) => {
        await page.setViewportSize(FOLD);
        await page.goto('/csat/plan', { waitUntil: 'networkidle', timeout: 45_000 });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('vocaflow-theme', t);
        }, theme);
        await page.waitForTimeout(500);
        expect(await axeViolations(page), `${theme} axe 위반`).toEqual([]);
      });
    }
  });

  // ── 훈련 화면 ───────────────────────────────────────────────────────
  // 이 화면이 무너지는 방식은 「안 돌아간다」가 아니라 **「돌아가는데 아무것도 안 잰다」**다:
  // 답을 골라도 채점이 안 되거나, 정답이 보기에 없거나, 서버·클라이언트 보기 순서가 어긋나거나.
  test.describe('훈련 화면 — 인출이 실제로 일어나는가', () => {
    test('여덟 문제가 있고 보기가 넷이며 답을 고르면 채점된다', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.setViewportSize(FOLD);
      await page.goto('/csat/drill', { waitUntil: 'networkidle', timeout: 60_000 });

      await expect(page.getByRole('heading', { level: 1, name: '오답 감별 훈련' })).toBeVisible();
      // 문제 한 장이 보이고 보기가 넷이다.
      await expect(page.locator('article')).toBeVisible();
      const options = page.locator('ul.grid button');
      await expect(options).toHaveCount(4);

      // **아무것도 안 고른 상태에서 정답이 드러나 있으면 안 된다.**
      expect(await page.locator('text=잡는 법').count(), '고르기 전에 답이 보인다').toBe(0);

      await options.first().click();
      // 채점 결과가 뜬다 — 맞든 틀리든 `role="status"` 한 덩어리.
      await expect(page.locator('[role="status"]')).toBeVisible();
      // 고른 뒤에는 보기가 잠긴다 — 답을 바꿔 가며 찍으면 인출이 아니다.
      expect(await page.locator('ul.grid button:not([disabled])').count(), '고른 뒤에도 보기를 누를 수 있다').toBe(
        0,
      );
      await expect(page.getByRole('button', { name: /다음|결과 보기/ })).toBeVisible();

      expect(
        errors.filter(
          (e) =>
            !/favicon|ResizeObserver|Download the React DevTools/i.test(e) &&
            !/fast ?refresh|hot-reloader|hot update|webpack-internal/i.test(e),
        ),
        '콘솔 에러',
      ).toEqual([]);
    });

    test('여덟 개를 끝까지 풀면 결과와 다음 걸음이 나온다', async ({ page }) => {
      await page.setViewportSize(FOLD);
      await page.goto('/csat/drill', { waitUntil: 'networkidle', timeout: 60_000 });

      for (let i = 0; i < 8; i++) {
        await page.locator('ul.grid button').first().click();
        await page.getByRole('button', { name: /다음|결과 보기/ }).click();
      }

      // 결과 — 숫자를 말하고, **기록이 아직 안 남는다는 사실**도 말해야 한다(거짓 약속 금지).
      await expect(page.getByText(/8개 중 \d개를 맞혔어요/)).toBeVisible();
      await expect(page.getByText(/아직 이 결과는 저장되지 않아요/)).toBeVisible();
      // 막다른 화면을 만들지 않는다(D5).
      await expect(page.getByRole('link', { name: /여덟 개 더/ })).toBeVisible();
    });

    test('허브에서 훈련으로 가는 문이 있다', async ({ page }) => {
      // 도달할 수 없는 화면은 없는 화면이다 — `/csat/overlay` 가 이미 그렇게 묻혔다.
      await page.goto('/csat', { waitUntil: 'networkidle', timeout: 45_000 });
      const link = page.getByRole('link', { name: /오답 감별 훈련/ });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/csat\/drill/, { timeout: 30_000 });
    });

    test('훈련 화면도 390px 에서 밀리지 않고 44px 를 지킨다', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/csat/drill', { waitUntil: 'networkidle', timeout: 60_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `390px 에서 가로로 ${overflow}px 밀린다`).toBeLessThanOrEqual(1);
      const offenders = await page.evaluate(scanTapTargets, {
        min: TAP_MIN,
        minTextWidth: TAP_MIN_TEXT_WIDTH,
      });
      expect(offenders.map(describeOffender), '터치 타깃 규칙 위반').toEqual([]);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`훈련 화면 ${theme} axe WCAG2 A/AA 위반 0`, async ({ page }) => {
        await page.setViewportSize(FOLD);
        await page.goto('/csat/drill', { waitUntil: 'networkidle', timeout: 60_000 });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('vocaflow-theme', t);
        }, theme);
        await page.waitForTimeout(500);
        // 답을 고른 뒤(정답/오답 피드백이 뜬 상태)도 함께 본다 — 그때만 나오는 색이 있다.
        await page.locator('ul.grid button').first().click();
        await page.waitForTimeout(400);
        expect(await axeViolations(page), `${theme} axe 위반`).toEqual([]);
      });
    }
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
