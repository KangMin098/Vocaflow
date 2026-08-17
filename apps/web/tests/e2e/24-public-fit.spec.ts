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

/**
 * 지문 → 결과 → 공유 URL 을 얻고, 그 주소를 **새로 연다**.
 *
 * ⚠️ 복사 버튼은 `history.replaceState` 로 주소만 바꾼다 — `<head>` 는 서버가 다시 만들지
 *    않으므로 그 상태에는 og:image 메타가 없다. 크롤러는 언제나 URL 을 새로 여니,
 *    미리보기를 검증하려면 테스트도 새로 열어야 한다.
 */
async function openSharedPage(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/fit', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#fit-input').fill(PASSAGE);
  await expect(page.getByRole('region', { name: '레벨 프로파일' })).toBeVisible({ timeout: 40_000 });

  await page.getByRole('button', { name: '결과 링크 복사' }).click();
  await page.waitForURL(/\/fit\/s\//, { timeout: 15_000 });

  const shareUrl = page.url();
  await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return shareUrl;
}

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

  test('결과 링크 복사 → 새 세션에서 열면 같은 판정이 보인다', async ({ page, context }) => {
    test.setTimeout(150_000);
    // 클립보드 읽기 권한 — 복사된 URL 을 실제로 꺼내 온다(중간 단계를 가정하지 않는다).
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/fit', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('#fit-input').fill(PASSAGE);

    const panel = page.getByRole('region', { name: '레벨 프로파일' });
    await expect(panel).toBeVisible({ timeout: 40_000 });

    // 원본 판정의 한 줄 답을 기억해 둔다
    const headline = (await panel.locator('p').first().innerText()).trim();
    expect(headline.length).toBeGreaterThan(5);

    await panel.getByRole('button', { name: '결과 링크 복사' }).click();
    await expect(panel.getByRole('button', { name: '링크 복사됨' })).toBeVisible();

    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareUrl).toContain('/fit/s/');
    // 지문이 링크에 실리지 않는다 — 저작권 계약(share.ts §지문 유출 금지)
    expect(shareUrl).not.toContain('Scientists');
    expect(shareUrl).not.toContain('memory');

    // 주소창도 함께 바뀐다 (새로고침·북마크에도 결과가 남는다)
    expect(page.url()).toContain('/fit/s/');

    // 새 세션(쿠키·상태 없음)에서 링크를 연다
    const fresh = await context.newPage();
    await fresh.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const sharedPanel = fresh.getByRole('region', { name: '레벨 프로파일' });
    await expect(sharedPanel).toBeVisible({ timeout: 30_000 });
    // 출처를 밝힌다 — 남의 숫자를 내 분석처럼 보여주지 않는다
    await expect(sharedPanel.getByText('공유받은 결과')).toBeVisible();
    // 같은 판정이 보인다
    await expect(sharedPanel.locator('p').filter({ hasText: headline }).first()).toBeVisible();

    await fresh.close();
  });

  test('망가진 공유 링크는 빈 결과를 결과처럼 보여주지 않는다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/fit/s/not-a-real-payload', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // not-found 로 끝난다 — 0% 짜리 빈 프로파일을 그리느니 없다고 말한다.
    await expect(page.getByRole('region', { name: '레벨 프로파일' })).toBeHidden();
    await expect(page.locator('body')).toContainText(/찾을 수 없|404/);
  });

  test('공유 링크에 결과 미리보기 이미지가 붙는다 — 안 보이면 눌러야 아는 링크가 된다', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await openSharedPage(page);

    const ogUrl = await page.getAttribute('meta[property="og:image"]', 'content');
    expect(ogUrl, 'og:image 메타').toBeTruthy();
    // 페이로드가 **이미지 URL 안에** 있어야 한다 — 쿼리로 두면 크롤러가 결과를 못 본다.
    expect(ogUrl!).toContain('/fit/s/');

    const res = await request.get(ogUrl!);
    expect(res.status(), 'OG 이미지 응답').toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    // 빈 이미지가 아니다 (곡선과 한글이 실제로 그려졌다는 최소 신호)
    expect((await res.body()).length).toBeGreaterThan(10_000);
  });

  test('계측이 지문을 밖으로 내보내지 않는다 — 화면의 약속이 네트워크에서도 지켜진다', async ({
    page,
  }) => {
    test.setTimeout(150_000);

    // 나가는 **모든** 요청의 본문·URL 을 모은다. 분석 도구만 보는 게 아니라 전부 본다 —
    // "어디로 새는지" 를 미리 정해 두면 정작 다른 곳으로 새는 걸 못 잡는다.
    const outbound: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      // 우리 분석 API 는 토큰 빈도표를 보내는 게 정상이라 제외한다(그건 지문이 아니라 집계다).
      if (url.includes('/api/fit')) return;
      outbound.push(url);
      const body = req.postData();
      if (body) outbound.push(body);
    });

    await page.goto('/fit', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('#fit-input').fill(PASSAGE);
    await expect(page.getByRole('region', { name: '레벨 프로파일' })).toBeVisible({
      timeout: 40_000,
    });
    await page.getByRole('button', { name: '결과 링크 복사' }).click();
    // 이벤트가 실제로 나갈 시간을 준다
    await page.waitForTimeout(2_500);

    const haystack = outbound.join('\n');
    // 지문에만 있는 특징어들 — 하나라도 나가면 약속이 깨진 것이다.
    for (const secret of ['Scientists', 'rehearsal', 'disproportionately', 'curriculum']) {
      expect(haystack, `"${secret}" 가 외부 요청에 실렸다`).not.toContain(secret);
    }
  });

  test('마케팅 헤더에서 한 번에 닿는다 — 묻혀 있으면 없는 것과 같다', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByRole('link', { name: '지문 진단' }).first().click();
    await page.waitForURL(/\/fit/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '이 지문, 우리 반에 맞을까?' })).toBeVisible();
  });
});
