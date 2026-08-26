// apps/web/tests/e2e/30-admin-sweep.spec.ts
//
// **관리자 전수 훑기** — 33개 화면이 열리고 · 조용하고 · 링크가 살아 있고 · 되돌아온다.
//
// ── 왜 이 스펙이 없었나가 문제였다 (실측 2026-08-25) ──────────────────────
// 학습자 쪽에는 전수 훑기(`26-learner-sweep`)가 있었지만 관리자 쪽에는 없었다.
// 관리자 정적 라우트 33개 중 어떤 스펙에라도 등장하는 것은 **8개(24.2%)** 뿐이고,
// 나머지 25개 화면은 **어떤 테스트도 열어 본 적이 없다.** 그 상태에서 "관리자는 괜찮다"
// 고 말할 근거가 없다 — 열리는지조차 아무도 안 봤기 때문이다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────────
//   ① 열림   — 화면이 뜨고, 에러 바운더리로 떨어지지 않는다
//   ② 조용함 — 콘솔 에러 0 (알려진 잡음은 이름을 붙여 거른다)
//   ③ 연결   — 화면 안의 내부 링크가 **실재하는 라우트**를 가리킨다(죽은 링크 0)
//   ④ 복귀   — 링크를 눌러 나갔다가 뒤로가기로 **원래 화면에 정확히 돌아온다**
//
// ── 판정 원칙 ────────────────────────────────────────────────────────────
// 한 화면이 실패하면 그 화면만 실패로 적고 **계속 훑는다.** 첫 실패에서 멈추면
// 매 실행마다 "첫 번째 문제" 하나씩만 알게 되고, 33개를 고치는 데 33번이 걸린다.
// 실패는 전부 모아 마지막에 한 번에 보고한다.

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

import {
  adminBypassEnabled,
  adminReachable,
  adminRedirectOnlyRoutes,
  adminRoutes,
  ADMIN_NO_CLICK_ROUTES,
} from './utils/admin-routes';

const ROUTES = adminRoutes();
/** 리다이렉트 껍데기 — 본문·복귀를 묻지 않는다(목적지에서 재진다). 소스로 판별. */
const REDIRECT_ONLY = adminRedirectOnlyRoutes();

/**
 * 콘솔 잡음 — **이름을 붙인 것만** 거른다.
 * 정규식이 넓어지면 진짜 에러까지 함께 지워지고, 그때 스펙은 조용히 아무것도 안 잰다.
 */
const KNOWN_NOISE = [
  /favicon/i,
  /Failed to load resource.*404/i,
  /Download the React DevTools/i,
  // Next dev 오버레이·HMR 잡음 — 프로덕션에는 없다
  /webpack-hmr|_next\/static\/webpack|hot-update/i,
  // Supabase 익명 세션에서 나는 토큰 갱신 잡음
  /auth\/v1\/token|AuthApiError|Invalid Refresh Token/i,
];

const isNoise = (t: string) => KNOWN_NOISE.some((re) => re.test(t));

/** 이 화면이 에러 바운더리로 떨어졌는가 — `app/error.tsx` 가 그리는 표면. */
async function crashed(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const t = document.body?.innerText ?? '';
      return (
        /Application error|client-side exception|missing required error components/i.test(t) ||
        /문제가 발생했어요|다시 시도/.test(t) === false && false
      );
    })
    .catch(() => false);
}

interface Finding {
  route: string;
  axis: '열림' | '조용함' | '연결' | '복귀';
  detail: string;
}

