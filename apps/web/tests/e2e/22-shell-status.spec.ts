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
const STATE_PATH = 'test-results/.auth-shell-status.json';

async function login(page: Page) {
  for (let i = 1; i <= 2; i++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
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

test.describe('셸 상태 표면 (ADR 0006 D2)', () => {
  // 20-mobile-shell 과 동일한 패턴 — beforeAll 이 상태 파일을 먼저 굽고 test.use 가 읽는다.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('A. 상태 띠는 셸에 정확히 하나다', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });
    const ribbon = page.locator('[aria-label="오늘 상태"]');
    await expect(ribbon).toHaveCount(1);
  });

  test('B. 같은 상태 띠가 다른 표면에서도 하나다 (페이지가 제 헤더를 또 그리지 않는다)', async ({
    page,
  }) => {
    for (const path of ['/hub', '/library', '/wordvault', '/dashboard']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.locator('[aria-label="오늘 상태"]'), `${path} 의 상태 띠`).toHaveCount(1);
    }
  });

  test('C. streak 은 한 화면에 한 번만 나온다', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900); // 클라이언트 페치(useHubData) 도착까지

    // "N일 연속" · "연속 N일" · "Streak" 을 전부 센다 — 표기가 흔들려도 잡히게.
    const body = (await page.locator('body').innerText()) ?? '';
    const hits = body.match(/\d+\s*일\s*연속|연속\s*\d+\s*일|Streak/gi) ?? [];
    expect(hits.length, `streak 표기 ${hits.length}회: ${hits.join(' | ')}`).toBeLessThanOrEqual(1);
  });

  test('D. 기억 4색 범례는 Growth 에만 있다', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const hubText = (await page.locator('body').innerText()) ?? '';
    // 4색 범례의 고유 표지 — 넷이 함께 나오는 것이 범례다
    const hubHasLegend =
      hubText.includes('안정') && hubText.includes('흔들림') && hubText.includes('위급') && hubText.includes('신규');
    expect(hubHasLegend, 'Today 에 기억 4색 범례가 있으면 안 된다').toBe(false);
  });

  test('E. FlowNav 6단계가 사라졌다 (내비 시스템 1개)', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });
    const body = (await page.locator('body').innerText()) ?? '';
    expect(body).not.toContain('클릭하면 바로 시작해요');
  });

  test('F. 학습 세션에서는 상태 띠도 사라진다 (작업기억 보호)', async ({ page }) => {
    await page.goto('/wordvault/browse', { waitUntil: 'networkidle' });
    await expect(page.locator('[aria-label="오늘 상태"]')).toHaveCount(0);
  });

  test('G. 띠의 상호작용 요소는 44px 이상이다', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });
    const links = page.locator('[aria-label="오늘 상태"] a');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const box = await links.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `띠 링크 #${i} 높이`).toBeGreaterThanOrEqual(44);
    }
  });
});
