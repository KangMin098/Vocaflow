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

/**
 * 학습자 허브 전체 — 이번 리디자인의 대상 표면.
 *
 * `nocards` 는 **"이 화면엔 잴 반복 카드가 없다" 는 선언**이다.
 * 카드 0개에는 두 가지가 섞여 있다 — ① 셀렉터가 못 잡은 것(결함) ② 원래 반복 카드가 없는
 * 화면(정상). 둘을 같은 경고로 찍으면 ②가 ①을 가려 진짜 누락이 묻힌다
 * (실측 2026-08-15: 15 라우트 중 9개가 "측정 안 됨" 이었고 그중 절반은 진짜 누락이었다).
 * 이유를 함께 적게 해서, 화면이 바뀌면 그 문장이 먼저 낡아 보이게 한다.
 * 선언을 화면(DOM 속성)이 아니라 여기 두는 이유: 계측 전용 속성을 제품 코드에 심지 않고,
 * 선언과 그것을 읽는 코드가 같은 파일에서 함께 리뷰되게 하려는 것.
 */
const ALL_ROUTES: { slug: string; url: string; label: string; nocards?: string }[] = [
  {
    slug: 'hub',
    url: '/hub',
    label: 'Today 허브',
    nocards: '단일 무대 + 흐름 목록 — 반복 카드 격자 없음',
  },
  {
    slug: 'wordvault',
    url: '/wordvault',
    label: 'WordVault 허브',
    nocards: '섹션 6종이 Frame 하나로 통일(v06.202) — 반복 카드 격자는 없다 · 면별 행은 접힘 안',
  },
  {
    slug: 'flashcard',
    url: '/flashcard',
    label: 'Flashcard 허브',
    nocards: '단일 큐 요약 — 반복 카드 격자 없음',
  },
  {
    slug: 'spellforge',
    url: '/spellforge',
    label: 'SpellForge 허브',
    nocards: '단일 큐 요약 — 반복 카드 격자 없음',
  },
  { slug: 'library', url: '/library', label: '라이브러리' },
  { slug: 'arcade', url: '/arcade', label: '아케이드' },
  { slug: 'dashboard', url: '/dashboard', label: '대시보드' },
  // PRACTICE 그룹 — 사이드바가 한 묶음으로 파는 5 표면. 서로 형제라 **같은 기준으로 봐야 한다**
  // (하나만 보면 "이 화면 괜찮네" 로 끝나고, 형제 간 불일치는 안 보인다).
  {
    slug: 'wordblitz',
    url: '/wordblitz',
    label: 'WordBlitz 허브',
    nocards: '규칙 카드 3장은 접힘(<details>) 안 — 기본 상태엔 없음',
  },
  { slug: 'pairflip', url: '/pairflip', label: 'PairFlip 허브' },
  { slug: 'practice', url: '/practice', label: '연습 진입면(통합)' },
  {
    slug: 'practice-dcp',
    url: '/practice/dcp',
    label: '구문 연습(DCP)',
    nocards: '문항 하나를 푸는 화면 — 반복 카드 없음',
  },
  // 라이브러리 3탭 — 서가는 **형제로 봐야 한다**. Books 만 보면 "괜찮네" 로 끝나고,
  // Dispatches·Decks 와의 불일치(카드 크기·서지정보 밀도·표지 유무)는 안 보인다.
  // My Library 3면 — 공용 서가와 **대칭이되 한 칸이 다르다**(Books · Texts · Decks).
  // 서가를 형제로 보는 것과 같은 이유로 셋을 함께 찍는다. 여기가 비어 있던 동안
  // "Decks 면에 스크립트가 보인다" 같은 신고를 캡처로 확인할 방법이 없었다.
  { slug: 'my-books', url: '/text?view=books', label: 'My Library — Books' },
  { slug: 'my-texts', url: '/text?view=scripts', label: 'My Library — Texts' },
  { slug: 'my-decks', url: '/text?view=vocab', label: 'My Library — Decks' },
  { slug: 'my-textbooks', url: '/text?view=textbooks', label: 'My Library — Textbooks' },
  { slug: 'library-books', url: '/library/books', label: '서가 — Books' },
  { slug: 'library-scripts', url: '/library/scripts', label: '서가 — Dispatches' },
  { slug: 'library-vocab', url: '/library/vocab', label: '서가 — Decks' },
  // 교재 서가 — 파이프라인 산출물이 학습자에게 닿는 유일한 면(v06.337 신설).
  { slug: 'library-textbooks', url: '/library/textbooks', label: '서가 — Textbooks' },
  // 권 상세 — 서가의 '지금 펼치기' 목적지. 이 자리가 비어 있던 동안 그 버튼은 죽어 있었다.
  {
    slug: 'textbook-volume',
    url: '/library/textbooks/5',
    label: '교재 상세 — STEP 5',
    nocards: '한 권을 펼친 화면 — 반복 카드 격자 없음',
  },
]

