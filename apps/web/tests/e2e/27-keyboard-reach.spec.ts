// apps/web/tests/e2e/27-keyboard-reach.spec.ts
//
// **마우스를 못 쓰는 학습자** — 키보드만으로 화면을 쓸 수 있나.
//
// ── 왜 이 축이 따로 필요한가 (실측 2026-08-23) ───────────────────────────
// 지금까지 학습자 화면을 세 축으로 재고 있었다:
//   `26-learner-sweep` 동선 · `10-a11y-sweep` 터치/넘침/이름 · `91-hub-design-capture` 대비/배치.
// 셋 다 **포인터를 쓰는 사람**을 가정한다. 저장소 전체에 `keyboard.press('Tab')` 이
// 한 번도 없었다 — 키보드 전용 학습자에게 이 앱이 쓸 만한지는 **한 번도 재지 않았다.**
//
// 44px 타깃을 키운 것과 이건 다른 문제다. 타깃이 아무리 커도 **Tab 으로 닿지 못하면**
// 그 기능은 없는 것이고, 포커스가 안 보이면 닿아도 어디 있는지 알 수 없다.
//
// ── 무엇을 성공으로 세는가 ───────────────────────────────────────────────
// 화면마다 세 가지. 성공률 = 통과 검사 / **실제로 잰** 검사.
//   ① 본문에 닿는다   — Tab 을 눌러 셸(사이드바·하단탭) 밖, 본문 안의 컨트롤에 도달한다
//   ② 포커스가 보인다 — 그 지점에서 outline 이나 ring 이 실제로 그려진다
//   ③ 갇히지 않는다   — 거기서 Tab 을 더 눌렀을 때 포커스가 움직인다
//
// ⚠️ **못 잰 것을 통과로 세지 않는다.** 화면이 안 열리면 세 검사 모두 분모에서 뺀다
//    (실패로도, 성공으로도 세지 않는다) — 그 화면에 대해 아무것도 알아내지 못했으므로.
//    분모는 항상 출력한다. 0 은 성과일 수도, 측정 실패일 수도 있다(§CONVENTIONS).
//
// ⚠️ **바닥값을 짐작해서 정하지 않는다.** 첫 실행의 실측치를 그대로 바닥으로 적는다.
//    근거 없는 임계값은 목표가 아니라 짐작이다.

import { test, expect, type Page } from '@playwright/test'
import { learnerRoutes, redirectOnlyRoutes } from './utils/learner-routes'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-keyboard-reach.json'

/** Tab 을 몇 번까지 눌러 볼 것인가. 셸의 컨트롤 수 + 여유. */
const MAX_TABS = 40

/**
 * 서버가 살아 있는가. **죽은 서버를 앱 결함으로 세지 않기 위해** 쓴다.
 *
 * ⚠️ 실측 2026-08-23: 라우트마다 새 탭을 열었더니 37곳 중 **30곳이 "본문이 비어 있다"** 로
 *    기록됐고, 남은 7곳이 전부 통과해 **100%** 가 찍혔다. 앱은 멀쩡했고 dev 서버가
 *    탭 폭주에 죽은 것이다. 분모 가드가 아니었으면 그 100 을 성과로 적을 뻔했다.
 *    → 탭을 재사용하고(부하 감소), 서버가 죽으면 재시도하고, 그래도 안 되면 **멈춘다.**
 */
async function serverAlive(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get('/hub', { timeout: 15_000 })
    return res.status() > 0
  } catch {
    return false
  }
}

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

interface Focused {
  /** 본문(`main`, 없으면 `body` 직계) 안인가 — 셸이면 false. */
  inMain: boolean
  /** 눌러서 뭔가 되는 것인가(링크·버튼·입력). 장식에 포커스가 가면 앞길이 아니다. */
  actionable: boolean
  /** 포커스 표시가 실제로 그려지나. */
  visible: boolean
  tag: string
  label: string
  /** 건너뛰기 링크인가 — 본문 앵커로 가는 링크. */
  isSkip: boolean
}

