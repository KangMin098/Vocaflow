// apps/web/tests/e2e/09-arcade-access.spec.ts
//
// 아케이드 "접근 모델" 회귀 — 게임이 잘 도는지(=07 스모크)가 아니라,
// **학습자가 게임에 어떻게 닿고 어떤 단어로 놀게 되는지**를 고정한다.
//
// 배경(v07.4 이전 결함):
//   · /arcade 카드가 스코프 없이 게임을 열어 전부 하드코딩 DEFAULT_POOL 로 돌았고
//     recordGameResult 가 silent skip → 허브가 광고한 FSRS 연동이 기본 경로에서 거짓
//   · 게임 정의가 4곳에 복제돼 카운트·세션 셸 메타가 각각 낡음(신규 3종은 아예 누락)
//   · /arcade 가 (app) 풀스크린 그룹에 있어 Sidebar 로 갈 수 없었음
//
// 커버리지 축:
//   A 발견성(사이드바·허브 진입·섹션 IA)  B 스코프 3단(explicit/mine/demo)
//   C 세션 셸(제목·닫기·복귀)             D 영속화(scores·learning_records)
//   E 반응형·접근성
import { test, expect, type Page } from '@playwright/test';

import {
  countLearningRecordsSince,
  countScoresSince,
  fetchUserVocabWords,
  resetDueCards,
  userIdByEmail,
} from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'playwright-auth/.auth-arcade-access.json';

/** 실 단어 40개 보유 공용 단어장 — explicit 스코프 픽스처. */
const FIXTURE_SET_ID = 'dcb6f06e-bc30-4fe3-80bf-577ad08be233';
/** 존재하지 않는 세트 — explicit 인데 단어 0 인 경로 픽스처. */
const EMPTY_SET_ID = '00000000-0000-4000-8000-000000000000';

async function login(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]');
    try {
      await email.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' });
      continue;
    }
    await page.waitForTimeout(1000); // 하이드레이션 — controlled input 리셋 방지
    for (let i = 0; i < 3; i++) {
      await email.fill(RUNTIME_USER.email);
      await page.fill('input[type="password"]', RUNTIME_USER.password);
      if ((await email.inputValue()) === RUNTIME_USER.email) break;
      await page.waitForTimeout(500);
    }
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
      return;
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
  throw new Error('로그인 실패 — 4회 재시도 후에도 리다이렉트 안 됨');
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
  return errors;
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
}

