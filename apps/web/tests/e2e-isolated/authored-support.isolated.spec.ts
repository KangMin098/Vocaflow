// apps/web/tests/e2e-isolated/authored-support.isolated.spec.ts
//
// T-0056 — 보조 TASK 창작 자료의 격리 브라우저 종단(러너 안 로컬 Supabase · 실제 Next.js · 실제 Chromium). 공유 개발 DB 에 닿지 않는다.
// 전제: authored-supply 와 같다(scripts/ci/authored-isolated-seed.mjs 가 「CI 격리 fixture — 사람 결정 아님」 으로 창작 세트 전부를 러너 DB 에 적재).
// 경로 ① ws.evidence-locate 의 보조 e.task_demand: 지도 → 저장한 PLAN → 보조 카드 → 실제 공급 API → 혼자 확인 2(오답) →
//        같은 TASK · Workspace 복귀 → 다시 공급하면 서버 계획이 바로잡기 단계(교수 · 안내 연습만) → 중심 TASK · 계획 · 목표 이력 불변.
// 경로 ② ws.sentence-core(중심 재고 0 · 자료 준비 중)의 보조 s.sentence_core: 준비 중 행에서 묶음을 열고 → 받은 자료 없음(사실대로) →
//        첫 공급 → 풀이 → 같은 묶음 복귀 · 중심은 여전히 준비 중.
// 서버 계획 · 단계는 브라우저에서 만들지 않는다 — 계획 확정 · 공급 · 채점은 모두 학습자 세션의 실제 API 다.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SET_DIR = path.resolve(__dirname, '../../src/lib/knowledge/authored')
type Item = { id: string; role: string; gold: Record<string, unknown> }
const setOf = (file: string) => JSON.parse(fs.readFileSync(path.join(SET_DIR, file), 'utf8')) as { taskKey: string; items: Item[] }
const TD = setOf('e-task-demand.v1.json')
const SC = setOf('s-sentence-core.v1.json')
const ASSESS = ['independent_check', 'transfer', 'delayed_check']

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
async function makeUser(tag: string) {
  const email = `iso-support-${tag}-${Date.now()}@example.com`
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
  expect(o, '가로 넘침').toBeLessThanOrEqual(1)
}
async function commitPlan(page: Page, template: string, order: string[], o: { reason?: string; expectedVersion?: number; goal?: number } = {}) {
  const r = await page.request.post('/api/csat/diagnosis/map/plan', {
    data: { template, order, planned: {}, reason: o.reason ?? 'initial', expectedVersion: o.expectedVersion ?? 0, ...(o.goal ? { expectedGoalVersion: o.goal } : {}), clientKey: crypto.randomUUID() },
  })
  expect(r.status(), `계획 확정 ${template}: ${await r.text()}`).toBe(200)
}
async function openWs(page: Page, template: string) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  const row = page.locator(`[data-testid="ws-row"][data-ws="${template}"]`)
  // 자료 준비 중 행은 접힌 묶음 안 — 사용자처럼 펼친다
  if ((await row.getAttribute('data-kind')) === 'preparing' && !(await row.isVisible())) await page.locator('[data-testid="ws-preparing"] > summary').click()
  await expect(row, `${template} 행`).toBeVisible()
  await row.locator('[data-testid="ws-open"]').click()
  return row
}
/** 학습 지도로 복귀 → 같은 Workspace 팝업 복원(복귀 문맥) → 개요 탭 */
async function backToWs(page: Page, template: string) {
  await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  const dialog = page.locator(`[role="dialog"][data-ws="${template}"]`)
  await expect(dialog, '복귀 문맥이 같은 Workspace 팝업을 복원한다').toBeVisible({ timeout: 30_000 })
  const overview = dialog.locator('[data-testid="ws-tab-overview"]')
  if ((await overview.getAttribute('aria-selected')) !== 'true') await overview.click()
  return dialog
}
async function solve(page: Page, href: string, act: (runner: ReturnType<Page['locator']>) => Promise<void>) {
  const u = new globalThis.URL(href, 'http://x')
  expect(u.searchParams.get('from'), '복귀 문맥').toBe('map')
  await page.goto(href, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-testid="authored-result"]'), '풀기 전 결과 비노출').toHaveCount(0)
  await act(runner)
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
  await noOverflow(page)
  return u.searchParams.get('d')!
}
const snapshot = async (uid: string) => ({
  plans: ((await admin().from('learner_workspace_plan').select('reason, plan_version').eq('user_id', uid).order('plan_version')).data ?? []).map((r) => r.reason),
  goals: (await admin().from('csat_map_goal_version').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count,
})

for (const width of [1440, 1280]) {
  test(`보조 TASK(e.task_demand) 공급 · 첫 확인 · 복귀 · 다음 단계 — ${width}px`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width, height: 1000 })
    const a = await makeUser(`td${width}`)
    await login(page, a)
    const T = 'ws.evidence-locate', TASK = 'e.task_demand'
    const ORDER = ['e.evidence_location', TASK]
    // 실제 학습자 흐름 — 시험 기록 → 목표 → PLAN(journey-evidence 와 같은 API)
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
    expect(ex.status(), await ex.text()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    await commitPlan(page, T, ORDER, { goal })
    const before = await snapshot(a.id)
    expect(before.plans).toEqual(['initial'])

    await openWs(page, T)
    const card = page.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"]`)
    await expect(card).toBeVisible()
    await expect(card).toContainText('보조 TASK')
    await expect(card.locator('[data-testid="ws-authored-support-empty"]')).toBeVisible()
    await expect(page.locator('[data-testid="ws-authored-list"]'), '중심 TASK 자료는 받지 않았다').toHaveCount(0)
    await noOverflow(page)
    await card.locator('[data-testid="ws-authored-support-request"]').click()
    await expect(card.locator('[data-testid="ws-authored-support-msg"]')).toBeVisible({ timeout: 30_000 })
    const list = card.locator('[data-testid="ws-authored-support-list"]')
    await expect(list).toBeVisible()
    const first = (await admin().from('workspace_content_delivery').select('artifact_ref, role').eq('user_id', a.id)).data ?? []
    expect(first.length).toBeGreaterThan(0)
    expect(first.every((d) => d.artifact_ref.startsWith('authored:td-')), '보조 TASK 자기 자료만').toBe(true)
    expect(first.every((d) => d.role === 'independent_check'), '첫 수요 = 혼자 확인').toBe(true)
    await commitPlan(page, T, ORDER, { reason: 'content_change', expectedVersion: 1, goal })

    // 첫 독립 확인 2 — 둘 다 오답(서버 채점)
    const hrefs = await list.locator('li[data-role="independent_check"] a').evaluateAll((as) => as.map((x) => x.getAttribute('href')!))
    expect(hrefs).toHaveLength(2)
    for (const [i, href] of hrefs.entries()) {
      const id = href.split('/')[3].split('?')[0]
      const gold = TD.items.find((x) => x.id === id)!.gold
      await solve(page, href, async (r) => { await r.locator(`[data-choice="${gold.answer === 0 ? 1 : 0}"]`).first().click() })
      const dialog = await backToWs(page, T)
      const back = dialog.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"] [data-testid="ws-authored-support-list"]`)
      await expect(back).toContainText('풀었어요')
      if (i === 0) await noOverflow(page)
    }
    const attempts = (await admin().from('learning_task_attempts').select('task_key, is_correct').eq('user_id', a.id)).data ?? []
    expect(attempts.map((x) => [x.task_key, x.is_correct])).toEqual([[TD.taskKey, false], [TD.taskKey, false]])
    await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', a.id)).data ?? []).filter((b) => b.evidence === true).length, { timeout: 15_000 }).toBe(2)
    // 확인 결과로 계획을 다시 확정(학습자 동작) — 서버가 그 TASK 의 단계를 바로잡기로 옮긴다
    await commitPlan(page, T, ORDER, { reason: 'check_result', expectedVersion: 2, goal })
    await openWs(page, T)

    // 다음 단계 — 서버가 지금 계획으로 수요를 다시 만든다: 바로잡기(교수 · 안내 연습)만, 평가 역할 없음
    const dialog = page.locator(`[role="dialog"][data-ws="${T}"]`)
    const again = dialog.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"]`)
    await again.locator('[data-testid="ws-authored-support-request"]').click()
    await expect.poll(async () => ((await admin().from('workspace_content_delivery').select('id').eq('user_id', a.id)).data ?? []).length, { timeout: 30_000 }).toBeGreaterThan(2)
    const all = (await admin().from('workspace_content_delivery').select('artifact_ref, role').eq('user_id', a.id)).data ?? []
    const added = all.filter((d) => !first.some((f) => f.artifact_ref === d.artifact_ref && f.role === d.role))
    expect(added.length).toBeGreaterThan(0)
    expect(added.every((d) => d.artifact_ref.startsWith('authored:td-') && !ASSESS.includes(d.role)), `바로잡기 수요: ${JSON.stringify(added)}`).toBe(true)
    await expect(again.locator('[data-testid="ws-authored-support-list"] li[data-role="guided_practice"]').first()).toBeVisible({ timeout: 30_000 })

    // 중심 TASK · 계획 · 목표 이력 불변
    expect(all.some((d) => d.artifact_ref.startsWith('authored:ev-')), '중심 TASK 자료 공급 없음').toBe(false)
    // 계획 이력 = 학습자가 확정한 세 번뿐 · 목표 이력 불변 · 중심 과제 시도 없음
    expect(await snapshot(a.id)).toEqual({ plans: ['initial', 'content_change', 'check_result'], goals: before.goals })
    expect(((await admin().from('learning_task_attempts').select('task_key').eq('user_id', a.id)).data ?? []).every((x) => x.task_key === TD.taskKey)).toBe(true)
    await noOverflow(page)
  })
}

