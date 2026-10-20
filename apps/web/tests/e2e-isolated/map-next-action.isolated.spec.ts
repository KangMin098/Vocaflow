// apps/web/tests/e2e-isolated/map-next-action.isolated.spec.ts
//
// T-0061 — 전체 학습지도 첫 화면의 「추천 TASK · 이유 · 이번 학습량 · 확인 조건 · 다음 한 행동」(격리 로컬 Supabase · 실제 Next · Chromium).
// 실제 학습자 흐름: 시험 기록 → 목표 → 전체 지도. 계획 저장 전에는 같은 TASK 의 Workspace 계획 탭으로, 저장 뒤에는 그 활동(또는 자료 받기)으로.
// 서버 계획 · 순위는 브라우저에서 만들지 않는다. 전체 페이지 캡처를 시험 첨부로 남긴다(1440×900 · 1280×800).
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
async function makeUser(tag: string) {
  const email = `iso-next-${tag}-${Date.now()}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user.id, email, password }
}
async function login(page: Page, u: { email: string; password: string }) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', u.email)
  await page.fill('input[type="password"]', u.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'))
}
async function noOverflow(page: Page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(o, '문서 가로 넘침').toBeLessThanOrEqual(1)
}
async function openMap(page: Page) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
}
const shot = async (page: Page, name: string) => test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`첫 화면 지금 할 일 — 이유 · 학습량 · 확인 조건 → 계획 → 활동 · 복귀 (${width}×${height})`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width, height })
    const u = await makeUser(`${width}`)
    await login(page, u)
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
    expect(ex.status(), await ex.text()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)

    // 1) 계획 저장 전 — 추천 TASK 와 이유 · 학습량(제안) · 확인 조건, 행동 = 같은 TASK 의 계획 탭
    await openMap(page)
    const head = page.locator('[data-testid="umap-next-task"]')
    await expect(head, '추천 TASK').toBeVisible()
    const task = await head.getAttribute('data-task')
    expect(task).toMatch(/^[a-z]\.[a-z_]+$/)
    await expect(page.locator('[data-testid="umap-next-why"]')).not.toBeEmpty()
    await expect(page.locator('[data-testid="umap-next-amount"]')).toContainText('이번 학습량')
    // 계획 저장 전 첫 행동은 계획 확정이다(「단계 대기」로 멈추지 않는다 — CI 39387227895 캡처에서 찾은 결함)
    await expect(head, '계획 저장 전 행동').toHaveAttribute('data-kind', 'plan')
    await expect(page.locator('[data-testid="umap-next-amount"]')).toContainText(/제안|계획량 없음/)
    await noOverflow(page)
    await shot(page, `before-plan-${width}`)

    // 키보드로 행동 → 같은 TASK 의 Workspace 계획 탭
    const cta = page.locator('[data-testid="umap-top-next"]')
    await cta.focus()
    await expect(cta).toBeFocused()
    await page.keyboard.press('Enter')
    const dialog = page.locator('[role="dialog"][data-testid="ws-modal"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-testid="ws-tab-plan"]')).toHaveAttribute('aria-selected', 'true')
    const ws = await dialog.getAttribute('data-ws')
    await expect(dialog.locator('[data-testid="umap-plan"]')).toHaveAttribute('data-ws', ws!)
    await noOverflow(page)
    await shot(page, `plan-tab-${width}`)
    // 실제 확정 버튼(학습자 동작) — 서버가 저장
    await dialog.locator('[data-testid="plan-save"]').click()
    await expect.poll(async () => (await admin().from('learner_workspace_plan').select('id', { count: 'exact', head: true }).eq('user_id', u.id)).count, { timeout: 30_000 }).toBe(1)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // 2) 저장 뒤 — 같은 추천의 학습량은 저장 계획으로, 행동 = 활동 시작 또는 자료 받기
    await openMap(page)
    await expect(head).toHaveAttribute('data-task', task!)
    const kind2 = await head.getAttribute('data-kind')
    expect(['start', 'supply'], `저장 뒤 행동: ${kind2}`).toContain(kind2)
    await expect(page.locator('[data-testid="umap-next-amount"]')).toContainText(/저장한 계획|계획량 없음/)
    await shot(page, `after-plan-${width}`)
    if (kind2 === 'start') {
      const href = await page.locator('[data-testid="umap-top-next"]').getAttribute('href')
      expect(href, '활동 링크는 지도 복귀 문맥을 가진다').toContain('from=map')
      expect(href).toContain(`map_task=${task}`)
    } else {
      await page.locator('[data-testid="umap-top-next"]').click()
      await expect(page.locator('[role="dialog"][data-testid="ws-modal"] [data-testid="ws-tab-overview"]')).toHaveAttribute('aria-selected', 'true')
      const card = page.locator(`[data-testid^="ws-authored"][data-task="${task}"]`).first()
      await expect(card, '같은 TASK 의 자료 받기').toBeVisible()
      // 실제 공급 API — 서버가 그 TASK 의 확인 자료를 납품한다(재고 판정은 서버)
      await card.locator('[data-testid$="-request"]').click()
      await expect.poll(async () => ((await admin().from('workspace_content_delivery').select('task_id').eq('user_id', u.id)).data ?? []).map((d) => d.task_id), { timeout: 30_000 }).toContain(task)
      await shot(page, `supply-${width}`)
      // 지도로 돌아오면 같은 추천이 이제 시작 가능한 활동을 가리킨다
      await page.keyboard.press('Escape')
      await openMap(page)
      await expect(head).toHaveAttribute('data-task', task!)
      await expect(head, '공급 뒤 행동').toHaveAttribute('data-kind', 'start')
      expect(await page.locator('[data-testid="umap-top-next"]').getAttribute('href')).toContain('from=map')
      await shot(page, `after-supply-${width}`)
    }
    await noOverflow(page)
  })
}
