// apps/web/tests/e2e-isolated/goal-plan-version.isolated.spec.ts
//
// T-0072 — 목표를 바꾼 뒤 이전 PLAN 을 지금 목표의 확정 계획처럼 보이지 않고, 새 목표로 다시 확정하면 다음 실제 활동으로 이어진다
// (격리 · 실제 Next · 실제 Chromium · 공유 개발 DB 무관).
//   시험 기록 → 목표 A → PLAN 확정 → 목표 B 로 변경 → 지도를 여는 것만으로 저장 없음 → 그 묶음 편집기 = 그때 목표 기준 안내 · 저장됨 아님 ·
//   기본 사유 goal_change → 키보드 재확정 → 저장됨 · 새 버전이 목표 B 에 결속(append-only · 이전 버전 보존) → 지도를 새로 열어(서버 재조회) 같은 묶음이 지금 목표 저장 상태.
//   상단 CTA — 재확정 전: 같은 TASK(r.central_meaning)의 계획 다시 확정 + 목표 변경 이유(첫 CI 39551480304 실패 = 자료 부족 분기가 목표 판정보다 먼저였던 P1-2) ·
//   재확정 뒤: 이 학습자는 자료가 없으므로 같은 TASK 의 「자료 받기」가 정상.
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const WS = 'ws.central-meaning'
const ORDER = ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure']

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

for (const width of [1440, 1280]) {
  test(`T-0072 목표 변경 → 이전 PLAN 구분 → 새 목표 재확정 → 다음 활동 · ${width}px`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-goalver-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
    expect(ex.status(), await ex.text()).toBe(200)
    const setGoal = async (target: number) => {
      const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target, exam: 'kice6', clientKey: crypto.randomUUID() } })
      expect(g.status(), await g.text()).toBe(200)
      return (await g.json() as { goalVersionId: number }).goalVersionId
    }
    const goalA = await setGoal(80)
    const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: WS, order: ORDER, planned: {}, reason: 'initial', expectedVersion: 0, expectedGoalVersion: goalA, clientKey: crypto.randomUUID() } })
    expect(r.status(), await r.text()).toBe(200)
    const goalB = await setGoal(90)
    expect(goalB).not.toBe(goalA)
    const plans = async () => ((await admin().from('learner_workspace_plan').select('plan_version, reason, goal_version_id').eq('user_id', uid).order('plan_version')).data ?? [])
    expect(await plans()).toEqual([{ plan_version: 1, reason: 'initial', goal_version_id: goalA }])

    // 지도 — 상단 CTA 는 자료 받기가 아니라 같은 TASK 의 계획 다시 확정(목표 변경 이유) · 여는 것만으로 저장하지 않는다
    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    const top = page.locator('[data-testid="umap-top-next"]')
    await expect(top).toHaveAttribute('data-task', 'r.central_meaning')
    await expect(top, '자료 받기가 아니라 계획 다시 확정').toHaveAttribute('data-kind', 'plan')
    await expect(page.locator('[data-testid="umap-next-plan-note"]'), '목표 변경 이유').toContainText('목표가 바뀌었어요')
    expect(await plans(), '지도를 여는 것만으로 저장하지 않는다(숨은 POST 없음)').toHaveLength(1)
    await test.info().attach(`goalver-before-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // 편집기 — 그때 목표 기준 안내 · 저장됨 아님 · 기본 사유 goal_change → 키보드 재확정
    await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
    const dlg = page.locator(`[role="dialog"][data-ws="${WS}"]`)
    await dlg.locator('[data-testid="ws-tab-plan"]').click()
    const notice = dlg.locator('[data-testid="plan-goal-changed"]')
    await expect(notice).toBeVisible()
    await expect(notice).toHaveAttribute('data-saved-goal', String(goalA))
    await expect(notice).toHaveAttribute('data-current-goal', String(goalB))
    await expect(dlg.locator('[data-testid="plan-save-state"]')).not.toHaveAttribute('data-state', 'saved')
    await expect(dlg.locator('[data-testid="plan-reason"]')).toHaveValue('goal_change')
    const save = dlg.locator('[data-testid="plan-save"]')
    await save.focus(); await page.keyboard.press('Enter')
    await expect(dlg.locator('[data-testid="plan-save-state"]'), '서버 재조회 뒤 저장됨').toHaveAttribute('data-state', 'saved', { timeout: 30_000 })
    await expect(dlg.locator('[data-testid="plan-goal-changed"]')).toHaveCount(0)
    // append-only — 이전 버전은 목표 A 그대로 · 새 버전은 목표 B · goal_change
    expect(await plans()).toEqual([{ plan_version: 1, reason: 'initial', goal_version_id: goalA }, { plan_version: 2, reason: 'goal_change', goal_version_id: goalB }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await test.info().attach(`goalver-after-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await page.keyboard.press('Escape')

    // 서버 재조회 — 지도를 새로 열면 같은 묶음 계획이 지금 목표로 저장된 상태 · 목표 변경 안내 없음
    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
    const dlg2 = page.locator(`[role="dialog"][data-ws="${WS}"]`)
    await dlg2.locator('[data-testid="ws-tab-plan"]').click()
    await expect(dlg2.locator('[data-testid="plan-save-state"]')).toHaveAttribute('data-state', 'saved')
    await expect(dlg2.locator('[data-testid="plan-goal-changed"]')).toHaveCount(0)
    expect(await plans(), '다시 열어도 추가 저장 없음').toHaveLength(2)
    await page.keyboard.press('Escape')
    // 재확정 뒤 — 같은 TASK 상단은 자료 받기(자료가 없으므로 정상) · 목표 변경 안내 사라짐
    const top2 = page.locator('[data-testid="umap-top-next"]')
    await expect(top2).toHaveAttribute('data-task', 'r.central_meaning')
    await expect(top2).toHaveAttribute('data-kind', 'supply')
    await expect(page.locator('[data-testid="umap-next-plan-note"]')).toHaveCount(0)
  })
}
