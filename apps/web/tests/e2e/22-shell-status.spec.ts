// apps/web/tests/e2e/22-shell-status.spec.ts
//
// 셸 상태 표면 회귀 — ADR 0006 D2.
//
// 왜 이 스펙이 필요한가:
//   상태 지표가 셸 여기저기로 번지는 것은 **정적 검사로 안 잡힌다**. 각 컴포넌트는 저마다
//   정상이고, 합쳐 놓았을 때만 결함이 된다. 재설계 직전 실측이 그랬다 —
//   streak 이 Sidebar·FlowNav·HubHero 세 곳, 기억 4색이 FlowNav·Growth 두 곳,
//   신규 학습자에게 19개 지표 중 18개가 0.
//
//   그래서 판정을 **렌더된 화면 전체에서 세는 방식**으로 둔다. 새 컴포넌트가 streak 을
//   또 그리면 여기서 깨진다.
//
// 판정은 전부 렌더 후 실측이다 — 클래스 문자열이나 import 를 읽지 않는다.

import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};
const STATE_PATH = 'playwright-auth/.auth-shell-status.json';

async function login(page: Page) {
  for (let i = 1; i <= 2; i++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(700);
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}

/**
 * 클라이언트 무거운 표면(/wordvault 등)으로 연속 이동하면 앞 페이지의 in-flight 요청과
 * 겹쳐 `net::ERR_ABORTED` 가 난다 — 제품 결함이 아니라 이동 경합이다. 한 번 재시도한다.
 */
async function gotoStable(page: Page, path: string) {
  for (let i = 1; i <= 2; i++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await ensureSignedIn(page, path);
      return;
    } catch (e) {
      if (i === 2) throw e;
      await page.waitForTimeout(800);
    }
  }
}

/**
 * **저장된 로그인 상태가 죽었으면 다시 로그인한다.**
 *
 * ── 왜 (실측 2026-09-05) ──────────────────────────────────────────────
 * 이 스펙은 `beforeAll` 에서 한 번 로그인해 `storageState` 로 굽고, 테스트마다 그 파일로
 * 새 컨텍스트를 연다. 그런데 **앞 테스트의 페이지가 세션을 갱신하면 refresh token 이
 * 회전**하고, 파일에 남은 옛 토큰은 유예 시간이 지나면 무효가 된다. 그 다음 테스트는
 * 조용히 **비로그인 상태로** 화면을 열고, 셸 띠는 규정대로 사라진다(비로그인이면 안 그린다).
 *
 * 그래서 실패 메시지가 "상태 띠가 0개" 로 나온다 — 원인은 띠가 아니라 **인증**인데
 * 화면 결함처럼 읽힌다. 실제로 그렇게 한 번 오진했다(A 는 통과, 바로 뒤 B 만 실패,
 * 단독 실행하면 3/3 통과, 실패 스냅샷은 `/hub` 의 **비로그인 온보딩**이었다).
 *
 * 비로그인 판정 신호는 `/hub` 비로그인 화면에만 있는 CTA 다 — 띠의 유무로 판정하면
 * 이 함수가 검사 대상을 검사 기준으로 쓰게 되어 결함을 영영 못 잡는다.
 */
async function ensureSignedIn(page: Page, path: string) {
  const signedOut = await page
    .getByRole('link', { name: '5분 시작하기' })
    .isVisible()
    .catch(() => false);
  if (!signedOut) return;
  await login(page);
  await page.context().storageState({ path: STATE_PATH });
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
}

