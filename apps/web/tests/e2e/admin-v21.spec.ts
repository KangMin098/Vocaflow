// apps/web/tests/e2e/admin-v21.spec.ts
import { test, expect, type Page } from '@playwright/test'
test.setTimeout(180000)
test.use({ storageState: process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE })

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 150000 })
  await expect(page.locator('[data-admin-ready=true]')).toBeVisible({ timeout: 30000 })
  expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname)
}
test('코퍼스·학습자·연구 기준의 하위 책임과 7개 영역을 보존한다', async ({ page }) => {
  await open(page, '/admin/topic-corpus')
  await expect(page.getByRole('navigation', { name: '관리자 업무 영역' }).locator('[aria-current=page]')).toHaveText('어휘·사전')
  await expect(page.getByRole('navigation', { name: '어휘·사전 화면' }).getByRole('link')).toHaveCount(4)
  await expect(page.getByRole('navigation', { name: '어휘·사전 화면' }).locator('[aria-current=page]')).toHaveText('관측·분류')
})
test('만화 제작본 탭과 query는 새로고침·뒤로 가기에서 복원된다', async ({ page }) => {
  await open(page, '/admin/comic?tab=published&trace=keep')
  await expect(page.getByRole('tab', { name: '제작본', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '모델', exact: true }).click()
  await expect(page).toHaveURL(/tab=models/)
  expect(new URL(page.url()).searchParams.get('trace')).toBe('keep')
  await page.goBack()
  await expect(page.getByRole('tab', { name: '제작본', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.reload()
  await expect(page.getByRole('tab', { name: '제작본', exact: true })).toHaveAttribute('aria-selected', 'true')
})
test('Compose의 URL 탭이 이전 세션 탭보다 우선하고 복귀한다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('vocaflow-compose-tab', '소스'))
  await open(page, '/admin/compose?tab=원장&trace=keep')
  const tabs = page.getByRole('navigation', { name: '단계', exact: true })
  await expect(tabs.locator('[aria-current=page]')).toContainText('원장')
  await tabs.getByRole('button', { name: /발행/ }).click()
  await expect(tabs.locator('[aria-current=page]')).toContainText('발행')
  expect(new URL(page.url()).searchParams.get('trace')).toBe('keep')
  await page.goBack()
  await expect(tabs.locator('[aria-current=page]')).toContainText('원장')
})
test('선택 권의 조판 범위와 집필 공유 재고를 구분한다', async ({ page }) => {
  await open(page, '/admin/csat/press?series=reading&band=4')
  await expect(page.getByText(/조회 범위: reading 4단계의 조판 기록/)).toBeVisible()
  await page.getByRole('navigation', { name: '제작 공정 작업' }).getByRole('link', { name: '문항·해설', exact: true }).click()
  await expect(page.getByText(/공장 전체 공유 재고이며 선택 기준으로 필터링되지 않습니다/)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('band')).toBe('4')
  // App Router can stream the shell with HTTP 200 before notFound renders.
  await page.goto('/admin/csat/press?series=unknown&band=4', { timeout: 120000 })
  await expect(page.getByText('Admin Console · 404', { exact: true })).toBeVisible()
})
test('작업 홈은 처리할 일과 최근 변경을 먼저 보여준다', async ({ page }) => {
  await open(page, '/admin')
  await expect(page.getByRole('heading', { name: '지금 처리할 일', exact: true })).toBeVisible()
  const inventory = page.getByText('영역별 현황·재고·운영 링크', { exact: true })
  await expect(inventory.locator('..')).not.toHaveAttribute('open')
  await expect(page.getByRole('heading', { name: '최근 파이프라인 변경', exact: true })).toBeVisible()
})
