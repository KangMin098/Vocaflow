// apps/web/tests/e2e-isolated/map-read-recovery.isolated.spec.ts
//
// T-0078 — 실제 Next + 격리 DB: 기록 없는 실제 첫 사용자(읽힌 빈 원장 [])는 「읽지 못함」 복구 화면이 아니라 기존 지도 → 계획 확정으로 간다(오탐 방지 대조).
//   서버 쪽 원장 조회만 실패시키는 장애 주입은 제품 코드에 시험용 갈고리를 두지 않으면 격리 환경에서 만들 수 없다 — 실패 경로(503 · 쓰기 0 · 복구 화면 ·
//   같은 문맥 재조회)는 단위 · 라우트 · 실제 React/Chromium 시험이 맡는다(T-0078 원장 기록). 여기서는 정상 경로가 막히지 않는지만 본다.
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

for (const width of [1440, 1280]) {
  test(`T-0078 읽힌 빈 원장 = 정상 첫 진입(복구 화면 아님) · 계획 확정 · ${width}px`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-readok-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)

    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('[data-testid="map-read-unavailable"]'), '빈 원장은 읽기 실패가 아니다').toHaveCount(0)
    // 기존 첫 행동(계획 확정) → 같은 Workspace 계획 탭에서 저장 — 서버 계획 저장이 evidence_unavailable 로 막히지 않는다
    const next = page.locator('[data-testid="umap-top-next"]')
    await expect(next).toHaveAttribute('data-kind', 'plan')
    await next.focus(); await page.keyboard.press('Enter')
    const dlg = page.locator('[role="dialog"][data-ws]')
    await expect(dlg).toBeVisible({ timeout: 30_000 })
    const saveRes = page.waitForResponse((r) => r.url().endsWith('/api/csat/diagnosis/map/plan') && r.request().method() === 'POST')
    await dlg.locator('[data-testid="plan-save"]').click()
    const res = await saveRes
    expect(res.status(), await res.text()).toBe(200)
    await expect(dlg.locator('[data-testid="plan-save-state"]')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 })
    expect(((await admin().from('learner_workspace_plan').select('plan_version').eq('user_id', uid)).data ?? []).length).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
}
