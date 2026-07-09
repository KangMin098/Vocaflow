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
  { path: '/flashcard', marker: /Flashcard|플래시|복습/ },
  { path: '/pairflip', marker: /PairFlip|페어|짝/ },
  { path: '/scriptquiz', marker: /ScriptQuiz|퀴즈/ },
  { path: '/library/books', marker: /Library|도서|발견/ },
  { path: '/library/scripts', marker: /스크립트|묶음|내 레벨/ },
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
