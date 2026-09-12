// apps/web/tests/e2e/09-etymology-set.spec.ts
// 어원 단어장 렌더 회귀 — /library/vocab 의 etymology-core 세트가 학습자에게 어근 챕터로 보이는지.
//   핵심: VocabSetPreviewModal 이 shared_words.chapter 그룹을 아코디언으로 + korean_learner_note(어근 라벨)를
//         챕터 헤딩으로 승격(어원 세트의 핵심). 숫자 "Chapter N"만 나오면 어원 가치가 안 보임 → 회귀 방지.
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};
const STATE_PATH = 'playwright-auth/.auth-runtime-user.json';
const SET_TITLE = '어원으로 익히는 핵심 영단어';

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

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.status() !== 404) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`); });
  return errors;
}
function fatalErrors(errors: string[]): string[] {
  return errors.filter((e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e));
}

test.describe('어원 단어장 — etymology-core 어근 챕터 렌더', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('/library/vocab 에서 어원 세트가 어근 라벨 챕터로 열린다', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);

    await page.goto('/library/vocab', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // ★ 프로미넌스: 기본 뷰(캐러셀)에 first-class '어원' 카테고리 탭이 노출된다.
    const etymTab = page.getByRole('tab', { name: /어원/ });
    await expect(etymTab).toBeVisible({ timeout: 20_000 });
    await etymTab.click();
    // 어원 탭 선택 시 캐러셀이 어원 세트를 보여준다(중앙 메타 제목).
    await expect(page.getByRole('heading', { name: SET_TITLE }).first()).toBeVisible({ timeout: 10_000 });

    // 검색어 입력 → 평탄 그리드(isGrouped=false)로 전환 → 세트 카드 → 미리보기 모달(어근 챕터).
    const search = page.getByRole('searchbox', { name: '공용 단어장 검색' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('어원');

    // 어원 세트 카드(aria-label="{title} 미리보기 열기")
    const card = page.getByRole('button', { name: `${SET_TITLE} 미리보기 열기` });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.scrollIntoViewIfNeeded();
    await card.click();

    // 미리보기 모달
    const dialog = page.getByRole('dialog', { name: SET_TITLE });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // 챕터형 서브타이틀(총 N개 단어 · M챕터) — 챕터 인식됨
    await expect(dialog.getByText(/총 .* · \d+챕터/)).toBeVisible({ timeout: 10_000 });

    // ★ 핵심: 챕터 헤딩이 숫자가 아니라 "어근 X — 뜻" 라벨로 노출 (korean_learner_note 승격)
    await expect(dialog.getByText(/어근 \S+ —/).first()).toBeVisible({ timeout: 10_000 });

    // 열린 첫 챕터에 실제 파생어(영단어 + 뜻)가 렌더
    const firstWord = dialog.getByRole('button', { name: /발음 듣기/ }).first();
    await expect(firstWord).toBeVisible();

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
    console.log('[etymology] 어근 라벨 챕터 렌더 확인');
  });

  test('주제별 세트 — L2 소주제 챕터 라벨로 열린다', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);
    await page.goto('/library/vocab', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 검색 → 평탄 그리드 → 여행 주제 세트 카드 → 모달
    const search = page.getByRole('searchbox', { name: '공용 단어장 검색' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('여행 주제');
    const card = page.getByRole('button', { name: '여행 주제 어휘 미리보기 열기' });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const dialog = page.getByRole('dialog', { name: '여행 주제 어휘' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // ★ 챕터 헤딩 = L2 소주제 라벨(숫자 아님) — 교통/휴가 등
    await expect(dialog.getByText(/교통|휴가/).first()).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('button', { name: /발음 듣기/ }).first()).toBeVisible();

    const fatal = fatalErrors(errors);
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
    console.log('[topic] 소주제 챕터 라벨 렌더 확인');
  });
});
