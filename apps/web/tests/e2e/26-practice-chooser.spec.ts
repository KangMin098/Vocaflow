// apps/web/tests/e2e/26-practice-chooser.spec.ts
//
// `/practice` 통합 화면 — **통폐합이 실제로 무엇을 흡수했는지** 를 잠근다.
//
// 배경: 사이드바 PRACTICE 그룹 5형제(Flashcard·WordBlitz·PairFlip·SpellForge·Game Lab)를
// `/practice` + `Game Lab` 둘로 접었다. 통폐합은 화면 수를 줄이는 순간이 아니라 **흡수한
// 것을 잃지 않았는지** 로 판정된다. 영향도 전수 검사에서 실제로 두 가지가 새고 있었다:
//   · `/practice` 에서 연 게임이 종료 시 `/arcade` 로 튕겼다 (`from` 미첨부)
//   · `/practice/dcp`(Syntax) 는 이 화면의 **하위 라우트**인데 화면이 언급조차 안 했다
//     — 진입 경로가 허브 처방 하나뿐이었다
// 둘 다 화면은 멀쩡히 뜨는 결함이라 눈으로는 안 잡힌다. 그래서 스펙으로 잠근다.
//
// ⚠️ 검증 계정 전제: 252단어 · stage S3(DCP 활성). 다른 계정이면 ④ 는 건너뛴다.

import { test, expect, type Page } from '@playwright/test'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-practice-chooser.json'

/** 여섯 면 — `lib/framework/axes.ts` 의 `FACETS[].name` 과 같은 문자열이어야 한다. */
const FACET_NAMES = ['Recognize', 'Spell', 'Sound', 'Build', 'Use', 'Fluency']

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test.describe('연습 통합 화면 — /practice', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test.beforeEach(async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'networkidle' })
    expect(page.url()).not.toContain('/login')
    // 면 요약은 클라이언트 fetch 라 첫 페인트 뒤에 온다
    await page.waitForTimeout(900)
  })

  test('① 여섯 면이 모두 화면에 있다 (일부만 파는 화면으로 되돌아가지 않는다)', async ({
    page,
  }) => {
    // v1 은 도구가 있는 세 면(Recognize·Spell·Fluency)만 보여주고 나머지 셋에는
    // "아직 전용 연습이 없어요" 라고 **틀린 말**을 했다 — Game Lab 에 있었다.
    const body = await page.locator('main, body').first().innerText()
    for (const name of FACET_NAMES) {
      expect(body, `${name} 면이 없다`).toContain(name)
    }
  })

  test('② 게임이 면 안에서 팔린다 — 그리고 링크가 연습으로 돌아온다', async ({ page }) => {
    const gameLinks = page.locator('a[href^="/play/"]')
    const n = await gameLinks.count()
    expect(n, '면 카드에 게임이 하나도 없다 — 매핑이 끊겼다').toBeGreaterThan(0)

    // `from` 이 없으면 게임 종료가 `/arcade` 로 튕겨 통합 화면이 자기가 연 문 뒤를 잃는다
    for (let i = 0; i < n; i++) {
      const href = await gameLinks.nth(i).getAttribute('href')
      expect(href, `${href} 에 from 이 없다`).toContain('from=%2Fpractice')
    }
  })

  test('③ Game Lab 전체 진입이 남아 있다 (발견 경로가 사이드바 하나로 줄지 않는다)', async ({
    page,
  }) => {
    // 예전 `/hub` 의 ArcadeEntryCard 를 없앤 뒤 Game Lab 통로가 사이드바 한 곳뿐이었다.
    // 사이드바에도 같은 링크가 있으므로 **본문 안**에서 찾는다 — 사이드바만으로는 이 계약이
    // 지켜진 게 아니다(그게 결함의 내용이었다).
    const link = page.locator('main a[href="/arcade"]')
    await expect(link).toHaveCount(1)
    // 조용하되 44px 미만이면 안 된다(프로젝트 절대 규칙)
    const box = await link.boundingBox()
    expect(box!.height, 'Game Lab 링크 터치 타겟').toBeGreaterThanOrEqual(44)

    // ⚠️ **첫 화면 안에 있어야 한다.** 맨 아래에 뒀을 때 desktop 1.31화면 · mobile 1.79화면이라
    // 양쪽 다 접힘선 아래로 밀렸다 — 발견성을 되살리려던 링크가 스크롤해야만 보였다.
    // "있다" 와 "보인다" 는 다르고, 이 계약이 지키려는 건 후자다.
    const vh = page.viewportSize()!.height
    expect(box!.y, 'Game Lab 링크가 접힘선 아래').toBeLessThan(vh)
  })

  test('④ Syntax(DCP)가 활성일 때 이 화면에서 갈 수 있다', async ({ page }) => {
    const dcp = page.locator('a[href="/practice/dcp"], :text("Syntax")')
    const visible = (await dcp.count()) > 0
    test.skip(!visible, 'DCP 비활성 계정 — stage 게이트')
    // 활성이면 링크가 있어야 한다. 잠긴 날 링크를 파는 것도 결함이므로 반대 방향은 잠그지 않는다.
    await expect(page.locator('a[href="/practice/dcp"]')).toHaveCount(1)
  })

  test('⑤ 흡수한 4모듈로 가는 길이 살아 있다 (딥링크 소실 금지)', async ({ page }) => {
    // 통폐합의 실패 형태는 "화면은 줄었는데 갈 데가 없어진 것" 이다
    for (const href of ['/flashcard', '/pairflip', '/spellforge', '/wordblitz']) {
      await expect(page.locator(`a[href="${href}"]`).first(), `${href} 진입 없음`).toBeVisible()
    }
  })
})