test.describe('셸 상태 표면 (ADR 0006 D2)', () => {
  // 20-mobile-shell 과 동일한 패턴 — beforeAll 이 상태 파일을 먼저 굽고 test.use 가 읽는다.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  // dev 서버는 라우트별로 컴파일한다 — 여러 표면을 도는 판정은 기본 30s 를 넘긴다.
  test.setTimeout(120_000);

  test('A. 상태 띠는 셸에 정확히 하나다', async ({ page }) => {
    await gotoStable(page, '/hub');
    const ribbon = page.locator('[aria-label="오늘 상태"]');
    await expect(ribbon).toHaveCount(1);
  });

  test('B. 같은 상태 띠가 다른 표면에서도 하나다 (페이지가 제 헤더를 또 그리지 않는다)', async ({
    page,
  }) => {
    for (const path of ['/hub', '/library', '/wordvault', '/dashboard']) {
      await gotoStable(page, path);
      await expect(page.locator('[aria-label="오늘 상태"]'), `${path} 의 상태 띠`).toHaveCount(1);
    }
  });

  test('C. streak 은 한 화면에 한 번만 나온다', async ({ page }) => {
    // ⚠️ /dashboard 를 반드시 포함할 것. 이 판정이 /hub 만 돌던 동안 Growth 에는 연속일이
    // **세 종류**로 떠 있었다(띠 3일 `user_stats.current_streak` · 히어로 3일 ·
    // 히트맵 0일 minutes 기반 자체 계산). 결함이 있던 화면을 안 보는 회귀는 회귀가 아니다.
    for (const path of ['/hub', '/dashboard']) {
      await gotoStable(page, path);
      await page.waitForTimeout(900); // 클라이언트 페치 도착까지

      // "N일 연속" · "연속 N일" · "Streak" 을 전부 센다 — 표기가 흔들려도 잡히게.
      const body = (await page.locator('body').innerText()) ?? '';
      const hits = body.match(/\d+\s*일\s*연속|연속\s*\d+\s*일|Streak/gi) ?? [];
      expect(
        hits.length,
        `${path} streak 표기 ${hits.length}회: ${hits.join(' | ')}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test('D. 기억 4색 범례는 어느 학습 화면에도 없다 (조치는 상태 띠가 소유)', async ({ page }) => {
    // 이름이 원래 "Growth 에만 있다" 였는데 **Growth 를 확인하지 않았다** — /hub 에 없다는
    // 것만 봤다. v06.201 에서 Growth 의 `MemoryStatus` 를 제거해(ADR 0006 D2 의 미완 이행)
    // 4색 범례는 이제 어디에도 없다. 조치 가능 수치(risk+shaky)는 상태 띠 하나가 판다.
    for (const path of ['/hub', '/dashboard']) {
      await gotoStable(page, path);
      await page.waitForTimeout(600);
      const text = (await page.locator('body').innerText()) ?? '';
      // 4색 범례의 고유 표지 — 넷이 함께 나오는 것이 범례다
      const hasLegend =
        text.includes('안정') &&
        text.includes('흔들림') &&
        text.includes('위급') &&
        text.includes('신규');
      expect(hasLegend, `${path} 에 기억 4색 범례가 있으면 안 된다`).toBe(false);
    }
  });

  test('H. 오늘 진행은 한 화면에 한 정의뿐이다 (띠 = 오늘의 흐름)', async ({ page }) => {
    // v06.201 회귀. 이전에는 셸 띠가 `오늘 2/3`(자체 4갈래 모델), 바로 아래 무대의
    // "오늘의 흐름" 이 `0/5`(다른 모델 + 클라이언트 최근활동) 를 동시에 그렸다.
    // 둘 다 근거는 있었지만 학습자는 무엇을 믿을지 알 수 없었다.
    await gotoStable(page, '/hub');
    await page.waitForTimeout(900);

    // v06.34 — 띠는 더 이상 `오늘 2/3` 이라는 **텍스트**를 그리지 않는다(철학 ④ 퍼센트·분수
    // 금지 · 진행은 계단 점으로만). 그래서 정규식으로 읽던 자리를 `data-today-progress` 로
    // 옮겼다. 텍스트 파싱을 그대로 뒀다면 이 판정은 `ribbonMatch === null` 로 **매번 skip** 이
    // 되어, 두 표면이 어긋나도 아무도 모르는 상태로 돌아갔을 것이다(알리바이 회귀).
    const progress = page.locator('[aria-label="오늘 상태"] [data-today-progress]');
    const flow = page.locator('[data-today-flow]');
    if ((await flow.count()) === 0 || (await progress.count()) === 0) {
      // 처방이 없는 날(수동계획·미진단)에는 흐름도 계단도 없다 — 비교할 것이 없으면 통과.
      test.skip(true, '오늘 처방 흐름이 렌더되지 않는 상태');
      return;
    }
    const ribbonProgress = (await progress.first().getAttribute('data-today-progress')) ?? '';
    const ribbonMatch = ribbonProgress.match(/(\d+)\s*\/\s*(\d+)/);
    expect(ribbonMatch, `띠 진행 표기를 읽지 못했다: "${ribbonProgress}"`).not.toBeNull();
    if (!ribbonMatch) return;

    const flowText = (await flow.innerText()) ?? '';
    const flowMatch = flowText.match(/(\d+)\s*\/\s*(\d+)/);
    expect(flowMatch, '오늘의 흐름에 진행 표기가 없다').not.toBeNull();

    expect(
      `${flowMatch![1]}/${flowMatch![2]}`,
      `띠 ${ribbonMatch[1]}/${ribbonMatch[2]} 와 흐름 ${flowMatch![1]}/${flowMatch![2]} 가 다르다`,
    ).toBe(`${ribbonMatch[1]}/${ribbonMatch[2]}`);
  });

  test('E. FlowNav 6단계가 사라졌다 (내비 시스템 1개)', async ({ page }) => {
    await gotoStable(page, '/hub');
    const body = (await page.locator('body').innerText()) ?? '';
    expect(body).not.toContain('클릭하면 바로 시작해요');
  });

  test('F. 학습 세션에서는 상태 띠도 사라진다 (작업기억 보호)', async ({ page }) => {
    await gotoStable(page, '/wordvault/browse');
    await expect(page.locator('[aria-label="오늘 상태"]')).toHaveCount(0);
  });

  /*
   * ── I~K: 나침반 띠 (v06.34) ────────────────────────────────────────────────
   *
   * A~H 는 "상태 표면이 하나인가" 를 지킨다. 아래 셋은 **그 하나가 실제로 말을 하는가** 를
   * 지킨다 — 재설계 직전 실측에서 이 띠는 학습자 라우트 9곳에서 텍스트가 100% 동일했고
   * (칩 하나 `새 단어 8`), 정적 검사로는 그것이 결함으로 보이지 않았다.
   *
   * ⚠️ 국면 4종 중 `complete`(오늘 5블록을 다 마친 날)는 여기서 재지 않는다.
   *    그 상태를 만들려면 이 계정의 학습 기록을 써야 하는데, 같은 계정을 20개 넘는 스펙이
   *    공유하므로 **다른 스펙의 전제를 조용히 바꾼다.** 그 국면은 순수 모델·렌더 회귀가
   *    맡는다(`lib/learner/__tests__/wayfinder.test.ts` · `compass-ribbon.test.tsx`).
   */

  test('I. 띠는 화면마다 다른 위치를 말한다 (9곳에서 같은 문자열이던 결함)', async ({ page }) => {
    const seen = new Set<string>();
    for (const path of ['/library/books', '/wordvault', '/dashboard']) {
      await gotoStable(page, path);
      const text = (await page.locator('[aria-label="오늘 상태"]').innerText()) ?? '';
      // 표면 이름은 `SURFACES[].name` 이 정본이라 영문 한 단어다.
      const label = text.split(/\s+/).find((w) => /^[A-Z]{4,}$/.test(w));
      expect(label, `${path} 에 위치 표기가 없다: "${text.slice(0, 60)}"`).toBeTruthy();
      seen.add(label!);
    }
    expect(seen.size, `세 화면이 같은 위치를 말한다: ${[...seen].join(' | ')}`).toBe(3);
  });

  test('J. 「나의 자리」는 접혀 있고, 펴면 나머지 세 질문이 나온다', async ({ page }) => {
    await gotoStable(page, '/hub');
    const toggle = page.getByRole('button', { name: /나의 자리/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // 철학 ② Progressive Disclosure — 접힌 상태에서는 내용이 DOM 에 없다.
    await expect(page.getByText('사정권', { exact: true })).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('.wayfinder-reveal');
    await expect(panel).toHaveCount(1);
    const text = (await panel.innerText()) ?? '';
    for (const cell of ['여정', '사정권', '지난 7일']) {
      expect(text, `펼친 층에 「${cell}」 이 없다`).toContain(cell);
    }
    // 사정권은 상수가 아니라 카탈로그 실측이어야 한다 — 숫자가 붙어 있어야 한다.
    expect(text).toMatch(/\d[\d,]*권/);

    // 같은 버튼으로 닫힌다 (모달이 아니므로 Esc 가 없어도 막히지 않는다).
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.wayfinder-reveal')).toHaveCount(0);
  });

  test('K. 셸의 CTA 는 하나이고, 누르면 실제로 그 화면으로 간다', async ({ page }) => {
    await gotoStable(page, '/hub');
    const ribbon = page.locator('[aria-label="오늘 상태"]');
    // 계단 점(→ /hub)과 CTA 둘뿐이다. 셸에서 고르게 하지 않는다.
    const links = ribbon.locator('a');
    expect(await links.count(), '띠의 링크가 늘었다 — 셸에서 CTA 는 하나다').toBeLessThanOrEqual(2);

    const cta = links.last();
    const href = await cta.getAttribute('href');
    expect(href, 'CTA 에 목적지가 없다').toBeTruthy();
    await cta.click();
    await page.waitForURL((u) => u.pathname !== '/hub', { timeout: 30_000 });
    expect(page.url()).toContain(href!.split('?')[0]);
  });

  test('G. 띠의 상호작용 요소는 44px 이상이다', async ({ page }) => {
    await gotoStable(page, '/hub');
    const links = page.locator('[aria-label="오늘 상태"] a');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const box = await links.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `띠 링크 #${i} 높이`).toBeGreaterThanOrEqual(44);
    }
  });
});
