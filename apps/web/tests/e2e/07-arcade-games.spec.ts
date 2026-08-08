// apps/web/tests/e2e/07-arcade-games.spec.ts
// 아케이드 게임 전수 스모크 — 14개 /play/* 라우트가 (1) 콘솔 에러 없이 마운트되고
// (2) 첫 입력에 반응하는지(작동·사용성)를 회귀로 고정한다.
//   - 계정: runtime-test-0705@vocaflow.dev (04/05 spec 과 동일 · vocab 10 · 활동 시드)
//   - 비스코프 진입(?set/?text 없음) → v07.4 부터 source:'mine' 게임은 사용자 due 큐(vocab 10)로,
//     source:'bank' 게임은 내장 뱅크로 렌더된다. mine 스코프는 단어 부족해도 맛보기로 degrade 하므로
//     NotEnoughWords 게이트는 여전히 발동하지 않는다(explicit ?set/?text 진입 전용).
//   - 로스터 19종 중 아래 14종을 개별 검증(허브 테스트가 19 카드 전수 딥링크를 커버)
//   - "준비 마커" 가시 = 마운트 성공, "첫 입력 → 반응 마커" = 입력 처리 정상(사용성)
//   - 콘솔 에러/4xx·5xx/pageerror 0 을 게임별로 단언(silent 붕괴 감지)
//   - pirate-quest 는 three.js 캔버스(3D 클릭) — DOM 이동 불가 → 렌더만 검증(WebGL 노이즈 제외)
import { test, expect, type Page, type Locator } from '@playwright/test';

import { fetchUserVocabWords, userIdByEmail } from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-arcade.json';

