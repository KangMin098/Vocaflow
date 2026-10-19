// apps/web/tests/e2e/admin-restructure.spec.ts
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.setTimeout(150000)
if (process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE)
  test.use({ storageState: process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE })
async function openAdmin(page: Page, path: string) {
  await page.goto(path, { timeout: 120000, waitUntil: 'domcontentloaded' })
  if (new URL(page.url()).pathname === '/login') {
    const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
    if (!password) throw new Error('관리자 검증 계정 또는 인증 상태가 필요합니다.')
    await page
      .getByLabel(/이메일/)
      .fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
    await page.locator('input[type=password]').fill(password)
    await page.getByRole('button', { name: /^로그인/ }).click()
    await page.waitForURL((url) => url.pathname !== '/login', {
      timeout: 90000,
      waitUntil: 'domcontentloaded',
    })
    await page.goto(path, { timeout: 120000, waitUntil: 'domcontentloaded' })
  }
  const requested = new URL(path, 'http://localhost').pathname
  const target =
    requested === '/admin/library'
      ? '/admin/curation'
      : requested === '/admin/csat/explain'
        ? '/admin/csat/authoring'
        : ['/admin/billing', '/admin/reports'].includes(requested)
          ? '/admin/settings'
          : requested
  await page.waitForURL((url) => url.pathname === target, {
    timeout: 120000,
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('[data-admin-ready=true]')).toBeVisible({ timeout: 30000 })
  if (target === '/admin/curation')
    await expect(page.locator('[data-curation-ready=true]')).toBeVisible({ timeout: 30000 })
}
function rail(page: Page) {
  return page.getByRole('navigation', { name: '관리자 업무 영역', exact: true })
}

test('이전 도서 관문은 검색·선택값을 보존하며 실제 목록으로 연결한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAdmin(page, '/admin/library?q=fish&status=published')
  await expect(page).toHaveURL(/\/admin\/curation\?.*view=library/)
  await expect(page.getByRole('textbox', { name: /검색/ })).toHaveValue('fish')
  await expect(rail(page).getByRole('link')).toHaveCount(7)
  await expect(rail(page).locator('[aria-current=page]')).toHaveText('콘텐츠')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})

test('소스별 수집 입력을 선택하고 검색 조건을 유지한 채 목록으로 돌아온다', async ({ page }) => {
  await openAdmin(page, '/admin/curation?view=collect&method=sources&q=fish')
  for (const method of [
    'sources',
    'bulk',
    'seed',
    'id',
    'wikibooks',
    'wikisource',
    'openstax',
    'storyweaver',
  ]) {
    await page.getByLabel('수집 방식', { exact: true }).selectOption(method)
    await expect(page.getByLabel('수집 방식', { exact: true })).toHaveValue(method)
    await expect(page).toHaveURL(new RegExp(`method=${method}`))
    await expect(page.getByLabel('도서 수집', { exact: true })).toBeVisible()
  }
  await page
    .getByRole('navigation', { name: '도서 작업', exact: true })
    .getByRole('button', { name: '도서 목록', exact: true })
    .click()
  await expect(page.getByRole('textbox', { name: /검색/ })).toHaveValue('fish')
  await page.goBack()
  await expect(page.getByLabel('수집 방식', { exact: true })).toBeVisible()
})

test('검토 대기에서 도서 목록으로 나가면 전용 필터와 상세 위치를 초기화한다', async ({ page }) => {
  await openAdmin(page, '/admin/curation?view=review&status=ready&page=4&selected=missing')
  await page
    .getByRole('navigation', { name: '도서 작업', exact: true })
    .getByRole('button', { name: '도서 목록', exact: true })
    .click()
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('view') === 'library' &&
      !['status', 'page', 'selected'].some((key) => url.searchParams.has(key))
  )
  await expect(page.getByRole('table').first()).toBeVisible()
})

test('페이지 이동과 새로고침 뒤에도 도서 목록 위치를 유지한다', async ({ page }) => {
  await openAdmin(page, '/admin/curation?view=library&status=all')
  const table = page.getByRole('table').first()
  await expect(table).toBeVisible()
  const count = await table.locator('tbody tr').count()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(25)
  const title = table.locator('tbody tr').first().getByRole('button').first()
  const first = await title.innerText()
  await page
    .getByRole('navigation', { name: '도서 목록 페이지' })
    .getByRole('button', { name: '다음', exact: true })
    .click()
  await expect(page).toHaveURL(/page=2/)
  await expect(title).not.toHaveText(first)
  const second = await title.innerText()
  await page.reload()
  await expect(page.locator('[data-curation-ready=true]')).toBeVisible({ timeout: 30000 })
  await expect(title).toHaveText(second)
})

test('옛 해설 경로가 제작 기준을 보존한 문항·해설 작업면으로 연결된다', async ({ page }) => {
  await openAdmin(page, '/admin/csat/explain?series=reading&band=4')
  await expect(page).toHaveURL(/\/admin\/csat\/authoring\?/)
  expect(new URL(page.url()).searchParams.get('view')).toBe('explanation')
  expect(new URL(page.url()).searchParams.get('band')).toBe('4')
  const writing = page.getByRole('navigation', { name: '문항·해설 작업', exact: true })
  await expect(writing.getByRole('link', { name: '해설 작성·검토', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await writing.getByRole('link', { name: '문항 제작', exact: true }).click()
  await page.waitForURL(/view=items/, { timeout: 60000 })
  await expect(page).toHaveURL(/view=items/)
  expect(new URL(page.url()).searchParams.get('series')).toBe('reading')
  await expect(page.getByText(/공장 전체 공유 재고이며 선택 기준으로 필터링되지 않습니다/)).toBeVisible()
})

test('진단·연구의 제목과 복귀 경로는 교재 제작과 구분된다', async ({ page }) => {
  for (const [path, section, title] of [
    ['/admin/csat/diagnosis', '학습자·진단', '진단 운영'],
    ['/admin/csat/strategy', '연구·기준', '설계·검증'],
    ['/admin/csat/blueprint', '연구·기준', '설계·검증'],
  ]) {
    await openAdmin(page, path!)
    await expect(rail(page).locator('[aria-current=page]')).toHaveText(section!)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!)
  }
})

test('미연결 신고·결제 경로는 하나의 상태 화면에서 확인하며 실행을 가장하지 않는다', async ({
  page,
}) => {
  for (const [path, anchor] of [
    ['/admin/reports', 'reports'],
    ['/admin/billing', 'billing'],
  ]) {
    await openAdmin(page, path!)
    await expect(page).toHaveURL(new RegExp(`/admin/settings#${anchor}`))
    await expect(page.getByRole('heading', { name: '연결·지원 상태', exact: true })).toBeVisible()
    await expect(page.getByRole('switch')).toHaveCount(0)
    await expect(rail(page).locator('[aria-current=page]')).toHaveText('운영·시스템')
  }
})

for (const width of [1440, 1280])
  for (const theme of ['light', 'dark']) {
    test(`PC ${width} ${theme}: 메뉴·프레임·접근성`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('vocaflow-theme', value), theme)
      await openAdmin(page, '/admin/settings')
      await expect(rail(page).getByRole('link')).toHaveCount(7)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      const problems = await new AxeBuilder({ page })
        .include('[aria-label="관리자 업무 영역"]')
        .analyze()
      expect(problems.violations).toEqual([])
      const link = rail(page).getByRole('link', { name: '어휘·사전', exact: true })
      await link.focus()
      await expect(link).toBeFocused()
      await page.screenshot({
        path: testInfo.outputPath(`admin-${width}-${theme}.png`),
        fullPage: false,
      })
    })
  }
