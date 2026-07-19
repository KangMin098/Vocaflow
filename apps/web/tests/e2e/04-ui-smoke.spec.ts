// apps/web/tests/e2e/04-ui-smoke.spec.ts
// UI 스모크 회귀 — 학습자 주요 화면이 로그인 세션에서 렌더되는지 일괄 확인.
// 목적: "화면 검증" 요청 시 임시 드라이버를 매번 새로 만들지 않는 상시 자산.
//   - 계정: runtime-test-0705@vocaflow.dev (RUNTIME_USER — vocab 10 · 활동 시드 존치)
//   - EchoMatch 는 마이크 권한 게이트 렌더까지 (실녹음/Piper 는 fake-mic 플래그 필요 — 별건)
//   - 콘솔 에러 0 을 페이지별로 단언 (silent 붕괴 감지)
import { test, expect, type Page } from '@playwright/test';

import { getUserVLevel, setUserVLevel, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/** EchoMatch 런타임 검증용 시드 텍스트 (runtime-test 계정 소유, 5문장) */
const ECHO_TEXT_ID = '89970bfa-f49d-44c2-92ce-75895a608317';

/** 로그인은 파일당 1회만 (auth rate-limit 회피) — storageState 로 각 테스트에 주입 */
const STATE_PATH = 'test-results/.auth-runtime-user.json';

async function loginRuntimeUser(page: Page) {
  // 배치 실행 시 테스트마다 새 로그인 → auth 스로틀/dev 컴파일 경합으로 리다이렉트 지연 →
  //   waitForURL 타임아웃(false-fail)이 잦았음. 1회 재시도로 견고화(v06.222).
  //   (근본 개선: STATE_PATH storageState 재사용 — 후속.)
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800); // hydration — submit 이 라우터 액션에 연결된 뒤 클릭
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(2_000); // 스로틀/경합 완화 후 재시도
    }
  }
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
  { path: '/library/scripts', marker: /먼저 이걸로|다른 주제로 읽기|스크립트/ },
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

    // 레벨 칩('Vx–y …') 클릭 → 결과 축소.
    // hydration 완료 전 클릭은 핸들러 미부착으로 유실되므로 반영될 때까지 재시도
    // (aria-pressed 확인 후 미선택 시에만 클릭 → 토글-오프 방지, 콜드 컴파일에도 견고).
    // dev 콜드 컴파일/HMR 경합 시 클라 번들 미로딩으로 hydration 이 지연 → 클릭이 유실될 수 있음.
    // aria-pressed 로 반영 확인, 미반영 지속 시 1회 리로드로 fresh 번들 유도(EchoMatch 패턴).
    const levelChip = explorer.getByRole('button', { name: /^V\d/ }).first();
    let reloaded = false;
    await expect(async () => {
      if ((await levelChip.getAttribute('aria-pressed')) !== 'true') await levelChip.click();
      const c = await items.count();
      if (c >= before && !reloaded) {
        reloaded = true;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(levelChip).toBeVisible({ timeout: 15_000 });
      }
      expect(await items.count()).toBeLessThan(before);
    }).toPass({ timeout: 30_000 });

    // 초기화 → 원복 (초기화 시 버튼이 사라지므로 보일 때만 클릭 → idempotent)
    const resetBtn = explorer.getByRole('button', { name: /초기화/ });
    await expect(async () => {
      if (await resetBtn.isVisible()) await resetBtn.click();
      expect(await items.count()).toBe(before);
    }).toPass({ timeout: 10_000 });

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  test('스크립트 진입면 — 조용한 초대 + 시리즈 상세/복귀', async ({ page }) => {
    // v06.238 재설계 회귀 — Progressive Disclosure:
    //   진입면(밴드 한줄 안내 + 추천 히어로 + 나머지 rows) → 시리즈 선택 → 상세(깊이+글 목록) → 복귀.
    // 밴드 무관 단언(계정 V-Level 의존 X) — buildScriptsMap 이 실집계로 진입면을 항상 구성.
    test.setTimeout(60_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/scripts', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 1) 밴드별 한 줄 안내
    const guide = page.getByRole('region', { name: '학습 안내' });
    await expect(guide).toBeVisible({ timeout: 15_000 });
    await expect(guide).toContainText(/레벨 진단|초급 추천|중급 추천|고급 안내/);

    // 2) 추천 히어로 1개 + 나머지 시리즈 rows
    const hero = page.getByRole('region', { name: '추천 시리즈' });
    await expect(hero).toBeVisible();
    await expect(page.getByRole('region', { name: '다른 시리즈' }).getByRole('listitem').first()).toBeVisible();

    // 3) 히어로 선택 → 상세(글 목록 + '시리즈 목록' 뒤로).
    //   v06.238 히어로는 버튼 2개 — 본문='학습 안내 보기'(팝업), 하단='글 둘러보기'(시리즈 진입).
    //   시리즈 상세로 가려면 '글 둘러보기'(onEnter)를 눌러야 함. .first()(=안내 팝업)를 누르면
    //   시트 오버레이가 열려 이후 클릭이 가로막힘. hydration 지연 대비 toPass 재클릭.
    const back = page.getByRole('button', { name: /시리즈 목록/ });
    await expect(async () => {
      if (!(await back.isVisible())) {
        await hero.getByRole('button', { name: /글 둘러보기/ }).click();
      }
      await expect(back).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByRole('region', { name: '글 목록' }).getByRole('listitem').first()).toBeVisible();

    // 4) 복귀 → 진입면 재노출
    await back.click();
    await expect(page.getByRole('region', { name: '추천 시리즈' })).toBeVisible();

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

  test('스크립트 진입면 — 레벨 밴드별 안내·추천 적응', async ({ page }) => {
    // v06.238 재설계 핵심(레벨 적응성) 실 로그인 E2E — current_v_level 을 초급/중급/고급으로
    // 바꿔가며 진입면 '학습 안내' 한 줄(eyebrow+title)이 밴드에 맞게 달라지는지.
    //   · 클린 서버에선 브라우저 supabase.auth.getUser() 200 → useUserVLevel 실 V-Level 반영 확인됨.
    //   · SSR 은 미진단 기본 렌더 → 하이드레이션 후 SWR fetch 로 flip → toContainText auto-retry 로 대기.
    //   · service-role 로 DB 직접 변경 후 finally 원복. 마지막 테스트 배치(원복 실패해도 앞 단언 무영향).
    test.setTimeout(90_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'SERVICE_ROLE_KEY 없음 — 밴드 적응성 검증 건너뜀 (진입면/로직은 별도 테스트가 커버)');

    const original = await getUserVLevel(userId!);
    const guide = page.getByRole('region', { name: '학습 안내' });

    // [V레벨, 기대 eyebrow, 기대 title] — 초급/중급/고급 3밴드
    const bands: Array<{ v: number; eyebrow: RegExp; title: RegExp }> = [
      { v: 2, eyebrow: /초급 추천/, title: /듣기와 쉬운 글부터/ },
      { v: 5, eyebrow: /중급 추천/, title: /수준에 맞는 글이 가장 많아요/ },
      { v: 9, eyebrow: /고급 안내/, title: /대부분 수월하게 읽혀요/ },
    ];

    try {
      for (const b of bands) {
        expect(await setUserVLevel(userId!, b.v), `set current_v_level=V${b.v}`).toBe(true);
        await page.goto('/library/scripts', { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await expect(guide, `V${b.v} 안내 eyebrow`).toContainText(b.eyebrow, { timeout: 20_000 });
        await expect(guide, `V${b.v} 안내 title`).toContainText(b.title);
        console.log(`[smoke] band V${b.v} → ${b.eyebrow.source} OK`);
      }
    } finally {
      if (original != null) await setUserVLevel(userId!, original);
    }
  });
});