/**
 * 재설계 랩 후보 — 기본 캡처에는 넣지 않는다.
 * (베이스라인 세트에 섞이면 "현행 7화면" 이라는 비교 기준이 흐려진다.)
 * HUB_SHOT_ROUTES 로 명시할 때만 잡힌다.
 */
const LAB_ROUTES: typeof ALL_ROUTES = [
  { slug: 'lab-a', url: '/hub-lab?v=a', label: '랩 후보 A' },
  { slug: 'lab-b', url: '/hub-lab?v=b', label: '랩 후보 B' },
  { slug: 'lab-c', url: '/hub-lab?v=c', label: '랩 후보 C' },
  { slug: 'lab-c-night', url: '/hub-lab?v=c&t=night', label: '랩 후보 C (밤)' },
  { slug: 'lab-c-dawn', url: '/hub-lab?v=c&t=dawn', label: '랩 후보 C (새벽)' },
  { slug: 'lab-d', url: '/hub-lab?v=d', label: '합성 D' },
  { slug: 'lab-d-night', url: '/hub-lab?v=d&t=night', label: '합성 D (밤)' },
  // 관문 첫 줄 4상태 — **본 화면(/hub)에서는 캡처가 불가능한 것**.
  // 검증 계정은 e2e 가 매일 돌아 늘 `today` 라 그 줄이 렌더되지 않는다(의도된 동작).
  // 복귀 문구의 시각 무게는 여기서만 눈으로 볼 수 있다.
  {
    slug: 'lab-gateway',
    url: '/hub-lab?v=g',
    label: '관문 첫 줄 4상태',
    nocards: '상태 견본 나열 — 반복 카드 격자 없음',
  },
]

