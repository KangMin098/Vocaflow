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
//   ⑤ 요청   — 그 화면이 보낸 **같은 출처 요청이 4xx/5xx 로 실패하지 않는다**
//            (나머지 넷은 전부 "화면이 뜨는가" 다. 화면은 뜨는데 그 데이터가
//             500 이면 관리자는 빈 큐를 "할 일 없음" 으로 읽는다.)
//
// ── 판정 원칙 ────────────────────────────────────────────────────────────
// 한 화면이 실패하면 그 화면만 실패로 적고 **계속 훑는다.** 첫 실패에서 멈추면
// 매 실행마다 "첫 번째 문제" 하나씩만 알게 되고, 33개를 고치는 데 33번이 걸린다.
// 실패는 전부 모아 마지막에 한 번에 보고한다.

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

import {
  adminBypassEnabled,
  adminReach,
  adminRedirectOnlyRoutes,
  adminRoutes,
  ADMIN_NO_CLICK_ROUTES,
} from './utils/admin-routes';
import { crashKind } from './utils/crash-screen';
import { describeNetFailure, watchNetwork } from './utils/net-watch';

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

/**
 * 이 화면이 에러 화면인가 — 판정은 `utils/crash-screen.ts` 가 소유한다.
 *
 * ⚠️ 2026-08-26 이전 이 함수의 조건은 **죽어 있었다**:
 *     `/문제가 발생했어요|다시 시도/.test(t) === false && false`
 * `X === false && false` 는 **항상 false** 다. 즉 관리자 33화면은 우리 에러 경계로
 * 떨어져도 영영 초록이었다 — `error.tsx` 는 HTTP 200 에 본문도 충분하니
 * 나머지 축도 전부 통과한다. **아무도 안 보는 구멍이었다.**
 */
async function crashed(page: Page): Promise<boolean> {
  return (await crashKind(page)) !== null;
}

interface Finding {
  route: string;
  axis: '열림' | '조용함' | '연결' | '복귀' | '요청';
  detail: string;
}