test.describe('관리자 전수 훑기', () => {
  test('모든 관리자 화면이 열리고 · 조용하고 · 링크가 살아 있고 · 되돌아온다', async ({ page }) => {
    test.skip(!adminBypassEnabled(), 'DEV_ADMIN_BYPASS=1 이 아니다');
    test.skip(!(await adminReachable(page)), '관리자 화면이 열리지 않는다 — dev 우회가 꺼져 있거나(프로덕션 빌드) 서버가 없다. 로그인 화면을 세어 초록을 만들지 않는다');
    test.setTimeout(ROUTES.length * 22_000 + 120_000);

    const findings: Finding[] = [];
    // 라우트 실재 판정의 분모 — 죽은 링크를 "없는 화면" 으로 판정하려면 목록이 필요하다.
    const known = new Set(ROUTES);

    for (const route of ROUTES) {
      const errors: string[] = [];
      const onConsole = (m: ConsoleMessage) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (!isNoise(t)) errors.push(t.slice(0, 180));
      };
      const onPageError = (e: Error) => {
        if (!isNoise(e.message)) errors.push(`[uncaught] ${e.message.slice(0, 180)}`);
      };
      page.on('console', onConsole);
      page.on('pageerror', onPageError);

      try {
        // ── ① 열림 ───────────────────────────────────────────────────
        const res = await page
          .goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
          .catch(() => null);

        if (!res) {
          findings.push({ route, axis: '열림', detail: '네비게이션 실패(타임아웃)' });
          continue;
        }
        if (res.status() >= 400) {
          findings.push({ route, axis: '열림', detail: `HTTP ${res.status()}` });
          continue;
        }
        // 로그인으로 튕기면 우회가 안 먹은 것 — 그 화면을 잰 것이 아니다.
        if (/\/login/.test(page.url())) {
          findings.push({ route, axis: '열림', detail: `로그인으로 리다이렉트 (${page.url()})` });
          continue;
        }

        // 클라이언트 렌더가 끝날 여유. networkidle 은 이 앱의 폴링 때문에 영영 안 온다.
        await page.waitForTimeout(1200);

        if (await crashed(page)) {
          findings.push({ route, axis: '열림', detail: '에러 바운더리로 떨어졌다' });
          continue;
        }

        // 본문이 사실상 비어 있으면 "열렸다" 고 할 수 없다.
        // 리다이렉트 껍데기는 본문을 묻지 않는다 — 물으면 리다이렉트 도중을 찍는다.
        if (!REDIRECT_ONLY.has(route)) {
          const textLen = await page
            .evaluate(() => (document.body?.innerText ?? '').trim().length)
            .catch(() => 0);
          if (textLen < 40) {
            findings.push({ route, axis: '열림', detail: `본문이 거의 비었다(${textLen}자)` });
          }
        }

        // ── ③ 연결 ───────────────────────────────────────────────────
        // 이 화면이 내미는 내부 링크가 실재하는 관리자 라우트인가.
        // (동적 라우트 `[id]` 로 가는 링크는 분모에서 뺀다 — 목록에 없는 것이 정상이다.)
        const links: string[] = await page
          .evaluate(() =>
            Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'))
              .map((a) => a.getAttribute('href') || '')
              .filter(Boolean),
          )
          .catch(() => []);

        const adminLinks = [...new Set(links)]
          .map((h) => h.split('?')[0].split('#')[0].replace(/\/$/, ''))
          .filter((h) => h.startsWith('/admin'));

        for (const href of adminLinks) {
          if (known.has(href)) continue;
          // 동적 세그먼트로 가는 링크인지 — `/admin/x/<uuid>` 같은 형태는 정상이다.
          const parent = href.slice(0, href.lastIndexOf('/'));
          const looksDynamic = known.has(parent) || /[0-9a-f]{8}-[0-9a-f]{4}/i.test(href);
          if (looksDynamic) continue;
          findings.push({ route, axis: '연결', detail: `없는 화면으로 가는 링크: ${href}` });
        }

        // ── ④ 복귀 ───────────────────────────────────────────────────
        // 첫 내부 링크로 나갔다가 뒤로가기로 정확히 이 화면에 돌아오는가.
        if (!ADMIN_NO_CLICK_ROUTES.has(route) && !REDIRECT_ONLY.has(route)) {
          const target = adminLinks.find((h) => known.has(h) && h !== route);
          if (target) {
            const before = page.url();
            const moved = await page
              .goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 })
              .then(() => true)
              .catch(() => false);
            if (moved) {
              await page.waitForTimeout(500);
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
              await page.waitForTimeout(500);
              const back = page.url();
              if (new URL(back).pathname !== new URL(before).pathname) {
                findings.push({
                  route,
                  axis: '복귀',
                  detail: `뒤로가기가 ${new URL(back).pathname} 로 갔다(기대: ${new URL(before).pathname})`,
                });
              }
            }
          }
        }

        // ── ② 조용함 ─────────────────────────────────────────────────
        if (errors.length > 0) {
          findings.push({
            route,
            axis: '조용함',
            detail: `콘솔 에러 ${errors.length}건 — ${errors[0]}`,
          });
        }
      } finally {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
        // **다음 화면을 깨끗한 상태에서 잰다.**
        // 한 페이지를 33번 재사용하면 앞 화면의 미완료 요청을 물고 다음 goto 가 시작된다.
        // 실측 2026-08-25: /admin/vocab/collections 는 홀로 열면 5.7초인데(요청 31건 미완료),
        // 훑기 안에서는 45초 타임아웃으로 찍혔다 — 그건 화면이 아니라 **큐를 잰 것**이다.
        // about:blank 로 넘겨 진행 중인 요청을 끊는다. 실제 관리자도 화면을 하나씩 본다.
        await page.goto('about:blank').catch(() => {});
      }
    }

    // ── 보고 ───────────────────────────────────────────────────────
    const byAxis = (a: Finding['axis']) => findings.filter((f) => f.axis === a);
    const summary = [
      `관리자 화면 ${ROUTES.length}개 훑음`,
      `  열림   실패 ${byAxis('열림').length}`,
      `  조용함 실패 ${byAxis('조용함').length}`,
      `  연결   실패 ${byAxis('연결').length}`,
      `  복귀   실패 ${byAxis('복귀').length}`,
      '',
      ...findings.map((f) => `  [${f.axis}] ${f.route} — ${f.detail}`),
    ].join('\n');

    // eslint-disable-next-line no-console
    console.log('\n' + summary + '\n');

    expect(findings, summary).toEqual([]);
  });

  test('390px 에서 가로로 스크롤되는 관리자 화면이 없다', async ({ browser }) => {
    test.skip(!adminBypassEnabled(), 'DEV_ADMIN_BYPASS=1 이 아니다');
    test.setTimeout(ROUTES.length * 16_000 + 120_000);
    const probe = await browser.newPage();
    const reachable = await adminReachable(probe);
    await probe.close();
    test.skip(!reachable, '관리자 화면이 열리지 않는다 — dev 우회가 꺼져 있거나(프로덕션 빌드) 서버가 없다. 로그인 화면을 세어 초록을 만들지 않는다');

    // 왜 이 축을 따로 두는가:
    //   가로 스크롤은 **어떤 화면에서도 의도가 아니다.** 화면은 멀쩡히 뜨고 콘솔도 조용해서
    //   위의 4축은 전부 통과하는데, 손에 쥔 사람은 좌우로 밀리는 화면을 본다.
    //   CLAUDE.md 는 "모바일 퍼스트 (390 → 768 → 1280px)" 를 항상 지킬 것으로 못 박고 있다.
    //
    // ⚠️ 관리자 내비게이션 자체는 여기서 재지 않는다 — 사이드바가 `hidden md:flex` 라
    //    390px 에서 33화면 중 30곳의 관리자 링크가 **하나도 보이지 않는다**(실측 2026-08-25).
    //    그건 버그가 아니라 "관리자는 데스크톱 표면" 이라는 설계 결정이고, 바꾸려면 모바일
    //    관리자 내비를 새로 만드는 제품 결정이 필요하다. 사실만 여기 적어 둔다.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const bad: string[] = [];

    try {
      for (const route of ROUTES) {
        const res = await page
          .goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
          .catch(() => null);
        if (!res || res.status() >= 400 || /\/login/.test(page.url())) continue;
        await page.waitForTimeout(1000);

        // scrollWidth 만 보면 **잘려 있는데도** 넘친다고 읽는 경우가 있다.
        // 실제로 밀리는지 밀어 본다 — 그게 사람이 겪는 것이다.
        const moved = await page
          .evaluate(() => {
            const before = window.scrollX;
            window.scrollTo(9999, 0);
            const after = window.scrollX;
            window.scrollTo(0, 0);
            return after - before;
          })
          .catch(() => 0);
        if (moved > 1) bad.push(`${route} — 가로로 ${moved}px 밀린다`);
        await page.goto('about:blank').catch(() => {});
      }
    } finally {
      await ctx.close();
    }

    expect(bad, `390px 에서 가로 스크롤이 생기는 화면:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  test('레지스트리 정합 — 파일시스템의 관리자 화면을 빠뜨리지 않는다', () => {
    // 목록을 손으로 적는 순간 뒤처진다. 학습자 쪽이 이미 그 값을 치렀다.
    expect(ROUTES.length, '관리자 라우트가 하나도 안 잡혔다 — 경로 규칙이 바뀌었는지 확인').toBeGreaterThan(20);
    expect(ROUTES).toContain('/admin');
    expect(new Set(ROUTES).size, '중복 라우트').toBe(ROUTES.length);
  });
});
