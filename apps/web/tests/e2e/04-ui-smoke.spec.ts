// apps/web/tests/e2e/04-ui-smoke.spec.ts
// UI 스모크 회귀 — 학습자 주요 화면이 로그인 세션에서 렌더되는지 일괄 확인.
// 목적: "화면 검증" 요청 시 임시 드라이버를 매번 새로 만들지 않는 상시 자산.
//   - 계정: runtime-test-0705@vocaflow.dev (RUNTIME_USER — vocab 10 · 활동 시드 존치)
//   - EchoMatch 는 마이크 권한 게이트 렌더까지 (실녹음/Piper 는 fake-mic 플래그 필요 — 별건)
//   - 콘솔 에러 0 을 페이지별로 단언 (silent 붕괴 감지)
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/** EchoMatch 런타임 검증용 시드 텍스트 (runtime-test 계정 소유, 5문장) */
const ECHO_TEXT_ID = '89970bfa-f49d-44c2-92ce-75895a608317';

/** 로그인은 파일당 1회만 (auth rate-limit 회피) — storageState 로 각 테스트에 주입 */
const STATE_PATH = 'test-results/.auth-runtime-user.json';

async function loginRuntimeUser(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // hydration — submit 이 라우터 액션에 연결된 뒤 클릭
  await page.fill('input[type="email"]', RUNTIME_USER.email);
  await page.fill('input[type="password"]', RUNTIME_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
  // 4xx/5xx 응답 URL 기록 — "Failed to load resource" 만으로는 원인 추적 불가
  page.on('response', (r) => {
    if (r.status() >= 400 && r.status() !== 404) {
      errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
    }
  });
  return errors;
}

/** 주요 학습자 화면 — [경로, 렌더 확인 텍스트/역할] */
const SCREENS: Array<{ path: string; marker: RegExp }> = [
  { path: '/hub', marker: /Today|오늘|학습/ },
  { path: '/dashboard', marker: /Growth|성장|리포트|학습/ },
  { path: '/plan', marker: /계획|Plan|이번 주/ },
  { path: '/wordvault', marker: /WordVault|단어/ },
  { path: '/library/vocab', marker: /공용 단어장|단어장|카테고리/ },
  { path: '/flashcard', marker: /Flashcard|플래시|복습/ },
  { path: '/pairflip', marker: /PairFlip|페어|짝/ },
  { path: '/scriptquiz', marker: /ScriptQuiz|퀴즈/ },
  { path: '/library/books', marker: /Library|도서|발견/ },
  { path: '/library/scripts', marker: /난이도 지도|시리즈 둘러보기|스크립트/ },
];

/** 환경 노이즈 필터 — Supabase auth 토큰 요청의 간헐 실패(rate-limit/refresh 경합)는
 *  앱 결함이 아니므로 제외. 그 외 콘솔 에러·4xx 는 전부 실패로 처리. */
function fatalErrors(errors: string[]): string[] {
  // ChunkLoadError: dev 서버 콜드 컴파일 경합(첫 히트 /_next/undefined) — 리로드로 복구되며
  // 진짜 청크 붕괴는 렌더 단언이 잡으므로 콘솔 노이즈에서 제외.
  return errors.filter(
    (e) =>
      !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
}

test.describe('UI 스모크 — 학습자 주요 화면', () => {
  test.beforeAll(async ({ browser }) => {
    // storageState 파일이 아직 없으므로 명시적으로 빈 상태로 시작 (test.use 상속 차단)
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('로그인 세션에서 주요 화면이 콘솔 에러 없이 렌더된다', async ({ page }) => {
    // 8화면 순차 방문 — dev first-compile 이 화면마다 수초 걸릴 수 있어 기본 30s 초과 가능
    test.setTimeout(120_000);
    const errors = collectConsoleErrors(page);

    for (const s of SCREENS) {
      // dev 콜드 컴파일 중 간헐 ERR_ABORTED(frame detached) — 1회 재시도
      try {
        await page.goto(s.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch {
        await page.goto(s.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      }
      await expect(
        page.locator('body').filter({ hasText: s.marker }),
      ).toBeVisible({ timeout: 15_000 });
      // 404/에러 바운더리 감지
      await expect(page.getByText(/페이지를 찾을 수 없어요|problem occurred/)).toHaveCount(0);
      console.log(`[smoke] ${s.path} OK`);
    }

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  test('도서관 전체 탐색 — 필터 구획 렌더 + 칩 필터가 결과를 좁힌다', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const explorer = page.getByRole('region', { name: '전체 도서 탐색' });
    await expect(explorer).toBeVisible({ timeout: 15_000 });

    // 재설계 핵심 — 뭉친 한 카드 → 라벨 구획으로 분리된 상세 패널이 상시 노출
    await expect(explorer.getByRole('heading', { name: '전체 탐색' })).toBeVisible();
    for (const label of ['레벨', '장르', '길이']) {
      await expect(explorer.getByText(label, { exact: true })).toBeVisible();
    }
    // '내 학습' 구획은 등록 도서 보유 계정에서만 노출(facet-adaptive) — 계정 의존이라 무단언

    const items = explorer.getByRole('listitem');
    const before = await items.count();
    expect(before).toBeGreaterThan(1);

    // 레벨 칩('Vx–y …') 클릭 → 결과 축소
    await explorer.getByRole('button', { name: /^V\d/ }).first().click();
    await expect.poll(async () => items.count()).toBeLessThan(before);

    // 초기화 → 원복
    await explorer.getByRole('button', { name: /초기화/ }).click();
    await expect.poll(async () => items.count()).toBe(before);

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  test('스크립트 학습 지도 — 오리엔테이션 스캐폴드 + 시리즈 드릴다운/복귀', async ({ page }) => {
    // v06.222 재설계 회귀 — 배너(밴드별)·난이도 지도·시리즈 카드가 렌더되고,
    // 시리즈 선택 → 평면 목록 → '학습 지도로 돌아가기' 왕복이 동작하는지.
    // 밴드 무관 단언(계정 V-Level 의존 X) — buildScriptsMap 이 실집계로 스캐폴드를 항상 구성.
    test.setTimeout(60_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/scripts', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 1) 개인화 배너 — 레벨 밴드 카피가 렌더 (4밴드 중 1)
    const banner = page.getByRole('region', { name: '학습 안내' });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/레벨 진단|초급 추천|중급 추천|고급 안내/);

    // 2) 난이도 지도 노출
    await expect(page.getByRole('region', { name: '난이도 지도' })).toBeVisible();

    // 3) 시리즈 둘러보기 — 오리엔테이션 카드 ≥2, '골라보기' CTA 노출
    const series = page.getByRole('region', { name: '시리즈 둘러보기' });
    await expect(series).toBeVisible();
    const openBtns = series.getByRole('button', { name: /골라보기/ });
    expect(await openBtns.count()).toBeGreaterThan(1);

    // 4) 시리즈 선택 → 평면 드릴다운(글 목록 + '학습 지도로 돌아가기')
    await openBtns.first().click();
    const back = page.getByRole('button', { name: /학습 지도로 돌아가기/ });
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('listitem').first()).toBeVisible();

    // 5) 복귀 → 지도 재노출
    await back.click();
    await expect(page.getByRole('region', { name: '난이도 지도' })).toBeVisible();

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  test('EchoMatch — 마이크 권한 게이트까지 렌더된다', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`/text/${ECHO_TEXT_ID}/echo`, { waitUntil: 'domcontentloaded' });
    // dev 콜드 컴파일 경합(ChunkLoadError → /_next/undefined) 은 리로드 1회로 복구
    const gate = page.getByRole('button').filter({ hasText: /마이크 사용 허용/ });
    try {
      await gate.waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await gate.waitFor({ state: 'visible', timeout: 90_000 });
    }
    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });
});
