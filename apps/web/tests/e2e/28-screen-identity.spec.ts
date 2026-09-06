// apps/web/tests/e2e/28-screen-identity.spec.ts
//
// **화면이 자기가 무엇인지 말하는가.**
//
// ── 왜 이 축이 따로 필요한가 (실측 2026-08-23) ───────────────────────────
// 지금 학습자 화면을 네 축으로 잰다:
//   `26` 동선 · `10` 터치/넘침 · `91` 대비/배치 · `27` 키보드.
// 넷 다 **화면 안에서 무엇을 할 수 있나**를 본다. 아무도 **이 화면이 무엇인가**는 안 본다.
//
// 그게 없으면 두 사람이 곤란해진다:
//   · 탭을 여러 개 열어 두고 공부하는 학습자 — 탭 제목이 전부 같으면 어디가 어딘지 모른다
//   · 스크린리더를 쓰는 학습자 — `h1` 이 없으면 "이 화면은 무엇" 을 물을 방법이 없다
//
// ── 무엇을 성공으로 세는가 ───────────────────────────────────────────────
// 화면마다 넷. 성공률 = 통과 검사 / **실제로 잰** 검사.
//   ① 제목이 있다      — `<title>` 이 비어 있지 않다
//   ② 제목이 구별된다  — 다른 화면과 같은 제목을 쓰지 않는다
//   ③ 제목이 하나다    — 본문에 `h1` 이 정확히 하나 (0 이면 요약 불가, 2+ 면 무엇이 주제인지 모호)
//   ④ 랜드마크가 있다  — `main` 과 `nav` 가 있다
//
// ⚠️ **못 잰 것을 통과로 세지 않는다.** 화면이 안 열리면 넷 다 분모에서 뺀다.
//    분모는 항상 출력한다 — 0 은 성과일 수도, 측정 실패일 수도 있다(§CONVENTIONS).
//
// ⚠️ **바닥값을 짐작하지 않는다.** 첫 실행의 실측치를 그대로 바닥으로 적는다.

import { test, expect, type Page } from '@playwright/test'
import { identityProbe } from './utils/content-scope'
import { isFullScreenRoute } from '../../src/lib/layout/full-screen-routes'
import { learnerRoutes, redirectOnlyRoutes } from './utils/learner-routes'
import { gotoSettled } from './utils/goto-settled'
import { SessionGuard } from './utils/session-guard'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-screen-identity.json'

/**
 * **어느 화면 크기에서 재는가.** 기본은 데스크톱, `SWEEP_VIEWPORT=mobile` 이면 390px.
 *
 * ⚠️ 실측 2026-08-23: 이 축들은 **데스크톱 한 크기에서만** 돌고 있었다.
 *    `CLAUDE.md` 는 모바일 퍼스트(390 → 768 → 1280)를 원칙으로 두는데,
 *    390 에서는 사이드바가 사라지고 하단 탭이 생긴다 — **셸이 통째로 다른 화면**이다.
 *    거기서 한 번도 안 재고 "전수" 라고 부르고 있었다.
 */
const MOBILE = process.env.SWEEP_VIEWPORT === 'mobile'
const VIEWPORT = MOBILE ? { viewport: { width: 390, height: 844 } } : {}

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

interface RouteResult {
  route: string
  opens: boolean
  title: string
  /** 본문 안의 `h1` 개수. */
  h1Count: number
  h1Text: string
  hasMain: boolean
  /** `null` = 풀스크린 세션이라 **재지 않았다**(통과도 실패도 아니다). */
  hasNav: boolean | null
  landed: string
  note: string
}

