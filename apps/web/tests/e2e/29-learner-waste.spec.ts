// apps/web/tests/e2e/29-learner-waste.spec.ts
//
// **낭비 축** — 한 화면을 여는 동안 같은 요청을 두 번 보내는가.
//
// ── 왜 이 축이 비어 있었나 (실측 2026-09-05) ─────────────────────────────
// 전수 훑기(`26-learner-sweep`)는 여섯 축을 본다 —
//   열림 · 조용함 · 앞길 · 복귀 · 연계 · 요청 성공.
// 여섯 축 모두 **"되는가"** 를 묻는다. 되기는 되는데 **두 번 하는** 것은 어느 축에도
// 안 걸린다. 같은 목록을 서버에서 한 번 받고 클라이언트에서 또 받는 화면은
// 초록으로 통과하면서 학습자의 대기 시간과 우리 DB 시간을 두 배로 쓴다.
//
// 그래서 축을 하나 더 세운다: **"되는가" 위에 "한 번만 하는가".**
//
// ── 무엇을 세는가 ────────────────────────────────────────────────────────
// 데이터 요청만 센다 — 같은 출처 `/api/*` 와 Supabase REST/RPC.
// 정적 자산(`_next/static` · 이미지 · 폰트 · 오디오 · onnx)은 브라우저 캐시의 몫이라
// 여기서 세면 잡음만 늘고 고칠 대상이 아니다.
// RSC 프리페치(`?_rsc=`)도 뺀다 — 프레임워크가 스스로 정하는 것이라 우리 코드의 낭비가 아니다.
//
// 중복 = **method + URL + 본문**이 완전히 같은 요청이 한 화면에서 2회 이상.
//
// ── dev 서버의 함정: React StrictMode ────────────────────────────────────
// `next.config.mjs` 는 `reactStrictMode` 를 끄지 않으므로 dev 기본값(켜짐)이다.
// StrictMode 는 개발에서 이펙트를 **일부러 두 번** 실행한다 — 즉 dev 에서 관측되는
// "정확히 2회" 는 우리 코드의 낭비일 수도, 프레임워크의 의도된 이중 실행일 수도 있다.
// 그 둘을 구별하지 못하는 채로 실패시키면 이 스펙은 고칠 수 없는 빨강이 되고,
// 고칠 수 없는 빨강은 곧 무시된다.
//
// 그래서 **판정선을 실행 환경에 맞춘다**:
//   · dev 서버 대상(기본)     → 3회 이상만 결함. 2회는 "의심" 으로 기록만 한다.
//   · 프로덕션 서버 대상       → `WASTE_PROD=1` 을 주면 2회부터 결함.
//     (`NEXT_DIST_DIR=.next-verify pnpm --filter web build` 후
//      `next start -p 3100` 을 띄우고 `PLAYWRIGHT_BASE_URL` 로 가리킨다.)
//
// ⚠️ **못 잰 것을 통과로 세지 않는다.** 화면이 안 열리면 그 화면은 "미측정" 으로 남기고
//    성공률의 분모에서 뺀다 — 열리지도 않은 화면을 "낭비 없음" 으로 세면 숫자가 거짓이 된다.
//    (열림 자체는 `26-learner-sweep` 의 몫이다. 여기서 두 번 재지 않는다.)
//
// 실행: LEARNER_WASTE=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test 29-learner-waste

import { test, expect, type Page } from '@playwright/test'
import { ensureAuthState } from './utils/auth'
import { PARAM_ROUTES, learnerRoutes, redirectOnlyRoutes } from './utils/learner-routes'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-learner-waste.json'

