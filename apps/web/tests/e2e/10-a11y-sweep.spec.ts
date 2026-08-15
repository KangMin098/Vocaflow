// apps/web/tests/e2e/10-a11y-sweep.spec.ts
//
// 학습자 화면 전수 자동 감사 — 모든 화면 × 뷰포트 × 테마.
//
// 왜 필요한가: 11회차는 화면 하나를 눈으로 봤고, 12회차는 Tailwind 클래스 문자열을
// 정적 스캔했다. 둘 다 "모든 케이스"가 아니다. 정적 스캔은 원리적으로
//   · 부모가 크기를 주는 요소
//   · 렌더 후에야 정해지는 크기
//   · 겹침 · 가로 넘침 · 다크 모드에서만 나는 결함
// 을 못 본다. 이 스펙은 **실제 렌더된 기하(getBoundingClientRect)** 를 재므로
// 추정이 아니라 실측이다.
//
// 검사 4종 (전부 객관적 · 판단 불필요):
//   1. 콘솔 에러 0
//   2. 가로 넘침 없음 (모바일에서 body 가 옆으로 밀리면 학습이 불가능하다)
//   3. 터치 타겟 44px — CLAUDE.md "절대 하지 않을 것 · 접근성"
//   4. 접근 가능한 이름 — 이름 없는 버튼은 스크린리더에서 "버튼"으로만 읽힌다
//
// 1·2·4 는 실패 처리, 3 은 **베이스라인 대비 악화만** 실패시킨다 —
// 기존 위반이 많아 전부 막으면 스펙이 상시 빨간불이 되어 아무도 안 본다.
// 베이스라인은 줄여 나가는 숫자다 (늘리지 말 것).

import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};
const STATE_PATH = 'playwright-auth/.auth-a11y-sweep.json';

/** 학습자 정적 라우트 — [param] 라우트는 대상 데이터가 계정마다 달라 제외 */
const ROUTES = [
  '/hub', '/dashboard', '/plan', '/reports',
  // `/my/words`·`/my/texts` 는 ADR 0006 D4 로 폐지돼 `/wordvault`·`/text` 로 리다이렉트한다.
  // 리다이렉트를 목록에 두면 **같은 화면을 두 번 재고**(라우트별 베이스라인이 뜻을 잃는다),
  // 실패 메시지도 이미 없는 이름을 가리킨다. 단독 화면으로 남은 `/my/books` 만 유지.
  '/wordvault', '/my/books',
  '/library', '/library/books', '/library/scripts', '/library/vocab',
  '/flashcard', '/pairflip', '/scriptquiz', '/spellforge',
  '/dictate', '/dictate/setup', '/comics', '/arcade',
  '/text', '/text/new', '/settings', '/diagnostic',
];

const CASES = [
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'desktop-light', width: 1280, height: 900, theme: 'light' },
] as const;

/**
 * ── 베이스라인 ──
 *
 * 기존 위반을 전부 실패로 막으면 스펙이 상시 빨간불이 되어 아무도 안 본다.
 * 그래서 **오늘 값을 고정하고 오늘부터의 악화만 막는다**. **줄이는 방향으로만**
 * 갱신할 것 — 숫자를 올려야 한다면 그건 회귀를 덮는 것이다.
 *
 * 정적 스캔(scripts/a11y-touch-target)은 80건으로 추정했는데 실측은 202건이었다.
 * 부모가 크기를 주는 요소·렌더 후 결정되는 크기를 정적으로는 못 보기 때문이다.
 *
 * ⚠️ 2026-08-14: **총합 하나(202)를 버리고 화면별 고유 위반 수로 바꿨다.** 이유 둘:
 *   ① 202 는 덜 센 값이었다 — 화면이 열리지 않거나(콜드 컴파일 `NAVIGATION_FAILED` 20건)
 *      스켈레톤 상태로 측정돼 그 화면 위반이 통째로 빠졌다.
 *   ② 총합은 **실행마다 흔들린다**(같은 조건 재실행에서 238 → 241). 같은 요소가 3 케이스 중
 *      2 개에서만 잡히는 일이 있어서다. 흔들리는 수를 `<=` 로 막으면 스펙이 무작위로 빨개진다.
 * 화면별 **고유 라벨 수**(케이스 중복 제거)는 그 흔들림이 사라진다. 그리고 어느 화면이
 * 나빠졌는지 바로 말해 준다 — 총합은 그걸 못 한다.
 *
 * 아래는 2026-08-14 완전 측정(72/72 성공)값. **줄이는 방향으로만** 갱신할 것.
 */
