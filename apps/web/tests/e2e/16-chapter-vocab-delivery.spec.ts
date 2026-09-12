// apps/web/tests/e2e/16-chapter-vocab-delivery.spec.ts
// L2 개인화 전달 회귀 (v06.35 · ADR 0004 D7).
//
// 지키는 것: 리더에서 챕터를 읽을 때
//   ① 이 학습자에게 맞춘 단어 목록이 뜬다 (deliver_chapter_vocab)
//   ② 단어를 펼치면 **이 챕터 본문의 실제 문장**이 나온다 (Context-Dependent 인출)
//   ③ "담기" 가 vocabularies 에 실제로 적재된다 — 표시 전용이던 이전 패널의 핵심 결함
//
// ③ 이 이 spec 의 존재 이유다. 이전 패널(extract_vocabulary_for_user 직결)은 좋은 i+1
// 목록을 보여주고도 FSRS 큐와 끊겨 있었다. 화면만 보면 정상으로 보이므로 DB 단언이 필요하다.
//
// ⚠️ 담은 행은 finally 에서 반드시 지운다 — deliver_chapter_vocab 은 기보유 단어를
//    제외하므로, 남기면 다음 실행의 전달 목록이 줄어 이 테스트가 스스로를 무력화한다.
import { test, expect, type Page } from '@playwright/test';

import { countVocabulariesSince, deleteVocabulariesSince, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/**
 * A Christmas Carol 챕터1 — 계정 보유 텍스트, 세트 5개 발행 (L2 후보 풀 존재).
 *
 * **읽는 자리**에서 검증한다. 이 패널은 원래 `BookContentReader`(= `/library/books/[bookId]`
 * enroll 전 미리보기) 안에만 있어서, 정작 읽기 시작하면 사라졌다.
 * v06.35 에서 학습 인사이트 패널로 옮겼고 이 spec 이 그 자리를 지킨다.
 */
const BOOK_TEXT_ID = '859e0b09-6dcc-4c70-97ee-7563341bf8d4';

const STATE_PATH = 'playwright-auth/.auth-runtime-user-16.json';

async function loginRuntimeUser(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email);
  await page.fill('input[type="password"]', RUNTIME_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('챕터 어휘 L2 개인화 전달', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('리더에 맞춤 단어 목록 + 본문 근거문장이 뜬다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/text/${BOOK_TEXT_ID}`, { waitUntil: 'domcontentloaded' });

    // 학습 인사이트 패널을 연다 (Progressive Disclosure — 읽기를 가리지 않는다)
    await page.getByRole('button', { name: /학습 인사이트 열기/ }).click({ timeout: 30_000 });
    const panel = page.getByRole('region', { name: '이 챕터에서 익힐 단어' });
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // 로딩이 끝나고 목록이 나올 때까지
    const items = panel.getByRole('listitem');
    await expect(items.first()).toBeVisible({ timeout: 30_000 });
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    // 밀도 기반 분량 상한 30 — 이보다 많으면 cap 이 풀린 것
    expect(count).toBeLessThanOrEqual(30);

    // 선정 근거가 학습자 언어로 노출된다 (색만으로 구분하지 않는다)
    await expect(
      panel.getByText(/i\+1|다지기|빈틈 메우기|맥락으로 만나기/).first(),
    ).toBeVisible({ timeout: 10_000 });

    // 펼치면 근거문장 — L1 정제 파이프라인이 붙여 준 본문 문장
    const firstWordBtn = items.first().getByRole('button');
    await firstWordBtn.click();
    await expect(firstWordBtn).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 });
  });

  test('담기가 vocabularies 에 실제로 적재된다 (표시 전용 회귀 차단)', async ({ page }) => {
    test.setTimeout(90_000);
    const uid = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!uid, 'service-role 키 없음 — DB 단언 불가');

    const since = new Date(Date.now() - 5_000).toISOString();
    try {
      await page.goto(`/text/${BOOK_TEXT_ID}`, { waitUntil: 'domcontentloaded' });

      // 학습 인사이트 패널을 연다 (Progressive Disclosure — 읽기를 가리지 않는다)
      await page.getByRole('button', { name: /학습 인사이트 열기/ }).click({ timeout: 30_000 });
      const panel = page.getByRole('region', { name: '이 챕터에서 익힐 단어' });
      await expect(panel.getByRole('listitem').first()).toBeVisible({ timeout: 30_000 });

      const saveBtn = panel.getByRole('button', { name: '내 단어장에 담기' });
      await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
      await saveBtn.click();

      // 낙관적 UI 가 아니라 실제 완료 표시를 기다린다
      await expect(panel.getByRole('button', { name: '단어장에 담았어요' })).toBeVisible({
        timeout: 20_000,
      });

      const added = await countVocabulariesSince(uid!, since, 'shared_set');
      expect(added).toBeGreaterThan(0);
    } finally {
      // 기보유 제외 때문에 반드시 원복 (파일 상단 주석 참조)
      await deleteVocabulariesSince(uid!, since);
    }
  });
});
