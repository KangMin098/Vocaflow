// apps/web/tests/e2e/44-csat-overlay.spec.ts
//
// **오버레이 화면의 런타임 회귀 — 그리고 「상자가 제자리에 오는가」를 사람 눈 대신 재는 자리.**
//
// ── 왜 이 파일이 필요한가 (2026-09-15) ────────────────────────────────
// 이 화면의 값어치는 **상자가 글자 위에 정확히 오는가** 하나에 달려 있다. 그런데 그것을
// 확인한 적이 없었다 — 화면이 보호 라우트라 열어 보려면 로그인이 필요했고, 좌표 뒤집기
// (PDF 는 왼아래 원점 · 화면은 왼위)는 **단위 테스트로만** 잠겨 있었다. 단위 테스트는 같은
// 식을 두 번 적은 것이라 식이 틀리면 둘 다 틀린다.
//
// 여기서는 **진짜 브라우저**가 진짜 PDF 를 열고, 상자의 렌더 기하를 캔버스 기준으로 잰다.
// 그리고 스크린샷을 남긴다 — 「한 줄 밀렸다」는 숫자로 안 잡히고 그림으로 잡히는 실패다.
//
// 지키는 계약:
//   ① 링크 모드 — `?exam=2026&no=30` 이 **그 문항이 있는 쪽**(5쪽)을 가리키는 원본을 건다
//   ② 파일 모드 — 문제지를 열면 캔버스가 그려지고 **문항 번호 상자**가 그 위에 놓인다
//   ③ 상자가 캔버스 **안**에 있다 — 좌표 뒤집기가 틀리면 여기서 밖으로 나간다
//   ④ 펼친 문항의 선지 기호 상자 **5개**가 그려진다
//   ⑤ 콘솔 에러 0
//
//   · 계정: `runtime-test-0705@vocaflow.dev`
//   · 읽기 전용 — DB 에 아무것도 쓰지 않는다
//
// ⚠️ **원본 PDF 는 저장소에 없다**(평가원 저작물). 사용자 폴더에 없으면 파일 모드 검사는
//    `skip` 한다 — CI 에서 거짓 실패를 내지 않으려면 그래야 하고, 대신 **소리 내어** 건너뛴다.

import fs from 'node:fs';
import path from 'node:path';

import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-csat-overlay.json';
const SHOT_DIR = 'playwright-report/overlay';

/** 2026 수능 영어 문제지. 원본 위치는 옮겨진 적이 있어 후보를 훑는다. */
const PAPER_CANDIDATES = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출/2026_영어영역_문제지.pdf',
  'C:/Users/Administrator/Documents/수능영어기출/수능기출/2026_영어영역_문제지.pdf',
];
const paperPath = PAPER_CANDIDATES.find((p) => fs.existsSync(p)) ?? null;

/** 2026 30번(어휘)은 5쪽이다 — `anchor-data/2026.json` 실측값. */
const EXAM = '2026';
const NO = 30;
const EXPECTED_PAGE = 5;

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

