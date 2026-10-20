// apps/web/tests/e2e-isolated/map-return-recap.isolated.spec.ts
//
// T-0062 — 학습 후 같은 지도로 돌아오면 TASK 정보의 「돌아온 뒤」 정리가 이번 기록 · 근거 채택 · 적용 진행 · 저장 계획과 제안을 사실대로 말한다.
// 같은 합성 학습자의 실제 경로(격리 로컬 Supabase · 실제 Next · Chromium): 기록 → 목표 → PLAN → 보조 TASK(e.task_demand) 자료 받기 →
//   혼자 확인 2 오답 → 복귀(독립 근거로 셈) → 확인 결과로 계획 다시 확정 → 바로잡기 자료 → 안내 연습 정답 → 복귀(독립 근거 아님 · 독립 근거 수 그대로) →
//   적용 단계 계획 확정 → 적용 자료(재고 1편 / 계획 2편) → 적용 1편 → 복귀(1 / 2편 — 완료 아님).
// 서버 계획 · 단계 · 채점은 브라우저에서 만들지 않는다. 1440×900 · 1280×800.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SET = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/knowledge/authored/e-task-demand.v1.json'), 'utf8')) as { taskKey: string; items: { id: string; role: string; gold: { answer: number } }[] }
const T = 'ws.evidence-locate', TASK = 'e.task_demand', ORDER = ['e.evidence_location', TASK]

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
const gold = (id: string) => SET.items.find((i) => i.id === id)!.gold.answer
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '문서 가로 넘침').toBeLessThanOrEqual(1)
}
async function plan(page: Page, reason: string, expectedVersion: number, goal: number) {
  const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: T, order: ORDER, planned: {}, reason, expectedVersion, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
  expect(r.status(), `계획 ${reason}: ${await r.text()}`).toBe(200)
}
async function openSupport(page: Page) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  await page.locator(`[data-testid="ws-row"][data-ws="${T}"] [data-testid="ws-open"]`).click()
  return page.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"]`)
}
async function supply(page: Page, uid: string, expectRole: string) {
  const card = await openSupport(page)
  await card.locator('[data-testid="ws-authored-support-request"]').click()
  await expect.poll(async () => ((await admin().from('workspace_content_delivery').select('role').eq('user_id', uid)).data ?? []).map((d) => d.role), { timeout: 30_000 }).toContain(expectRole)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const again = await openSupport(page)
  await expect(again.locator(`[data-testid="ws-authored-support-list"] li[data-role="${expectRole}"]`).first()).toBeVisible({ timeout: 30_000 })
  return again
}
/** 자료를 열어 고르고 제출 → 결과 → 「학습 지도로」 복귀 → 팝업 닫고 TASK 정보의 돌아온 뒤 정리 */
const hrefsOf = async (card: ReturnType<Page['locator']>, role: string) => card.locator(`li[data-role="${role}"] a`).evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
async function solveAndReturn(page: Page, href: string, choice: (id: string) => number) {
  expect(new globalThis.URL(href, 'http://x').searchParams.get('from'), '지도 복귀 문맥').toBe('map')
  const id = href.split('/')[3].split('?')[0]
  await page.goto(href, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toBeVisible({ timeout: 30_000 })
  await runner.locator(`[data-choice="${choice(id)}"]`).first().click()
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  const dialog = page.locator('[role="dialog"]')
  if (await dialog.count()) { await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0) }
  const recap = page.locator('[data-testid="inspector-return-summary"]')
  await expect(recap, '돌아온 뒤 정리').toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-testid="task-inspector"]')).toHaveAttribute('data-task', TASK)
  await noOverflow(page)
  return recap
}
const shot = async (page: Page, name: string) => test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`돌아온 뒤 — 이번 기록 · 근거 채택 · 적용 1/2편 · 저장 계획과 제안 (${width}×${height})`, async ({ page }) => {
    test.setTimeout(420_000)
    await page.setViewportSize({ width, height })
    const email = `iso-recap-${width}-${Date.now()}@example.com`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    expect((await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })).status()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    await plan(page, 'initial', 0, goal)

    // ① 혼자 확인 2 — 오답 → 복귀: 독립 근거로 셈 · 틀렸어요
    let card = await supply(page, uid, 'independent_check')
    await plan(page, 'content_change', 1, goal)
    card = await openSupport(page)
    const wrong = (id: string) => (gold(id) === 0 ? 1 : 0)
    const inds = await hrefsOf(card, 'independent_check')
    expect(inds).toHaveLength(2)
    await solveAndReturn(page, inds[0], wrong)
    const r1 = await solveAndReturn(page, inds[1], wrong)
    await expect(r1).toContainText('독립 근거로 셌어요')
    await expect(r1).toContainText('틀렸어요')
    await expect(r1).toContainText('저장한 학습계획 v2')
    await shot(page, `recap-independent-${width}`)

    // ② 확인 결과로 다시 확정 → 바로잡기 자료 → 안내 연습 정답 → 복귀: 안내 연습(독립 근거 아님) · 독립 근거 수 그대로
    await plan(page, 'check_result', 2, goal)
    card = await supply(page, uid, 'guided_practice')
    const r2 = await solveAndReturn(page, (await hrefsOf(card, 'guided_practice'))[0], gold)
    await expect(r2).toContainText('안내 연습')
    await expect(r2).toContainText('독립 근거로 세지 않아요')
    await expect(r2).toContainText('독립 근거 2개')
    await expect(r2).toContainText('직전 v2')
    await shot(page, `recap-guided-${width}`)

    // ③ 적용 단계 확정 → 적용 자료(재고 1편 · 계획 2편) → 적용 1편 → 복귀: 1 / 2편 — 완료 아님
    await plan(page, 'check_result', 3, goal)
    card = await supply(page, uid, 'transfer')
    const r3 = await solveAndReturn(page, (await hrefsOf(card, 'transfer'))[0], gold)
    await expect(r3).toContainText(/처음 보는 지문 적용 1 \/ 2편 — 아직 계획만큼 하지 않았어요/)
    await expect(r3).not.toContainText('적용한 기록은 아직 없어요')
    await shot(page, `recap-transfer-partial-${width}`)

    // 근거 결속 = 처음 독립 확인 2 뿐(안내 연습 · 적용은 독립 근거가 아니다) · 계획 이력 = 학습자 확정 4회
    const binds = (await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid)).data ?? []
    expect(binds.filter((b) => b.evidence).length).toBe(2)
    expect((await admin().from('learner_workspace_plan').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count).toBe(4)
  })
}
