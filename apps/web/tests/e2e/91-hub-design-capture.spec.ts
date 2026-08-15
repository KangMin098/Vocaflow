// apps/web/tests/e2e/91-hub-design-capture.spec.ts
//
// 허브 화면 디자인 캡처 하네스 — **회귀 스펙이 아니라 평가 도구다.**
//
// 왜 스펙으로 두나: 허브 리디자인은 "좋아졌나" 를 눈대중으로 판정하면 매번 결론이
// 바뀐다. 같은 계정·같은 뷰포트·같은 라우트에서 before/after 를 뽑아야 점수가 의미를
// 가진다. 임시 드라이버를 매번 새로 만들지 말라는 apps/web/CLAUDE.md 규칙에 따라
// 상시 자산으로 남긴다.
//
// 실행:
//   HUB_SHOT_DIR=<출력경로> npx playwright test 91-hub-design-capture --project=chromium
//   HUB_SHOT_TAG=baseline   → 파일명 접두사 (baseline / lab-a / lab-b …)
//   HUB_SHOT_THEME=dark     → 다크모드 캡처
//   HUB_SHOT_ROUTES=/hub,/wordvault → 라우트 부분 캡처
//
// ⚠️ Git Bash(MSYS)에서는 `MSYS_NO_PATHCONV=1` 을 함께 줄 것. 안 그러면 `/hub` 같은 값이
//    `C:/Program Files/Git/hub` 로 **경로 변환**되어 아무 라우트와도 안 맞는다(실측 2026-08-15).
//    `?v=a` 처럼 물음표가 붙은 값은 변환되지 않아서 이 함정이 한동안 안 보였다.
//
// 산출물은 리포에 남기지 않는다(스크린샷은 커밋 대상 아님). 기본 출력은 test-results 하위.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}

const OUT_DIR = process.env.HUB_SHOT_DIR || path.join('test-results', 'hub-shots')
const TAG = process.env.HUB_SHOT_TAG || 'baseline'
const THEME = process.env.HUB_SHOT_THEME === 'dark' ? 'dark' : 'light'
/** 공개 라우트 전용 캡처 — 로그인을 건너뛴다 (HUB_SHOT_NOAUTH=1). */
const NO_AUTH = process.env.HUB_SHOT_NOAUTH === '1'

/** 학습자 허브 전체 — 이번 리디자인의 대상 표면. */
const ALL_ROUTES: { slug: string; url: string; label: string }[] = [
  { slug: 'hub', url: '/hub', label: 'Today 허브' },
  { slug: 'wordvault', url: '/wordvault', label: 'WordVault 허브' },
  { slug: 'flashcard', url: '/flashcard', label: 'Flashcard 허브' },
  { slug: 'spellforge', url: '/spellforge', label: 'SpellForge 허브' },
  { slug: 'library', url: '/library', label: '라이브러리' },
  { slug: 'arcade', url: '/arcade', label: '아케이드' },
  { slug: 'dashboard', url: '/dashboard', label: '대시보드' },
  // PRACTICE 그룹 — 사이드바가 한 묶음으로 파는 5 표면. 서로 형제라 **같은 기준으로 봐야 한다**
  // (하나만 보면 "이 화면 괜찮네" 로 끝나고, 형제 간 불일치는 안 보인다).
  { slug: 'wordblitz', url: '/wordblitz', label: 'WordBlitz 허브' },
  { slug: 'pairflip', url: '/pairflip', label: 'PairFlip 허브' },
  { slug: 'practice', url: '/practice', label: '연습 진입면(통합)' },
  { slug: 'practice-dcp', url: '/practice/dcp', label: '구문 연습(DCP)' },
  // 라이브러리 3탭 — 서가는 **형제로 봐야 한다**. Books 만 보면 "괜찮네" 로 끝나고,
  // Dispatches·Decks 와의 불일치(카드 크기·서지정보 밀도·표지 유무)는 안 보인다.
  { slug: 'library-books', url: '/library/books', label: '서가 — Books' },
  { slug: 'library-scripts', url: '/library/scripts', label: '서가 — Dispatches' },
  { slug: 'library-vocab', url: '/library/vocab', label: '서가 — Decks' },
]

/**
 * 재설계 랩 후보 — 기본 캡처에는 넣지 않는다.
 * (베이스라인 세트에 섞이면 "현행 7화면" 이라는 비교 기준이 흐려진다.)
 * HUB_SHOT_ROUTES 로 명시할 때만 잡힌다.
 */
