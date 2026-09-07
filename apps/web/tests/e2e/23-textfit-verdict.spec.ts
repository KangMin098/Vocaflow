// apps/web/tests/e2e/23-textfit-verdict.spec.ts
// TextFit 지문 적합도 판정 런타임 회귀 — /text/new 에서 추출보다 **먼저** 뜨는 판정 카드.
//
// 이 스펙이 지키는 계약:
//   ① 판정이 실제로 뜬다 — 서버 액션(analyzeText)이 조용히 죽으면 화면은 그대로 뜨고
//      카드만 영원히 안 나온다. 단위 테스트로는 절대 잡히지 않는 종류의 실패다.
//   ② 같은 화면에서 **추출보다 위**에 있다 — "무엇을 배울까" 전에 "이 글이 맞나" 를 답하는 순서.
//   ③ 근거를 펼칠 수 있다 — 숫자만 던지고 출처를 못 밝히면 신뢰 장치가 아니라 장식이다.
//
//   · 계정: runtime-test-0705@vocaflow.dev (진단 v11 · vocab 10 · stage S3)
//   · 읽기 전용 — DB 에 아무것도 쓰지 않는다(정리 불필요).
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-runtime-textfit.json';

// 난이도가 섞인 지문 — 기지어(the/of/and)와 고난도어가 함께 있어야 커버리지가 0%/100% 극단으로
// 붙지 않는다. 극단값이면 대역·처방 UI 가 렌더되지 않아 회귀를 못 잡는다.
const PASSAGE =
  'The committee allocated a substantial subsidy to mitigate the deteriorating conditions. ' +
  'Their empirical findings challenged prevalent assumptions about cognitive development, ' +
  'and the discrepancy between the two datasets proved inherently ambiguous. ' +
  'Nevertheless, researchers advocated a coherent paradigm that could accommodate ' +
  'the anomalous observations without resorting to arbitrary reclassification.';

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

test.describe('TextFit — 지문 적합도 판정', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('본문 입력 → 커버리지 판정 카드 + 근거 펼침', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/text/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('textarea').first().fill(PASSAGE);

    // 판정 카드 — 입력 후 디바운스(600ms) + 서버 왕복.
    const card = page.getByRole('region', { name: '지문 적합도 판정' });
    await expect(card).toBeVisible({ timeout: 30_000 });

    // ① 커버리지 백분율이 실제 숫자로 찍힌다 (NaN·undefined 방어)
    await expect(card).toContainText(/\d{1,3}\.\d%/);

    // ② 대역 라벨이 글자로도 나온다 — 색만으로 정보를 전달하지 않는다는 규약
    await expect(
      card.getByText(/술술 읽힘|지금 딱 좋음|정독 구간|도전 구간|아직 이른 글/),
    ).toBeVisible();

    // ③ 스케일에 스크린리더 문장이 붙어 있다
    await expect(card.getByRole('img', { name: /어휘 커버리지/ })).toBeVisible();

    // ④ 추출 패널보다 **위** — 판정이 먼저다
    const cardBox = await card.boundingBox();
    const extractBtn = page.getByRole('button', { name: /추출 분석/ }).first();
    const btnBox = await extractBtn.boundingBox();
    expect(cardBox, '판정 카드 위치').not.toBeNull();
    expect(btnBox, '추출 버튼 위치').not.toBeNull();
    expect(cardBox!.y, '판정 카드가 추출 버튼보다 위에 있어야 한다').toBeLessThan(btnBox!.y);

    // ⑤ 근거 펼침 — 숫자의 출처를 밝힐 수 있어야 한다
    const toggle = card.getByRole('button', { name: /이 숫자가 나온 근거/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(card).toContainText('러닝 워드');
    await expect(card).toContainText('Hu & Nation');
  });

  test('본문을 지우면 판정도 사라진다 — 낡은 숫자를 남기지 않는다', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/text/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const textarea = page.locator('textarea').first();
    await textarea.fill(PASSAGE);

    const card = page.getByRole('region', { name: '지문 적합도 판정' });
    await expect(card).toBeVisible({ timeout: 30_000 });

    await textarea.fill('');
    await expect(card).toBeHidden({ timeout: 15_000 });
  });
});