test.describe('관리자 전수 훑기', () => {
  test('모든 관리자 화면이 열리고 · 조용하고 · 링크가 살아 있고 · 되돌아온다', async ({ page }) => {
    // ⚠️ **시간 예산을 가장 먼저 준다.** 예전에는 `adminReachable()` **뒤에** 있었는데,
    //    그 한 줄이 dev 서버를 깨우는 첫 요청이라 콜드 상태에서는 30초를 넘긴다
    //    (실측 2026-09-06: 파일 33개를 고쳐 전체 재컴파일이 걸린 직후 이 자리에서
    //    `Test timeout of 30000ms exceeded` 로 죽었다 — 기본 타임아웃이었다).
    //    그러면 훑기가 한 화면도 못 재고 끝나면서 **원인과 무관한 메시지**만 남는다.
    //    측정 한 바퀴(브라우저) + 예열(HTTP GET, 싸다).
    //
    // ⚠️ 라우트당 예산은 **추측이 아니라 실측**이다(2026-09-06, 예열된 dev 서버):
    //    관리자 라우트 응답 202건 — 중앙값 **2.2초** · p90 **16.1초** · 최대 **35.2초**.
    //    한 라우트가 goto 를 **둘** 쓴다(진입 + 복귀 확인)므로 p90 경로는 33초가 넘는다.
    //    24초로는 모자라 전체가 20.2분에서 시간 초과했다 — 화면은 멀쩡히 열리는데
    //    **끝까지 못 훑고 죽어** 아무 판정도 못 냈다. 40초로 올린다(43라우트 ≈ 32분).
    test.setTimeout(ROUTES.length * 40_000 + 180_000);
    test.skip(!adminBypassEnabled(), 'DEV_ADMIN_BYPASS=1 이 아니다');
    // 「서버가 죽었다」를 「잴 것이 없다」로 뭉개지 않는다 — 전자는 실패다.
    const reach = await adminReach(page);
    test.skip(reach === 'login', '관리자 화면이 로그인으로 튕긴다 — dev 우회가 꺼졌다(프로덕션 빌드). 로그인 화면을 세어 초록을 만들지 않는다');
    expect(reach, '/admin 을 못 열었다 — 서버가 없거나 컴파일이 안 끝났다. 잴 수 있어야 하는데 못 쟀으면 통과가 아니다(위 [admin-sweep] 로그에 사유)').toBe('ok');

    const findings: Finding[] = [];
    // 라우트 실재 판정의 분모 — 죽은 링크를 "없는 화면" 으로 판정하려면 목록이 필요하다.
    const known = new Set(ROUTES);

    // ── 예열 ───────────────────────────────────────────────────────────
    // ⚠️ **이 훑기는 dev 서버에서만 돌 수 있다.** 관리자 우회(`DEV_ADMIN_BYPASS`)를
    //    `NODE_ENV==='production'` 에서 코드가 무조건 무력화하기 때문이다
    //    (`lib/auth/dev-bypass.ts` — 하드 게이트). 학습자 훑기처럼 프로덕션 빌드로
    //    도망갈 수 없다.
    //
    //    그런데 dev 서버는 **라우트마다 첫 방문에 컴파일한다.** 그 첫 방문을 재면
    //    컴파일 지연이 앱 결함으로 찍힌다. 실측 2026-08-26: `/admin` 이
    //    `Failed to fetch RSC payload … Falling back to browser navigation` 으로
    //    콘솔 에러 1건을 냈는데, 같은 화면을 홀로·연속·about:blank 경유 세 방법으로
    //    다시 열자 **셋 다 0건**이었다. 재현되지 않는다 = 화면이 아니라 **컴파일 타이밍**이다.
    //
    //    학습자 훑기가 같은 함정을 먼저 겪고 예열로 풀었다(같은 코드가 96.7% → 54.9%).
    //    예열 결과는 **버린다**(재지 않은 것을 성적에 넣지 않는다).
    //
    // ⚠️ 예열은 **브라우저로 열지 않고 HTTP GET 으로만** 한다.
    //    첫 판은 학습자 훑기처럼 새 탭으로 33화면을 전부 열었는데, 라우트당 두 번
    //    렌더하느라 **26분이 걸려 테스트가 타임아웃**했다(1,302초 초과).
    //    컴파일을 유발하는 것은 서버 요청이지 클라이언트 렌더가 아니므로,
    //    요청만 보내면 목적(컴파일 선행)은 같고 비용은 훨씬 싸다.
    // ⚠️ 예열은 **확인해야 예열이다** (2026-09-05).
    //    예전에는 `.catch(() => {})` 로 결과를 통째로 버려서, 예열 요청 자체가 404 로
    //    떨어져도(= 아직 컴파일 안 됨) 그대로 본 측정으로 넘어갔다. 그래서 스윕이
    //    돌 때마다 **다른 3~5개 화면**이 `404 GET <자기 자신>` 과
    //    `Failed to fetch RSC payload …` 로 찍혔다 — 실패 집합이 매번 바뀌는 것이
    //    이것이 화면 결함이 아니라 컴파일 타이밍이라는 증거다.
    //
    //    지금은 200 이 아닌 라우트만 모아 한 번 더 두드린다. 그래도 200 이 아니면
    //    **가리지 않는다** — 본 측정이 그 화면을 정상적으로 재고, 진짜 404 는 잡힌다.
    const notWarm: string[] = [];
    for (const route of ROUTES) {
      const r = await page.request.get(route, { timeout: 60_000 }).catch(() => null);
      if (!r || !r.ok()) notWarm.push(route);
    }
    for (const route of notWarm) {
      await page.waitForTimeout(300);
      await page.request.get(route, { timeout: 60_000 }).catch(() => null);
    }

    // ── ⑤ 요청 ─────────────────────────────────────────────────────────
    // 나머지 축은 전부 **"화면이 뜨는가"** 를 묻는다. 화면은 멀쩡히 뜨고 콘솔도
    // 조용한데 **그 화면의 데이터 요청이 500 을 뱉는** 경우는 아무도 안 봤다.
    // 관리자에게는 특히 위험하다 — 빈 목록이 "큐가 비었다" 로 읽히기 때문이다.
    const origin = new URL(page.url()).origin;
    const net = watchNetwork(page, origin);

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
        // ── ⑤ 요청 ───────────────────────────────────────────────────
        // 이 화면 몫만 본다(복귀 축이 다른 화면을 들렀다 오므로 라우트마다 비운다).
        const failed = net.drain();
        if (failed.length > 0) {
          findings.push({
            route,
            axis: '요청',
            detail: `실패한 요청 ${failed.length}건 — ${describeNetFailure(failed[0])}`,
          });
        }
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

    net.stop();

    // ── 보고 ───────────────────────────────────────────────────────
    const byAxis = (a: Finding['axis']) => findings.filter((f) => f.axis === a);
    const summary = [
      `관리자 화면 ${ROUTES.length}개 훑음`,
      `  열림   실패 ${byAxis('열림').length}`,
      `  조용함 실패 ${byAxis('조용함').length}`,
      `  연결   실패 ${byAxis('연결').length}`,
      `  복귀   실패 ${byAxis('복귀').length}`,
      `  요청   실패 ${byAxis('요청').length}`,
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
    // ⚠️ 이 goto 는 예열도 겸한다 — 아래 측정이 **콜드 컴파일 중인 화면**을 재면
    //   폭이 실제와 다르게 나온다(실측 2026-09-06: 예열 없이 재서 7개 화면이 넘침으로
    //   나왔는데, 같은 검사가 예열된 판에서는 통과했다). 판정 전에 서버를 깨운다.
    const reach = await adminReach(probe);
    await probe.close();
    test.skip(reach === 'login', '관리자 화면이 로그인으로 튕긴다 — dev 우회가 꺼졌다(프로덕션 빌드). 로그인 화면을 세어 초록을 만들지 않는다');
    expect(reach, '/admin 을 못 열었다 — 서버가 없거나 컴파일이 안 끝났다. 잴 수 있어야 하는데 못 쟀으면 통과가 아니다(위 [admin-sweep] 로그에 사유)').toBe('ok');

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