test('중심 재고 0 묶음(ws.sentence-core)의 보조 s.sentence_core — 준비 중 행에서 첫 공급 · 풀이 · 복귀(1440px)', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const u = await makeUser('sc')
  await login(page, u)
  const T = 'ws.sentence-core', TASK = 's.sentence_core'
  await commitPlan(page, T, ['s.o.sentence_meaning_model', TASK, 's.chunk_boundary', 's.structural_relation'])
  const before = await snapshot(u.id)

  const row = await openWs(page, T)
  await expect(row, '중심은 자료 준비 중(실행 가능으로 보이지 않음)').toHaveAttribute('data-kind', 'preparing')
  const dialog = page.locator(`[role="dialog"][data-ws="${T}"]`)
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-testid="ws-authored"]'), '중심 TASK 창작 카드 없음').toHaveCount(0)
  await expect(dialog.locator('[data-testid="ws-modal-next"]'), '중심 학습 실행 없음').toHaveCount(0)
  for (const t of [TASK, 's.chunk_boundary', 's.structural_relation']) {
    const c = dialog.locator(`[data-testid="ws-authored-support"][data-task="${t}"]`)
    await expect(c, `${t} 보조 카드`).toBeVisible()
    await expect(c.locator('[data-testid="ws-authored-support-empty"]'), `${t} 재고 0 = 받은 자료 없음`).toBeVisible()
  }
  await noOverflow(page)

  const card = dialog.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"]`)
  await card.locator('[data-testid="ws-authored-support-request"]').click()
  await expect(card.locator('[data-testid="ws-authored-support-list"]')).toBeVisible({ timeout: 30_000 })
  const got = (await admin().from('workspace_content_delivery').select('artifact_ref, role').eq('user_id', u.id)).data ?? []
  expect(got.length).toBeGreaterThan(0)
  expect(got.every((d) => d.artifact_ref.startsWith('authored:sc-')), '그 보조 TASK 자료만').toBe(true)

  const href = await card.locator('li[data-role="independent_check"] a').first().getAttribute('href')
  expect(href).toBeTruthy()
  const id = href!.split('/')[3].split('?')[0]
  const gold = SC.items.find((x) => x.id === id)!.gold
  await solve(page, href!, async (r) => {
    await r.locator(`[data-segment="${gold.answer}"]`).first().click()
    await r.locator(`[data-reason="${gold.reason}"]`).first().click()
  })
  const back = await backToWs(page, T)
  await expect(back.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"] [data-testid="ws-authored-support-list"]`)).toContainText('풀었어요')
  await expect(back.locator('[data-testid="ws-modal-next"]'), '보조 수행이 중심을 실행 가능으로 바꾸지 않는다').toHaveCount(0)
  await expect(page.locator(`[data-testid="ws-row"][data-ws="${T}"]`)).toHaveAttribute('data-kind', 'preparing')
  const attempts = (await admin().from('learning_task_attempts').select('task_key, is_correct').eq('user_id', u.id)).data ?? []
  expect(attempts.map((x) => [x.task_key, x.is_correct])).toEqual([[SC.taskKey, true]])
  expect(await snapshot(u.id)).toEqual(before)
  await noOverflow(page)
})
