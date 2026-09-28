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

async function removeAll(page: import('@playwright/test').Page, name: string) {
  for (let i = 0; i < 5 && (await page.getByTestId('ws-card').filter({ hasText: name }).count()) > 0; i++) {
    await page.getByTestId('ws-card').filter({ hasText: name }).first().getByRole('link').click()
    await page.getByTestId('ws-edit').click()
    await page.getByTestId('ws-delete').click()
    await page.getByTestId('ws-delete-confirm').click()
    await expect(page).toHaveURL(/\/csat$/, { timeout: 60000 })
    await expect(page.getByTestId('ws-table')).not.toContainText('기록을 읽는 중', { timeout: 60000 })
  }
}

test('Workspace — 메인 목록 → 만들기 팝업 → 안 → 설정 팝업(이름 · 담을 것 · 지우기) · 레일은 곧바로 이동', async ({ page }, info) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1440, height: 1000 })

  // 메인 = Workspace 목록
  await page.goto('/csat')
  await expect(page.getByTestId('ws-table')).toBeVisible({ timeout: 120000 })
  await expect(page.getByTestId('ws-table')).not.toContainText('기록을 읽는 중', { timeout: 60000 })
  await removeAll(page, 'E2E 킬러 2026')

  // 레일 — 팝업 없이 곧바로 이동한다
  await page.getByTestId('rail-types').click()
  await expect(page).toHaveURL(/tab=type/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByTestId('rail-home').click()
  await expect(page.getByTestId('ws-table')).toBeVisible({ timeout: 60000 })

  // 만들기 팝업 — 고르기 상자 + 토큰
  await page.getByTestId('ws-new').click()
  const dialog = page.getByRole('dialog', { name: '새 Workspace' })
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('ws-starter').selectOption('killer')
  const preview = dialog.getByTestId('ws-preview')
  const count = async () => Number((await preview.locator('b').first().textContent()) ?? '0')
  const before = await count()
  expect(before).toBeGreaterThan(0)
  // 회차를 더하면 「그리고」 라 줄어든다(합집합이 아니다)
  await dialog.getByTestId('ws-add-exams').selectOption('2026')
  const after = await count()
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThan(before)
  await dialog.locator('#ws-name').fill('E2E 킬러 2026')
  await page.screenshot({ path: info.outputPath('01-create.png') })

  await dialog.getByTestId('ws-create').click()
  await expect(page).toHaveURL(/\/csat\/workspace\/ws-/, { timeout: 60000 })
  await expect(page.getByRole('heading', { name: 'E2E 킬러 2026' })).toBeVisible({ timeout: 60000 })
  await expect(page.getByTestId('ws-next')).toHaveAttribute('href', /\/csat\/item\//)
  await page.screenshot({ path: info.outputPath('02-detail.png') })
  await page.getByTestId('ws-edit').click()
  await expect(page.getByRole('dialog', { name: 'Workspace 설정' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('03-settings.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(300) // 팝업이 닫히며 쌓아 둔 히스토리 항목을 되감는 동안 이동하지 않는다

  // 메인 목록 한 줄 · 레일 이름
  await page.goto('/csat')
  await expect(page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' })).toBeVisible({ timeout: 120000 })
  await expect(page.getByTestId('csat-rail').getByRole('link', { name: 'E2E 킬러 2026' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('04-home.png') })

  // 지우기 — 설정 팝업 안에서 두 번 눌러 확인
  await removeAll(page, 'E2E 킬러 2026')
  await expect(page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' })).toHaveCount(0)
})
