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
import fs from 'node:fs';

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
      // **미리 구운 세션이 있으면 로그인 폼을 거치지 않는다.**
      //
      // 이 머신은 «브라우저 → Supabase» 경로만 간헐적으로 막힌다(같은 시각 node 는 로그인
      // 성공인데 폼은 "로그인 중..." 에서 멈춤 — 실측 2026-09-15). 그러면 화면 코드가 멀쩡해도
      // 검증을 못 한다. `npx tsx scripts/e2e-session.mts .auth-runtime-csat.json` 이 굽는다.
      //
      // ⚠️ 훅 기본 제한은 **30초**인데 아래 로그인은 2회 시도 × 25초라 **최대 50초+** 다.
      //    그래서 망이 멀쩡해도 느리면 훅이 먼저 죽고, 메시지가 «beforeAll 시간 초과» 라
      //    **망 문제인지 코드 문제인지 구별이 안 된다.**
      //
      // ⚠️ 건너뛴 사실을 크게 남긴다 — 조용히 건너뛰면 로그인이 깨져도 이 스펙은 초록이다.
      //    로그인 폼 자체의 회귀는 `20-auth-flows` 가 따로 본다.
      if (fs.existsSync(STATE_PATH)) {
        console.log(`[41] 미리 구운 세션을 쓴다 (${STATE_PATH}) — 로그인 폼은 거치지 않았다`);
        return;
      }
      test.setTimeout(150_000);
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
      // ⚠️ 2026-09-15 재설계로 허브의 h1 이 **오답 지도의 주장**으로 바뀌었다 — 화면의 주제가
      //    「유형 26개 목록」에서 「오답은 아홉 가지로 만들어진다」로 옮겨 갔기 때문이다.
      //    문구를 못 박지 않는다(가짓수는 DB 에서 세는 값이라 분석이 늘면 바뀐다) — h1 이 **있고**
      //    그것이 오답 지도의 제목인지만 본다.
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      await expect(h1).toHaveText(/평가원은 오답을 \d+가지 방법으로 만듭니다/);

      // 못 불러왔으면 조용히 빈 목록이 되므로 **에러 문구가 없음**을 먼저 못 박는다
      await expect(page.getByText('지금은 분석을 불러오지 못했어요.')).toHaveCount(0);
      await expect(page.getByText('아직 준비된 유형이 없어요.')).toHaveCount(0);

      // 준비된 유형 수가 0이 아니어야 한다 — 0이면 헤더 줄 자체가 렌더되지 않는다
      // (2026-09-15 재설계로 문구가 「분석 26/26 유형」으로 짧아졌다 — 유형 목록이 2급 시민이 되면서
      //  그 절의 머리로 옮겨 갔다. 세는 것은 그대로다.)
      const readyLine = page.getByText(/분석 \d+\/\d+ 유형/);
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
      // ⚠️ **그 절 안에서만 센다.** 예전에는 `page.locator('ol > li')` 로 화면 전체를 훑었는데,
      //    2026-09-15 에 「근거 위치 분포」(`LocusBar`)가 `<ol>` 로 위에 붙자 `.first()` 가
      //    구간 라벨("앞머리 0")을 집어 이 단언이 4자에서 실패했다. 화면이 옳고 선택자가
      //    넓었던 것이다 — 절차는 절차 절에서 센다.
      const procSection = page.locator('section').filter({ has: proc });
      const steps = procSection.locator('ol > li');
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

      // ① 정답 근거가 **번호와 함께** 있어야 한다.
      //
      // ⚠️ 이 화면은 2026-09-15 에 갈라졌다 — 골격이 있는 589문항은 「지문 지도」가 근거를
      //    지문 위치와 함께 보여 주고, 지문이 잘린 213문항은 예전 산문 절을 그대로 쓴다.
      //    그래서 **둘 중 하나**를 본다. 하나만 고집하면 옳은 화면을 실패로 센다.
      const mapHead = page.getByRole('heading', { name: '지문 지도' });
      const proseHead = page.getByRole('heading', { name: '답이 왜 이것인가' });
      const useMap = (await mapHead.count()) > 0;
      const why = useMap ? mapHead : proseHead;
      await expect(why).toBeVisible();
      const whyBody = page.locator('section').filter({ has: why }).first();
      await expect(whyBody.getByText(/[①②③④⑤]/).first()).toBeVisible();
      // 되풀이가 아니라 **대응**을 말해야 한다 — 짧은 한 줄은 근거가 아니다
      expect(((await whyBody.textContent()) ?? '').trim().length).toBeGreaterThan(80);

      // ② 오답 넷이 **하나도 빠지지 않고** 닿는다 — 지도의 칩이거나, 산문의 항목이거나.
      //
      // ⚠️ 「지도가 떴다」는 이 화면이 옳다는 증거가 아니다. 2026-09-15 실측 — 지도는
      //    `how_to_reject` 속 영어 조각이 지문에서 **찾힐 때만** 오답 칩을 얻는데(노출 예산에
      //    걸려 버려지기도 한다) 산문 절을 지우는 조건은 **문항 단위**였다. 그래서 골격
      //    589문항 중 **136문항(23.1%)** 에서 오답 분석 **544문단(평균 867자)** 이 화면에서
      //    통째로 사라졌고, 지도는 정답 칩 하나만 띄운 채 멀쩡해 보였다.
      //    그러니 여기서 세는 것은 «칩이 있는가» 가 아니라 **넷이 다 닿는가** 다.
      const rejectChips = useMap
        ? (await page.getByRole('group', { name: '근거 고르기' }).locator('button[aria-pressed]').count()) - 1
        : 0;
      const proseSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: '나머지가 왜 아닌가' }) });
      const proseRejects = (await proseSection.count()) ? await proseSection.locator('> ul > li').count() : 0;
      expect(
        rejectChips + proseRejects,
        `오답 넷 중 닿지 않는 것이 있다 — 칩 ${rejectChips} + 글 ${proseRejects}`,
      ).toBe(4);
      // 글로 내려온 것이 있으면 «왜 칩이 아닌지» 를 말해야 한다 — 말없이 두면 두 화면이
      // 같은 문항을 다르게 그리는 것으로만 보인다.
      if (useMap && proseRejects > 0) {
        await expect(page.getByText('지문에서 가리킬 문장을 찾지 못한 선지예요')).toBeVisible();
      }

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