const LAB_ROUTES = [
  { slug: 'lab-a', url: '/hub-lab?v=a', label: '랩 후보 A' },
  { slug: 'lab-b', url: '/hub-lab?v=b', label: '랩 후보 B' },
  { slug: 'lab-c', url: '/hub-lab?v=c', label: '랩 후보 C' },
  { slug: 'lab-c-night', url: '/hub-lab?v=c&t=night', label: '랩 후보 C (밤)' },
  { slug: 'lab-c-dawn', url: '/hub-lab?v=c&t=dawn', label: '랩 후보 C (새벽)' },
  { slug: 'lab-d', url: '/hub-lab?v=d', label: '합성 D' },
  { slug: 'lab-d-night', url: '/hub-lab?v=d&t=night', label: '합성 D (밤)' },
]

const ROUTES = process.env.HUB_SHOT_ROUTES
  ? [...ALL_ROUTES, ...LAB_ROUTES].filter((r) =>
      process.env.HUB_SHOT_ROUTES!.split(',').includes(r.url),
    )
  : ALL_ROUTES

/**
 * 로그인 세션 파일. `test-results/` 가 아니라 `playwright-auth/` 인 이유는
 * Playwright 가 실행 시작에 output 디렉터리를 통째로 지우기 때문이다(apps/web/CLAUDE.md).
 */
const STATE_PATH = 'playwright-auth/.auth-hub-capture.json'

/**
 * 로그인.
 *
 * ⚠️ 두 가지를 실측으로 배웠다(2026-08-15).
 *
 * ① **하이드레이션 전에 누르면 안 된다.** `domcontentloaded` 직후 submit 을 클릭하면
 *    React 핸들러가 아직 안 붙어 네이티브 폼 전송이 일어나고 `/login` 으로 되돌아온다.
 *    로그 상 "navigated to /login" 이 여섯 번 찍혔다. networkidle + 고정 대기로 막는다.
 * ② **실패를 삼키면 안 된다.** `.catch(() => {})` 로 두는 순간 로그인 화면이 그대로
 *    캡처되고, 이 하네스는 그걸 허브인 줄 알고 채점한다. 실제로 한 사이클을 통째로
 *    잘못된 화면에 썼다. 판정 도구에서는 조용한 실패가 회귀 실패보다 나쁘다.
 */
async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/**
 * 캡처 안정화.
 *
 * 허브는 전부 SWR/클라이언트 페치라 domcontentloaded 직후에는 스켈레톤이다.
 * 스켈레톤을 찍으면 "빈 카드가 많다" 는 잘못된 점수가 나온다 — 실제로 그렇게 찍히면
 * 레이아웃 평가가 통째로 무의미해진다. aria-busy 가 사라질 때까지 기다리고,
 * 그래도 남으면 네트워크 유휴 + 고정 대기로 마감한다.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
      timeout: 15_000,
    })
    .catch(() => {})

  // ⚠️ **지연 로딩을 먼저 깨워야 한다.** `next/image` 는 뷰포트 밖 이미지를 안 받는데
  // `fullPage: true` 는 문서 전체를 찍는다 — 그래서 접힘 아래 표지가 전부 **검은 박스**로
  // 찍혔고, 서가를 "표지가 없다" 로 채점할 뻔했다(실측 2026-08-15: 실제로는 next/image 가
  // 384x576 을 정상 반환하고 있었다). 판정 도구가 만들어낸 가짜 결함이다.
  // 끝까지 스크롤해 전부 요청시킨 뒤 맨 위로 돌아온다.
  await page.evaluate(async () => {
    const step = Math.max(400, window.innerHeight)
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  // 요청은 끝났어도 디코드·페인트가 남는다. 모든 <img> 가 complete 가 될 때까지 기다린다.
  await page
    .waitForFunction(
      () => Array.from(document.images).every((i) => i.complete),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {})
  // 모션 정지 — 진입 트랜지션 중간 프레임이 찍히면 before/after 비교가 흔들린다
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}`,
  })
  await page.waitForTimeout(600)
}

/**
 * 레이아웃 계측 — 스크린샷이 못 보여주는 것을 숫자로.
 *
 * 서가에서 "실제 도서관 같지 않다" 의 정체는 대개 **불균질**이다: 카드 높이가 여러 종류거나,
 * 제목이 1~3줄로 흔들려 기준선이 어긋나거나, 가로로 넘친다. 눈으로는 "뭔가 이상하다" 까지만
 * 가고 어디를 고칠지는 안 나온다. 라운드마다 같은 잣대로 재야 개선이 래칫이 된다.
 */