/** fire-and-forget 서버액션 폴링 — 최대 waitMs 까지 조건 충족 대기. */
async function pollUntil(fn: () => Promise<boolean>, waitMs = 12_000): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════
// 비로그인 — 단어가 없는 사용자가 보는 아케이드 (신규 유입 경로)
// ══════════════════════════════════════════════════════════════════
test.describe('A. 발견성 — 비로그인(단어 0)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('맛보기 배지 + "단어 모으러 가기" 유도 — 0개 배지 같은 깨진 카피 없음', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    // v08.3 — "아케이드" → Game Lab(연구소 은유 + 영문 구조 라벨) 재설계.
    await expect(page.getByRole('heading', { name: 'Game Lab', exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // 단어 0 → mine 섹션은 맛보기 상태이고, 단어를 모으러 갈 길을 준다
    await expect(page.locator('.arc-sec-badge[data-tone="muted"]')).toContainText('맛보기');
    await expect(page.getByRole('link', { name: /단어 모으러 가기/ })).toBeVisible();

    // 깨진 카피 회귀 — "0개" 배지 / 수 없는 "내 복습 단어 로 진행"
    const body = (await page.locator('.arc-inner').innerText()).replace(/\s+/g, ' ');
    expect(body, '0개 배지는 무의미한 노출').not.toContain('복습 임박 0개');
    expect(body, '수 없는 문장(깨진 템플릿)').not.toMatch(/내 복습 단어\s*로 진행/);

    // 단어가 없어도 오늘의 추천은 반드시 있어야 한다.
    // ⚠️ v07.8 회귀 지점: 전 게임이 source:'mine' 이 되면서 BANK_GAMES 가 비었고,
    // pickDailyGame 이 `vocabCount < 6 ? BANK_GAMES : ...` 로 갈리던 시절이라면
    // 후보 0개 → from[NaN] → undefined → 이 페이지가 통째로 죽는다.
    await expect(page.locator('.arc-daily-card')).toBeVisible();
    expect(await page.locator('.arc-daily-meta').innerText()).toContain('단어 없이 바로 시작');

    expect(fatalErrors(errors)).toHaveLength(0);
  });

  test('반응형 — 390 / 768 / 1280 에서 가로 스크롤 0', async ({ page }) => {
    for (const [w, h] of [
      [390, 844],
      [768, 1024],
      [1280, 900],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.arc-grid').first()).toBeVisible({ timeout: 30_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `viewport ${w}px 가로 넘침 ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  // ── G. Protocol 브리핑 (v08.3) ───────────────────────────────────
  //
  // 재설계 전 결함: 게임을 고르는 근거가 이름·색·한 줄 태그라인뿐이었다. 19종은 저마다
  // 판돈 구조(시계·거리·자본·박)가 다른데 들어가 봐야만 알 수 있어, 선택이 사실상 찍기였다.
  // 계약은 "**텍스트가 아니라 보드 그림**으로 설명하고, **눌러서 통과**하게 한다" 이다.
  // 여기서는 **계약**만 본다 — 프레임 3장 · 트라이얼 존재 · 오답 거부 · Launch 목적지.
  // 게임별 트라이얼 내용(어떤 타일을 어떤 순서로 누르는가)은 15-arcade-brief.spec.ts 가
  // 브리핑 데이터를 그대로 읽어 19종 전수로 구동한다. 여기에 특정 게임의 토큰 id 를
  // 하드코딩하면 브리핑을 고칠 때마다 무관한 스펙이 빨개진다(v08.4 에서 실제로 그랬다).
  test('G1. 카드 (?) → Protocol: 보드 그림 3장 + 눌러서 통과하는 Trial Run', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: /^Cascade — 게임 설명/ });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.click();

    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('aria-modal', 'true');
    await expect(dlg.getByRole('heading', { name: 'Cascade', exact: true })).toBeVisible();

    // 설명은 글이 아니라 보드다 — 프레임 3장이 실제 보드 컴포넌트여야 한다
    await expect(dlg.locator('.bf-fig .bb[data-variant="figure"]')).toHaveCount(3);

    const trial = dlg.locator('.bb[data-variant="trial"]');
    await expect(trial).toBeVisible();

    // 오답은 통과시키지 않는다(튜토리얼이 그냥 넘어가면 아무것도 가르치지 못한다).
    // 어느 타일이 오답인지는 데이터가 정하므로, "정답 아닌 것 하나" 를 화면에서 찾는다 —
    // 정답 계열은 눌리면 aria-pressed 가 켜지고 오답은 흔들리기만 한다.
    const tiles = trial.locator('.bb-tiles .bb-tile');
    const n = await tiles.count();
    expect(n, '트라이얼 보드에 누를 타일이 없다').toBeGreaterThan(1);
    let rejected = false;
    for (let i = 0; i < n; i++) {
      await tiles.nth(i).click();
      if ((await tiles.nth(i).getAttribute('aria-pressed')) === 'false') {
        rejected = true;
        break;
      }
    }
    expect(rejected, '어느 타일을 눌러도 거부되지 않는다 — 오답을 통과시키고 있다').toBe(true);
    await expect(dlg.locator('.bf-ok'), '오답으로 트라이얼이 통과됐다').toHaveCount(0);

    // Launch 는 카드와 같은 목적지여야 한다(브리핑이 막다른 길이 되지 않게)
    await expect(dlg.locator('a.bf-launch')).toHaveAttribute('href', /^\/play\/cascade/);
  });

  test('G2. Esc 로 닫히고 포커스가 트리거로 돌아온다', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: /^Cascade — 게임 설명/ });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // 포커스가 문서 처음으로 튀면 키보드 사용자는 자리를 잃는다
    await expect(trigger).toBeFocused();
  });

  test('G3. 계열 카드의 Protocol 은 4모드를 탭으로 전환한다', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: /^Rapid Recall — 게임 설명/ });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.click();

    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('tab')).toHaveCount(4);
    await dlg.getByRole('tab', { name: 'Ghost' }).click();
    await expect(dlg.getByRole('heading', { name: 'Ghost Race', exact: true })).toBeVisible();
    await expect(dlg.getByRole('link', { name: /Launch/ })).toHaveAttribute(
      'href',
      /^\/play\/ghost-race/,
    );
  });

  test('G4. 모든 카드가 브리핑 트리거를 갖는다 (설명 없는 게임 0)', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-slot').first()).toBeVisible({ timeout: 30_000 });
    const slots = await page.locator('.arc-grid .arc-slot').count();
    const briefs = await page.locator('.arc-grid .arc-slot .arc-brief').count();
    expect(briefs, '브리핑 버튼이 없는 카드가 있다').toBe(slots);

    // 44px 터치 타겟
    const box = await page.locator('.arc-brief').first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

// ══════════════════════════════════════════════════════════════════
// 로그인 — 실제 학습자 경로
// ══════════════════════════════════════════════════════════════════
test.describe('아케이드 접근 모델 (로그인)', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  // ── A. 발견성 ────────────────────────────────────────────────────
  test('A1. 사이드바 Practice 에 Arcade 가 있고 /arcade 에서 활성 표시된다', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    const link = page.locator('aside[aria-label="주 메뉴"] a[href="/arcade"]');
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveAttribute('aria-current', 'page');
    // 허브는 세션이 아니다 — 전역 셸이 살아 있어야 한다((app) 그룹 잔류 회귀 차단)
    await expect(page.locator('aside[aria-label="주 메뉴"]')).toBeVisible();
  });

  test('A2. /hub 진입 카드의 게임 수가 허브 실제 카드 수와 일치한다 (문구 드리프트 차단)', async ({
    page,
  }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    // 사이드바에도 /arcade 링크가 있으므로 본문(진입 카드)로 한정한다.
    const entry = page.locator('main a[href="/arcade"]').first();
    await expect(entry).toBeVisible({ timeout: 30_000 });
    const aria = (await entry.getAttribute('aria-label')) ?? '';
    const claimed = Number(aria.match(/(\d+)\s*종/)?.[1] ?? 0);
    expect(claimed, `진입 카드 aria-label 에 게임 수 없음: "${aria}"`).toBeGreaterThan(0);

    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-grid a[href^="/play/"]').first()).toBeVisible({ timeout: 30_000 });
    // 계열 접기 이후 카드 수 ≠ 게임 수 — 진입 카드가 약속한 수는 "도달 가능한 게임 수"다.
    expect(await page.locator('.arc-grid a[href^="/play/"]').count()).toBe(claimed);
  });

  test('A3. 섹션 카운트 배지가 그 섹션에서 실제로 도달 가능한 게임 수와 일치한다', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-sec').first()).toBeVisible({ timeout: 30_000 });
    const sections = page.locator('.arc-sec');
    for (let i = 0; i < (await sections.count()); i++) {
      const sec = sections.nth(i);
      const claimed = Number((await sec.locator('.arc-sec-count').innerText()).trim());
      expect(await sec.locator('a[href^="/play/"]').count()).toBe(claimed);
    }
  });

  // 중복 체감(“또 같은 거네”)의 원인은 게임 존재가 아니라 19장을 동급으로 평평하게 깐 것.
  // 같은 인지 루프를 공유하는 계열은 한 장으로 접히되, 게임은 하나도 사라지지 않아야 한다.
  test('A5. 계열 접기 — 카드 수 < 게임 수, 그러나 모든 게임에 여전히 도달 가능', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-grid').first()).toBeVisible({ timeout: 30_000 });

    const cards = await page.locator('.arc-card').count(); // 단독 게임 + 계열 카드
    const links = await page.locator('.arc-grid a[href^="/play/"]').count();
    expect(cards, '접혔는데 카드 수가 그대로면 접기 실패').toBeLessThan(links);

    // 계열 카드는 링크가 아니라 컨테이너 — 중첩 <a> 없이 모드 칩이 링크여야 한다
    const family = page.locator('.arc-card--family').first();
    await expect(family).toBeVisible();
    expect(await family.evaluate((el) => el.tagName)).not.toBe('A');
    const modes = family.locator('a.arc-mode');
    expect(await modes.count()).toBeGreaterThanOrEqual(2);
    for (const href of await modes.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href')),
    )) {
      expect(href).toMatch(/^\/play\/[a-z-]+\?from=(\/|%2F)arcade$/);
    }
    // 모드 칩도 44px 터치 타겟
    const mBox = await modes.first().boundingBox();
    expect(mBox!.height).toBeGreaterThanOrEqual(44);

    // 접힌 게임이 중복 노출되지 않는다(계열 카드 + 단독 카드에 이중 등장 금지)
    const all = await page
      .locator('.arc-grid a[href^="/play/"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).pathname));
    expect(new Set(all).size, `중복 노출: ${all.join(', ')}`).toBe(all.length);
  });

  test('A4. 오늘의 추천은 새로고침해도 같은 게임이다 (결정론 회전)', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-daily-card')).toBeVisible({ timeout: 30_000 });
    const first = await page.locator('.arc-daily-card').getAttribute('href');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-daily-card')).toBeVisible({ timeout: 30_000 });
    expect(await page.locator('.arc-daily-card').getAttribute('href')).toBe(first);
  });

  // ── B. 스코프 3단 ────────────────────────────────────────────────
  test('B1. explicit(?set=) — 그 단어장 이름이 세션 셸에 뜨고 내 due 큐로 덮이지 않는다', async ({
    page,
  }) => {
    await page.goto(`/play/cascade?set=${FIXTURE_SET_ID}&from=/arcade`, {
      waitUntil: 'domcontentloaded',
    });
    // v07.8 재설계로 cascade 의 grid 이름이 '매칭 보드' → '단어 보드' 로 바뀌었다
    // (선택 단계가 사라지고 탭 1회가 곧 제출이다 — `.cs-tile--sel` 도 소멸).
    await expect(page.getByRole('grid', { name: '단어 보드' })).toBeVisible({ timeout: 30_000 });
    // 명시 스코프가 이겨야 한다 — mine 라벨이 뜨면 스코프 우선순위 회귀
    await expect(page.getByText('내 복습 단어')).toHaveCount(0);
    await expect(page.getByText('맛보기 단어')).toHaveCount(0);
    await expect(page.locator('header[role="banner"]')).toContainText('Ch.');
  });

  test('B2. explicit 인데 단어 0 — 다른 단어로 바꿔치지 않고 안내한다', async ({ page }) => {
    await page.goto(`/play/cascade?set=${EMPTY_SET_ID}&from=/arcade`, {
      waitUntil: 'domcontentloaded',
    });
    // ⚠️ getByRole('alert') 만 쓰면 Next 의 라우트 어나운서(#__next-route-announcer__)까지
    // 잡혀 strict mode 위반이 난다 — 안내 블록(.gk-empty)으로 한정한다.
    await expect(page.locator('.gk-empty[role="alert"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('학습할 단어가 부족해요')).toBeVisible();
    // 조용히 맛보기/내 단어로 대체되면 안 된다 (v07.8: grid 이름 '매칭 보드' → '단어 보드')
    await expect(page.getByRole('grid', { name: '단어 보드' })).toHaveCount(0);
    // 돌아갈 길이 있어야 한다
    await expect(page.getByRole('button', { name: '돌아가기' })).toBeVisible();
  });

  // v07.8 — 이전 단언은 'bank 게임은 "큐레이션 세계" 라벨' 이었다. 그 분류축이 사라졌다:
  // 전 게임이 학습자 단어를 쓰고, 단어가 모자라면 **맛보기로 degrade** 한다.
  // 중요한 계약은 이제 "조용히 degrade 하지 않는다" 이다 — 맛보기는 FSRS 에 남지 않으므로
  // 기록되는 플레이로 오인하면 학습자가 진도를 착각한다.
  // v07.8 — 이전 단언은 'bank 게임은 "큐레이션 세계" 라벨' 이었다. 그 분류축이 사라졌다:
  // 전 게임이 학습자 단어를 쓰고, 단어가 모자랄 때만 맛보기로 degrade 한다.
  //
  // 그런데 검증 계정은 **뜻 있는 단어 225개**(DB 실측)라 어떤 게임의 minWords(최대 24)도
  // 넘는다 — degrade 경로 자체가 발생하지 않는다. 그 경로를 단언하려던 테스트는 영구
  // 스킵이 되어 아무것도 지키지 못했다. 그래서 **검증 가능한 반대 사실**을 못으로 박는다:
  // 단어가 충분하면 비스코프 진입에서 **19종 어느 것도 맛보기로 떨어지지 않는다.**
  // (스코프 경로는 13-arcade-integrity 가 덮는다. 여기는 mine 경로 담당.)
  test('B3. 단어가 충분하면 비스코프 진입에서 19종 어느 것도 맛보기로 떨어지지 않는다', async ({ page }) => {
    test.setTimeout(19 * 25_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    const mine = userId ? await fetchUserVocabWords(userId, 40) : [];
    // 최대 minWords 는 connections 24. 그보다 적으면 degrade 가 정상이라 이 단언이 성립 안 한다.
    test.skip(mine.length < 24, `단어 ${mine.length}개 — 전 게임 minWords 를 못 채운다`);

    const ALL = [
      'cascade', 'ghost-race', 'word-economy', 'wordfall-cadence', 'letter-forge',
      'wordsmith-vigil', 'morphmerge', 'daily-blitz', 'connections', 'glyph-tongue',
      'word-customs', 'morpheme-rules', 'silent-rule', 'lexicon-hands', 'lexicon-detective',
      'lexicon-estate', 'word-orrery', 'wordblitz', 'pirate-quest',
    ];
    const degraded: string[] = [];
    for (const slug of ALL) {
      await page.goto(`/play/${slug}?from=/arcade`, { waitUntil: 'domcontentloaded' });
      const res = page.locator('[aria-label^="현재 학습:"]').first();
      try {
        await res.waitFor({ state: 'attached', timeout: 20_000 });
      } catch {
        degraded.push(`${slug}: 자료 컨텍스트 미렌더`);
        continue;
      }
      const label = (await res.getAttribute('aria-label')) ?? '';
      // 맛보기 = 내장 뱅크 = recordGameResult 가 전부 silent skip = 학습 기록 0.
      if (label.includes('맛보기')) degraded.push(`${slug}: ${label.slice(0, 70)}`);
    }
    expect(degraded, `단어 ${mine.length}개인데 맛보기로 떨어진 게임:\n${degraded.join('\n')}`).toEqual([]);
  });

  test('B4. wordblitz(독립 3D)도 mine 스코프를 따른다 — 카탈로그 source 와 실제 동작 일치', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'SERVICE_ROLE_KEY 없음');
    const mine = await fetchUserVocabWords(userId as string);
    test.skip(mine.length < 4, `단어 ${mine.length}개 — minWords 4 미달`);

    await page.goto('/play/wordblitz?from=/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('이 뜻의 단어는?')).toBeVisible({ timeout: 45_000 });
    // 카탈로그가 source:'mine' 이라 광고하므로 실제로도 내 단어여야 한다
    await expect(page.getByText('내 복습 단어')).toBeVisible();
    await expect(page.getByText('맛보기 단어')).toHaveCount(0);
  });

  // ── C. 세션 셸 ───────────────────────────────────────────────────
  test('C1. 카탈로그 파생 세션 메타 — 신규 3종도 게임 이름으로 뜨고 닫기가 /arcade 로 간다', async ({
    page,
  }) => {
    // 손으로 유지하던 SESSION_META 에서 누락돼 "학습 세션 ✨" + /hub 로 오배송되던 게임들
    for (const [slug, name] of [
      ['wordsmith-vigil', "Wordsmith's Vigil"],
      ['morphmerge', 'Morphmerge'],
      ['wordfall-cadence', 'Wordfall Cadence'],
    ] as const) {
      await page.goto(`/play/${slug}`, { waitUntil: 'domcontentloaded' });
      const header = page.locator('header[role="banner"]');
      await expect(header).toBeVisible({ timeout: 30_000 });
      await expect(header.getByRole('heading', { level: 1 })).toHaveText(name);
      await expect(header.getByRole('heading', { level: 1 })).not.toHaveText('학습 세션');
      // ?from 없음 → 카탈로그 closeHref(/arcade)
      await expect(header.getByRole('link', { name: /세션 닫기/ })).toHaveAttribute('href', '/arcade');
    }
  });

  test('C2. ?from= 이 닫기 목적지를 이긴다 (워크스페이스 제자리 복귀)', async ({ page }) => {
    await page.goto('/play/connections?from=%2Fhub', { waitUntil: 'domcontentloaded' });
    const close = page.locator('header[role="banner"]').getByRole('link', { name: /세션 닫기/ });
    await expect(close).toBeVisible({ timeout: 30_000 });
    await expect(close).toHaveAttribute('href', '/hub');
  });

  test('C3. Esc 로 세션을 닫으면 출처로 돌아온다', async ({ page }) => {
    await page.goto('/play/connections?from=%2Farcade', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '섞기' })).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await page.waitForURL('**/arcade', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Game Lab', exact: true })).toBeVisible();
  });

  // ── D. 영속화 ────────────────────────────────────────────────────
  // 셸 상단 X 는 학습자가 가장 많이 누르는 종료 경로인데, 예전엔 게임 내부 종료 버튼만
  // scores·XP 를 적재해서 이 경로로 나가면 세션 기록이 통째로 유실됐다(실측: learning_records 6 / scores 0).
  // 이 테스트는 **X 로 닫는 경로**를 일부러 사용한다.
  test('D1. mine 게임 인출 → 셸 X 로 닫아도 scores + learning_records 가 남는다', async ({ page }) => {
    test.setTimeout(90_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'SERVICE_ROLE_KEY 없음');
    const mine = await fetchUserVocabWords(userId as string);
    test.skip(mine.length < 4, `단어 ${mine.length}개 — minWords 4 미달`);

    const since = new Date(Date.now() - 2000).toISOString();
    try {
      await page.goto('/play/ghost-race?from=%2Farcade', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        try {
          localStorage.removeItem('vf_ghostrace_v1');
        } catch {
          /* SecurityError 무시 */
        }
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.gr-meaning')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('내 복습 단어')).toBeVisible();

      // 몇 문항 응답 → 인출 결과 발생
      for (let i = 0; i < 4; i++) {
        await page.locator('.gr-tile').first().click();
        await page.waitForTimeout(700);
      }
      // 세션 종료(닫기) → scores 적재
      await page.locator('header[role="banner"]').getByRole('link', { name: /세션 닫기/ }).click();
      await page.waitForURL('**/arcade', { timeout: 20_000 });

      expect(
        await pollUntil(async () => (await countLearningRecordsSince(userId as string, 'ghost-race', since)) > 0),
        'learning_records 미적재 — 내 단어가 아닌 DEFAULT_POOL 로 돌았을 가능성',
      ).toBe(true);
      expect(
        await pollUntil(async () => (await countScoresSince(userId as string, 'ghost-race', since)) > 0),
        'scores 미적재',
      ).toBe(true);
    } finally {
      // 게임이 SRS 를 미래로 밀면 다음 실행에서 due 가 말라 테스트가 흔들린다 → 원복
      await resetDueCards(userId as string);
    }
  });

  // ── F. 배경음악 발견성 ───────────────────────────────────────────
  // BGM 을 붙여놓고도 듣는 사람이 없던 원인은 재생 로직이 아니라 발견성이었다
  // (기본 OFF + 게임 안 작은 무라벨 아이콘이 유일한 스위치). v07.6 에서 기본값을 ON 으로
  // 뒤집었으므로(사용자 결정 — 단어 게임에 음악이 중요), 허브 알약은 "끄는 길"이기도 하다.
  // 여기서는 허브 토글 → 게임 자동 적용을 **양방향으로** 고정한다.
  test('F1. 허브 배경음악 토글이 게임에 그대로 적용된다 (기본 ON · 끄기/켜기 양방향)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('.arc-meta-music');
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    // v07.6 — 미설정 학습자의 기본은 켜짐. (자동재생 정책은 gamekit 이 제스처로 처리)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('켬');

    // ① 끄기 → 게임에도 꺼진 채로 전달
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toContainText('끔');
    await page.goto('/play/connections?from=%2Farcade', { waitUntil: 'domcontentloaded' });
    const offBtn = page.locator('.gk-music-btn');
    await expect(offBtn).toBeVisible({ timeout: 30_000 });
    await expect(offBtn).toHaveAttribute('aria-pressed', 'false');

    // ② 다시 켜기 → 게임에서 실제 재생까지
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/play/connections?from=%2Farcade', { waitUntil: 'domcontentloaded' });
    const btn = page.locator('.gk-music-btn');
    await expect(btn).toBeVisible({ timeout: 30_000 });
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    // 선호를 정했으므로 첫진입 라벨 힌트는 사라진다
    await expect(btn).toHaveAttribute('data-hint', '0');

    // 실제로 트랙이 재생 중인지 — 요청만이 아니라 currentTime 진행을 본다
    const playing = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const a = document.querySelector('audio');
      if (a) return { paused: a.paused, t: a.currentTime };
      return null;
    });
    // new Audio() 는 DOM 에 붙지 않으므로 null 일 수 있다 — 그 경우 mp3 요청으로 갈음.
    if (playing) expect(playing.paused).toBe(false);
  });

  test('F2. 선호 미결정 상태에서는 게임 내 버튼이 라벨을 펼쳐 존재를 알린다', async ({ page }) => {
    await page.goto('/play/connections?from=%2Farcade', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.removeItem('vocaflow-arcade-music');
      } catch {
        /* SecurityError 무시 */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const btn = page.locator('.gk-music-btn');
    await expect(btn).toBeVisible({ timeout: 30_000 });
    await expect(btn).toHaveAttribute('data-hint', '1');
    await expect(btn).toContainText('배경음악');
    // 한 번 정하면 힌트 해제(그 뒤로는 조용한 아이콘)
    await btn.click();
    await expect(btn).toHaveAttribute('data-hint', '0');
  });

  // ── E. 접근성 ────────────────────────────────────────────────────
  test('E1. 카드/추천 터치 타겟 44px 이상 · 제목 계층 h1→h2→h3', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a.arc-card').first()).toBeVisible({ timeout: 30_000 });

    for (const loc of [page.locator('.arc-daily-card'), page.locator('a.arc-card').first()]) {
      const box = await loc.boundingBox();
      expect(box, 'boundingBox 없음').toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // h1 은 정확히 1개, 섹션 제목은 h2, 카드 제목은 h3 (스크린리더 목차 무결성)
    expect(await page.locator('.arc-inner h1').count()).toBe(1);
    expect(await page.locator('.arc-sec h2').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('a.arc-card h3').count()).toBe(await page.locator('a.arc-card').count());
  });

  test('E2. 키보드만으로 오늘의 추천에 도달하고 포커스가 보인다', async ({ page }) => {
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-daily-card')).toBeVisible({ timeout: 30_000 });
    await page.locator('.arc-daily-card').focus();
    await expect(page.locator('.arc-daily-card')).toBeFocused();
    const shadow = await page
      .locator('.arc-daily-card')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow, '포커스 링 없음(:focus-visible 미적용)').not.toBe('none');
  });
});
