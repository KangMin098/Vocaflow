// apps/web/tests/e2e-isolated/map-supply-outcome.isolated.spec.ts
//
// T-0067 — 「자료 받기」 결과 표시가 공급 응답의 사실과 일치하는가(실제 Next · 실제 로그인 · 실제 지도 · 1440×900 · 1280×800).
// **공급 API 응답만 모의(page.route)** — 0 · 부분 · 결과 미확인을 재현하기 위해서다. 이 시험은 실제 납품 DB 성공의 증거가 아니다(그것은 authored-support · authored-supply 가 맡는다).
// 확인: 역할마다 받은 수 / 요청 수 · orderOpened false 는 「접수 확인 못 함」 · true 는 「접수」만 · 다시 확인하기(키보드) · 중심 · 보조 카드 공통.
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const T = 'ws.evidence-locate'

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '문서 가로 넘침').toBeLessThanOrEqual(1)
}
const line = (o: Record<string, unknown>) => ({ role: 'independent_check', requested: 2, delivered: [], rejected: [], orderOpened: false, ...o })

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`공급 결과를 사실대로 — 0 · 부분 · 미확인 · 다시 확인(중심 · 보조) ${width}×${height}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height })
    const email = `iso-supply-outcome-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: T, order: ['e.evidence_location', 'e.task_demand'], planned: {}, reason: 'initial', expectedVersion: 0, clientKey: crypto.randomUUID() } })
    expect(r.status(), await r.text()).toBe(200)

    // 모의 응답 차례 — ① 0 · 주문 미확인 ② 부분 · 주문 접수 + 다른 역할 완전 ③ 모양이 다른 응답(결과 미확인)
    const replies = [
      { status: 'ok', demandId: 'x', lines: [line({})] },
      { status: 'ok', demandId: 'x', lines: [line({ delivered: ['authored:ev-ind-1'], orderOpened: true }), line({ role: 'guided_practice', requested: 1, delivered: ['authored:ev-guided-1'] })] },
      { status: 'ok' },
    ]
    let n = 0
    await page.route('**/api/csat/authored/supply', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(replies[Math.min(n++, replies.length - 1)]) }))

    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator(`[data-testid="ws-row"][data-ws="${T}"] [data-testid="ws-open"]`).click()
    const dialog = page.locator(`[role="dialog"][data-ws="${T}"]`)
    await dialog.locator('[data-testid="ws-tab-overview"]').click()

    // ① 중심 카드 — 0 / 2 · 접수 확인 못 함 · 「요청해 두었어요」류 성공 문구 없음 · 다시 확인하기
    const core = dialog.locator('[data-testid="ws-authored"]')
    await core.locator('[data-testid="ws-authored-request"]').click()
    const out1 = core.locator('[data-testid="ws-authored-outcome"]')
    await expect(out1).toContainText('0 / 2')
    await expect(out1).toContainText('접수됐는지 확인하지 못했어요')
    await expect(out1).not.toContainText('요청해 두었')
    const retry = core.locator('[data-testid="ws-authored-retry"]')
    await expect(retry).toBeVisible()
    await noOverflow(page)
    await test.info().attach(`outcome-zero-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // ② 키보드로 다시 확인 → 부분(1 / 2 · 접수만) + 안내 연습 완전 — 역할마다 따로
    await retry.focus(); await expect(retry).toBeFocused(); await page.keyboard.press('Enter')
    const out2 = core.locator('[data-testid="ws-authored-outcome"]')
    await expect(out2.locator('li[data-role="independent_check"]')).toHaveAttribute('data-kind', 'partial')
    await expect(out2.locator('li[data-role="independent_check"]')).toContainText('1 / 2')
    await expect(out2.locator('li[data-role="independent_check"]')).toContainText('제작 요청을 접수했어요')
    await expect(out2.locator('li[data-role="independent_check"]')).toContainText('완료 시각은 정해지지 않았어요')
    await expect(out2.locator('li[data-role="guided_practice"]')).toHaveAttribute('data-kind', 'full')
    await expect(core.locator('[data-testid="ws-authored-retry"]'), '모두 확인됨 → 다시 확인 버튼 없음').toHaveCount(0)

    // ③ 보조 카드 — 모양이 다른 응답 = 결과 확인 불가(성공 아님) · 다시 확인하기
    const support = dialog.locator('[data-testid="ws-authored-support"][data-task="e.task_demand"]')
    await support.locator('[data-testid="ws-authored-support-request"]').click()
    const msg3 = support.locator('[data-testid="ws-authored-support-msg"]')
    await expect(msg3).toHaveAttribute('data-unknown', 'true')
    await expect(msg3).toContainText('공급 결과를 확인하지 못했어요')
    await expect(support.locator('[data-testid="ws-authored-support-retry"]')).toBeVisible()
    await noOverflow(page)
    await test.info().attach(`outcome-unknown-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
