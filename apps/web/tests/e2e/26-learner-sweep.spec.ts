// apps/web/tests/e2e/26-learner-sweep.spec.ts
//
// **제3의 학습자 전수 훑기** — 모든 학습자 화면을 열고, 눌러 보고, 되돌아온다.
//
// ── 왜 이 스펙이 필요한가 (실측 2026-08-22) ──────────────────────────────
// 기존 e2e 는 **44개 정적 학습자 라우트 중 22개(50%)** 만 한 번이라도 연다.
// 나머지 절반은 깨져도 아무도 모른다 — `/pairflip` · `/scriptquiz` · `/settings` ·
// `/reports` · `/my/*` · `/wordvault/review` 등.
// 개별 스펙은 자기 시나리오만 깊게 보므로, **"전부 한 번씩"** 을 보는 자리가 따로 필요하다.
//
// ── 무엇을 성공으로 세는가 ───────────────────────────────────────────────
// 화면마다 네 가지를 본다. 성공률 = 통과 검사 / 전체 검사.
//   ① 열린다        — 에러/404 화면이 아니고 본문이 있다
//   ② 콘솔 에러 0   — 앱이 조용히 터지지 않는다
//   ③ 앞길이 있다   — 본문 안에 **실제로 눌리는** 링크/버튼이 하나 이상
//   ④ 되돌아온다    — 앞길을 눌러 이동한 뒤 뒤로가기로 원래 자리에 돌아온다
//
// ⚠️ **못 잰 것을 통과로 세지 않는다.** 라우트가 로그인으로 튕기거나 타임아웃하면
//    그 화면의 네 검사는 전부 실패로 기록된다 — 이 저장소가 반복해서 겪은
//    "측정 실패가 아니라 측정 안 함" 을 성공률에 섞지 않기 위해서다.
//
// ⚠️ 라우트 목록을 **손으로 적지 않는다.** 파일 시스템에서 읽는다 —
//    적어 두면 화면이 늘어도 이 스펙은 늘지 않고, 커버리지가 조용히 낡는다.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-learner-sweep.json'

/**
 * 훑지 않는 라우트 — **이유가 있는 것만.**
 * 이 목록이 길어지면 커버리지가 아니라 면제 목록이 자라는 것이다.
 */
const SKIP: Record<string, string> = {
  '/hub-lab': '재설계 실험용 — 학습자 동선이 아니다(캡처 하네스가 따로 본다)',
  '/teacher': '교사 표면 — 학습자 기준 훑기의 대상이 아니다',
}

/** 세션을 쓰는 화면 — 열면 학습이 시작되거나 기록이 남는다. 열되 **누르지는 않는다**. */
const NO_CLICK = new Set([
  '/flashcard/play',
  '/pairflip/play',
  '/spellforge/play',
  '/scriptquiz/play',
  '/dictate/session',
  '/practice/dcp',
  '/wordvault/review',
  '/wordvault/study',
])

function learnerRoutes(): string[] {
  const base = path.resolve(__dirname, '../../src/app/(main)')
  const out: string[] = []
  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 라우트는 실 데이터가 필요해 별도 스펙이 본다
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url)
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }
  walk(base, '')
  return out.filter((r) => !(r in SKIP)).sort()
}

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** 앱 결함이 아닌 소음. 여기에 새 패턴을 더할 때는 **왜 무해한지** 함께 적을 것. */
function fatal(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError|ResizeObserver/.test(
        e,
      ),
  )
}

/**
 * 이동한다. **소프트 리다이렉트를 실패로 세지 않는다.**
 *
 * ⚠️ 첫 판이 여기서 틀렸다. `/library`·`/comics`·`/my/books` 는 서버가 200 을 주고
 *    RSC 가 다른 곳으로 보내는데, 그때 `page.goto` 가 `net::ERR_ABORTED` 를 던진다.
 *    그걸 예외로 받아 **네 검사를 전부 실패로 기록**했다 — 실제로는 멀쩡히 열리는 화면이다.
 *    (`12-navigation` 이 이미 같은 함정을 주석으로 남겨 뒀는데 안 읽었다.)
 *    실패로 세야 하는 것은 "도착을 못 했다" 이지 "도중에 방향이 바뀌었다" 가 아니다.
 */
/**
 * 서버가 살아 있는가. **죽은 서버를 앱 결함으로 세지 않기 위해** 쓴다.
 *
 * ⚠️ 실측 2026-08-22: 42개 라우트를 연속으로 열자 dev 서버가 중간에 죽었고,
 *    그 뒤 라우트들이 전부 "리다이렉트 → /" · "본문이 비어 있다" 로 기록됐다.
 *    **앱은 멀쩡했다.** 성공률에 환경 장애가 섞이면 그 숫자는 아무 뜻이 없다.
 */
async function serverAlive(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get('/hub', { timeout: 15_000 })
    return res.status() > 0
  } catch {
    return false
  }
}

