// apps/web/tests/e2e/41-csat-type-analysis.spec.ts
//
// 기출 유형 분석 학습자 표면 런타임 회귀 — `/csat` · `/csat/<유형>` · `/csat/plan`.
//
// 이 스펙이 지키는 계약:
//   ① 셋 다 실제 데이터로 뜬다 — 이 화면들은 전부 서버 컴포넌트이고 **RLS 를 따르는**
//      클라이언트로 읽는다(일부러 service_role 을 안 쓴다). 정책이 조금만 좁아지면
//      화면은 그대로 뜨고 **내용만 사라진다** — "지금은 불러오지 못했어요" 조차 안 뜬다.
//      그래서 빈 화면이 아니라 **숫자와 절차가 실제로 찍히는지**를 본다.
//   ② 유형 상세는 **절차**를 준다 — 이 화면의 값어치는 함정 목록이 아니라 실행 가능한 순서다.
//   ③ 계획 화면은 **시간 합을 시험 시간과 나란히** 적는다. 합이 넘으면 절차가 옳아도 못 쓴다.
//   ④ 원문은 안 나온다 — 지문·선지는 평가원 저작물이다. 저작권 고지가 두 화면에 다 있어야 한다.
//      (DB 층 경계는 `src/lib/csat/__tests__/copyright-boundary.integration.test.ts` 가 따로 잠근다)
//   ⑤ 로그인 없이는 못 본다.
//
//   · 계정: runtime-test-0705@vocaflow.dev
//   · 읽기 전용 — DB 에 아무것도 쓰지 않는다(정리 불필요).
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-runtime-csat.json';

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

