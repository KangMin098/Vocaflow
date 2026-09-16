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
//   ④ **제출 전에는 선지 상자가 0개** — 해설은 감춰진 게 아니라 «없다»(순차 공개의 전부)
//   ⑤ 답을 내면 선지 기호 상자 **5개**가 그려진다
//   ⑥ 키보드만으로 풀고 겹을 넘긴다
//   ⑦ 390px 에서 가로 스크롤 0 — 두 단 화면이 좁은 폭에서 종이를 밀어내지 않는다
//   ⑧ 콘솔 에러 0
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

/**
 * 파일 모드 구역. **이름이 겹치기 때문에 필요하다** — 링크 모드에도 같은 해설 패널이 있어
 * (2026-09-16부터 그쪽도 풀고 나서 열린다) 「30번」 제목과 「답 맞춰 보기」 단추가 둘씩 있다.
 * 범위를 안 좁히면 strict mode 위반으로 죽고, 원인이 화면인지 검사인지 구별이 안 된다.
 */
const paperSection = (page: Page) => page.locator('section').filter({ hasText: '글자 위에 상자까지 얹기' });

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

    // 오른쪽 해설이 그 문항의 것인가. 제목은 둘이다(링크 모드 패널 + 아래 파일 모드 패널) —
    // 여기서 볼 것은 **앞의 것**이다.
    await expect(
      page.getByRole('heading', { level: 2, name: new RegExp(`^${NO}번`) }).first(),
    ).toBeVisible();

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

    // ── 제출 전에는 상자가 **없다** ──────────────────────────────────
    // 이것이 순차 공개의 전부다. 감춰 둔 것과 안 만든 것은 화면이 똑같지만, 감춰 두면
    // «스스로 답해 보기» 가 안 일어난다. 그래서 **진짜 브라우저의 DOM 에서** 센다.
    const marksOnPaper = page.locator('div.pointer-events-none span[class*="border-2"]');
    expect(
      await marksOnPaper.count(),
      '풀기 단계인데 선지 상자가 종이에 이미 그려져 있다 — 해설이 새고 있다',
    ).toBe(0);
    const submitBtn = paperSection(page).getByRole('button', { name: /답을 안 고르고 보기|답 맞춰 보기/ });
    await expect(submitBtn).toBeVisible();

    // ── 답을 내면 비로소 그려진다 ────────────────────────────────────
    await submitBtn.click();
    await expect(marksOnPaper.first()).toBeVisible({ timeout: 15_000 });
    expect(await marksOnPaper.count(), '답을 낸 뒤에도 선지 기호 상자가 5개가 아니다').toBe(5);

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

  test('③ 키보드만으로 풀고 겹을 넘긴다', async ({ page }) => {
    test.skip(!paperPath, `원본 PDF 가 없다 — 찾아본 곳: ${PAPER_CANDIDATES.join(' · ')}`);
    test.setTimeout(120_000);

    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(`/csat/overlay?exam=${EXAM}&no=${NO}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#csat-pdf')).toBeAttached({ timeout: 45_000 });
    await page.setInputFiles('#csat-pdf', paperPath!, { timeout: 45_000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });
    await expect(
      paperSection(page).getByRole('heading', { level: 2, name: new RegExp(`^${NO}번`) }),
    ).toBeVisible({ timeout: 45_000 });

    // 1~5 로 답하고 Enter 로 연다. 마우스를 한 번도 쓰지 않는다.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('3');
    await expect(paperSection(page).getByRole('button', { name: '③', pressed: true })).toBeVisible();
    await page.keyboard.press('Enter');

    // 첫 겹이 열렸다 — 그리고 **한 장만** 열렸다.
    const stepButtons = page.getByRole('group', { name: '해설 단계' }).getByRole('button');
    const total = await stepButtons.count();
    expect(total, '겹이 하나도 없다').toBeGreaterThan(1);
    await expect(stepButtons.nth(0)).toHaveAttribute('aria-current', 'step');
    await expect(stepButtons.nth(1)).toBeDisabled();

    // → 로 넘기면 «지금 겹» 이 옮겨 가고, 그만큼만 열린다.
    await page.keyboard.press('ArrowRight');
    await expect(stepButtons.nth(1)).toHaveAttribute('aria-current', 'step');
    await expect(stepButtons.nth(0)).toBeEnabled();
    if (total > 2) await expect(stepButtons.nth(2)).toBeDisabled();

    // ← 로 되돌아간다 — 되감기 없는 순차는 그냥 불편함이다.
    await page.keyboard.press('ArrowLeft');
    await expect(stepButtons.nth(0)).toHaveAttribute('aria-current', 'step');

    // Esc 로 닫는다.
    await page.keyboard.press('Escape');
    await expect(paperSection(page).getByRole('heading', { level: 2, name: new RegExp(`^${NO}번`) })).toHaveCount(0);

    expect(errors, `콘솔 에러: ${errors.slice(0, 3).join(' | ')}`).toHaveLength(0);
  });

  test('④ 390px — 가로로 밀려나지 않는다', async ({ page }) => {
    test.skip(!paperPath, `원본 PDF 가 없다 — 찾아본 곳: ${PAPER_CANDIDATES.join(' · ')}`);
    test.setTimeout(120_000);

    // 390 = CLAUDE.md 의 모바일 기준선. 이 화면은 «종이 + 옆 패널» 두 단이라 좁은 폭에서
    // 가장 먼저 깨질 곳이고, 종이는 폭에 맞춰 배율을 잡으므로 한 번 넘치면 조용히 넘친다.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/csat/overlay?exam=${EXAM}&no=${NO}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#csat-pdf')).toBeAttached({ timeout: 45_000 });
    await page.setInputFiles('#csat-pdf', paperPath!, { timeout: 45_000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });
    await paperSection(page).getByRole('button', { name: /답을 안 고르고 보기|답 맞춰 보기/ }).click();
    await expect(paperSection(page).getByRole('group', { name: '해설 단계' })).toBeVisible();

    // ⚠️ **종이 자체는 예외다.** 2단 조판을 390px 로 줄이면 글자를 못 읽으므로 최소 배율을
    //    두었고(`OverlayClient` 의 `Math.max(0.55, …)`), 그 칸만 가로로 넘긴다.
    //    문서 전체가 밀리는 것과 한 칸이 스스로 넘치는 것은 다르다 — 여기서 재는 것은 앞쪽이다.
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement!;
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(
      overflow.scrollWidth,
      `문서가 가로로 ${overflow.scrollWidth - overflow.clientWidth}px 밀렸다`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);

    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, `${EXAM}-390-reveal.png`), fullPage: false });
  });
});