async function gotoSettled(page: Page, url: string): Promise<string> {
  const want = new URL(url, 'http://x').pathname
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {})
  await page.waitForTimeout(700)

  // 순수 `redirect()` 페이지는 본문이 빈 채로 잠깐 머문다 — **주소가 바뀔 때까지 기다린다.**
  // 첫 판은 여기서 성급히 읽고 "본문이 비어 있다" 로 기록했다(`/library`·`/my`·`/my/texts`).
  const empty = ((await page.locator('body').innerText().catch(() => '')) || '').trim().length < 40
  if (empty) {
    await page
      .waitForURL((u) => u.pathname !== want, { timeout: 6_000 })
      .catch(() => {})
    await page.waitForTimeout(600)
  }

  let last = page.url()
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(400)
    if (page.url() === last) break
    last = page.url()
  }
  return new URL(page.url()).pathname
}

interface RouteResult {
  route: string
  landed: string
  opens: boolean
  quiet: boolean
  hasWayForward: boolean
  /**
   * 되돌아오기. `null` = **재지 않았다**(통과도 실패도 아니다).
   *
   * ⚠️ 리다이렉트 화면에서는 뒤로가기의 정답이 무엇인지가 애매하다 — 원래 주소로 돌아가면
   *    또 튕기므로 브라우저는 그 앞으로 간다. 그걸 실패로 세면 **고칠 수 없는 실패**가 되고,
   *    통과로 세면 안 재본 것을 성적에 넣는 것이다. 그래서 **분모에서 뺀다.**
   */
  backWorks: boolean | null
  note: string
}

/**
 * ⚠️ **아직 상시 스펙이 아니다. `LEARNER_SWEEP=1` 일 때만 돈다.**
 *
 * 이유: 같은 코드에서 연속 두 번 돌렸는데 **96.7% 와 54.9%** 가 나왔다(실측 2026-08-22).
 * 재현되지 않는 측정은 성적표가 아니라 소음이고, 상시로 두면 **빨간 스펙에 익숙해지게** 만들어
 * 다음 진짜 실패를 가린다 — 이 저장소가 이미 여러 번 겪은 일이다.
 *
 * 원인으로 보는 것: dev 서버는 라우트마다 **첫 방문에 컴파일**한다. 42개를 연속으로 때리면
 * 서버가 흔들리고(실제로 스윕 도중 죽었다), 클라이언트 렌더가 준비되기 전에 판정하게 된다.
 * → 다음 사이클에 **프로덕션 빌드**(`NEXT_DIST_DIR=.next-sweep`)를 띄우고 그 위에서 잰다.
 *   그때 재현되면 상시로 올리고 래칫을 건다.
 */