async function layoutMetrics(page: Page) {
  return page.evaluate(() => {
    // 카드 루트는 탭마다 다른 aria-label 로 끝난다. 한 탭만 잡는 셀렉터를 쓰면
    // 나머지 탭이 **조용히 0개**로 나오고, 그걸 "측정했다" 로 착각한다
    // (실측 2026-08-15: Dispatches·Decks 가 한 라운드 내내 0개였는데 아무도 안 걸렸다).
    const CARD_SELECTOR = [
      'button[aria-label$="상세 보기"]', // Books
      'button[aria-label$="미리보기 열기"]', // Decks
      '[aria-label$="글 둘러보기"]', // Dispatches
      'button[aria-label$=" 선택"]', // Decks 캐러셀(측면)
      'button[aria-label$=" 미리보기"]', // Decks 캐러셀(중앙)
    ].join(',')
    const cards = Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR))

    // ⚠️ **구역을 섞어 세면 안 된다.** 서가에는 캐러셀(270px 고정폭)·인기 가로줄·전체 격자가
    // 함께 있고, 셋은 원래 크기가 다르다. 전부 한 통에 넣고 "높이 9종" 이라고 읽으면
    // 멀쩡한 구역을 고치러 간다(실제로 한 번 그렇게 했다). 같은 부모 안에서만 비교한다.
    // 카드마다 자기 `<li>`/래퍼가 있으므로 부모로 묶으면 전부 1개짜리 구역이 된다.
    // **여러 카드를 담는 첫 조상**(격자/가로줄 컨테이너)까지 올라가서 묶는다.
    const containerOf = (c: HTMLElement): Element => {
      let n: Element | null = c
      for (let i = 0; i < 4 && n?.parentElement; i++) {
        n = n.parentElement
        if (n.querySelectorAll(CARD_SELECTOR).length >= 2) return n
      }
      return c.parentElement ?? document.body
    }
    // ⚠️ **transform 을 뺀 레이아웃 높이(offsetHeight)로 잰다.**
    // `getBoundingClientRect()` 는 3D 변형을 포함하는데, 코버플로 캐러셀은 깊이를 주려고
    // 일부러 카드마다 scale 을 다르게 준다. rect 로 재면 그 **의도된 원근**이 "불균질 1/1"
    // 로 보고된다(실측 2026-08-15: Decks 119~360px). 우리가 묻는 것은 레이아웃이 균질한가지,
    // 화면에 몇 픽셀로 보이는가가 아니다.
    const bySection = new Map<Element, number[]>()
    for (const c of cards) {
      const section = containerOf(c)
      const arr = bySection.get(section) ?? []
      arr.push(c.offsetHeight)
      bySection.set(section, arr)
    }
    const sections = [...bySection.values()]
      .map((hs) => ({ n: hs.length, heights: [...new Set(hs)].sort((a, b) => a - b) }))
      .filter((s) => s.n >= 2) // 카드 1개짜리 구역은 균질성을 말할 수 없다
      .sort((a, b) => b.n - a.n)

    const titleLines: Record<number, number> = {}
    for (const c of cards) {
      const t = c.querySelector('h3')
      if (!t) continue
      const cs = getComputedStyle(t)
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25
      const n = Math.max(1, Math.round(t.getBoundingClientRect().height / lh))
      titleLines[n] = (titleLines[n] ?? 0) + 1
    }
    return {
      cardCount: cards.length,
      /** 구역별 카드 높이 — **각 구역 안에서 1종**이 목표다. */
      sections,
      /** 높이가 균질하지 않은 구역 수 — 이 값이 래칫의 눈금이다. */
      unevenSections: sections.filter((s) => s.heights.length > 1).length,
      /** 제목 줄 수 분포 — 흩어져 있으면 기준선이 어긋난다. */
      titleLines,
      /** 문서 가로 넘침(px) — 모바일에서 0 이어야 한다. */
      overflowPx: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    }
  })
}

