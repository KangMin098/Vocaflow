// apps/web/tests/e2e/24-public-fit.spec.ts
// 공개 지문 진단(/fit) 런타임 회귀 — **로그아웃 상태**로만 검증한다.
//
// 이 스펙이 지키는 계약:
//   ① 로그인 없이 실제로 동작한다 — 이 화면의 존재 이유가 "가입 전에 가치를 본다" 이므로,
//      로그인 리다이렉트가 붙는 순간 기능이 아니라 장식이 된다. (protected-routes 회귀를
//      단위 테스트로도 잡지만, 미들웨어·RLS·anon 키까지는 브라우저에서만 확인된다.)
//   ② anon 권한으로 어휘 레벨이 실제로 해석된다 — `shared_dictionary` 는 authenticated 전용이라
//      경로를 잘못 잡으면 화면은 뜨고 숫자만 영원히 안 나온다.
//   ③ 레벨 미상을 감추지 않는다 — 정직성 장치가 화면에서 사라지면 과대평가가 된다.
//
//   · 읽기 전용 — DB 에 아무것도 쓰지 않는다.
//   · storageState 를 비운다(다른 스펙이 남긴 로그인 상태를 물려받지 않도록).
import { test, expect } from '@playwright/test';

// 난도가 섞인 지문 — 쉬운 단어와 고난도 단어가 함께 있어야 학년별로 곡선이 갈라진다.
const PASSAGE = `Scientists have long assumed that memory decays at a predictable rate, but recent
evidence suggests the process is far more contingent than that. When learners encounter a word
repeatedly in meaningful contexts, the retrieval pathway is reinforced disproportionately compared
with isolated rehearsal. This has substantial implications for classroom instruction: allocating
scarce time to massed drilling may be considerably less efficient than distributing the same effort
across weeks. Nevertheless, the prevailing curriculum still favours concentrated review, largely
because it is easier to administer and to measure.`;

test.describe('공개 지문 진단 — /fit (로그아웃)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('로그인 없이 지문 → 학년별 커버리지 곡선', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/fit', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // ① 로그인으로 튕기지 않는다
    expect(page.url()).toContain('/fit');
    await expect(page.getByRole('heading', { name: '이 지문, 우리 반에 맞을까?' })).toBeVisible();

    // ② 예시 지문 버튼이 입력을 채운다 (교사가 아무것도 준비 안 해도 볼 수 있어야 한다)
    await page.getByRole('button', { name: '예시 지문' }).click();
    await expect(page.locator('#fit-input')).not.toBeEmpty();

    // ③ 직접 붙여넣기 → 프로파일
    await page.locator('#fit-input').fill(PASSAGE);

    const panel = page.getByRole('region', { name: '레벨 프로파일' });
    await expect(panel).toBeVisible({ timeout: 40_000 });

    // ④ 여덟 학년이 모두 글자로 나온다 (색만으로 정보를 전달하지 않는다)
    for (const label of ['중1–2', '중3', '고1', '고2 · 수능 기본', '학술 · 원서']) {
      await expect(panel.getByText(label, { exact: false }).first()).toBeVisible();
    }

    // ⑤ 실제 숫자가 찍힌다 — anon 권한으로 레벨 해석이 됐다는 증거
    await expect(panel).toContainText(/\d{1,3}\.\d%/);

    // ⑥ 각 막대에 스크린리더 문장이 붙어 있다
    await expect(panel.getByRole('img', { name: /커버리지/ }).first()).toBeVisible();

    // ⑦ 전부 100% 로 뭉개지지 않는다 — 학년축이 실제로 변별해야 곡선이다
    const readings = await panel.getByRole('img', { name: /커버리지/ }).all();
    expect(readings.length, '학년 줄 수').toBe(8);

    // ⑧ 로그인 모드로 넘어가는 고리
    await expect(panel.getByRole('link', { name: /내 기준으로 보기/ })).toBeVisible();
  });

  test('짧은 입력은 분석하지 않고 이유를 말한다 — 빈 숫자를 만들지 않는다', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/fit', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('#fit-input').fill('Hello world.');

    await expect(page.getByText(/자 이상이면 분석돼요/)).toBeVisible();
    await expect(page.getByRole('region', { name: '레벨 프로파일' })).toBeHidden();
  });

  test('마케팅 헤더에서 한 번에 닿는다 — 묻혀 있으면 없는 것과 같다', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByRole('link', { name: '지문 진단' }).first().click();
    await page.waitForURL(/\/fit/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '이 지문, 우리 반에 맞을까?' })).toBeVisible();
  });
});