/** 지금 포커스된 요소를 브라우저 안에서 판정한다. */
async function focusState(page: Page): Promise<Focused | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null

    const main = document.querySelector('main')
    const inMain = main ? main.contains(el) : true

    const tag = el.tagName.toLowerCase()
    const role = el.getAttribute('role') || ''
    const actionable =
      tag === 'a' ||
      tag === 'button' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      ['button', 'link', 'checkbox', 'tab', 'menuitem'].includes(role)

    // 포커스 표시 — outline 이 그려지거나 ring(box-shadow) 이 붙거나.
    // ⚠️ 클래스 문자열(`focus-visible:ring-2`)을 세면 안 된다. 그건 "적혀 있다" 이지
    //    "그려진다" 가 아니다 — 상위 규칙에 덮이면 적혀 있어도 안 보인다.
    const cs = getComputedStyle(el)
    const ow = parseFloat(cs.outlineWidth || '0')
    const hasOutline = cs.outlineStyle !== 'none' && ow > 0
    const hasRing = cs.boxShadow !== 'none' && cs.boxShadow !== ''
    const visible = hasOutline || hasRing

    const label =
      (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28) || tag

    const href = el.getAttribute('href') || ''
    const isSkip = tag === 'a' && href.startsWith('#')

    return { inMain, actionable, visible, tag, label, isSkip }
  })
}

interface RouteResult {
  route: string
  /** 열렸나 — 안 열렸으면 세 검사 모두 분모에서 뺀다. */
  opens: boolean
  /** ① 본문 컨트롤에 닿기까지 누른 Tab 수. null = 못 닿았다. */
  tabsToMain: number | null
  /** 건너뛰기 링크를 눌러서 닿았나. */
  viaSkip: boolean
  /** ② 그 지점의 포커스 표시. null = 닿지 못해 재지 못했다. */
  focusVisible: boolean | null
  /** ③ 더 눌렀을 때 움직이나. null = 닿지 못해 재지 못했다. */
  escapable: boolean | null
  /** 어느 키로 나갔나. `Shift+Tab` 뿐이면 화면이 그걸 알려야 한다. */
  escapedBy: 'Tab' | 'Shift+Tab' | null
  note: string
}