test.describe('제3의 학습자 — 이 화면은 무엇인가', () => {
  test.describe.configure({ mode: 'serial', timeout: 900_000 })
  test.skip(
    process.env.IDENTITY_SWEEP !== '1',
    'IDENTITY_SWEEP=1 로 명시할 때만 — 전 화면을 연다',
  )

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH, ...VIEWPORT })

  test('모든 학습자 화면이 이름을 갖고 · 그 이름이 구별되고 · 주제가 하나다', async ({
    page,
    context,
  }) => {
    const redirectOnly = redirectOnlyRoutes()
    // 보내기만 하는 껍데기는 목적지에서 재진다.
    const routes = learnerRoutes().filter((r) => !redirectOnly.has(r))
    expect(routes.length, '라우트를 하나도 못 찾았다 — 목록 추출이 깨졌다').toBeGreaterThan(20)

    // 실행 도중 세션이 죽으면(공유 계정을 다른 실행이 회전시킨다) 남은 라우트가 전부
    // "로그인으로 튕겼다" 로 찍혀 성적표가 뜻을 잃는다 — 실측: 같은 빌드로 100% → 99.6%.
    // 한 번은 되살리고 다시 연다(예산 3회). 감추지 않는다 — 몇 번 되살렸는지 찍는다.
    const guard = new SessionGuard(context, login)

    const results: RouteResult[] = []

    for (const route of routes) {
      const r: RouteResult = {
        route,
        opens: false,
        title: '',
        h1Count: 0,
        h1Text: '',
        hasMain: false,
        hasNav: false,
        landed: '',
        note: '',
      }

      // ⚠️ 고정 대기로 재면 **클라이언트 리다이렉트와 경합한다** — `/dictate/setup` 은
      //    자료가 없으면 `/dictate` 로 되돌리는데, 먼저 재면 "h1 이 없다", 나중에 재면
      //    "제목이 겹친다" 가 된다(실측 2026-09-06, 같은 빌드에서 실행마다 갈렸다).
      //    주소가 멈출 때까지 기다리는 공용 규칙을 26·27 과 나눠 쓴다.
      const settle = await guard.openWithRetry(async () => await gotoSettled(page, route))
      if (settle.recovered) r.note = '세션이 끊겨 다시 로그인했다'

      const landed = settle.landed
      const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim()
      r.opens = body.length > 40 && !landed.startsWith('/login')
      if (!r.opens) {
        r.note = landed.startsWith('/login') ? '로그인으로 튕겼다 — 재지 않음' : '본문이 비어 있다 — 재지 않음'
        results.push(r)
        continue
      }

      r.landed = landed
      // 판정은 `utils/content-scope` 가 소유한다 — 26·27 과 같은 규칙을 나눠 쓴다.
      const probe = await page.evaluate(identityProbe, isFullScreenRoute(landed))
      Object.assign(r, probe)
      results.push(r)
    }

    // ── 집계 ────────────────────────────────────────────────────────────
    const open = results.filter((r) => r.opens)

    // ⚠️ **착지한 주소로 센다.** `/dictate/setup` 은 자료 없이 열면 `/dictate` 로 되돌리고
    //    `/pairflip/play` 도 마찬가지다 — 셋 다 같은 페이지에 서 있으니 제목이 같은 게 맞다.
    //    요청한 주소로 세면 **같은 화면을 세 번 세고** "제목이 겹친다" 고 적는다
    //    (실측 2026-08-23: 그렇게 6건이 허위로 잡혔다).
    const byLanded = new Map<string, RouteResult>()
    for (const r of open) if (!byLanded.has(r.landed)) byLanded.set(r.landed, r)
    const titleCount = new Map<string, number>()
    for (const r of byLanded.values()) titleCount.set(r.title, (titleCount.get(r.title) ?? 0) + 1)

    let measured = 0
    let passed = 0
    for (const r of open) {
      const checks: Array<[boolean, string]> = [
        [r.title.length > 0, '제목 없음'],
        [r.title.length > 0 && (titleCount.get(r.title) ?? 0) === 1, `제목이 겹친다: "${r.title}"`],
        [r.h1Count === 1, r.h1Count === 0 ? '본문에 h1 이 없다' : `h1 이 ${r.h1Count}개`],
        // ⚠️ 풀스크린 세션(`(app)` 그룹)은 **셸을 일부러 뺀다** —
        //    "게임 본체에 viewport 100% 할당"(`(app)/layout.tsx`). 거기서 nav 를 요구하면
        //    고칠 수 없는 실패가 되고, 통과로 세면 안 재본 것을 성적에 넣는 것이다.
        //    → `main` 만 재고 `nav` 는 분모에서 뺀다. 뺀 사실은 아래에 출력한다.
        [r.hasMain, 'main 없음'],
      ]
      for (const [ok, why] of checks) {
        measured += 1
        if (ok) passed += 1
        else r.note = (r.note ? r.note + ' · ' : '') + why
      }
      // 앱이 셸을 숨기는 기준을 **그대로** 쓴다 — 여기서 다시 정의하면 두 정의가 갈라진다
      //    (내 첫 판은 `/play/` 접두사로 재정의했고, `/dictate/session`·`/flashcard/play` 를 놓쳤다).
      const fullscreen = isFullScreenRoute(r.landed)
      if (fullscreen) {
        r.hasNav = null
        r.note = (r.note ? r.note + ' · ' : '') + '풀스크린 세션 — nav 검사 제외'
      } else {
        measured += 1
        if (r.hasNav) passed += 1
        else r.note = (r.note ? r.note + ' · ' : '') + 'nav 없음'
      }
    }
    const rate = measured > 0 ? Math.round((passed / measured) * 1000) / 10 : 0
    const skipped = results.filter((r) => !r.opens).map((r) => r.route)

    /* eslint-disable no-console */
    if (guard.reauths > 0) {
      console.log(`[정체] 실행 중 세션이 끊겨 다시 로그인 ${guard.reauths}회 — 공유 계정이 회전당했다`)
    }
    console.log(
      `\n[정체] 라우트 ${results.length} · 잰 검사 ${measured} · 통과 ${passed} → ${rate}%` +
        (skipped.length ? ` (안 열려서 제외 ${skipped.length}곳: ${skipped.join(', ')})` : ''),
    )
    const dupes = [...titleCount.entries()].filter(([, n]) => n > 1)
    if (dupes.length) {
      console.log(`[정체] 겹치는 제목 ${dupes.length}종:`)
      for (const [t, n] of dupes.sort((a, b) => b[1] - a[1])) {
        console.log(`    ${n}곳  "${t}"  ← ${open.filter((r) => r.title === t).map((r) => r.route).join(', ')}`)
      }
    }
    for (const r of results) {
      if (r.opens && (!r.note || r.note === '풀스크린 세션 — nav 검사 제외')) continue
      console.log(`  ${r.route.padEnd(26)} h1=${r.h1Count} "${r.h1Text}"  ${r.note}`)
    }
    console.log('')
    /* eslint-enable no-console */

    // 분모 먼저. 재지 못했으면 성공률은 아무 뜻이 없다.
    expect(measured, '아무것도 재지 못했다 — 이 성공률은 성과가 아니라 측정 실패다').toBeGreaterThan(
      routes.length,
    )

    const FLOOR = Number(process.env.IDENTITY_SWEEP_FLOOR ?? 100)
    expect(rate, `화면 정체 성공률 ${rate}% (바닥 ${FLOOR}%) — 목표 100%. 위 목록 참조`).toBeGreaterThanOrEqual(
      FLOOR,
    )
  })
})