const TOUCH_BASELINE: Record<string, number> = {
  '/plan': 8,
  // 3D 코버플로의 **옆 카드**들 — 원근 축소로 폭이 8~38px 이 된다. 44px 로 키우면 코버플로
  // 자체가 성립하지 않는다(가운데 카드가 크고 옆이 작은 것이 이 UI 의 전부다). 가운데 카드는
  // 270px 이고 점 인디케이터가 44px 히트영역으로 같은 이동을 제공하므로, **대체 경로가 있는
  // 의도된 예외**로 남긴다. 없애려면 코버플로를 버리는 결정이 먼저다.
  '/library': 3,
  '/library/books': 3,
  '/library/vocab': 3,
  '/text/new': 3,
  '/text': 3,
  '/pairflip': 2,
  '/wordvault': 1,
  '/library/scripts': 1,
  // 이번 회차에 0 이 된 화면(항목을 지웠으므로 되살아나면 즉시 잡힌다):
  //   /diagnostic 7 → 0 (안내 4종 32px · 레벨 안내 20px · 기록 보기 18px · 시작 34px)
  //   /flashcard·/spellforge 각 4 → 0 (HubStartCard 공유 칩 30px — 세 허브가 함께 해소)
  //   /dictate·/dictate/setup 각 3 → 0 · /library/vocab 18 → 3 (점 6x6 · 카테고리 칩 32px)
  // 17회차에 0 으로 만든 화면 — 항목을 지우면 기본값 0 이라 되살아나는 즉시 잡힌다.
  //   `/settings` 18 → 0 : `Toggle` 래퍼가 52x32 였다(주석은 "44×44 보장" 이라고 적혀 있었다)
  //                        + Segment 87x30 + 계정 버튼 2종
  //   `/hub`      2 → 0 : 처방 카드의 출발 버튼이 `min-h-[36px]` 로 **명시**돼 있었다
};

/**
 * ── 어디서 실패시킬 것인가 (dev vs CI) ──
 *
 * 콘솔 에러·터치 타겟·막다른 길은 **dev 서버에서 재현되지 않는다**. 같은 커밋 연속 2회 실측:
 *   · 터치 위반 `/library/vocab` 19 ↔ 17 · `/diagnostic` 7 ↔ 5 · 막다른 길 1 ↔ 2
 *   · 콘솔 500 은 라우트가 아니라 **하위 리소스**였다(`/library/scripts` 직접 요청은 3/3 200)
 * 원인은 제품이 아니라 환경이다 — dev 는 요청 시점에 컴파일하고, 워크스페이스에 세션이
 * 여럿이면 서버가 흔들린다(이번 회차에 `.next` 오염으로 전 라우트 500 도 겪었다).
 *
 * 그래서 **판정은 CI 에서만 한다.** CI 는 `next build` 산출물을 `next start` 로 띄우므로
 * 컴파일 지연도, 세션 경합도 없다. dev 에서는 같은 값을 **출력만** 한다 —
 * 재현되지 않는 값으로 빨간불을 켜면 아무도 스펙을 안 보게 되고, 그게 15회차가
 * 미검증 지표를 CI 에 넣었을 때와 같은 실패다.
 *
 * 환경과 무관하게 안정적인 것(가로 넘침 · 이름 없는 컨트롤)은 dev 에서도 그대로 실패시킨다.
 */
const GATE_UNSTABLE = !!process.env.CI;

