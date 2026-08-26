// apps/web/tests/e2e/33-public-sweep.spec.ts
//
// **공개 화면 전수 훑기** — 로그아웃 상태로, 데스크톱과 390px 양쪽에서.
//
// ── 왜 이 스펙이 없었나가 문제였다 (실측 2026-08-26) ──────────────────────
// 전수 훑기가 둘 있었지만 **둘 다 로그인한 뒤의 화면만** 봤다(학습자 45 · 관리자 33).
// 랜딩 `/` · `(marketing)` · `(auth)` 는 **어느 훑기의 분모에도 없었다** —
// 하필 검색·공유가 도착하는 정문이고, 모든 가입자가 반드시 통과하는 길이다.
// 로그인 뒤가 100% 여도 정문이 깨져 있으면 아무도 거기까지 오지 못한다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────────
//   ① 열림     — 뜨고, 에러 바운더리로 떨어지지 않고, 본문이 있다
//   ② 조용함   — 콘솔 에러 0
//   ③ 연결     — 내부 링크가 **실재하는 라우트**를 가리킨다(죽은 링크 0)
//   ④ 복귀     — 링크로 나갔다가 뒤로가기로 정확히 돌아온다
//   ⑤ 가로스크롤 — 390px 에서 좌우로 밀리지 않는다
//   ⑥ 탭 대상  — 390px 에서 44px 미만으로 눌러야 하는 것이 없다
//   ⑦ 요청     — 그 화면이 보낸 **같은 출처 요청이 4xx/5xx 로 실패하지 않는다**
//              (①~⑥ 은 전부 "화면이 뜨는가" 다. 화면은 뜨는데 데이터가 안 오면
//               학습자는 빈 카탈로그를 보고 우리는 그 화면을 100% 로 센다.)
//
// 한 화면이 실패해도 **계속 훑는다** — 첫 실패에서 멈추면 매 실행 하나씩만 알게 된다.
//
// ⚠️ **프로덕션 빌드 위에서 잰다.** dev 서버는 라우트마다 첫 방문에 컴파일하고, 그때 청크가
//    잘려 오면 `[uncaught] Invalid or unexpected token` 이 뜬다 — 화면이 아니라 서버 상태다.
//    실측 2026-08-27, 같은 코드 같은 커밋:
//      dev(3221)        → `/dev` 조용함 실패 1  (위 파싱 에러)
//      프로덕션(next start) → **12화면 7축 전부 0**, 게다가 8.7분 → 59초
//    권장:  next build && next start -p 3240  후  PLAYWRIGHT_BASE_URL=http://localhost:3240

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

import { crashKindOf } from './utils/crash-screen';
import { describeNetFailure, watchNetwork } from './utils/net-watch';
import { AUTH_ROUTES, DEV_ROUTES, allStaticRoutes, publicRoutes } from './utils/public-routes';
import { describeOffender, scanTapTargets, TAP_MIN, TAP_MIN_TEXT_WIDTH } from './utils/tap-target';

const ROUTES = publicRoutes();

/** 알려진 잡음 — **이름을 붙인 것만.** 넓히면 진짜 에러까지 지워진다. */
const KNOWN_NOISE = [
  /favicon/i,
  /Failed to load resource.*404/i,
  /Download the React DevTools/i,
  /webpack-hmr|_next\/static\/webpack|hot-update/i,
  // 로그아웃 상태에서 나는 세션 조회 잡음
  /auth\/v1\/token|AuthApiError|Invalid Refresh Token|Auth session missing/i,
];
const isNoise = (t: string) => KNOWN_NOISE.some((re) => re.test(t));

interface Finding {
  route: string;
  axis: '열림' | '조용함' | '연결' | '복귀' | '요청' | '가로스크롤' | '탭대상';
  detail: string;
}

/** 이 앱에 실재하는 모든 정적 라우트 — 죽은 링크 판정의 분모(그룹을 가리지 않는다). */
function knownRoutes(): Set<string> {
  return new Set(allStaticRoutes());
}

