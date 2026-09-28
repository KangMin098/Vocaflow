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

test('Workspace — 탭 → 만들기 팝업 → 안 → 표 한 줄 → 지우기 팝업 · 레일 팝업', async ({ page }, info) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1440, height: 1000 })

  // 레일: 유형 26 · 회차 29 줄이 펴져 있지 않고, 목록은 팝업으로 연다
  await page.goto('/csat?tab=workspace')
  await expect(page.getByTestId('ws-table')).toBeVisible({ timeout: 120000 })
  // 앞선 실패가 남긴 것부터 지운다(공유 계정 — 같은 이름이 둘이면 끝의 「0개」 단언이 흔들린다)
  await expect(page.getByTestId('ws-table')).not.toContainText('기록을 읽는 중', { timeout: 60000 })
  for (let i = 0; i < 5 && (await page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' }).count()) > 0; i++) {
    await page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' }).first().getByRole('link').click()
    await page.getByRole('button', { name: '지우기', exact: true }).click()
    await page.getByTestId('ws-delete-confirm').click()
    await expect(page).toHaveURL(/\/csat\?tab=workspace/, { timeout: 60000 })
    await expect(page.getByTestId('ws-table')).not.toContainText('기록을 읽는 중', { timeout: 60000 })
  }
  await page.getByTestId('rail-type').click()
  await expect(page.getByRole('dialog', { name: '유형별' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('00-rail-popup.png') })
  await page.keyboard.press('Escape')

  // 만들기 팝업
  await page.getByTestId('ws-new').click()
  const dialog = page.getByRole('dialog', { name: '새 Workspace' })
  await expect(dialog).toBeVisible()
  await dialog.locator('[data-starter="killer"]').click()
  const preview = dialog.getByTestId('ws-preview')
  const count = async () => Number((await preview.locator('b').first().textContent()) ?? '0')
  const before = await count()
  expect(before).toBeGreaterThan(0)
  // 회차를 더 고르면 「그리고」 라 줄어든다(합집합이 아니다)
  await dialog.locator('summary', { hasText: '담을 것' }).click()
  await dialog.getByRole('button', { name: /2026학년도 수능/ }).first().click()
  const after = await count()
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThan(before)
  await dialog.locator('#ws-goal').fill('빈칸 · 순서 · 삽입에서 근거 문장을 먼저 찾는다')
  await dialog.locator('#ws-name').fill('E2E 킬러 2026')
  await page.screenshot({ path: info.outputPath('01-create.png') })

  await dialog.getByTestId('ws-create').click()
  await expect(page).toHaveURL(/\/csat\/workspace\/ws-/, { timeout: 60000 })
  await expect(page.getByRole('heading', { name: 'E2E 킬러 2026' })).toBeVisible({ timeout: 60000 })
  await expect(page.getByTestId('ws-next')).toHaveAttribute('href', /\/csat\/item\//)
  await expect(page.getByText('연 문항 · 기존 학습 포함')).toBeVisible()
  await page.getByTestId('ws-edit').click()
  await expect(page.getByRole('dialog', { name: '담은 것 고치기' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: info.outputPath('02-detail.png') })

  // 메인 Workspace 탭에 한 줄 — 레일에도 이름이 뜬다
  await page.goto('/csat?tab=workspace')
  await expect(page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' })).toBeVisible({ timeout: 120000 })
  await expect(page.getByTestId('csat-rail').getByRole('link', { name: 'E2E 킬러 2026' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('03-home.png') })

  // 지우기 — 확인 팝업을 거친다
  await page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' }).getByRole('link', { name: 'E2E 킬러 2026' }).click()
  await page.getByRole('button', { name: '지우기', exact: true }).click()
  await page.getByTestId('ws-delete-confirm').click()
  await expect(page).toHaveURL(/\/csat\?tab=workspace/, { timeout: 60000 })
  await expect(page.getByTestId('ws-card').filter({ hasText: 'E2E 킬러 2026' })).toHaveCount(0)
})