/**
 * 가로 넘침이 남아 있는 화면 — 모바일에서 옆으로 밀린다. 해소되면 목록에서 뺄 것.
 *
 * **비었다.** 두 건 다 원인이 "보이는 큰 요소" 가 아니었다:
 *   · `/plan` 126px (17회차) — `sr-only`(position:absolute)가 위치 기준 조상이 없어 문서를
 *     기준으로 잡았고, 가로 스크롤러(`min-w-[820px]`) 안의 정적 위치만큼 문서가 넓어졌다.
 *   · `/library`·`/library/books` 61px (19회차) — 3D 캐러셀이 범인처럼 보였지만 무대는 이미
 *     `overflow-x-clip` 으로 잘리고 있었다(**잘린 요소는 문서를 넓히지 못한다**). 진짜 원인은
 *     점 인디케이터 줄 — 점 하나가 44px 히트영역이라 권수만큼 자라 20권에서 512px 이 됐다.
 *
 * 교훈: 넘침 원인은 **조상 중 자르는 것이 없는 요소** 중에서 찾는다. 그냥 "뷰포트를 넘는
 * 요소" 를 세면 클리핑된 것까지 잡혀 엉뚱한 곳을 고치게 된다.
 */
const OVERFLOW_BASELINE = new Set<string>([]);

async function login(page: Page) {
  for (let i = 1; i <= 2; i++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (i === 2) throw e;
      await page.waitForTimeout(1_500);
    }
  }
}

interface Finding {
  route: string;
  case: string;
  overflowPx: number;
  consoleErrors: string[];
  smallTargets: { label: string; w: number; h: number }[];
  namelessControls: number;
  /** **본문(`<main>`) 안**에서 다른 경로로 가는 링크 종수 — 0 이면 막다른 길 후보 */
  forwardPaths: number;
  /** 44px 이상 · 이름 있는 버튼 수 (JS 라우팅 포함한 "앞길") · 본문 안만 */
  actionButtons: number;
  /** 셸(사이드바·FlowNav·하단 탭)이 얹는 링크 종수 — 판정에 쓰지 않는 참고값 */
  shellPaths: number;
}

/** 페이지 안에서 실제 렌더 기하를 잰다 — 정적 스캔이 못 보는 것. */
const MEASURE = `() => {
  const SEL = 'button, [role="button"], input[type="checkbox"], input[type="radio"], select, a[role="button"]';
  const els = Array.from(document.querySelectorAll(SEL));
  const small = [];
  let nameless = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;              // 숨김 요소 제외
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    // 부모가 히트 영역을 주는 정상 패턴(label 로 감싼 체크박스) 보정
    const host = el.closest('label') ?? el;
    const hr = host.getBoundingClientRect();
    const w = Math.max(r.width, hr.width), h = Math.max(r.height, hr.height);
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
    if (!label) nameless++;
    if (w < 44 || h < 44) small.push({ label: label || '(이름없음)', w: Math.round(w), h: Math.round(h) });
  }
  // ── 흐름 연속성: 이 화면에서 "앞으로 나아갈 길"이 있는가 ──
  // 학습자가 화면마다 물어야 하는 것은 "다음에 뭘 하지?" 다. 앞으로 가는 경로가
  // 하나도 없으면 막다른 길이고, 그건 디자인 취향이 아니라 **셀 수 있는 결함**이다.
  // (판단이 필요한 "이 화면이 이해되는가" 는 자동화 못 하지만, 이건 된다)
  //
  // ⚠️ **셸(사이드바 · FlowNav · 하단 탭)은 세지 않는다.** 셸은 모든 화면에 같은 링크를
  //    N 개 얹으므로, 포함해서 세면 이 지표는 **원리적으로 0 이 될 수 없다** —
  //    측정을 돌려도 항상 통과하는 지표는 지표가 아니다(초판이 그랬고, 첫 실측에서
  //    막다른 길 0 이 나온 것은 화면이 좋아서가 아니라 셸을 셌기 때문이다).
  //    셸은 \`<main>\` 밖에 있으므로 **본문 안만** 센다. 셸 링크 수는 참고로 따로 낸다.
  const here = location.pathname;
  const main = document.querySelector('main') ?? document.body;
  const collectPaths = (root) => {
    const out = new Set();
    for (const a of Array.from(root.querySelectorAll('a[href]'))) {
      const r = a.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/')) continue;                // 외부·앵커 제외
      const path = href.split('?')[0].split('#')[0];
      if (!path || path === here) continue;               // 자기 자신 제외
      out.add(path);
    }
    return out;
  };
  const forward = collectPaths(main);
  const allPaths = collectPaths(document.body);
  // 라우팅을 JS 로 하는 버튼도 앞길이다 — 44px 이상 + 이름 있는 것만 인정
  let actionButtons = 0;
  for (const b of Array.from(main.querySelectorAll('button, [role="button"]'))) {
    const r = b.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) continue;
    const nm = (b.getAttribute('aria-label') || b.textContent || '').trim();
    if (nm) actionButtons++;
  }

  const de = document.documentElement;
  return {
    overflowPx: Math.max(0, de.scrollWidth - de.clientWidth),
    small,
    nameless,
    forwardPaths: forward.size,
    actionButtons,
    shellPaths: Math.max(0, allPaths.size - forward.size),
  };
}`;