test.describe('기출 유형 분석 — 학습자 표면', () => {
  test('로그인 없이는 /csat 이 로그인으로 보낸다', async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await page.goto('/csat', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(page.url(), '/csat 이 비로그인에 열려 있다').toContain('/login');
    await page.close();
  });

  test.describe('로그인 상태', () => {
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage({ storageState: undefined });
      await loginRuntimeUser(page);
      await page.context().storageState({ path: STATE_PATH });
      await page.close();
    });
    test.use({ storageState: STATE_PATH });

    test('허브 → 유형 상세 → 계획, 셋 다 실제 데이터로 찍힌다', async ({ page }) => {
      test.setTimeout(150_000);

      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      // ── ① 허브 ────────────────────────────────────────────────────
      await page.goto('/csat', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await expect(page.getByRole('heading', { name: '기출 유형 분석', level: 1 })).toBeVisible();

      // 못 불러왔으면 조용히 빈 목록이 되므로 **에러 문구가 없음**을 먼저 못 박는다
      await expect(page.getByText('지금은 분석을 불러오지 못했어요.')).toHaveCount(0);
      await expect(page.getByText('아직 준비된 유형이 없어요.')).toHaveCount(0);

      // 준비된 유형 수가 0이 아니어야 한다 — 0이면 헤더 줄 자체가 렌더되지 않는다
      const readyLine = page.getByText(/분석이 준비된 유형 \d+ \/ \d+/);
      await expect(readyLine).toBeVisible();
      const readyText = (await readyLine.textContent()) ?? '';
      const [, ready, total] = readyText.match(/(\d+)\s*\/\s*(\d+)/) ?? [];
      expect(Number(ready), '준비된 유형이 0이면 화면이 껍데기다').toBeGreaterThan(0);
      expect(Number(total)).toBeGreaterThanOrEqual(Number(ready));

      const cards = page.locator('ul.grid > li a');
      expect(await cards.count(), '유형 카드가 없다').toBeGreaterThan(10);
      await expect(page.getByText(/한국교육과정평가원/)).toBeVisible();

      // ── ② 유형 상세 — 권장 풀이 시간이 적힌 카드는 분석이 준비된 유형이다 ──
      const readyCard = page.locator('ul.grid > li a').filter({ hasText: '권장 풀이 시간' }).first();
      await expect(readyCard).toBeVisible();
      await readyCard.click();
      await page.waitForURL(/\/csat\/[A-Z0-9-]+$/, { timeout: 30_000 });

      await expect(page.getByText('지금은 분석을 불러오지 못했어요.')).toHaveCount(0);
      await expect(page.getByText('이 유형은 아직 분석 중이에요.')).toHaveCount(0);

      // 분석 문항 수가 실제 숫자로 찍힌다 (NaN·0 방어)
      const meta = page.locator('header p').first();
      await expect(meta).toContainText(/기출 \d+문항/);
      await expect(meta).toContainText(/분석 \d+문항/);

      // **절차**가 이 화면의 알맹이다 — 목록만 있고 절차가 없으면 실패로 본다
      const proc = page.getByRole('heading', { name: '푸는 절차' });
      await expect(proc).toBeVisible();
      const steps = page.locator('ol > li');
      expect(await steps.count(), '절차 단계가 없다').toBeGreaterThan(0);
      // 첫 단계가 실행 가능한 문장인지까지는 못 재지만, 빈 껍데기는 잡는다
      expect(((await steps.first().textContent()) ?? '').trim().length).toBeGreaterThan(15);

      await expect(page.getByText(/한국교육과정평가원/)).toBeVisible();

      // ── ③ 계획 ────────────────────────────────────────────────────
      await page.goto('/csat/plan', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await expect(page.getByRole('heading', { name: '한 회차 주파 계획', level: 1 })).toBeVisible();
      await expect(page.getByText('지금은 계획을 불러오지 못했어요.')).toHaveCount(0);
      await expect(page.getByText('아직 계획을 세울 회차가 없어요.')).toHaveCount(0);

      // 독해 배점 — 99점의 정의가 여기 걸려 있다. 0점이면 회차를 잘못 골랐다는 뜻이다.
      const points = page.getByText(/^\d+점$/).first();
      await expect(points).toBeVisible();
      expect(Number(((await points.textContent()) ?? '0').replace('점', ''))).toBeGreaterThan(0);

      // 시간 합과 쓸 수 있는 시간이 **나란히** 적혀야 한다
      await expect(page.getByText(/쓸 수 있는 시간 \d+분/)).toBeVisible();

      // 번호 줄이 오름차순이어야 한다 — 시험장에서 만나는 순서 그대로가 이 화면의 존재 이유다
      const nos = await page.locator('ol > li span.tabular-nums').filter({ hasText: /^\d+번$/ }).allTextContents();
      expect(nos.length, '번호 줄이 없다').toBeGreaterThan(10);
      const nums = nos.map((t) => Number(t.replace('번', '')));
      expect(nums, '번호가 시험 순서대로가 아니다').toEqual([...nums].sort((a, b) => a - b));

      // ── ④ 문항 해설 — **이 파이프라인의 본체다** ──────────────────
      //
      // 유형 절차는 "이 유형은 이렇게 푼다" 를 말한다. 그런데 학습자가 채점 뒤 알고 싶은 것은
      // 눈앞의 한 문항이고 질문은 하나다 — **그래서 왜 ③인가.**
      // 그 답이 화면에 없으면 나머지는 전부 딸림이므로, 여기서 비어 있으면 실패로 본다.
      await page.goto('/csat', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator('ul.grid > li a').filter({ hasText: '권장 풀이 시간' }).first().click();
      await page.waitForURL(/\/csat\/[A-Z0-9-]+$/, { timeout: 30_000 });

      // 유형 화면이 그 유형의 기출 목록을 준다 — 「해설 N / M」으로 준비된 수를 함께 말한다
      const itemsHeading = page.getByRole('heading', { name: /이 유형의 기출/ });
      await expect(itemsHeading).toBeVisible();
      await expect(itemsHeading).toContainText(/해설 \d+ \/ \d+/);

      // 조회 실패를 「없음」으로 뭉개지 않는다 — 예전에는 이 섹션이 **아무 말 없이 통째로
      // 사라졌고**(로더가 error 를 `[]` 로 삼켰다) 학습자는 "기출이 없구나" 로 읽었다.
      // 머리글의 「기출 N문항」은 다른 쿼리라 그대로 떠서 화면이 스스로 모순됐다.
      await expect(page.getByText('지금은 기출 목록을 불러오지 못했어요.')).toHaveCount(0);
      await expect(page.getByText(/이 유형의 기출을 아직 연결하지 못했어요/)).toHaveCount(0);

      const explained = page.locator('ul.grid > li a[href^="/csat/item/"]').filter({ hasNotText: '준비 중' });
      expect(await explained.count(), '해설이 준비된 문항이 없다').toBeGreaterThan(0);
      await explained.first().click();
      await page.waitForURL(/\/csat\/item\//, { timeout: 30_000 });

      await expect(page.getByText('지금은 해설을 불러오지 못했어요.')).toHaveCount(0);
      await expect(page.getByText('이 문항은 정답 근거 서술을 아직 쓰는 중이에요.')).toHaveCount(0);

      // ① 답이 왜 이것인가 — 정답 번호와 근거가 함께 있어야 한다
      const why = page.getByRole('heading', { name: '답이 왜 이것인가' });
      await expect(why).toBeVisible();
      const whyBody = page.locator('section').filter({ has: why }).first();
      await expect(whyBody.getByText(/[①②③④⑤]/).first()).toBeVisible();
      // 되풀이가 아니라 **대응**을 말해야 한다 — 짧은 한 줄은 근거가 아니다
      expect(((await whyBody.textContent()) ?? '').trim().length).toBeGreaterThan(80);

      // ② 나머지가 왜 아닌가 — 오답 넷이 번호로 가리켜진다
      await expect(page.getByRole('heading', { name: '나머지가 왜 아닌가' })).toBeVisible();
      await expect(page.getByText('지우는 근거 —').first()).toBeVisible();

      // ③ 다시 풀 때의 순서
      await expect(page.getByRole('heading', { name: '다시 풀 때의 순서' })).toBeVisible();

      // 저작권 경계 — 원문을 싣지 않는다는 고지가 이 화면에도 있어야 한다
      await expect(page.getByText(/한국교육과정평가원/)).toBeVisible();

      // ── ⑤ 콘솔 에러 0 ────────────────────────────────────────────
      // dev 서버가 이 스펙을 도는 중에 다시 컴파일하면(파일을 고치던 중이었다면) fast refresh 가
      // 콘솔 에러를 뱉는다 — 화면의 결함이 아니라 개발 환경의 소음이다. 걸러 내지 않으면
      // 이 단언은 "언젠가 실패하는" 검사가 되고, 그런 검사는 곧 무시당한다.
      const real = errors.filter(
        (e) =>
          !/favicon|ResizeObserver|Download the React DevTools/i.test(e) &&
          !/fast ?refresh|hot-reloader|hot update|webpack-internal/i.test(e),
      );
      expect(real, `콘솔 에러: ${real.slice(0, 3).join(' | ')}`).toHaveLength(0);
    });
  });
});
