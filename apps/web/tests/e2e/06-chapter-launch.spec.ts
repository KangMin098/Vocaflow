// apps/web/tests/e2e/06-chapter-launch.spec.ts
// 챕터 스코프 학습 런처 회귀 (v06.188 · v06.192) — 이번 세션 3기능 런타임 검증:
//   1) /library/vocab 진단 기반 추천 행(FeaturedRow — recommend_word_sets_for_user)
//   2) /plan 공용단어장 런처 챕터 선택(ChapterScopePicker select)
//   3) /wordvault 구독 단어장 → 챕터 학습 모달(VocabSetPreviewModal 아코디언)
// 시드: runtime-test 계정에 '교육과정 기본어휘 (고등)'(25 내부챕터) 구독 + 계획(오늘 요일) 존치.
//   (계정은 진단 완료 V11 — 추천 RPC 가 primary/review 반환)
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/** 로그인은 파일당 1회만 (auth rate-limit 회피) — storageState 로 각 테스트에 주입 */
const STATE_PATH = 'test-results/.auth-runtime-user.json';

async function loginRuntimeUser(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email);
  await page.fill('input[type="password"]', RUNTIME_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('챕터 스코프 학습 런처', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('/library/vocab — 진단 기반 추천 행이 렌더된다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/library/vocab', { waitUntil: 'domcontentloaded' });
    // FeaturedRow 제목: "내 수준 추천 · V{n} 맞춤" (진단 완료 계정만)
    await expect(page.getByRole('heading', { name: /내 수준 추천/ })).toBeVisible({ timeout: 20_000 });
  });

  test('/plan — 공용단어장 런처에 챕터 선택 select 가 노출된다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/plan', { waitUntil: 'domcontentloaded' });
    // 오늘의 학습(시드 계획, 오늘 요일) → LaunchRow → ChapterScopePicker select(aria-label)
    await expect(page.getByLabel('게임을 시작할 챕터 범위').first()).toBeVisible({ timeout: 20_000 });
  });

  test('/wordvault — 구독 단어장 탭에서 챕터 학습 모달이 열린다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/wordvault', { waitUntil: 'domcontentloaded' });
    // ResourcePortfolio(학습 자산) → '단어장' 세그먼트(자산 종류 nav)
    const seg = page.getByRole('navigation', { name: '자산 종류' });
    await seg.getByRole('button', { name: /단어장/ }).click({ timeout: 20_000 });
    // 시드 구독 세트 행(InsetRow onClick) → 모달
    await page.getByRole('button', { name: /교육과정 기본어휘/ }).click({ timeout: 15_000 });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // 챕터 아코디언(25챕터) — Chapter 1 헤더 (fromPath=/wordvault 로 게임 launch 복귀)
    await expect(dialog.getByText(/Chapter\s*1/).first()).toBeVisible({ timeout: 20_000 });
  });
});