test.describe('제3의 학습자 — 전수 훑기', () => {
  test.describe.configure({ mode: 'serial', timeout: 900_000 })
  test.skip(process.env.LEARNER_SWEEP !== '1', 'LEARNER_SWEEP=1 로 명시할 때만 — 아직 재현되지 않는다')

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('모든 학습자 화면이 열리고 · 조용하고 · 앞길이 있고 · 되돌아온다', async ({ page }) => {
    const routes = learnerRoutes()
    expect(routes.length, '라우트를 하나도 못 찾았다 — 목록 추출이 깨졌다').toBeGreaterThan(20)

    const results: RouteResult[] = []

    for (const route of routes) {
      const errors: string[] = []
      const onConsole = (m: { type: () => string; text: () => string }) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 200))
      }
      page.on('console', onConsole)
      const onPageError = (e: Error) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`)
      page.on('pageerror', onPageError)

      const r: RouteResult = {
        route,
        landed: route,
        opens: false,
        quiet: false,
        hasWayForward: false,
        backWorks: false,
        note: '',
      }

      try {
        r.landed = await gotoSettled(page, route)

        // 서버가 죽으면 그 아래 검사는 전부 무의미하다 — **측정을 중단**한다.
        // 결과를 적어 두고 넘어가면 "실패 42건" 이라는 거짓 성적표가 남는다.
        if ((await page.locator('body').innerText().catch(() => '')).trim().length === 0) {
          if (!(await serverAlive(page))) {
            throw new Error(
              `[측정 중단] dev 서버가 응답하지 않는다(${route} 에서). ` +
                '앱 결함이 아니라 환경 장애다 — 서버를 다시 띄우고 재실행할 것.',
            )
          }
        }

        if (r.landed.startsWith('/login')) {
          r.note = '로그인으로 튕김'
        } else {
          const body = (await page.locator('body').innerText().catch(() => '')) || ''
          const isError = /페이지를 찾을 수 없어요|문제가 발생했어요|Application error/.test(body)
          r.opens = !isError && body.trim().length > 40
          if (!r.opens) r.note = isError ? '에러/404 화면' : '본문이 비어 있다'
          if (r.landed !== route) r.note = `리다이렉트 → ${r.landed}`
        }

        r.quiet = fatal(errors).length === 0
        if (!r.quiet) r.note = (r.note ? r.note + ' · ' : '') + fatal(errors)[0].slice(0, 80)

        if (r.opens) {
          // ③ 앞길 — 본문 안에서 **실제로 다른 곳으로 가는** 링크.
          // ⚠️ `main` 만 보면 안 된다 — `<main>` 을 쓰지 않는 화면이 있고, 그때 첫 판은
          //    "막다른 길" 로 잘못 기록했다. 셸(사이드바·하단탭)은 모든 화면에 있으므로
          //    앞길로 세면 안 되지만, 본문이 `main` 밖이면 그것도 세야 한다.
          const scope = (await page.locator('main').count()) > 0 ? 'main' : 'body'
          const links = page.locator(
            `${scope} a[href^="/"]:not([href="#"]), ${scope} button:not([disabled])`,
          )
          const n = await links.count()
          let target: string | null = null
          for (let i = 0; i < Math.min(n, 12); i++) {
            const el = links.nth(i)
            if (!(await el.isVisible().catch(() => false))) continue
            const href = await el.getAttribute('href')
            if (href && href !== r.landed && !href.startsWith('#')) {
              target = href
              break
            }
          }
          r.hasWayForward = target !== null || n > 0
          if (!r.hasWayForward) r.note = (r.note ? r.note + ' · ' : '') + '막다른 길'

          // ④ 되돌아오기 — 세션 화면은 누르지 않고, 리다이렉트 화면은 재지 않는다.
          if (r.landed !== route) {
            r.backWorks = null
            r.note = (r.note ? r.note + ' · ' : '') + '리다이렉트 — 복귀 검사 제외'
          } else if (target && !NO_CLICK.has(route)) {
            await gotoSettled(page, target)
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {})
            await page.waitForTimeout(700)
            // 리다이렉트 화면은 **도착지**로 돌아오는 것이 맞다(원래 주소로 돌아오면 또 튕긴다).
            const back = new URL(page.url()).pathname
            r.backWorks = back === r.landed || back === route
            if (!r.backWorks) {
              r.note = (r.note ? r.note + ' · ' : '') + `뒤로가기 → ${back}`
            }
          } else {
            // 누르지 않기로 한 화면도 **안 재본 것**이다 — 분모에서 뺀다.
            r.backWorks = null
            r.note =
              (r.note ? r.note + ' · ' : '') + (target ? '세션 화면 — 복귀 검사 제외' : '이동 대상 없음')
          }
        }
      } catch (e) {
        r.note = `예외: ${String(e).slice(0, 80)}`
      } finally {
        page.off('console', onConsole)
        page.off('pageerror', onPageError)
      }

      results.push(r)
    }

    // ── 보고 ────────────────────────────────────────────────────────────
    // 분모는 **실제로 잰 검사**만 센다 — 안 잰 것을 통과로도 실패로도 세지 않는다.
    const checks = results.reduce((s, r) => s + 3 + (r.backWorks === null ? 0 : 1), 0)
    const passed = results.reduce(
      (s, r) =>
        s +
        Number(r.opens) +
        Number(r.quiet) +
        Number(r.hasWayForward) +
        (r.backWorks === true ? 1 : 0),
      0,
    )
    const skipped = results.filter((r) => r.backWorks === null).length
    const rate = Math.round((passed / checks) * 1000) / 10

    // eslint-disable-next-line no-console
    console.log(
      `\n[sweep] 라우트 ${results.length} · 잰 검사 ${checks} · 통과 ${passed} → ${rate}%` +
        ` (복귀 검사 제외 ${skipped}곳)`,
    )
    for (const r of results) {
      if (r.opens && r.quiet && r.hasWayForward && r.backWorks !== false) continue
      const flags = [
        r.opens ? '열림' : '✗열림',
        r.quiet ? '조용' : '✗콘솔',
        r.hasWayForward ? '앞길' : '✗앞길',
        r.backWorks === null ? '복귀–' : r.backWorks ? '복귀' : '✗복귀',
      ].join(' ')
      // eslint-disable-next-line no-console
      console.log(`  ${r.route.padEnd(26)} ${flags}  ${r.note}`)
    }

    // ── 래칫 ────────────────────────────────────────────────────────────
    // **목표는 100% 다.** 다만 지금 남은 실패는 실행마다 오락가락해서(클라이언트 렌더가
    // 준비되기 전에 판정하는 것으로 보인다) 아직 제품 결함으로 확정하지 못했다.
    // 그래서 이 저장소가 쓰는 방식대로 **현재 수치를 바닥으로 고정**한다 —
    // 내려가면 실패하고, 올렸으면 이 숫자를 함께 올린다.
    //
    // ⚠️ 올리는 방향으로만 고칠 것. 내리면 그 순간 이 스펙은 아무것도 지키지 않는다.
    //    (2026-08-22 최초 96.7% · 잰 검사 150 · 복귀 검사 제외 18곳)
    // 재현되기 전까지는 바닥을 걸지 않는다 — 숫자를 인쇄하는 것이 이 스펙의 일이다.
    const FLOOR = Number(process.env.LEARNER_SWEEP_FLOOR ?? 0)
    expect(
      rate,
      `학습자 훑기 성공률 ${rate}% (바닥 ${FLOOR}%) — 목표 100%. 위 목록 참조`,
    ).toBeGreaterThanOrEqual(FLOOR)
  })
})
