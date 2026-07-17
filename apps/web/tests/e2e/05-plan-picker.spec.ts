// apps/web/tests/e2e/05-plan-picker.spec.ts
// /plan 자료 고르기 picker 회귀 — 4탭 전환 + 소스별 분류 네비 + 다건 선택 구조가
//   콘솔 에러 없이 렌더되는지 확인. (v06.146~160 picker 전면 재설계 회귀 자산)
//   - 계정: runtime-test-0705@vocaflow.dev (04-ui-smoke 와 동일 RUNTIME_USER)
//   - article/word_set 자료는 전역 published 라 어느 계정에서도 노출됨
import { test, expect, type Page } from '@playwright/test'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'test-results/.auth-plan-picker.json'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
}

/** auth 토큰 경합·favicon·콜드컴파일 청크는 앱 결함이 아니므로 제외 */
function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  )
}

test.describe('/plan picker 회귀', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('4탭 전환 + 소스별 분류 네비가 콘솔 에러 없이 렌더된다', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200))
    })
    page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`))

    await page.goto('/plan', { waitUntil: 'domcontentloaded' })

    // 4개 자료 유형 탭 노출 ("내 스크립트" 와 구분 위해 앵커 정규식)
    for (const re of [/^도서/, /^스크립트/, /^공용단어장/, /^내 스크립트/]) {
      await expect(page.getByRole('tab', { name: re })).toBeVisible({ timeout: 15_000 })
    }

    // 스크립트(article) 탭 — 소스 네비(VOA) + 우측 다건 선택 안내
    //   (VOA 는 소스 레일 + 컨텐츠 행 부제에도 나오므로 소스 네비로 범위 한정)
    await page.getByRole('tab', { name: /^스크립트/ }).click()
    await expect(
      page.getByRole('navigation', { name: '소스' }).getByRole('button', { name: /VOA/ }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/담을 자료를 여러 개/)).toBeVisible()

    // 공용단어장 탭 — 카테고리 네비(도서 챕터 등)
    await page.getByRole('tab', { name: /^공용단어장/ }).click()
    await expect(
      page.getByRole('navigation', { name: '카테고리' }).getByRole('button').first(),
    ).toBeVisible({ timeout: 10_000 })

    // 도서 탭 — 표준 분류 레일(전체 버튼) 렌더
    await page.getByRole('tab', { name: /^도서/ }).click()
    await expect(
      page.getByRole('navigation', { name: '분류' }).getByRole('button', { name: /^전체/ }),
    ).toBeVisible({ timeout: 10_000 })

    // 에러 바운더리 미노출 + 콘솔 에러 0
    await expect(page.getByText(/페이지를 찾을 수 없어요|문제가 발생|problem occurred/)).toHaveCount(0)
    const fatal = fatalErrors(errors)
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0)
  })
})