// 콜드 .next 에서 첫 브라우저 히트는 클라이언트 청크가 404(하이드레이션 실패) → 리로드로 복구되는
// 알려진 dev 경합(04-ui-smoke 계승). 07 을 단독 실행하면 로그인이 첫 히트라 이 경합에 노출되므로
// goto→submit 사이클을 리로드와 함께 재시도한다.
async function loginRuntimeUser(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]');
    try {
      await email.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' }); // 청크 404 복구
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
      return; // 성공
    } catch {
      // 하이드레이션 미완(콜드 청크) → 리로드 후 재시도
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
  page.on('response', (r) => {
    if (r.status() >= 400 && r.status() !== 404) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  return errors;
}

/** 환경 노이즈 필터(04-ui-smoke 계승) + WebGL 게임 전용 추가 필터. */
function fatalErrors(errors: string[], webgl = false): string[] {
  let out = errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
  if (webgl) {
    // 헤드리스 크로미움엔 GPU 가 없어 three/r3f 가 WebGL 컨텍스트·GLTF 로드 에러를 뱉음(환경 노이즈).
    out = out.filter((e) => !/WebGL|THREE|GLTF|glTF|\.glb|fiber|drei|shader|context lost|swiftshader|GPU/i.test(e));
  }
  return out;
}

interface GameSpec {
  slug: string;
  /** true = 내장 캔버스(3D) — 렌더만 검증 */
  webgl?: boolean;
  /** true = localStorage 상태 의존(완료/기록) — 진입 후 초기화·리로드 */
  fresh?: boolean;
  /** 마운트·상호작용 준비 마커(가시 = ready) */
  ready: (p: Page) => Locator;
  /** 첫 입력 + 반응 단언(작동·사용성). 없으면 렌더만. */
  play?: (p: Page) => Promise<void>;
}

const GAMES: GameSpec[] = [
  // ── Glyph Tongue: 뜻 칩을 룬에 배정(2-탭) ──
  {
    slug: 'glyph-tongue',
    ready: (p) => p.locator('.gt-chip').first(),
    play: async (p) => {
      await p.locator('.gt-chip').first().click();
      await expect(p.locator('.gt-chip--held').first()).toBeVisible();
    },
  },
  // ── Word Customs: 첫 여행자(generous·정품) 승인 = 결정론적 정답 ──
  {
    slug: 'word-customs',
    ready: (p) => p.getByRole('button', { name: /승인/ }),
    play: async (p) => {
      await p.getByRole('button', { name: /승인/ }).click();
      await expect(p.getByRole('button', { name: /다음 여행자/ })).toBeVisible();
    },
  },
  // ── Lexicon Hands: 손패 카드 선택 토글 ──
  {
    slug: 'lexicon-hands',
    ready: (p) => p.locator('.lh-card').first(),
    play: async (p) => {
      await p.locator('.lh-card').first().click();
      await expect(p.locator('.lh-card--on').first()).toBeVisible();
    },
  },
  // ── Lexicon Detective: 단서 조사 → 단어 노출 ──
  {
    slug: 'lexicon-detective',
    ready: (p) => p.locator('.ld-clue').first(),
    play: async (p) => {
      await p.locator('.ld-clue').first().click();
      await expect(p.locator('.ld-clue--seen').first()).toBeVisible();
    },
  },
  // ── Morpheme Rules: 접두사+어근 선택 → 두 슬롯 채움 ──
  {
    slug: 'morpheme-rules',
    ready: (p) => p.locator('.mr-block--pre').first(),
    play: async (p) => {
      await p.locator('.mr-block--pre').first().click();
      await p.locator('.mr-block--root').first().click();
      await expect(p.locator('.mr-slot--on')).toHaveCount(2);
    },
  },
  // ── The Silent Rule: 패널 타일 선택 ──
  {
    slug: 'silent-rule',
    ready: (p) => p.locator('.sr-panel').first(),
    play: async (p) => {
      await p.locator('.sr-panel').first().click();
      await expect(p.locator('.sr-panel--on').first()).toBeVisible();
    },
  },
  // ── Daily Blitz: 인트로 → 시작 → 문항 → 타일 응답(reveal) ── (localStorage 완료 상태 의존)
  {
    slug: 'daily-blitz',
    fresh: true,
    ready: (p) => p.getByRole('button', { name: '오늘의 챌린지 시작' }),
    play: async (p) => {
      await p.getByRole('button', { name: '오늘의 챌린지 시작' }).click();
      await expect(p.locator('.db-meaning')).toBeVisible();
      await p.locator('.db-tile').first().click();
      await expect(p.locator('.gk-tile--correct').first()).toBeVisible();
    },
  },
  // ── Letter Forge: 자동 시작 → 트레이 글자 클릭 → 소비 ──
  {
    slug: 'letter-forge',
    ready: (p) => p.locator('.lf-meaning'),
    play: async (p) => {
      await p.locator('[aria-label^="글자 "]').first().click();
      await expect(p.locator('.lf-key--used').first()).toBeVisible();
    },
  },
  // ── Cascade: 그리드 타일 선택 ──
  {
    slug: 'cascade',
    ready: (p) => p.getByRole('grid', { name: '매칭 보드' }),
    play: async (p) => {
      await p.getByRole('gridcell').first().click();
      await expect(p.locator('.cs-tile--sel').first()).toBeVisible();
    },
  },
  // ── Connections: 타일 선택 토글 ──
  {
    slug: 'connections',
    ready: (p) => p.getByRole('button', { name: '섞기' }),
    play: async (p) => {
      await p.locator('.cn-tile').first().click();
      await expect(p.locator('.cn-tile--sel').first()).toBeVisible();
    },
  },
  // ── Word Economy: 보기 응답 → 정답 타일 reveal ──
  {
    slug: 'word-economy',
    ready: (p) => p.locator('.we-meaning'),
    play: async (p) => {
      await p.locator('.we-tile').first().click();
      await expect(p.locator('.gk-tile--correct').first()).toBeVisible();
    },
  },
  // ── Ghost Race: 보기 응답 → 정답 타일 reveal ── (localStorage bestMs 의존)
  {
    slug: 'ghost-race',
    fresh: true,
    ready: (p) => p.locator('.gr-meaning'),
    play: async (p) => {
      await p.locator('.gr-tile').first().click();
      await expect(p.locator('.gk-tile--correct').first()).toBeVisible();
    },
  },
  // ── WordBlitz: 키보드 '1' 응답(옵션0) → 정답 타일 reveal ──
  {
    slug: 'wordblitz',
    ready: (p) => p.getByText('이 뜻의 단어는?'),
    play: async (p) => {
      await p.keyboard.press('1');
      await expect(p.locator('.wbz-tile--correct').first()).toBeVisible();
    },
  },
  // ── Pirate's Bounty: three.js 캔버스(3D 클릭) — DOM 이동 불가 → 렌더만 검증 ──
  {
    slug: 'pirate-quest',
    webgl: true,
    ready: (p) => p.locator('.pq-intro, .pq-card').first(),
  },
];

test.describe('아케이드 게임 전수 스모크', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000); // 콜드 서버에서 로그인 리로드 재시도 여유
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('아케이드 허브 — 2섹션 + 오늘의 추천 + 전 카드 딥링크 무결성', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '아케이드', exact: true })).toBeVisible({ timeout: 30_000 });

    // IA v07.4 — ① 오늘의 추천 ② 내 단어로 플레이 ③ 큐레이션 세계
    await expect(page.locator('.arc-daily-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /내 단어로 플레이/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /큐레이션 세계/ })).toBeVisible();

    const cards = page.locator('a.arc-card');
    // 게임 로스터는 성장한다(카탈로그 현재 19) — 정확 카운트는 brittle → 하한 + 딥링크 무결성
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(19);
    // 각 카드가 /play/<slug> 로 연결되는지. from 은 URLSearchParams 인코딩(%2F) — 양쪽 허용.
    for (const href of await cards.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')))) {
      expect(href).toMatch(/^\/play\/[a-z-]+\?from=(\/|%2F)arcade$/);
    }
    // 오늘의 추천도 실제 게임으로 연결돼야 한다(빈 CTA 방지)
    const dailyHref = await page.locator('.arc-daily-card').getAttribute('href');
    expect(dailyHref).toMatch(/^\/play\/[a-z-]+\?from=(\/|%2F)arcade$/);

    const fatal = fatalErrors(errors);
    expect(fatal, `[arcade] console: ${fatal.join(' | ')}`).toHaveLength(0);
  });

  for (const g of GAMES) {
    test(`${g.slug} — 마운트 + ${g.play ? '첫 입력 반응' : '렌더'} · 콘솔 에러 0`, async ({ page }) => {
      test.setTimeout(60_000); // dev 콜드 컴파일이 라우트마다 수초 소요 가능
      const errors = collectConsoleErrors(page);

      await page.goto(`/play/${g.slug}?from=/arcade`, { waitUntil: 'domcontentloaded' });

      if (g.fresh) {
        // 완료/최고기록 localStorage 를 비워 결정론적 초기 상태로 리로드
        await page.evaluate(() => {
          try {
            localStorage.removeItem('vf_dailyblitz_v1');
            localStorage.removeItem('vf_ghostrace_v1');
          } catch {
            /* SecurityError 등 무시 */
          }
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
      }

      // 마운트/준비(로딩 스피너 해소 포함 — Playwright auto-wait).
      // 콜드 청크 404(하이드레이션 실패)면 준비 마커가 안 뜨므로 1회 리로드로 복구.
      try {
        await expect(g.ready(page)).toBeVisible({ timeout: 30_000 });
      } catch {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(g.ready(page)).toBeVisible({ timeout: 30_000 });
      }
      // 에러 바운더리/404 감지
      await expect(page.getByText(/문제가 발생했어요|problem occurred|페이지를 찾을 수 없어요/)).toHaveCount(0);

      // 배경음악 컨트롤 — 존재 + 좌하단 fixed 배치.
      //   BGM 14곡을 붙여놓고도 아무도 못 들은 이유가 여기 있었다: .gk-root/.wbz-root 의
      //   `> :not(...)` 규칙(명시도 우위)이 .gk-music-btn 의 position:fixed 를 덮어써
      //   버튼이 게임 상단 흐름에 전체 너비로 박혀 있었고, 음악 컨트롤로 보이지 않았다.
      const music = page.locator('.gk-music-btn');
      await expect(music, `[${g.slug}] 배경음악 버튼 없음`).toBeVisible({ timeout: 15_000 });
      const mBox = await music.boundingBox();
      const vh = page.viewportSize()?.height ?? 720;
      expect(await music.evaluate((el) => getComputedStyle(el).position), `[${g.slug}] 음악 버튼 position`).toBe('fixed');
      expect(vh - (mBox!.y + mBox!.height), `[${g.slug}] 음악 버튼이 좌하단이 아님`).toBeLessThanOrEqual(24);
      expect(mBox!.width, `[${g.slug}] 음악 버튼이 전체 너비로 퍼짐(레이아웃 붕괴)`).toBeLessThan(240);

      // 첫 입력 → 반응(작동·사용성)
      if (g.play) await g.play(page);

      const fatal = fatalErrors(errors, g.webgl);
      if (g.webgl) {
        // WebGL 환경 노이즈만 제외하고 그 외 앱 에러는 여전히 실패로 처리
        expect(fatal, `[${g.slug}] console: ${fatal.join(' | ')}`).toHaveLength(0);
      } else {
        expect(fatal, `[${g.slug}] console: ${fatal.join(' | ')}`).toHaveLength(0);
      }
    });
  }

  // v07.4 회귀 — 아케이드에서 스코프 없이 연 mine 게임이 하드코딩 DEFAULT_POOL 로 조용히
  // 돌아가던 결함(내 단어 미사용 → recordGameResult silent skip → FSRS 무반영)의 재발 차단.
  // 브레드크럼 라벨 + 실제 제시된 뜻이 내 단어장 소속인지 2중으로 단언한다.
  test('비스코프 진입 — mine 게임이 내 복습 단어를 쓴다 (FSRS 연동 회귀)', async ({ page }) => {
    test.setTimeout(60_000);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'SERVICE_ROLE_KEY 없음 — DB 단언 불가');
    const mine = await fetchUserVocabWords(userId as string);
    test.skip(mine.length < 4, `due 단어 ${mine.length}개 — ghost-race minWords 4 미달`);

    await page.goto('/play/ghost-race?from=/arcade', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.removeItem('vf_ghostrace_v1');
      } catch {
        /* SecurityError 무시 */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // ① 세션 셸 브레드크럼 — mine 스코프가 실제로 해석됐다(맛보기 폴백 아님)
    await expect(page.getByText('내 복습 단어')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('맛보기 단어')).toHaveCount(0);

    // ② 제시된 뜻이 내 단어장 소속 — 내장 DEFAULT_POOL 이면 여기서 실패한다
    await expect(page.locator('.gr-meaning')).toBeVisible({ timeout: 15_000 });
    const shown = (await page.locator('.gr-meaning').first().innerText()).trim();
    expect(
      mine.map((w) => w.meaning),
      `제시된 뜻 "${shown}" 이 사용자 단어장에 없음 — DEFAULT_POOL 회귀 의심`,
    ).toContain(shown);
  });
});
