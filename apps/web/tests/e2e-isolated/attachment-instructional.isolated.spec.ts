// apps/web/tests/e2e-isolated/attachment-instructional.isolated.spec.ts
//
// T-0083 — 실제 Next + 격리 DB: 긴 문장 뼈대 Workspace(ws.sentence-core)의 학습 전용 보조 진입(수식 관계 s.attachment).
//   계획 확정 → Workspace 에 「학습 자료 · 수식 관계」 카드(독립 확인 준비 중 범위 문구) → 키보드 자료 받기 → 서버 응답 줄 = 원리 설명 · 안내 연습만 ·
//   평가 역할 납품 0 · 계획 이력 불변. 격리 DB 에 승인된 수식 관계 자료가 없으면 납품 0(주문만)이어도 같은 불변이 성립한다.
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

import { templateOf } from '../../src/lib/csat/map/v4/definition'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const WS = 'ws.sentence-core'

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

for (const width of [1440, 1280]) {
  test(`T-0083 수식 관계 학습 전용 진입 · 교수 역할만 · ${width}px`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-attach-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    const tpl = templateOf(WS)!
    const p = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: WS, order: [...tpl.core, ...tpl.support], planned: {}, reason: 'initial', expectedVersion: 0, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
    expect(p.status(), await p.text()).toBe(200)
    const plans = async () => ((await admin().from('learner_workspace_plan').select('plan_version').eq('user_id', uid)).data ?? []).length
    const before = await plans()

    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
    const dlg = page.locator(`[role="dialog"][data-ws="${WS}"]`)
    const card = dlg.locator('[data-testid="ws-authored-learn"][data-task="s.attachment"]')
    await expect(card).toBeVisible({ timeout: 30_000 })
    await expect(card.locator('[data-testid="ws-authored-learn-scope"]')).toContainText('혼자 확인은 아직 준비 중')
    const resP = page.waitForResponse((r) => r.url().endsWith('/api/csat/authored/supply') && r.request().method() === 'POST')
    const btn = card.locator('[data-testid="ws-authored-learn-request"]')
    await btn.focus(); await page.keyboard.press('Enter')
    const res = await resP
    const body = await res.json() as { status: string; lines?: { role: string }[] }
    expect(res.request().postDataJSON()).toEqual({ task: 's.attachment', template: WS })
    if (body.status === 'ok') expect((body.lines ?? []).map((l) => l.role).sort()).toEqual(['guided_practice', 'model_explanation'])
    const deliveries = (await admin().from('workspace_content_delivery').select('role').eq('user_id', uid)).data ?? []
    expect(deliveries.some((d) => ['independent_check', 'transfer', 'delayed_check'].includes(d.role)), '평가 역할 납품 0').toBe(false)
    expect(await plans(), '계획 이력 불변').toBe(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
}
