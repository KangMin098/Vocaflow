// apps/web/tests/e2e/25-textbook-shelf.spec.ts
//
// 교재 서가 ↔ My Library **왕복** 회귀.
//
// ── 왜 이 spec 이 필요한가 ─────────────────────────────────────────────
// "담기" 는 DB 쓰기라, 화면 단언 없이는 **눌렀는데 아무 일도 안 일어나는 상태**를 알 수 없다.
// 이 저장소가 지배적 결함으로 못 박은 종류이고, 이 화면에서 이미 한 번 밟았다 —
// 서가의 "지금 펼치기" 가 `<span>` 이라 보이는데 눌리지 않았다(v06.337).
// 게다가 담기의 저장소(`user_textbook_selections`)는 **RLS 로 본인만** 읽을 수 있어서,
// 정책이 잘못되면 쓰기는 성공하고 조회만 0건이 된다 — 그러면 화면은 조용히 "담은 게 없어요" 다.
// 그래서 **쓰고 → 다른 화면에서 읽고 → 되돌린다**.
//
// ⚠️ 검증 계정의 담은 목록을 남기지 않는다. finally 에서 반드시 원복한다 —
//    남기면 다음 실행의 "0권 빈 상태" 단언이 영구히 깨진다.

import { test, expect, type Page } from '@playwright/test'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-textbook-shelf.json'

/** 고등 계단 — 재고가 가장 두꺼워 'ready' 가 확실한 자리(실측 V6 1,241문항). */
const STEP = 6

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
}

/**
 * 권 상세를 열고 **담기지 않은 상태로 되돌린다.**
 *
 * ⚠️ 서버 렌더된 버튼은 보이자마자 눌리지 않는다 — 하이드레이션 전에 클릭하면 아무 일도
 *    일어나지 않고, 테스트는 "빼기가 안 된다" 로 **엉뚱한 증상**을 보고한다(실측 2026-08-22).
 *    그래서 결과(= '담기' 라벨)가 나타날 때까지 재시도한다. 정리는 반드시 성공해야 한다 —
 *    남기면 다음 실행이 "담기 버튼이 없다" 로 실패한다.
 */