test.describe('제3의 학습자 — 키보드만으로', () => {
  test.describe.configure({ mode: 'serial', timeout: 900_000 })
  test.skip(
    process.env.KEYBOARD_SWEEP !== '1',
    'KEYBOARD_SWEEP=1 로 명시할 때만 — 전 화면 × Tab 이라 몇 분 걸린다',
  )

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH, ...VIEWPORT })

  test('모든 학습자 화면에 Tab 으로 닿고 · 포커스가 보이고 · 갇히지 않는다', async ({
    page,
    context,
  }) => {
    const redirectOnly = redirectOnlyRoutes()
    // 보내기만 하는 껍데기는 목적지에서 재진다 — 여기서 재면 목적지를 두 번 센다.
    const routes = learnerRoutes().filter((r) => !redirectOnly.has(r))
    expect(routes.length, '라우트를 하나도 못 찾았다 — 목록 추출이 깨졌다').toBeGreaterThan(20)

    // 예열 — dev 서버는 라우트마다 첫 방문에 컴파일한다. 그 지연을 "못 닿았다" 로
    // 기록하면 실행마다 결과가 달라진다(26-learner-sweep 에서 겪었다). 결과는 버린다.
    const warm = await context.newPage()
    for (const route of routes) {
      await warm.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
      await warm.waitForTimeout(150)
    }
    await warm.close()

    const results: RouteResult[] = []

    for (const route of routes) {
      const r: RouteResult = {
        route,
        opens: false,
        tabsToMain: null,
        viaSkip: false,
        focusVisible: null,
        escapable: null,
        escapedBy: null,
        note: '',
      }

      // ⚠️ 화면마다 새 탭을 열면 dev 서버가 죽는다(위 serverAlive 주석 참조).
      //    포커스는 `goto` + blur 로 초기화되므로 탭을 새로 열 이유가 없다.
      const p = page
      {
        await p.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
        await p.waitForTimeout(1_200)

        const body = ((await p.locator('body').innerText().catch(() => '')) || '').trim()
        const landed = new URL(p.url()).pathname
        r.opens = body.length > 40 && !landed.startsWith('/login')
        if (!r.opens && !landed.startsWith('/login')) {
          // 한 번은 봐준다 — 그리고 서버가 죽었으면 **그 사실을 말하고 멈춘다.**
          // 죽은 서버가 만든 "안 열림" 을 화면 결함으로도, 제외로도 세면 안 된다.
          if (!(await serverAlive(p))) {
            throw new Error(
              `dev 서버가 응답하지 않는다 (${route} 에서) — 여기까지의 성공률은 뜻이 없다`,
            )
          }
          await p.waitForTimeout(1_500)
          await p.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
          await p.waitForTimeout(1_500)
          const retry = ((await p.locator('body').innerText().catch(() => '')) || '').trim()
          r.opens = retry.length > 40
        }
        if (!r.opens) {
          r.note = landed.startsWith('/login') ? '로그인으로 튕겼다 — 재지 않음' : '본문이 비어 있다 — 재지 않음'
          results.push(r)
          continue
        }

        // 문서 **처음부터** Tab 을 시작한다.
        //
        // ⚠️ 앞 판은 여기서 `body.click({x:2,y:2})` 를 했다. 그 좌표에는 사이드바가 있고,
        //    클릭한 자리부터 순차 포커스가 이어지므로 **그보다 앞에 있는 건너뛰기 링크를
        //    영영 지나쳤다.** 링크를 달아도 37곳 중 1곳만 그 링크를 만났고,
        //    "본문까지 Tab 중앙값 19" 는 그대로였다 — 고쳤는데 눈금이 안 움직였다.
        //    Playwright 의 `keyboard.press` 는 이미 페이지를 향하므로 클릭이 필요 없다.
        await p.evaluate(() => {
          ;(document.activeElement as HTMLElement | null)?.blur()
          window.scrollTo(0, 0)
        })

        // 못 닿았을 때 **어디를 돌았는지** 남긴다 — "못 닿았다" 만으로는 화면을 고칠지
        // 계측기를 고칠지 알 수 없다(대비 사이클에서 같은 실패를 세 번 겪었다).
        const trail: string[] = []
        let usedSkip = false
        for (let i = 1; i <= MAX_TABS; i++) {
          await p.keyboard.press('Tab')
          const f = await focusState(p)
          if (f) trail.push(`${f.inMain ? '본문' : '셸'}/${f.actionable ? '' : '비컨트롤:'}${f.tag}"${f.label}"`)

          // ⚠️ 건너뛰기 링크는 **누르라고 있는 것**이다. Tab 수만 세고 지나치면
          //    링크를 달아도 눈금이 안 움직여, 고쳐도 고친 걸 알 수 없다.
          //    학습자가 하는 일을 그대로 한다 — 포커스됐으면 Enter 를 누른다.
          if (f && f.isSkip) {
            usedSkip = true
            await p.keyboard.press('Enter')
            await p.waitForTimeout(250)
            continue
          }

          if (f && f.inMain && f.actionable) {
            r.tabsToMain = i
            r.viaSkip = usedSkip
            r.focusVisible = f.visible
            if (!f.visible) r.note = `포커스가 안 보인다: <${f.tag}> "${f.label}"`
            break
          }
        }

        if (r.tabsToMain === null) {
          const seen = [...new Set(trail)]
          r.note =
            `Tab ${MAX_TABS}번으로 본문 컨트롤에 못 닿았다 — 돈 곳: ` +
            (seen.length ? seen.slice(0, 6).join(' → ') + (seen.length > 6 ? ` … 외 ${seen.length - 6}` : '') : '(아무 데도 포커스가 안 갔다)')
        } else {
          // ③ 갇히지 않는가 — 여기서 더 눌렀을 때 포커스가 실제로 옮겨 가나.
          const before = await p.evaluate(() => {
            const el = document.activeElement as HTMLElement | null
            return el ? el.outerHTML.slice(0, 120) : ''
          })
          // ⚠️ 탈출을 `Tab` 만으로 재면 안 된다. 타이핑 게임처럼 `Tab` 을 기능키로 쓰는
          //    화면에서는 **뒤로 나가는 문(Shift+Tab)** 이 정답이다. 한 방향만 보고
          //    "갇혔다" 고 적으면 고칠 수 없는 실패가 된다.
          //    다만 어느 문으로 나갔는지는 **남긴다** — Shift+Tab 뿐이라면 화면이 그 사실을
          //    말하고 있어야 하고(WCAG 2.1.2), 그건 사람이 확인할 몫이다.
          let escapedBy: 'Tab' | 'Shift+Tab' | null = null
          for (const key of ['Tab', 'Shift+Tab'] as const) {
            for (let i = 0; i < 5 && !escapedBy; i++) {
              await p.keyboard.press(key)
              const now = await p.evaluate(() => {
                const el = document.activeElement as HTMLElement | null
                return el ? el.outerHTML.slice(0, 120) : ''
              })
              if (now !== before) escapedBy = key
            }
            if (escapedBy) break
          }
          r.escapable = escapedBy !== null
          r.escapedBy = escapedBy
          if (!escapedBy) r.note = (r.note ? r.note + ' · ' : '') + '포커스가 갇혔다 (Tab · Shift+Tab 둘 다 막힘)'
          else if (escapedBy === 'Shift+Tab')
            r.note = (r.note ? r.note + ' · ' : '') + 'Tab 은 막혀 있고 Shift+Tab 으로만 나간다 — 화면이 그 사실을 말해야 한다'
        }
      }
      results.push(r)
    }

    // ── 집계 ────────────────────────────────────────────────────────────
    let measured = 0
    let passed = 0
    const skipped: string[] = []
    for (const r of results) {
      if (!r.opens) {
        skipped.push(r.route)
        continue
      }
      measured += 1 // ①
      if (r.tabsToMain !== null) passed += 1
      for (const v of [r.focusVisible, r.escapable]) {
        if (v === null) continue // 닿지 못해 재지 못한 것 — 분모에 넣지 않는다
        measured += 1
        if (v) passed += 1
      }
    }
    const rate = measured > 0 ? Math.round((passed / measured) * 1000) / 10 : 0

    /* eslint-disable no-console */
    console.log(
      `\n[키보드] 라우트 ${results.length} · 잰 검사 ${measured} · 통과 ${passed} → ${rate}%` +
        (skipped.length ? ` (안 열려서 제외 ${skipped.length}곳: ${skipped.join(', ')})` : ''),
    )
    const viaSkip = results.filter((r) => r.viaSkip).length
    const reached = results.filter((r) => r.tabsToMain !== null).length
    console.log(`[키보드] 건너뛰기 링크로 닿은 화면 ${viaSkip}/${reached}`)
    const tabs = results.map((r) => r.tabsToMain).filter((n): n is number => n !== null)
    if (tabs.length) {
      const sorted = [...tabs].sort((a, b) => a - b)
      console.log(
        `[키보드] 본문까지 Tab — 최소 ${sorted[0]} · 중앙 ${sorted[Math.floor(sorted.length / 2)]} · 최대 ${sorted[sorted.length - 1]}`,
      )
    }
    for (const r of results) {
      if (r.tabsToMain !== null && r.focusVisible && r.escapable !== false && r.escapedBy !== 'Shift+Tab')
        continue
      const flags = [
        r.opens ? '열림' : '✗열림',
        r.tabsToMain !== null ? `본문 Tab${r.tabsToMain}` : '✗본문 못 닿음',
        r.focusVisible === null ? '포커스–' : r.focusVisible ? '포커스' : '✗포커스',
        r.escapable === null ? '탈출–' : r.escapable ? '탈출' : '✗탈출',
      ].join(' ')
      console.log(`  ${r.route.padEnd(26)} ${flags}  ${r.note}`)
    }
    console.log('')
    /* eslint-enable no-console */

    // 분모부터. 재지 못했으면 성공률은 아무 뜻이 없다.
    expect(measured, '아무것도 재지 못했다 — 이 성공률은 성과가 아니라 측정 실패다').toBeGreaterThan(
      routes.length,
    )

    // ⚠️ 바닥은 **첫 실측치**로 정한다. 짐작한 임계값은 목표가 아니다.
    //    올릴 때는 올리기만 한다(래칫) — 내리려면 왜 내리는지 여기에 적을 것.
    const FLOOR = Number(process.env.KEYBOARD_SWEEP_FLOOR ?? 100)
    expect(rate, `키보드 성공률 ${rate}% (바닥 ${FLOOR}%) — 목표 100%. 위 목록 참조`).toBeGreaterThanOrEqual(
      FLOOR,
    )
  })
})
