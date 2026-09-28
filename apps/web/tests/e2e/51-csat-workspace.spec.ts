// apps/web/tests/e2e/51-csat-workspace.spec.ts
//
// 학습 Workspace — 만들기(가이드 · 실제 포함 문항) → 안(다음 3문항 · 진행 · 약점) → 메인 카드 → 지우기.
// 검증 계정을 여러 세션이 같이 쓰므로 **만든 것은 끝에 지운다**(묘비로 남아 다른 기기에서도 되살아나지 않는다).
import { expect, test } from '@playwright/test'

// 로그인은 파일당 1회(04-ui-smoke 와 같은 계정 · 같은 방식) — 저장된 옛 세션 파일은 만료돼 있을 수 있다
const STATE = 'playwright-auth/.auth-csat-workspace.json'
const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? '',
}

test.beforeAll(async ({ browser }) => {
  test.skip(!USER.password, 'PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local (CI: 저장소 시크릿)')
  const page = await browser.newPage({ storageState: undefined })
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await page.fill('input[type="email"]', USER.email)
    await page.fill('input[type="password"]', USER.password)
    await page.click('button[type="submit"]')
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 })
      break
    } catch (e) {
      if (attempt === 2) throw e
    }
  }
  await page.context().storageState({ path: STATE })
  await page.close()
})
test.use({ storageState: STATE })

test('Workspace 만들기 → 안 → 메인 카드 → 지우기', async ({ page }, info) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.goto('/csat/workspace/new')
  await expect(page.getByTestId('csat-workspace')).toBeVisible({ timeout: 120000 })
  await page.locator('[data-starter="killer"]').click()

  // 가이드가 킬러 유형을 미리 채웠고, 실제 포함 문항이 보인다
  const preview = page.getByTestId('ws-preview')
  await expect(preview).toContainText('실제 포함 문항')
  const count = async () => Number((await preview.locator('b').first().textContent()) ?? '0')
  const before = await count()
  expect(before).toBeGreaterThan(0)

  // 회차를 하나 더 고르면 「그리고」 라 줄어든다(합집합이 아니다)
  await page.getByRole('group', { name: '출발점' }).waitFor()
  const examChip = page.locator('section').filter({ hasText: '3. 담을 것' }).getByRole('button', { name: /2026학년도 수능/ }).first()
  await examChip.click()
  const after = await count()
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThan(before)

  await page.locator('#ws-goal').fill('빈칸 · 순서 · 삽입에서 근거 문장을 먼저 찾는다')
  await page.locator('#ws-name').fill('E2E 킬러 2026')
  await page.screenshot({ path: info.outputPath('01-create.png'), fullPage: true })

  await page.getByTestId('ws-create').click()
  await expect(page).toHaveURL(/\/csat\/workspace\/ws-/, { timeout: 60000 })
  await expect(page.getByRole('heading', { name: 'E2E 킬러 2026' })).toBeVisible({ timeout: 60000 })
  await expect(page.getByTestId('ws-next')).toHaveAttribute('href', /\/csat\/item\//)
  await expect(page.getByText('연 문항 (기존 학습 기록 포함)')).toBeVisible()
  await page.screenshot({ path: info.outputPath('02-detail.png'), fullPage: true })

  // 메인에 카드가 뜬다 — 기존 유형 · 함정 표도 그대로
  await page.goto('/csat')
  await expect(page.getByTestId('home-workspaces')).toBeVisible({ timeout: 120000 })
  await expect(page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: '보는 것' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('03-home.png'), fullPage: false })

  // 지우기(확인 단계를 거친다)
  await page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' }).getByRole('link', { name: 'E2E 킬러 2026' }).click()
  await page.getByRole('button', { name: '지우기', exact: true }).click()
  await page.getByTestId('ws-delete-confirm').click()
  await expect(page).toHaveURL(/\/csat\/workspace$/, { timeout: 60000 })
  await expect(page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' })).toHaveCount(0)
})