test.describe('기출 오버레이', () => {
  test.beforeAll(async ({ browser }) => {
    // 미리 구운 세션이 있으면 로그인 폼을 거치지 않는다 — 이 머신은 **브라우저 → Supabase**
    // 경로만 막힌다(42번 스펙 머리말 · `scripts/e2e-session.mts`). 건너뛴 사실은 크게 남긴다.
    if (fs.existsSync(STATE_PATH)) {
      console.log(`[44] 미리 구운 세션을 쓴다 (${STATE_PATH}) — 로그인 폼은 거치지 않았다`);
      return;
    }
    // 훅 기본 제한 30초인데 로그인은 2회 × 25초다. 그대로 두면 「훅 시간 초과」로만 보이고
    // 로그인이 문제인지 망이 문제인지 구별이 안 된다(42번이 겪었다).
    test.setTimeout(150_000);
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });

  test.use({ storageState: STATE_PATH });

  test('① 링크 모드 — 그 문항이 있는 쪽을 가리킨다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(`/csat/overlay?exam=${EXAM}&no=${NO}`, { waitUntil: 'domcontentloaded' });

    // 원본은 브라우저가 평가원에서 직접 받는다. **우리가 확인하는 것은 「어디를 가리키나」** 다 —
    // 평가원 서버가 느리거나 막혀도 이 계약은 성립해야 한다(그래서 로드 완료를 안 기다린다).
    const frame = page.locator('iframe[title*="문제지"]');
    await expect(frame).toHaveCount(1);
    const src = await frame.getAttribute('src');
    expect(src, '원본 링크가 비었다').toBeTruthy();
    expect(src!, '평가원 원본이 아니다').toContain('suneung.re.kr');
    expect(src!, `${EXPECTED_PAGE}쪽을 가리키지 않는다`).toContain(`#page=${EXPECTED_PAGE}`);

    // 오른쪽 해설이 그 문항의 것인가
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${NO}번`) })).toBeVisible();

    expect(errors, `콘솔 에러: ${errors.slice(0, 3).join(' | ')}`).toHaveLength(0);
  });

  test('② 파일 모드 — 상자가 캔버스 안 제자리에 놓인다', async ({ page }) => {
    test.skip(!paperPath, `원본 PDF 가 없다 — 찾아본 곳: ${PAPER_CANDIDATES.join(' · ')}`);

    // ⚠️ **기본 제한 30초로는 못 끝낸다.** 이 검사는 진짜 일을 한다 — 2.2 MB PDF 를 브라우저가
    //    파싱하고 5쪽을 렌더한다. 아래 대기들을 45초로 잡아 놓고 테스트 제한을 그대로 두면
    //    **대기가 완주하기 전에 테스트가 죽어** 「캔버스를 못 찾았다」로만 보이고, 원인이
    //    화면인지 제한인지 구별이 안 된다(실측 2026-09-15 — 원인은 이 숫자였다).
    test.setTimeout(120_000);

    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(`/csat/overlay?exam=${EXAM}&no=${NO}`, { waitUntil: 'domcontentloaded' });

    // 파일을 연다. 입력은 `sr-only` 라 보이지 않지만 `setInputFiles` 는 값을 넣을 수 있다.
    //
    // ⚠️ **먼저 붙었는지 기다린다.** 이 화면은 링크 모드일 때 평가원 원본 iframe 을 함께 걸고,
    //    그 2.2 MB 를 브라우저가 받는 동안 페이지가 느려진다. 기본 동작 제한(10초 ·
    //    `playwright.config.ts`)에 걸려 **단독 실행은 통과하고 전체 실행만 실패**했다
    //    (실측 2026-09-15 — 화면이 아니라 이 검사가 성급했다).
    await expect(page.locator('#csat-pdf')).toBeAttached({ timeout: 45_000 });
    await page.setInputFiles('#csat-pdf', paperPath!, { timeout: 45_000 });

    // 겨냥한 문항이 자동으로 펼쳐지므로, 그 쪽이 그려질 때까지 기다린다.
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(`text=${EXPECTED_PAGE} / 8`).first()).toBeVisible({ timeout: 45_000 });

    // ── 상자가 캔버스 **안**에 있는가 ────────────────────────────────
    // 좌표 뒤집기가 틀리면 상자가 위아래로 밀려 캔버스를 벗어난다. 기하로 잰다.
    const cb = await canvas.boundingBox();
    expect(cb, '캔버스 기하를 못 읽었다').not.toBeNull();

    // ⚠️ 속성 셀렉터(`[aria-label*="번"]`)로 잡으면 **0개**가 나온다(실측 2026-09-15).
    // 접근성 이름으로 잡는다 — 화면이 실제로 읽히는 이름이고, 그게 계약이기도 하다.
    const numberBoxes = page.getByRole('button', { name: /^[0-9]+번 .*해설 (열기|닫기)$/ });
    // ⚠️ **세기 전에 기다린다.** 쪽 표시(`5 / 8`)는 payload 가 오면 바로 뜨지만, 상자는
    //    캔버스 렌더가 끝나 `canvasSize` 가 잡힌 **뒤에** 붙는다. 그 사이에 세면 0이 나오고,
    //    실패 스냅샷에는 상자가 멀쩡히 보여서 «셀렉터가 틀렸나» 로 두 번 헛짚는다
    //    (실측 2026-09-15 — 화면이 아니라 이 검사의 순서가 틀린 것이었다).
    await expect(numberBoxes.first()).toBeVisible({ timeout: 45_000 });
    const n = await numberBoxes.count();
    expect(n, '이 쪽에 문항 번호 상자가 하나도 없다').toBeGreaterThan(0);

    const outside: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const b = await numberBoxes.nth(i).boundingBox();
      const label = (await numberBoxes.nth(i).getAttribute('aria-label')) ?? `#${i}`;
      if (!b) continue;
      // 상자는 44px 터치 타깃이라 글자보다 크다 — 중심이 캔버스 안이면 제자리로 본다.
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      if (cx < cb!.x || cx > cb!.x + cb!.width || cy < cb!.y || cy > cb!.y + cb!.height) {
        outside.push(`${label} (${Math.round(cx)},${Math.round(cy)})`);
      }
    }
    expect(outside, `캔버스 밖에 놓인 상자: ${outside.join(' · ')}`).toHaveLength(0);

    // ── 펼친 문항의 선지 기호 5개 ────────────────────────────────────
    const marks = page.locator('span[title]').filter({ hasNot: page.locator('*') });
    // 제목이 붙은 span 중 이 문항의 기호 상자만 센다 — 캔버스 위 레이어 안에 있다.
    const markCount = await page.locator('div.pointer-events-none span[class*="border-2"]').count();
    expect(markCount, '펼친 문항의 선지 기호 상자가 5개가 아니다').toBe(5);
    void marks;

    // ── 그림으로 남긴다 ─────────────────────────────────────────────
    // 「한 줄 밀렸다」는 숫자로 안 잡힌다. 사람이 한 장만 보면 되게 해 둔다.
    // ⚠️ **캔버스만 따로 찍을 수는 없다.** Playwright 의 요소 스크린샷은 그 요소의 사각형으로
    //    **페이지를 자른 것**이라, 위에 겹친 상자가 함께 찍힌다. 처음에 「상자 없는 것」과
    //    「있는 것」 두 장을 남기려 했더니 **바이트까지 같은 파일 두 개**가 나왔다(실측).
    //    한 장만 남긴다 — 확인할 것은 「상자가 글자 위 제자리인가」 하나다.
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await canvas.screenshot({ path: path.join(SHOT_DIR, `${EXAM}-p${EXPECTED_PAGE}-with-boxes.png`) });

    expect(errors, `콘솔 에러: ${errors.slice(0, 3).join(' | ')}`).toHaveLength(0);
  });
});