test.describe('학습자 화면 전수 감사 (a11y · 레이아웃)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('전 화면 × 뷰포트 × 테마', async ({ page }) => {
    test.setTimeout(900_000);

    const findings: Finding[] = [];
    /** 20초 안에 DOM 이 멎지 않은 측정 — 값이 재현되지 않으므로 단언에서 뺀다(리포트에는 남긴다) */
    const unstable: string[] = []
    /** `/login` 으로 튕긴 측정 — 세션이 죽은 것이다. 그 화면의 값이 아니므로 전부 무효 */
    const loggedOut: string[] = [];
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
    });
    page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${String(e).slice(0, 160)}`));

    // ── 워밍업 (측정 아님) ──
    // dev 서버는 라우트를 **첫 요청 때 컴파일**한다. 30초 안에 안 열리는 화면이 나오고,
    // 그게 `NAVIGATION_FAILED` 로 리포트에 섞여 "제품 결함"처럼 보인다(2026-08-14 실측:
    // 첫 케이스 20건 실패 → 마지막 케이스 3건, 순전히 콜드/웜 차이였다).
    // 여기서 한 번씩 열어 컴파일을 끝내 놓고, 그 다음부터 잰다. CI 는 `next start`(빌드 산출물)라
    // 컴파일이 없으므로 이 패스는 몇 초에 끝난다 — 넣어도 CI 비용이 늘지 않는다.
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 180_000 }).catch(() => {});
    }
    consoleErrors.length = 0;

    for (const c of CASES) {
      await page.setViewportSize({ width: c.width, height: c.height });
      // 테마는 localStorage 기반 (hooks/useTheme) — 이동 전에 심는다.
      // ⚠️ 라우트마다 부르면 `addInitScript` 가 **누적**된다(24×3 = 72개가 매 페이지 실행).
      //    케이스당 한 번이면 충분하다.
      await page.addInitScript((t) => {
        try { window.localStorage.setItem('vocaflow-theme', t as string); } catch { /* noop */ }
      }, c.theme);
      for (const route of ROUTES) {
        consoleErrors.length = 0;

        try {
          await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          // ── 본문이 **더 이상 바뀌지 않을 때까지** 기다린다 ──
          // 고정 대기(900ms)도, "요소가 하나라도 생기면"(8초) 도 부족했다. 둘 다 **그리는 중**을
          // 재고, 그래서 같은 커밋을 두 번 재면 값이 달라졌다(실측: 터치 위반 241 ↔ 182,
          // 막다른 길 0 ↔ 6). 재현되지 않는 측정은 베이스라인을 만들 수 없다.
          // 조건은 "상호작용 요소가 있고, DOM 이 QUIET_MS 동안 조용하다" — 화면별 셀렉터가 필요 없다.
          const stabilized = await page
            .waitForFunction(
              () => {
                const QUIET_MS = 700;
                const w = window as unknown as { __sweepLast?: number; __sweepObs?: MutationObserver };
                const main = document.querySelector('main');
                if (!main) return false;
                if (!w.__sweepObs) {
                  w.__sweepLast = performance.now();
                  w.__sweepObs = new MutationObserver(() => { w.__sweepLast = performance.now(); });
                  w.__sweepObs.observe(main, { subtree: true, childList: true, attributes: true });
                  return false;
                }
                const hasControls = main.querySelectorAll('a[href], button, [role="button"]').length > 0;
                return hasControls && performance.now() - (w.__sweepLast ?? 0) > QUIET_MS;
              },
              undefined,
              { timeout: 20_000, polling: 200 },
            )
            .then(() => true)
            .catch(() => false); // 20초 안에 안 멎으면 그 측정은 **믿지 않는다**(아래에서 판정 제외)
          if (!stabilized) unstable.push(`${route}[${c.name}]`)

          // ── 로그인 화면을 재고 있지는 않은가 ──
          // 검증 계정은 워크스페이스의 **모든 세션이 공유**한다. 다른 세션의 인증 스펙이
          // 로그아웃하면 이쪽 컨텍스트의 세션도 함께 죽고, 그 뒤 모든 라우트가 `/login` 으로
          // 리다이렉트된다. 그래도 측정은 "성공" 하므로 **로그인 페이지의 컨트롤이
          // 그 화면의 위반으로 보고된다**(실측: `/hub`·`/dashboard`·`/reports` 등 8화면에
          // `비밀번호 보기 28x28` 이 새 위반으로 잡혔다 — 그 화면엔 그런 버튼이 없다).
          // 값이 틀린 것보다 나쁜 것은 **틀린 줄 모르는 것**이라, 여기서 걸러 낸다.
          if (/\/login(\?|$)/.test(page.url())) {
            loggedOut.push(`${route}[${c.name}]`)
            unstable.push(`${route}[${c.name}]`)
          };
        } catch {
          findings.push({ route, case: c.name, overflowPx: -1, consoleErrors: ['NAVIGATION_FAILED'], smallTargets: [], namelessControls: 0, forwardPaths: -1, actionButtons: -1, shellPaths: -1 });
          continue;
        }

        // 일부 화면은 진입 직후 리다이렉트한다(/flashcard → 세션 · /library → 하위 탭).
        // 측정 중 내비게이션이 일어나면 실행 컨텍스트가 파괴되므로, 가라앉힌 뒤 한 번 재시도한다.
        type Measured = {
          overflowPx: number;
          small: { label: string; w: number; h: number }[];
          nameless: number;
          forwardPaths: number;
          actionButtons: number;
          shellPaths: number;
        };
        let m: Measured | null = null;
        for (let attempt = 1; attempt <= 2 && !m; attempt++) {
          try {
            await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
            // 문자열을 그대로 넘기면 "함수 정의"가 평가돼 함수 객체가 돌아온다 — 호출식으로 감싼다.
            m = (await page.evaluate(`(${MEASURE})()`)) as Measured;
          } catch {
            await page.waitForTimeout(1_200);
          }
        }
        if (!m) {
          findings.push({ route, case: c.name, overflowPx: -1, consoleErrors: ['MEASURE_FAILED'], smallTargets: [], namelessControls: 0, forwardPaths: -1, actionButtons: -1, shellPaths: -1 });
          continue;
        }

        findings.push({
          route,
          case: c.name,
          overflowPx: m.overflowPx,
          consoleErrors: consoleErrors.filter(
            (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError|Download the React DevTools/.test(e),
          ),
          smallTargets: m.small,
          namelessControls: m.nameless,
          forwardPaths: m.forwardPaths,
          actionButtons: m.actionButtons,
          shellPaths: m.shellPaths,
        });
      }
    }

    // ── 리포트 ──
    // `test-results/` 에 두지 않는다 — Playwright 는 **실행 시작 때 그 디렉터리를 통째로 지운다**.
    // 워크스페이스에 세션이 둘 이상이면 남의 실행이 내 리포트를 지운다(2026-08-14 실측: 두 번 유실).
    mkdirSync('a11y-report', { recursive: true });
    writeFileSync('a11y-report/a11y-sweep.json', JSON.stringify(findings, null, 2), 'utf8');

    const overflow = findings.filter((f) => f.overflowPx > 1);
    const errored = findings.filter((f) => f.consoleErrors.length > 0);
    const nameless = findings.filter((f) => f.namelessControls > 0);
    const totalSmall = findings.reduce((a, f) => a + f.smallTargets.length, 0);

    // 화면별 고유 위반 (케이스 중복 제거).
    // 키는 **라벨만** 쓴다 — 크기를 키에 넣으면 뷰포트마다 1px 달라진 같은 요소가
    // 두 건으로 세어져 베이스라인이 실행마다 흔들린다. 크기는 값으로 들고 표시에만 쓴다.
    // 안 멎은 측정은 빼고 센다 — 반쯤 그려진 화면의 "위반 없음" 은 사실이 아니다.
    const trusted = findings.filter((f) => !unstable.includes(`${f.route}[${f.case}]`));
    const smallByRoute = new Map<string, Map<string, string>>();
    for (const f of trusted) {
      for (const s of f.smallTargets) {
        if (!smallByRoute.has(f.route)) smallByRoute.set(f.route, new Map());
        smallByRoute.get(f.route)!.set(s.label, `${s.w}x${s.h}`);
      }
    }

    console.log(`\n[sweep] ${ROUTES.length} 화면 × ${CASES.length} 케이스 = ${findings.length} 측정`);
    console.log(`[sweep] 가로 넘침 ${overflow.length} · 콘솔 에러 ${errored.length} · 이름없는 컨트롤 ${nameless.length}`);
    console.log(`[sweep] 44px 미만 터치 타겟 ${totalSmall}건 (중복 포함) / ${smallByRoute.size}개 화면`);
    console.log(
      `[sweep] 안정화 ${trusted.length}/${findings.length} 측정` +
        (unstable.length ? ` · 미안정(판정 제외): ${unstable.join(', ')}` : ''),
    )
    if (loggedOut.length > 0) {
      console.log(
        `[sweep] ⚠️ 세션이 죽어 /login 을 잰 측정 ${loggedOut.length}건 — **이 실행의 값은 믿지 말 것**.` +
          ` 검증 계정을 다른 세션이 함께 쓰면 그쪽 로그아웃이 이쪽 세션을 죽인다.` +
          ` 해당 라우트: ${loggedOut.slice(0, 8).join(', ')}${loggedOut.length > 8 ? ' …' : ''}`,
      )
    };
    console.log('');

    // ── 흐름 연속성 리포트 ──
    //   앞길(다른 경로 링크 + 44px 이상 이름있는 버튼)이 아예 없으면 막다른 길이다.
    //   학습자가 "다음에 뭘 하지?" 를 화면에서 답할 수 없다는 뜻.
    //   ⚠️ 사각: **같은 경로의 쿼리 이동**(`/wordvault?view=study` 탭 등)은 세지 않는다.
    //      그래서 '앞길 얇음' 목록에는 실제로는 탭이 여럿인 화면이 섞인다 — 참고값으로만 읽을 것.
    //      막다른 길(0건) 판정만 단언한다.
    const deadEnds = trusted.filter(
      (f) => f.forwardPaths === 0 && f.actionButtons === 0,
    );
    const thinPaths = trusted.filter(
      (f) => f.forwardPaths >= 0 && f.forwardPaths + f.actionButtons > 0 && f.forwardPaths + f.actionButtons <= 2,
    );
    const shellAvg =
      findings.filter((f) => f.shellPaths >= 0).reduce((a, f) => a + f.shellPaths, 0) /
      Math.max(1, findings.filter((f) => f.shellPaths >= 0).length);
    console.log(
      `[sweep] 흐름(본문 기준) — 막다른 길 ${deadEnds.length} · 앞길 2개 이하 ${thinPaths.length}` +
        ` · 셸이 얹는 링크 평균 ${shellAvg.toFixed(1)}종(판정 제외)`,
    );
    for (const f of deadEnds) console.log(`  막다른길  ${f.route} [${f.case}]`);
    for (const f of thinPaths.slice(0, 12)) {
      console.log(`  앞길얇음  ${f.route} [${f.case}] 링크${f.forwardPaths}+버튼${f.actionButtons}`);
    }
    console.log('');

    for (const f of overflow) console.log(`  넘침 ${f.overflowPx}px  ${f.route} [${f.case}]`);
    for (const f of errored) console.log(`  에러  ${f.route} [${f.case}] ${f.consoleErrors[0]}`);
    for (const f of nameless) console.log(`  무명  ${f.route} [${f.case}] ${f.namelessControls}개`);

    console.log(`\n  터치 타겟 위반 상위 화면 (고유 라벨 / 베이스라인):`);
    for (const [route, map] of [...smallByRoute.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 12)) {
      const base = TOUCH_BASELINE[route] ?? 0;
      console.log(`    ${String(map.size).padStart(3)}종 / ${String(base).padStart(3)}  ${route}`);
      for (const [label, size] of [...map].slice(0, 3)) console.log(`           · ${label}|${size}`);
    }
    console.log('');

    // ── 단언 ──
    // 베이스라인에 없는 **새** 위반만 실패시킨다 (오늘부터의 악화 차단).
    const newOverflow = overflow
      .filter((f) => !OVERFLOW_BASELINE.has(f.route))
      .map((f) => `${f.route}[${f.case}] +${f.overflowPx}px`);
    // 느린 화면 예외(`/arcade`·`/my/texts`·`/library/books`)는 걷어냈다 —
    // 워밍업 패스가 콜드 컴파일을 앞에서 흡수하므로 이제 전부 열려야 한다(실측 로드 실패 0).
    const newErrors = errored.map((f) => `${f.route}[${f.case}] ${f.consoleErrors[0]}`);

    // 44px 미만 — **화면별**로 베이스라인을 넘는 것만 본다.
    // 어느 화면이 나빠졌는지 메시지에 그대로 나오고, 다른 화면의 흔들림에 가려지지 않는다.
    const worsened: string[] = [];
    for (const [route, map] of smallByRoute) {
      const base = TOUCH_BASELINE[route] ?? 0;
      if (map.size > base) worsened.push(`${route} ${map.size}종 > 베이스라인 ${base} (${[...map.keys()].join(', ')})`);
    }

    // ── 환경과 무관하게 안정적인 것: 어디서든 실패시킨다 ──
    expect(newOverflow, '새 가로 넘침 (모바일에서 화면이 옆으로 밀린다)').toEqual([]);
    expect(
      nameless.map((f) => `${f.route}[${f.case}] ${f.namelessControls}`),
      '접근 가능한 이름 없는 컨트롤 (베이스라인 0 — 절대 늘리지 말 것)',
    ).toEqual([]);

    // ── dev 에서 재현되지 않는 것: CI(빌드 산출물)에서만 실패시킨다 (위 GATE_UNSTABLE 주석) ──
    if (GATE_UNSTABLE) {
      expect(newErrors, '새 콘솔 에러 · 로드 실패').toEqual([]);
      // 흐름 연속성 — 본문에 앞길이 하나도 없는 화면.
      // 셸을 세던 초판은 원리적으로 항상 0 이었다. 셸을 뺀 뒤 나온 수는 렌더 타이밍에 흔들려,
      // 지금은 CI 에서만 0 을 요구한다.
      expect(
        deadEnds.map((f) => `${f.route}[${f.case}]`),
        '막다른 길 (본문에 다른 경로 링크도, 44px 이상 이름있는 버튼도 없다)',
      ).toEqual([]);
      expect(worsened, '44px 미만 터치 타겟이 늘어난 화면 (베이스라인은 줄이는 방향으로만 갱신)').toEqual([]);
    } else if (newErrors.length || deadEnds.length || worsened.length) {
      console.log(
        `\n[sweep] ⚠️ dev 실행이라 아래는 실패 처리하지 않는다 (CI 에서 판정) —` +
          ` 콘솔에러 ${newErrors.length} · 막다른길 ${deadEnds.length} · 터치 악화 ${worsened.length}`,
      );
      for (const w of worsened) console.log(`  터치악화  ${w}`);
    }
  });
});