test.describe('공개 화면 전수 훑기 (로그아웃)', () => {
  // ⚠️ **로그아웃이 이 스펙의 전제다.** 로그인 상태로 재면 (auth) 4개가 전부
  //    리다이렉트로 튕겨 아무것도 못 잰다 — 그러면 초록인데 검증은 0이 된다.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('모든 공개 화면이 열리고 · 조용하고 · 링크가 살아 있고 · 되돌아온다', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(ROUTES.length * 20_000 + 120_000);
    expect(ROUTES.length, '공개 라우트를 못 찾았다 — 경로 규칙이 바뀌었는지 확인').toBeGreaterThan(5);

    const known = knownRoutes();
    const findings: Finding[] = [];
    // ── ⑦ 요청 ─────────────────────────────────────────────────────────
    // 나머지 축은 전부 **"화면이 뜨는가"** 다. 화면은 뜨고 콘솔도 조용한데
    // **그 화면의 데이터 요청이 실패하는** 경우는 아무 축도 안 봤다.
    // ⚠️ origin 은 `baseURL` 에서 받는다 — 테스트 시작 시점의 `page.url()` 은
    //    `about:blank` 라, 거기서 뽑으면 감시가 **아무것도 안 잡는다**.
    const net = watchNetwork(page, new URL(baseURL ?? 'http://localhost:3000').origin, 'anonymous');

    for (const route of ROUTES) {
      const errors: string[] = [];
      const onConsole = (m: ConsoleMessage) => {
        if (m.type() === 'error' && !isNoise(m.text())) errors.push(m.text().slice(0, 160));
      };
      const onPageError = (e: Error) => {
        if (!isNoise(e.message)) errors.push(`[uncaught] ${e.message.slice(0, 160)}`);
      };
      page.on('console', onConsole);
      page.on('pageerror', onPageError);

      try {
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
        await page.waitForTimeout(1200);

        const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        // ⚠️ 이 판정은 `문제가 발생했어요`(= app/error.tsx)를 **안 보고 있었다.**
        // `error.tsx` 는 HTTP 200 에 본문도 충분해서, 서버 컴포넌트가 던져 에러 화면이
        // 떠 있어도 나머지 축이 전부 통과한다 — 공개 화면 12개가 그 구멍 위에 있었다.
        // 판정은 `utils/crash-screen.ts` 가 소유한다(셋이 각자 적으면 또 갈라진다).
        const crash = crashKindOf(body);
        if (crash) {
          findings.push({ route, axis: '열림', detail: `${crash} 가 떠 있다` });
          continue;
        }
        if (body.trim().length < 40) {
          findings.push({ route, axis: '열림', detail: `본문이 거의 비었다(${body.trim().length}자)` });
        }

        // ── ③ 연결 ───────────────────────────────────────────────────
        // dev 목차는 링크가 전부 다른 그룹으로 나가므로 이 축을 묻지 않는다.
        const links: string[] = await page
          .evaluate(() =>
            Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'))
              .map((a) => a.getAttribute('href') || '')
              .filter(Boolean),
          )
          .catch(() => []);
        const internal = [...new Set(links)]
          .map((h) => h.split('?')[0].split('#')[0].replace(/\/$/, '') || '/')
          .filter((h) => h.startsWith('/'));

        if (!DEV_ROUTES.has(route)) {
          for (const href of internal) {
            if (known.has(href)) continue;
            // 동적 세그먼트로 가는 링크는 정상이다 — 부모가 실재하면 통과.
            const parent = href.slice(0, href.lastIndexOf('/')) || '/';
            if (known.has(parent)) continue;
            findings.push({ route, axis: '연결', detail: `없는 화면으로 가는 링크: ${href}` });
          }
        }

        // ── ④ 복귀 ───────────────────────────────────────────────────
        const target = internal.find((h) => known.has(h) && h !== route);
        if (target) {
          const before = new URL(page.url()).pathname;
          const moved = await page
            .goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 })
            .then(() => true)
            .catch(() => false);
          if (moved) {
            await page.waitForTimeout(400);
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
            await page.waitForTimeout(400);
            const back = new URL(page.url()).pathname;
            // 로그인 화면은 목적지가 다시 로그인으로 되돌릴 수 있다 — 그건 정상이다.
            if (back !== before && !AUTH_ROUTES.has(route)) {
              findings.push({ route, axis: '복귀', detail: `뒤로가기가 ${back} 로 갔다(기대: ${before})` });
            }
          }
        }

        if (errors.length > 0) {
          findings.push({ route, axis: '조용함', detail: `콘솔 에러 ${errors.length}건 — ${errors[0]}` });
        }
      } finally {
        // ── ⑦ 요청 — 이 화면 몫만 본다(복귀 축이 다른 화면을 들렀다 오므로 라우트마다 비운다).
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
        await page.goto('about:blank').catch(() => {});
      }
    }

    net.stop();

    const summary = [
      `공개 화면 ${ROUTES.length}개 훑음`,
      ...(['열림', '조용함', '연결', '복귀', '요청'] as const).map(
        (a) => `  ${a} 실패 ${findings.filter((f) => f.axis === a).length}`,
      ),
      '',
      ...findings.map((f) => `  [${f.axis}] ${f.route} — ${f.detail}`),
    ].join('\n');

    // eslint-disable-next-line no-console
    console.log('\n' + summary + '\n');
    expect(findings, summary).toEqual([]);
  });
});