/** 프로덕션 서버를 재면 StrictMode 이중 실행이 없다 — 2회부터가 낭비다. */
const PROD = process.env.WASTE_PROD === '1'
const DUP_LIMIT = PROD ? 2 : 3

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** 데이터 요청인가 — 자산·RSC 프리페치·인증 토큰 갱신은 뺀다. */
function isData(url: string, origin: string): boolean {
  if (url.startsWith(origin)) {
    const rest = url.slice(origin.length)
    if (!rest.startsWith('/api/')) return false
    if (rest.startsWith('/api/auth/')) return false // 토큰 갱신은 우리 화면의 요청이 아니다
    return true
  }
  // Supabase REST/RPC/Storage — 화면이 직접 부르는 데이터다.
  if (/supabase\.(co|in)\//.test(url)) {
    if (/\/auth\/v1\//.test(url)) return false // 세션 갱신
    return /\/rest\/v1\/|\/rpc\/|\/functions\/v1\//.test(url)
  }
  return false
}

/** 로그 표시용 — 원점과 쿼리의 잡음을 줄여 한 줄에 들어가게 만든다. */
function short(url: string, origin: string): string {
  let s = url.startsWith(origin) ? url.slice(origin.length) : url.replace(/^https?:\/\/[^/]+/, '')
  if (s.length > 110) s = s.slice(0, 107) + '...'
  return s
}

interface Dup {
  key: string
  count: number
}
interface RouteWaste {
  route: string
  measured: boolean
  /** 로그인 화면으로 튕겼는가 — **측정 실패**지 "중복 없음" 이 아니다(아래 주석). */
  bouncedToLogin: boolean
  total: number
  dups: Dup[]
  hard: Dup[]
}

test.describe('학습자 표면 — 낭비(중복 요청)', () => {
  test.describe.configure({ mode: 'serial', timeout: 900_000 })
  test.skip(
    process.env.LEARNER_WASTE !== '1',
    'LEARNER_WASTE=1 로 명시할 때만 — 전 화면을 열어 몇 분 걸린다',
  )

  // ⚠️ **매번 새로 로그인하지 않는다.** 스펙마다 로그인을 복제하면 Supabase auth
  //    rate-limit 에 걸리고, 그때 증상은 "로그인 실패" 가 아니라 **전 화면이 로그인으로
  //    튕긴 채 측정이 진행되는 것**이다(2026-09-06 실측: 낭비 축 56/57 "100%" ·
  //    전수 훑기 0.6%). 유효한 상태가 있으면 재사용한다 — 그 판단은 utils/auth 한 곳이 한다.
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, STATE_PATH, login)
  })
  test.use({ storageState: STATE_PATH })

  test('한 화면을 여는 동안 같은 데이터 요청을 두 번 보내지 않는다', async ({ page, baseURL }) => {
    const origin = (baseURL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectOnly = redirectOnlyRoutes()
    const routes = learnerRoutes().filter((r) => !redirectOnly.has(r) && !PARAM_ROUTES.has(r))

    // 요청 수집기. 화면마다 비운다.
    let bag: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (!isData(url, origin)) return
      let body = ''
      try {
        body = req.postData() || ''
      } catch {
        body = ''
      }
      bag.push(`${req.method()} ${short(url, origin)}${body ? ' :: ' + body.slice(0, 120) : ''}`)
    })

    // dev 서버는 라우트마다 첫 컴파일이 있다 — 예열하지 않으면 첫 방문의 타임아웃이
    // "미측정" 으로 잡혀 분모가 흔들린다(26-learner-sweep 이 같은 값을 이미 치렀다).
    for (const r of routes) {
      await page.goto(r, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
    }

    const results: RouteWaste[] = []
    for (const route of routes) {
      bag = []
      let opened = true
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {
        opened = false
      })
      // 클라이언트 요청이 뒤따라 나간다 — 잠잠해질 때까지 기다린다.
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(600)

      const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim()
      // ⚠️ **본문이 있다고 잰 것이 아니다** (실측 2026-09-06 — 이 스펙이 스스로 걸린 함정).
      //    로그인이 풀린 채로 돌리면 보호 라우트가 전부 `/login` 으로 튕기는데, 로그인 화면에도
      //    본문은 있다. 그때 데이터 요청은 0건이고, 0건은 중복이 없으므로 이 스펙은
      //    **57화면 전부 통과 · 100%** 를 인쇄했다. 같은 빌드·같은 서버의 직전 실행이
      //    `/dictate` 15건 · `/dashboard` 11건이었는데도.
      //    못 잰 것을 통과로 세면 그 초록은 위험하다 — 실패보다 나쁘다.
      const landed = new URL(page.url()).pathname
      const bouncedToLogin = landed.startsWith('/login')
      const measured = opened && body.length > 0 && !bouncedToLogin

      const counts = new Map<string, number>()
      for (const k of bag) counts.set(k, (counts.get(k) || 0) + 1)
      const dups = [...counts.entries()]
        .filter(([, c]) => c >= 2)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)

      results.push({
        route,
        measured,
        bouncedToLogin,
        total: bag.length,
        dups,
        hard: dups.filter((d) => d.count >= DUP_LIMIT),
      })
    }

    const measured = results.filter((r) => r.measured)
    const clean = measured.filter((r) => r.hard.length === 0)
    const rate = measured.length ? (clean.length / measured.length) * 100 : 0

    const lines: string[] = []
    lines.push(
      `\n낭비 축 — 판정선 ${DUP_LIMIT}회 이상 (${PROD ? '프로덕션' : 'dev · StrictMode 이중 실행 흡수'})`,
    )
    lines.push(
      `측정 ${measured.length}/${results.length} 화면 · 중복 없는 화면 ${clean.length} (${rate.toFixed(1)}%)`,
    )
    const unmeasured = results.filter((r) => !r.measured)
    if (unmeasured.length) lines.push(`미측정(분모 제외): ${unmeasured.map((r) => r.route).join(', ')}`)

    const offenders = measured.filter((r) => r.hard.length).sort((a, b) => b.hard[0].count - a.hard[0].count)
    for (const o of offenders) {
      lines.push(`\n  ✗ ${o.route}  (데이터 요청 ${o.total}건)`)
      for (const d of o.hard) lines.push(`      ${d.count}회  ${d.key}`)
    }

    const suspects = measured.filter((r) => !r.hard.length && r.dups.length)
    if (suspects.length) {
      lines.push(`\n  의심(2회 — dev 에서는 StrictMode 와 구별 불가): ${suspects.length}화면`)
      for (const s of suspects.slice(0, 12)) lines.push(`      ${s.route}  ${s.dups[0].key}`)
    }

    const heavy = [...measured].sort((a, b) => b.total - a.total).slice(0, 8)
    lines.push(`\n  데이터 요청이 많은 화면: ${heavy.map((h) => `${h.route}(${h.total})`).join(' · ')}`)
    console.log(lines.join('\n'))

    // ── 잰 것이 맞는지 먼저 따진다 ────────────────────────────────────
    // 아래 세 검사가 없으면 이 스펙은 **로그아웃 상태에서 100% 를 인쇄한다**(실측 2026-09-06).
    const bounced = results.filter((r) => r.bouncedToLogin).map((r) => r.route)
    const totalRequests = measured.reduce((n, r) => n + r.total, 0)

    expect(measured.length, '한 화면도 못 열었다 — 서버나 로그인을 확인할 것').toBeGreaterThan(0)
    expect(
      bounced,
      `로그인으로 튕긴 화면이 있다 — 세션이 풀린 채로 잰 것이다(측정 실패):\n${bounced.join(', ')}`,
    ).toEqual([])
    expect(
      totalRequests,
      '데이터 요청이 한 건도 안 잡혔다 — 이 앱의 학습자 화면은 그럴 수 없다. 로그인·감시 범위를 확인할 것',
    ).toBeGreaterThan(0)

    expect(offenders.map((o) => `${o.route} ← ${o.hard[0].count}회 ${o.hard[0].key}`)).toEqual([])
  })
})