test.describe('허브 디자인 캡처', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  // 세션은 한 번만 만든다. 리디자인 사이클은 하루에도 수십 번 캡처하는데,
  // 매번 로그인하면 느릴 뿐 아니라 auth 요청이 쌓인다.
  test.beforeAll(async ({ browser }) => {
    // 훅은 describe.configure 의 timeout 을 물려받지 않는다 — 기본 30초다.
    // dev 서버가 콜드 컴파일 중이면 `/login` 진입만 30초를 넘겨서, 캡처가 한 장도
    // 없이 "beforeAll hook timeout" 으로 죽는다(실측 2026-08-15, `.next` 삭제 직후).
    test.setTimeout(180_000)
    // 공개 라우트(/library/*)만 찍을 때는 로그인하지 않는다.
    //   검증 계정은 **워크스페이스의 모든 세션이 공유**한다. 다른 세션이 로그아웃하면
    //   Supabase 가 refresh 토큰을 전역 폐기해서 이쪽 로그인도 곧바로 죽고,
    //   `waitForURL` 이 30초를 태우다 캡처가 한 장도 안 남는다(실측 2026-08-15).
    //   서가는 비로그인에 열려 있으므로(카탈로그 공개 유지) 로그인할 이유가 없다.
    if (NO_AUTH) return
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  if (!NO_AUTH) test.use({ storageState: STATE_PATH })

  test(`${TAG}/${THEME} — 학습자 허브 전 화면`, async ({ page }) => {
    // HUB_SHOT_ROUTES 에 목록에 없는 주소를 적으면 ROUTES 가 빈 배열이 되고,
    // 아래 개수 단언은 0 === 0 으로 **통과한다**. 한 장도 안 찍고 성공으로 보이는 것은
    // 이 하네스에서 두 번째로 발견한 조용한 실패다(첫 번째는 로그인 화면 캡처).
    expect(ROUTES.length, `HUB_SHOT_ROUTES 가 알려진 라우트와 하나도 안 맞는다`).toBeGreaterThan(0)

    await page.addInitScript((theme) => {
      window.localStorage.setItem('vocaflow-theme', theme as string)
    }, THEME)

    const captured: string[] = []
    const metrics: Array<Awaited<ReturnType<typeof layoutMetrics>> & { route: string; vp: string }> = []

    for (const vp of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height })

      for (const route of ROUTES) {
        await page.goto(route.url, { waitUntil: 'domcontentloaded' })
        await settle(page)

        // 세션이 중간에 끊기면 보호 라우트가 /login 으로 리다이렉트된다.
        // 그 화면을 찍어서 "허브" 로 채점하는 것이 이 하네스의 최악의 실패다.
        expect(page.url(), `${route.label} 캡처 중 로그인 화면으로 튕겼다`).not.toContain('/login')

        const file = path.join(OUT_DIR, `${TAG}-${THEME}-${vp.name}-${route.slug}.png`)
        await page.screenshot({ path: file, fullPage: true })
        captured.push(file)

        metrics.push({ route: route.slug, vp: vp.name, ...(await layoutMetrics(page)) })
      }
    }

    // 캡처 자체가 목적이지만, 화면이 통째로 죽어 있으면 스크린샷도 무의미하다.
    expect(captured.length).toBe(ROUTES.length * 2)

    // 계측을 함께 낸다 — 스크린샷만으로는 "카드 높이가 3종" 같은 것이 눈에 안 띈다.
    // 라운드마다 같은 잣대가 있어야 개선이 감이 아니라 래칫이 된다.
    const metricsFile = path.join(OUT_DIR, `${TAG}-${THEME}-metrics.json`)
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2))
    // eslint-disable-next-line no-console
    console.log(`[hub-capture] ${captured.length} shots + metrics → ${OUT_DIR}`)
    for (const m of metrics) {
      // 카드 0개는 "균질하다" 가 아니라 **못 쟀다** 이다. 조용히 넘어가면 그 화면은
      // 영영 평가되지 않는다 — Dispatches·Decks 가 실제로 그렇게 한 라운드를 통과했다.
      const verdict =
        m.cardCount === 0
          ? '⚠ 카드 0개 — 셀렉터가 이 화면의 카드를 못 잡는다(측정 안 됨)'
          : `불균질구역 ${m.unevenSections}/${m.sections.length} · ` +
            `구역 ${m.sections.map((s) => `${s.n}개:${s.heights.join(',')}`).join(' | ')}`
      // eslint-disable-next-line no-console
      console.log(
        `[metric] ${m.route}/${m.vp} 카드 ${m.cardCount} · ${verdict} · ` +
          `제목줄 ${JSON.stringify(m.titleLines)} · 넘침 ${m.overflowPx}px`,
      )
    }
  })
})