test.describe('공개 화면 @390px (로그아웃)', () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test('가로로 밀리지 않고 · 44px 미만으로 눌러야 하는 것이 없다', async ({ page }) => {
    test.setTimeout(ROUTES.length * 16_000 + 120_000);
    const findings: Finding[] = [];

    for (const route of ROUTES) {
      const res = await page
        .goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        .catch(() => null);
      if (!res || res.status() >= 400) {
        await page.goto('about:blank').catch(() => {});
        continue;
      }
      await page.waitForTimeout(1100);

      // ── ⑤ 가로 스크롤 — scrollWidth 만 보지 않고 **실제로 밀어 본다** ───
      const moved = await page
        .evaluate(() => {
          const b = window.scrollX;
          window.scrollTo(9999, 0);
          const a = window.scrollX;
          window.scrollTo(0, 0);
          return a - b;
        })
        .catch(() => 0);
      if (moved > 1) findings.push({ route, axis: '가로스크롤', detail: `가로로 ${moved}px 밀린다` });

      // ── ⑥ 탭 대상 ────────────────────────────────────────────────
      // `/dev/components` 는 **컴포넌트 쇼케이스**다 — "Small" 변형을 나란히 보여 주는 것이
      // 그 화면의 목적이라, 거기서 작은 버튼을 세는 것은 카탈로그를 결함으로 읽는 것이다.
      if (DEV_ROUTES.has(route)) {
        await page.goto('about:blank').catch(() => {});
        continue;
      }
      const small = (
        await page
          .evaluate(scanTapTargets, { min: TAP_MIN, minTextWidth: TAP_MIN_TEXT_WIDTH })
          .catch(() => [])
      ).map(describeOffender);
      for (const s of small) findings.push({ route, axis: '탭대상', detail: s });

      await page.goto('about:blank').catch(() => {});
    }

    const summary = [
      `공개 화면 ${ROUTES.length}개 @390px`,
      `  가로스크롤 ${findings.filter((f) => f.axis === '가로스크롤').length}`,
      `  탭대상     ${findings.filter((f) => f.axis === '탭대상').length}`,
      '',
      ...findings.map((f) => `  [${f.axis}] ${f.route} — ${f.detail}`),
    ].join('\n');

    // eslint-disable-next-line no-console
    console.log('\n' + summary + '\n');
    expect(findings, summary).toEqual([]);
  });
});