async function ensureUnpicked(page: Page, step: number) {
  await page.goto(`/library/textbooks/${step}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  const pick = page.getByRole('button', { name: /내 교재에 담기$/ })
  const unpick = page.getByRole('button', { name: /내 교재에서 빼기$/ })

  for (let attempt = 0; attempt < 4; attempt++) {
    if (await pick.isVisible().catch(() => false)) return
    if (await unpick.isVisible().catch(() => false)) {
      await unpick.click({ timeout: 10_000 }).catch(() => {})
      if (await pick.isVisible({ timeout: 5_000 }).catch(() => false)) return
    }
    await page.waitForTimeout(1_500)
  }
  await expect(pick, `step ${step} 정리 실패 — 다음 실행이 엉뚱한 증상으로 깨진다`).toBeVisible({
    timeout: 15_000,
  })
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  )
}

test.describe('교재 서가', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('세 축 필터가 실제로 목록을 줄이고, 되돌아갈 길이 있다', async ({ page }) => {
    test.setTimeout(120_000)
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200))
    })
    page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`))

    await page.goto('/library/textbooks', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const shelf = page.getByRole('region', { name: '교재 서가' })
    await expect(shelf).toBeVisible({ timeout: 30_000 })

    const volumes = shelf.locator('ol > li')
    const total = await volumes.count()
    expect(total, '서가에 권이 하나도 없다 — 재고 조회가 막혔거나 사다리가 비었다').toBeGreaterThan(0)

    // 축 칩 하나를 켠다. 어느 축이든 "전체보다 적어져야" 필터가 실제로 동작하는 것이다.
    const firstChip = page.getByRole('button', { name: /^학령 / }).first()
    await expect(firstChip).toBeVisible()
    await firstChip.click()
    await expect(firstChip).toHaveAttribute('aria-pressed', 'true')

    const filtered = await volumes.count()
    expect(filtered, '칩을 켰는데 목록이 그대로다 — 필터가 표시만 하고 있다').toBeLessThan(total)

    // ⚠️ 되돌아갈 길 — 이게 없으면 조건을 걸어 0건이 된 학습자는 막힌다.
    const reset = page.getByRole('button', { name: /조건 \d+개 해제/ })
    await expect(reset).toBeVisible()
    await reset.click()
    await expect(volumes).toHaveCount(total)

    expect(fatalErrors(errors), `콘솔 에러: ${fatalErrors(errors).join(' | ')}`).toEqual([])
  })

  test('담으면 My Library 교재 면에 나타난다 (쓰기 → 다른 화면에서 읽기 → 원복)', async ({
    page,
  }) => {
    test.setTimeout(150_000)

    // 앞선 실행이 남긴 상태를 먼저 치운다 — 시작 상태를 보장하지 않으면
    // "담기 버튼이 없다"(사실은 이미 담겨 있어 '빼기' 다)로 엉뚱한 증상을 보고한다.
    await ensureUnpicked(page, STEP)

    const pick = page.getByRole('button', { name: /내 교재에 담기$/ })
    await expect(
      pick,
      '담기 버튼이 없다 — 저장소를 못 읽었거나(마이그레이션 미적용) 배선이 끊겼다',
    ).toBeVisible({ timeout: 30_000 })

    // 권 제목은 서가(SERIES_SPINE)가 소유한다 — 여기서 짓지 않고 화면에서 읽어 온다.
    const title = (await page.locator('h1').first().innerText()).trim()
    expect(title.length).toBeGreaterThan(0)

    try {
      await pick.click()
      // 낙관적 갱신을 하지 않으므로, 라벨이 바뀌었다 = **서버가 확인해 줬다**.
      await expect(page.getByRole('button', { name: /내 교재에서 빼기$/ })).toBeVisible({
        timeout: 20_000,
      })

      // 다른 화면에서 읽는다 — 쓰기는 성공하고 조회만 0건이 되는 RLS 사고를 잡는 유일한 방법.
      await page.goto('/text?view=textbooks', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      const mine = page.getByRole('region', { name: '내 교재' })
      await expect(mine).toBeVisible({ timeout: 30_000 })
      // ⚠️ `getByText` 로 느슨하게 잡으면 같은 제목이 링크·담기 버튼 이름에 함께 들어 있어
      //    여러 요소가 걸린다(strict mode 위반). 여는 링크 하나로 좁힌다 —
      //    "목록에 있다" 가 아니라 **"거기서 열 수 있다"** 가 이 면의 계약이다.
      await expect(mine.getByRole('link', { name: title })).toBeVisible({ timeout: 20_000 })

      // 못 읽었을 때의 문장이 떠 있으면 안 된다 — 그건 담긴 것을 못 본 것이다.
      await expect(mine.getByText('확인하지 못했어요')).toHaveCount(0)
      await expect(mine.getByText('아직 담은 교재가 없어요')).toHaveCount(0)
    } finally {
      // ⚠️ 반드시 원복 — 남기면 다음 실행의 빈 상태 단언이 영구히 깨진다.
      await ensureUnpicked(page, STEP)
    }
  })

  test('권 상세가 앞뒤 권을 말한다 — 안 맞을 때 서가로 되돌려보내지 않는다', async ({ page }) => {
    test.setTimeout(120_000)

    // 가운데 권 — 양쪽이 다 있다.
    await page.goto(`/library/textbooks/${STEP}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const ladder = page.getByRole('region', { name: '계단 안내' })
    await expect(ladder).toBeVisible({ timeout: 30_000 })
    await expect(ladder.getByText('어렵다면 한 계단 아래')).toBeVisible()
    await expect(ladder.getByText('쉽다면 한 계단 위')).toBeVisible()

    // 한 계단 위로 실제로 갈 수 있어야 한다 — 보이는데 안 눌리는 것이 이 화면의 첫 결함이었다.
    await ladder.getByRole('link').last().click()
    await page.waitForURL(
      (u) =>
        u.pathname.startsWith('/library/textbooks/') &&
        u.pathname.split('/').pop() !== String(STEP),
      { timeout: 20_000 },
    )
    expect(Number(page.url().split('/').pop())).toBeGreaterThan(STEP)

    // 끝 계단 — 빈 칸이 아니라 이유를 적는다.
    await page.goto('/library/textbooks/1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByText('시리즈의 첫 권이에요')).toBeVisible({ timeout: 30_000 })
  })

  test('매대가 초등·중등·고등 세 칸으로 갈린다 (평평한 일곱 줄이 아니다)', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/library/textbooks', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // 시중 교재 코너의 1차 분류. 이게 없으면 고1 학습자가 초등 두 권을 지나쳐야 자기 자리에 닿는다.
    for (const name of ['초등 매대', '중등 매대', '고등 매대']) {
      await expect(page.getByRole('region', { name }), `${name}가 없다`).toBeVisible({
        timeout: 30_000,
      })
    }

    // 필터로 한 매대만 남기면 나머지 팻말은 사라져야 한다 — 빈 칸에 팻말을 세우지 않는다.
    await page.getByRole('button', { name: /^학령 초등 저학년/ }).click()
    await expect(page.getByRole('region', { name: '초등 매대' })).toBeVisible()
    await expect(page.getByRole('region', { name: '고등 매대' })).toHaveCount(0)
  })
})

/**
 * 모바일에서 교재로 가는 길.
 *
 * ⚠️ 데스크톱 사이드바는 `hidden md:flex` 다. 모바일 학습자에게 남는 통로는 **하단 탭 →
 *    Library → 가로 탭줄** 하나뿐이고, 그 탭줄에서 `Textbooks` 는 **네 번째**다.
 *    390px 에서 네 번째 탭은 화면 밖으로 밀린다 — 스크롤은 되지만 **더 있다는 표시가 없어서**
 *    학습자에게는 존재하지 않는 것과 같다(실측 2026-08-22: 오른쪽 끝 485px / 뷰포트 390px).
 *
 * 여기서 재는 것은 "DOM 에 있는가" 가 아니라 **"눈에 보이는가"** 다 —
 * 이 저장소가 죽은 버튼과 같은 부류로 취급하는 결함이 정확히 그 차이에서 생긴다.
 */
test.describe('모바일에서 교재로 가는 길', () => {
  test.use({ storageState: STATE_PATH, viewport: { width: 390, height: 844 } })

  /** 요소가 뷰포트 안에 **실제로 몇 px 보이는가**. 0 이면 DOM 에 있어도 없는 것이다. */
  async function visibleWidth(page: Page, locator: ReturnType<Page['locator']>) {
    const box = await locator.boundingBox()
    if (!box) return 0
    const vw = page.viewportSize()?.width ?? 0
    return Math.max(0, Math.min(box.x + box.width, vw) - Math.max(box.x, 0))
  }

  test('공용 서가 탭줄에서 Textbooks 가 눈에 보인다', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const strip = page.getByRole('tablist', { name: '라이브러리 탭' })
    await expect(strip).toBeVisible({ timeout: 30_000 })

    const tab = strip.getByRole('tab', { name: /Textbooks/ })
    await expect(tab, 'Textbooks 탭이 탭줄에 없다').toHaveCount(1)

    const shown = await visibleWidth(page, tab)
    expect(
      shown,
      `Textbooks 탭이 화면 밖이다(보이는 폭 ${Math.round(shown)}px) — 모바일에서 교재로 갈 길이 없다`,
    ).toBeGreaterThan(44)
  })

  test('탭줄이 더 있다는 것을 알린다 — 스크롤되는지 모르면 없는 것과 같다', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/library/books', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const strip = page.getByRole('tablist', { name: '라이브러리 탭' })
    await expect(strip).toBeVisible({ timeout: 30_000 })

    const overflows = await strip.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    if (!overflows) return // 다 들어가면 알릴 것도 없다

    // 넘칠 때는 가장자리 표시가 있어야 한다 — 손가락을 대 볼 이유를 주는 것.
    const hasAffordance = await strip.evaluate((el) => el.hasAttribute('data-scroll-hint'))
    expect(hasAffordance, '탭줄이 넘치는데 더 있다는 표시가 없다').toBe(true)
  })

  test('My Library 탭줄에서도 Textbooks 가 눈에 보인다', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/text?view=books', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const strip = page.getByRole('tablist', { name: '내 라이브러리 탭' })
    await expect(strip).toBeVisible({ timeout: 30_000 })

    const tab = strip.getByRole('tab', { name: /Textbooks/ })
    await expect(tab, 'Textbooks 탭이 탭줄에 없다').toHaveCount(1)

    const shown = await visibleWidth(page, tab)
    expect(
      shown,
      `Textbooks 탭이 화면 밖이다(보이는 폭 ${Math.round(shown)}px)`,
    ).toBeGreaterThan(44)
  })
})
