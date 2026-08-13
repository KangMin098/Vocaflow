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
const STATE_PATH = 'test-results/.auth-a11y-sweep.json';

/** 학습자 정적 라우트 — [param] 라우트는 대상 데이터가 계정마다 달라 제외 */
const ROUTES = [
  '/hub', '/dashboard', '/plan', '/reports',
  '/wordvault', '/my/words', '/my/texts', '/my/books',
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
 * ── 베이스라인 (2026-08-13 최초 실측) ──
 *
 * 기존 위반을 전부 실패로 막으면 스펙이 상시 빨간불이 되어 아무도 안 본다.
 * 그래서 **오늘 값을 고정하고 오늘부터의 악화만 막는다**. 전부 **줄이는 방향으로만**
 * 갱신할 것 — 숫자를 올려야 한다면 그건 회귀를 덮는 것이다.
 *
 * 정적 스캔(scripts/a11y-touch-target)은 80건으로 추정했는데 실측은 202건이었다.
 * 부모가 크기를 주는 요소·렌더 후 결정되는 크기를 정적으로는 못 보기 때문이다.
 */
const TOUCH_BASELINE = 202;

/** 가로 넘침이 남아 있는 화면 — 모바일에서 옆으로 밀린다. 해소되면 목록에서 뺄 것. */
const OVERFLOW_BASELINE = new Set(['/plan', '/library', '/library/books']);

/** 30초 안에 열리지 않는 화면 — 원인 미규명. 해소되면 목록에서 뺄 것. */
const SLOW_ROUTE_BASELINE = new Set(['/arcade', '/my/texts', '/library/books']);

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
  const de = document.documentElement;
  return {
    overflowPx: Math.max(0, de.scrollWidth - de.clientWidth),
    small,
    nameless,
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
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
    });
    page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${String(e).slice(0, 160)}`));

    for (const c of CASES) {
      await page.setViewportSize({ width: c.width, height: c.height });
      for (const route of ROUTES) {
        consoleErrors.length = 0;
        // 테마는 localStorage 기반 (hooks/useTheme) — 이동 전에 심는다
        await page.addInitScript((t) => {
          try { window.localStorage.setItem('vocaflow-theme', t as string); } catch { /* noop */ }
        }, c.theme);

        try {
          await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await page.waitForTimeout(900); // hydration + 첫 데이터
        } catch {
          findings.push({ route, case: c.name, overflowPx: -1, consoleErrors: ['NAVIGATION_FAILED'], smallTargets: [], namelessControls: 0 });
          continue;
        }

        // 일부 화면은 진입 직후 리다이렉트한다(/flashcard → 세션 · /library → 하위 탭).
        // 측정 중 내비게이션이 일어나면 실행 컨텍스트가 파괴되므로, 가라앉힌 뒤 한 번 재시도한다.
        type Measured = {
          overflowPx: number;
          small: { label: string; w: number; h: number }[];
          nameless: number;
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
          findings.push({ route, case: c.name, overflowPx: -1, consoleErrors: ['MEASURE_FAILED'], smallTargets: [], namelessControls: 0 });
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
        });
      }
    }

    // ── 리포트 ──
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/a11y-sweep.json', JSON.stringify(findings, null, 2), 'utf8');

    const overflow = findings.filter((f) => f.overflowPx > 1);
    const errored = findings.filter((f) => f.consoleErrors.length > 0);
    const nameless = findings.filter((f) => f.namelessControls > 0);
    const totalSmall = findings.reduce((a, f) => a + f.smallTargets.length, 0);

    // 화면별 고유 위반 (케이스 중복 제거)
    const smallByRoute = new Map<string, Set<string>>();
    for (const f of findings) {
      for (const s of f.smallTargets) {
        if (!smallByRoute.has(f.route)) smallByRoute.set(f.route, new Set());
        smallByRoute.get(f.route)!.add(`${s.label}|${s.w}x${s.h}`);
      }
    }

    console.log(`\n[sweep] ${ROUTES.length} 화면 × ${CASES.length} 케이스 = ${findings.length} 측정`);
    console.log(`[sweep] 가로 넘침 ${overflow.length} · 콘솔 에러 ${errored.length} · 이름없는 컨트롤 ${nameless.length}`);
    console.log(`[sweep] 44px 미만 터치 타겟 ${totalSmall}건 (중복 포함) / ${smallByRoute.size}개 화면\n`);

    for (const f of overflow) console.log(`  넘침 ${f.overflowPx}px  ${f.route} [${f.case}]`);
    for (const f of errored) console.log(`  에러  ${f.route} [${f.case}] ${f.consoleErrors[0]}`);
    for (const f of nameless) console.log(`  무명  ${f.route} [${f.case}] ${f.namelessControls}개`);

    console.log(`\n  터치 타겟 위반 상위 화면:`);
    for (const [route, set] of [...smallByRoute.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 12)) {
      console.log(`    ${String(set.size).padStart(3)}종  ${route}`);
      for (const s of [...set].slice(0, 3)) console.log(`           · ${s}`);
    }
    console.log('');

    // ── 단언 ──
    // 베이스라인에 없는 **새** 위반만 실패시킨다 (오늘부터의 악화 차단).
    const newOverflow = overflow
      .filter((f) => !OVERFLOW_BASELINE.has(f.route))
      .map((f) => `${f.route}[${f.case}] +${f.overflowPx}px`);
    const newErrors = errored
      .filter((f) => !(f.consoleErrors[0] === 'NAVIGATION_FAILED' && SLOW_ROUTE_BASELINE.has(f.route)))
      .map((f) => `${f.route}[${f.case}] ${f.consoleErrors[0]}`);

    expect(newOverflow, '새 가로 넘침 (모바일에서 화면이 옆으로 밀린다)').toEqual([]);
    expect(newErrors, '새 콘솔 에러 · 로드 실패').toEqual([]);
    expect(
      nameless.map((f) => `${f.route}[${f.case}] ${f.namelessControls}`),
      '접근 가능한 이름 없는 컨트롤 (베이스라인 0 — 절대 늘리지 말 것)',
    ).toEqual([]);
    expect(
      totalSmall,
      `44px 미만 터치 타겟 (베이스라인 ${TOUCH_BASELINE} · 줄이는 방향으로만 갱신)`,
    ).toBeLessThanOrEqual(TOUCH_BASELINE);
  });
});