const ROUTES = process.env.HUB_SHOT_ROUTES
  ? [...ALL_ROUTES, ...LAB_ROUTES].filter((r) =>
      process.env.HUB_SHOT_ROUTES!.split(',').includes(r.url)
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
    .waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, {
      timeout: 15_000,
    })
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
      '[data-design-card]', // 범용 opt-in — 서재 밖 화면은 이걸 달아 계측에 참여한다
      'button[aria-label$="상세 보기"]', // Books
      'button[aria-label$="미리보기 열기"]', // Decks
      '[aria-label$="글 둘러보기"]', // Dispatches
      'button[aria-label$=" 선택"]', // Decks 캐러셀(측면)
      'button[aria-label$=" 미리보기"]', // Decks 캐러셀(중앙)
    ].join(',')
    // ⚠️ **숨은 카드는 세지 않는다.** `<details>` 안에 접힌 설명서 카드나 닫힌 disclosure 는
    // DOM 에 있지만 `offsetHeight` 가 0 이다. 그대로 세면 "3개:0" — **가짜 균질**이 나오고,
    // 그 화면은 "쟀다" 로 기록된다. 접힘 안은 기본 상태에서 학습자가 못 보는 것이므로
    // 처음부터 계측 대상이 아니다(실측: `/wordblitz` 규칙 카드 3장).
    const cards = Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR)).filter(
      (c) => c.offsetHeight > 0
    )

    // ⚠️ **구역을 섞어 세면 안 된다.** 서가에는 캐러셀(270px 고정폭)·인기 가로줄·전체 격자가
    // 함께 있고, 셋은 원래 크기가 다르다. 전부 한 통에 넣고 "높이 9종" 이라고 읽으면
    // 멀쩡한 구역을 고치러 간다(실제로 한 번 그렇게 했다). 같은 부모 안에서만 비교한다.
    // 카드마다 자기 `<li>`/래퍼가 있으므로 부모로 묶으면 전부 1개짜리 구역이 된다.
    // **여러 카드를 담는 첫 조상**(격자/가로줄 컨테이너)까지 올라가서 묶는다.
    const containerKey = new Map<Element, string>()
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
    // ⚠️ **줄(row)이 비교 단위다 — 격자 전체가 아니다.**
    // 줄바꿈하는 격자에서는 줄마다 높이가 다른 게 정상이다(각 줄은 그 줄의 최고 카드에
    // 맞춰 늘어난다). 격자 전체를 한 통에 넣고 세면 **정상 격자가 영원히 "불균질"** 로
    // 나온다 — 실측 2026-08-15 `/practice`: 5장이 3줄에 걸쳐 131/179/227 로 나왔는데
    // 각 줄 안에서는 완전히 균질했다. 그 신호를 쫓았으면 멀쩡한 레이아웃을 고쳤을 것이다.
    // 같은 컨테이너 + 같은 줄인 카드끼리만 비교한다.
    //
    // ⚠️ 줄 판별에 **`offsetTop` 을 쓰면 안 된다** — 그건 `offsetParent` 기준이다.
    // 카드마다 `position:relative` 래퍼가 있으면(아케이드 `.arc-slot`) 전부 `0` 이 되어
    // **한 구역의 카드 전부가 한 줄로 묶인다.** 실측 2026-08-15: `/arcade` 가 그렇게 해서
    // 208/225/331 "불균질 2/3" 으로 나왔는데, 실제로는 서로 다른 줄이었고 331 은 아예 다른
    // 컴포넌트(패밀리 카드)였다. 계측이 만들어낸 가짜 결함이다.
    // 문서 기준 top 으로 묶고, 서브픽셀은 4px 버킷으로 흡수한다.
    const bySection = new Map<string, { el: Element; heights: number[] }>()
    for (const c of cards) {
      const section = containerOf(c)
      if (!containerKey.has(section)) containerKey.set(section, String(containerKey.size))
      const docTop = Math.round((c.getBoundingClientRect().top + window.scrollY) / 4)
      const key = `${containerKey.get(section)}@${docTop}`
      const entry = bySection.get(key) ?? { el: section, heights: [] }
      entry.heights.push(c.offsetHeight)
      bySection.set(key, entry)
    }
    const sections = [...bySection.values()]
      .map(({ heights }) => ({
        n: heights.length,
        heights: [...new Set(heights)].sort((a, b) => a - b),
      }))
      .filter((s) => s.n >= 2) // 카드 1개짜리 줄은 균질성을 말할 수 없다
      .sort((a, b) => b.n - a.n)

    /**
     * **첫 카드까지 몇 화면인가** — "콘텐츠에 닿기까지의 거리".
     *
     * 전체 높이만 보면 "긴 화면" 과 "본론이 늦는 화면" 이 구분되지 않는다. 책이 27권이라
     * 6.86화면인 것과, 필터가 두 화면을 먹어서 6.86화면인 것은 완전히 다른 문제다.
     * 카드가 곧 콘텐츠인 화면(서가·아케이드·연습)에서 이 값이 1을 넘으면 학습자는
     * **아무 콘텐츠도 못 본 채 스크롤을 시작**한다.
     *
     * ⚠️ **태그 안 된 콘텐츠는 이 값을 부풀린다.** 실측 2026-08-15: `/arcade` 가 1.38화면으로
     * 나와 "첫 게임까지 한 화면 반" 이라고 판단했는데, 맨 위 "오늘의 실험" 카드가
     * `data-design-card` 를 안 달고 있었을 뿐이었다. 달고 다시 재니 **0.84화면**(접힘선 위) —
     * 결함이 아니었다. 이 값이 크면 먼저 **그 위에 안 세어진 콘텐츠가 있는지** 보라.
     */
    const firstCardTop = cards.length
      ? Math.min(...cards.map((c) => c.getBoundingClientRect().top + window.scrollY))
      : null

    // ⚠️ **아무 `h3` 나 재면 안 된다 — 장식 타이포를 기준선으로 착각한다.**
    // 실측 2026-08-16: 서가가 `{"2":24,"4":2}`(Books) · `{"1":7,"2":2,"3":3}`(Decks) 로 나와
    // "제목 줄 수가 흩어져 기준선이 어긋난다" 고 판단할 뻔했다. 실제로는 **표지 아트의 제목**
    // (`GradientBookCover`, `line-clamp-4/5`)을 메타데이터 제목과 한 통에 센 것이었다.
    // 책 표지의 제목이 1~5줄인 것은 정상이다 — 그건 그림이지 표의 한 칸이 아니다.
    // Decks 카드는 아예 표지 아래 제목이 없다(제목이 곧 표지다).
    // 그래서 **명시적으로 표시된 제목만** 잰다. 표시가 없으면 재지 않고 그 수를 따로 낸다 —
    // 잘못 재는 것보다 "안 쟀다" 가 낫다.
    const titleLines: Record<number, number> = {}
    let cardsWithoutMarkedTitle = 0
    for (const c of cards) {
      const t = c.querySelector('[data-design-title]')
      if (!t) {
        cardsWithoutMarkedTitle++
        continue
      }
      const cs = getComputedStyle(t)
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25
      const n = Math.max(1, Math.round(t.getBoundingClientRect().height / lh))
      titleLines[n] = (titleLines[n] ?? 0) + 1
    }
    // ── 접힘선(fold) ──
    // "한 화면에 들어오는가" 를 눈으로 판정하면 매번 다르게 읽는다. 더 중요한 건 **넘친
    // 픽셀 수가 아니라 무엇이 접혔는가** 다 — 본문이 길어서 스크롤하는 것은 정상이고,
    // 유일한 진입 링크가 접히는 것은 결함이다. 그래서 접힌 **인터랙티브 요소의 이름**까지 낸다.
    //
    // ⚠️ 다만 **이름을 전부 내면 그것도 못 읽는다** — 서가는 카드가 수십 장이라 82개가
    // 쏟아졌다. 계측이 읽히지 않으면 없는 것과 같으므로 개수는 정확히 세고 이름은 앞부분만
    // 낸다(무엇이 접혔는지 판단하는 데는 앞부분이면 충분하다).
    const vh = document.documentElement.clientHeight
    const docH = document.documentElement.scrollHeight
    const belowFold: string[] = []
    const main = document.querySelector('main') ?? document.body
    for (const el of Array.from(main.querySelectorAll<HTMLElement>('a[href], button'))) {
      const r = el.getBoundingClientRect()
      if (r.height === 0) continue // 숨은 요소
      if (r.top + window.scrollY >= vh) {
        const label = (el.getAttribute('aria-label') || el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40)
        if (label) belowFold.push(label)
      }
    }

    return {
      cardCount: cards.length,
      /** 첫 카드가 나오기까지 몇 화면 스크롤해야 하나 (카드 없으면 null) */
      firstCardRatio: firstCardTop == null ? null : Math.round((firstCardTop / vh) * 100) / 100,
      /** 문서 높이 / 뷰포트 높이 — 1.0 이하면 한 화면 */
      foldRatio: Math.round((docH / vh) * 100) / 100,
      /** 첫 화면 아래로 밀린 인터랙티브 요소 **수** */
      belowFoldCount: belowFold.length,
      /** 그중 앞 12개 이름 (개수만 보면 무엇이 접혔는지 모른다) */
      belowFold: belowFold.slice(0, 12),
      /** 구역별 카드 높이 — **각 구역 안에서 1종**이 목표다. */
      sections,
      /** 높이가 균질하지 않은 구역 수 — 이 값이 래칫의 눈금이다. */
      unevenSections: sections.filter((s) => s.heights.length > 1).length,
      /** 제목 줄 수 분포 — 흩어져 있으면 기준선이 어긋난다. */
      titleLines,
      /** 제목 표시가 없어 재지 않은 카드 수 — 0 이 아니면 그 화면의 제목 계측은 부분적이다 */
      cardsWithoutMarkedTitle,
      /** 문서 가로 넘침(px) — 모바일에서 0 이어야 한다. */
      overflowPx: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
      /**
       * 넘침을 **일으킨 요소**.
       *
       * 넘침 픽셀 수만 보고하면 어디를 고칠지는 눈으로 찾아야 한다 — 실제로 한 라운드를
       * 엉뚱한 컴포넌트를 고치는 데 썼다(2026-08-15: 막대 트랙을 고쳤는데 범인은 다른 곳).
       * 뷰포트 오른쪽 경계를 넘는 요소 중 **부모는 안 넘는 것**만 남긴다(자식이 밀어낸
       * 조상까지 전부 보고하면 목록이 수십 개가 되어 다시 못 읽는다).
       */
      /**
       * **지면 배분** — 최상위 블록이 세로 공간을 얼마나 가져가는가.
       *
       * 카드 균질성·넘침은 "각 블록이 잘 만들어졌나" 를 보지만, 진입면에서 더 자주 틀리는 것은
       * **무엇에 얼마를 줬나** 다. 가장 큰 자리를 가장 덜 중요한 것이 차지해도 스크린샷만
       * 봐서는 "꽉 차 보인다" 로 넘어간다. 라벨과 높이를 함께 찍어 두면 그 판단이 숫자가 된다.
       */
      blocks: (() => {
        // 구성 단위 = **이름 붙은 최상위 섹션**. 래퍼 `div` 를 세면 중첩 깊이에 따라
        // "블록 1개 100%" 같은 무의미한 값이 나온다(첫 시도가 그랬다).
        // 다른 `section[aria-label]` 안에 든 것은 하위 요소이므로 뺀다.
        const all = Array.from(document.querySelectorAll<HTMLElement>('main section[aria-label]'))
        const tops = all.filter((el) => !all.some((o) => o !== el && o.contains(el)))
        const vh = window.innerHeight || 1
        return tops
          .map((el) => ({
            label: el.getAttribute('aria-label') || el.tagName.toLowerCase(),
            px: el.offsetHeight,
            screens: Math.round((el.offsetHeight / vh) * 100) / 100,
          }))
          .filter((b) => b.px > 0)
      })(),
      /**
       * 지면 계측이 **페이지의 몇 %를 실제로 덮었는가**.
       *
       * ⚠️ 이 값이 없으면 계측은 조용히 거짓말한다. `blocks` 는 `section[aria-label]` 만 보는데,
       * 그 관례를 안 따르는 화면(`/wordvault` — 3.14화면인데 라벨 섹션은 368px 하나)에서는
       * **측정한 한 조각을 "100%" 로 인쇄**한다. 카드 0개를 "균질하다" 로 읽으면 안 된다는
       * 이 하네스의 기존 교훈과 정확히 같은 함정이다(실측 2026-08-17).
       *
       * 분모는 본문 높이다. 낮으면 그 화면의 배분은 **아직 못 잰 것**이지 잘 배분된 것이 아니다.
       */
      blockCoverage: (() => {
        const main = document.querySelector('main') as HTMLElement | null
        const total = main?.offsetHeight || document.body.offsetHeight || 0
        if (total <= 0) return 0
        const all = Array.from(document.querySelectorAll<HTMLElement>('main section[aria-label]'))
        const tops = all.filter((el) => !all.some((o) => o !== el && o.contains(el)))
        const covered = tops.reduce((s, el) => s + el.offsetHeight, 0)
        return Math.round((covered / total) * 100)
      })(),
      overflowCulprits: (() => {
        const limit = document.documentElement.clientWidth
        const out: { tag: string; cls: string; right: number; text: string }[] = []
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.right <= limit + 0.5) continue
          const p = el.parentElement
          if (p && p.getBoundingClientRect().right > limit + 0.5) continue // 조상은 결과일 뿐
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 120),
            right: Math.round(r.right),
            text: (el.textContent || '').trim().slice(0, 40),
          })
        }
        return out.slice(0, 6)
      })(),
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
    const metrics: Array<
      Awaited<ReturnType<typeof layoutMetrics>> & { route: string; vp: string; nocards?: string }
    > = []

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

        metrics.push({
          route: route.slug,
          vp: vp.name,
          nocards: route.nocards,
          ...(await layoutMetrics(page)),
        })
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
      // 같은 이유로 **줄 0개도 "균질" 이 아니라 "비교 불가"** 다 — 1열 모바일에서는 모든 줄이
      // 카드 1장이라 비교 대상이 없다. `0/0` 을 통과로 읽으면 검증했다고 착각한다.
      const verdict =
        m.cardCount === 0 && m.nocards
          ? `잴 카드 없음(선언) — ${m.nocards}`
          : m.cardCount === 0
            ? '⚠ 카드 0개 — 셀렉터가 이 화면의 카드를 못 잡는다(측정 안 됨)'
            : m.sections.length === 0
              ? '한 줄에 카드 2장 이상인 곳이 없음 — 균질성 비교 불가'
              : `불균질줄 ${m.unevenSections}/${m.sections.length} · ` +
                `줄 ${m.sections.map((s) => `${s.n}개:${s.heights.join(',')}`).join(' | ')}`
      // eslint-disable-next-line no-console
      console.log(
        `[metric] ${m.route}/${m.vp} 카드 ${m.cardCount} · ${verdict} · ` +
          `제목줄 ${JSON.stringify(m.titleLines)}${m.cardsWithoutMarkedTitle ? `(+${m.cardsWithoutMarkedTitle} 미표시)` : ''} · 넘침 ${m.overflowPx}px · ` +
          `높이 ${m.foldRatio}화면`
      )
      if (m.belowFoldCount > 0) {
        const more = m.belowFoldCount - m.belowFold.length
        // eslint-disable-next-line no-console
        console.log(
          `  [접힘] ${m.belowFoldCount}개: ${m.belowFold.join(' / ')}` +
            (more > 0 ? ` … 외 ${more}개` : '')
        )
      }
      // 덮은 비중이 낮으면 배분을 말할 수 없다 — 조각을 100% 로 읽는 것을 막는다.
      if (m.blockCoverage < 60) {
        // eslint-disable-next-line no-console
        console.log(
          `  [지면] ⚠ 본문의 ${m.blockCoverage}% 만 이름 붙은 섹션이다 — **배분 측정 안 됨**. ` +
            `구성 단위를 보려면 그 화면의 최상위 블록에 <section aria-label> 을 달 것`,
        )
      } else if (m.blocks.length > 0) {
        const total = m.blocks.reduce((s, b) => s + b.px, 0) || 1
        // eslint-disable-next-line no-console
        console.log(
          `  [지면] (본문 ${m.blockCoverage}% 덮음) ${m.blocks
            .map((b) => `${b.label} ${b.px}px(${Math.round((b.px / total) * 100)}%)`)
            .join(' · ')}`,
        )
      }
      for (const c of m.overflowCulprits) {
        // eslint-disable-next-line no-console
        console.log(`  [넘침] <${c.tag}> right=${c.right} "${c.text}" .${c.cls}`)
      }
    }
  })
})
