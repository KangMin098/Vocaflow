// apps/web/tests/e2e-isolated/journey-evidence.isolated.spec.ts
//
// T-0052 rev1 — 근거 찾기(e.evidence_location) 대표 여정. 같은 합성 학습자 · 같은 Workspace · 같은 목표 버전으로
//   시험 기록 → 목표 → PLAN v1 → 실제 공급 API(확인 2) → PLAN v2 → 독립 오답 2(G2 근거) → 보완 필요 → PLAN v3 repair
//   → 실제 공급(교수 · 안내 연습) → 안내 연습 오답 → 다시 풀기 → 정답 + 자기 설명 노트 저장 · 제공 설명 대조 → PLAN v4 transfer
//   → 실제 공급(전이 2 · 서로 다른 지문) → PLAN v5 recheck → 실제 공급(새 독립 확인 2 · 이미 본 지문 제외) → 정답 → G2 → MAP → PLAN v6.
// 격리 Supabase(127.0.0.1:54321) 전용 — 개발 DB 를 쓰지 않는다. 자격 · 사람 결정은 CI fixture(사람 승인 아님).
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEMPLATE = 'ws.evidence-locate'
const TASK = 'e.evidence_location'
const ORDER = ['e.evidence_location', 'e.task_demand']
type Gold = { answer: number; decisive: number; evidence: number[]; evidenceAlt?: number[]; decisiveAlt?: number[][] }
type Item = { id: string; role: string; passageGroup: string; body: { sentences: string[] }; gold: Gold }
const EVL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/knowledge/authored/e-evidence-location.v1.json'), 'utf8')) as { items: Item[] }
const byRef = (r: string) => EVL.items.find((i) => `authored:${i.id}` === r)!
const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } })

test.beforeAll(() => {
  expect(URL_, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const plan = async (page: Page, reason: string, expectedVersion: number, goal: number) => {
  const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason, expectedVersion, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
  expect(r.status(), await r.text()).toBe(200)
}
async function planRow(ws: string, version: number) {
  const r = (await admin().from('learner_workspace_plan').select('user_id, plan_version, reason, goal_version_id, plan').eq('workspace_id', ws).eq('plan_version', version).single()).data!
  const t = (r.plan as { tasks: { task: string; stage?: string | null; planned?: unknown; available?: unknown }[] }).tasks.find((x) => x.task === TASK) ?? null
  return { ...r, task: t ? { stage: t.stage ?? null, planned: t.planned ?? null, available: t.available ?? null } : null }
}
/** 실제 자료 받기 API — 지금 저장 PLAN 단계의 수요 */
async function supply(page: Page) {
  const r = await page.request.post('/api/csat/authored/supply', { data: { task: TASK, template: TEMPLATE } })
  const j = await r.json().catch(() => ({}))
  expect(r.status(), JSON.stringify(j)).toBe(200)
  expect(j.status, JSON.stringify(j)).toBe('ok')
  return ((j.lines ?? []) as { role: string; delivered: string[] }[]).filter((l) => l.delivered.length > 0)
}
async function deliveryOf(uid: string, ref: string, role: string) {
  const r = await admin().from('workspace_content_delivery').select('id').eq('user_id', uid).eq('artifact_ref', ref).eq('role', role).order('delivered_at', { ascending: false }).limit(1)
  expect((r.data ?? []).length, `납품 없음 ${ref} ${role}`).toBe(1)
  return (r.data as { id: string }[])[0].id
}
async function observe(page: Page) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  const node = page.locator(`[data-testid="umap-node"][data-node="${TASK}"]`)
  await expect(node).toBeVisible()
  await node.click()
  const pop = page.locator('[data-testid="task-pop"]')
  if (!(await pop.isVisible())) await node.click()
  await expect(pop).toBeVisible({ timeout: 15_000 })
  const evidence = await pop.locator('[data-testid="pop-evidence"]').getAttribute('data-evidence')
  const next = (await pop.locator('[data-testid="pop-next"]').count()) ? await pop.locator('[data-testid="pop-next"]').getAttribute('href') : null
  const nextLabel = (await pop.locator('[data-testid="pop-next"]').count()) ? (await pop.locator('[data-testid="pop-next"]').innerText()).trim() : null
  const blocked = (await pop.locator('[data-testid="pop-blocked"]').count()) ? await pop.locator('[data-testid="pop-blocked"]').getAttribute('data-reason') : null
  return { evidence, next: next?.split('?')[0] ?? null, nextHref: next, nextLabel, blocked }
}
/** choice_evidence 풀이 — 정답: 선택 + 결정 근거 문장 · 오답: 다른 선택 + 근거 범주 밖 문장 */
async function solve(page: Page, item: Item, href: string, right: boolean) {
  await page.goto(href, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toHaveAttribute('data-format', 'choice_evidence', { timeout: 30_000 })
  const allowed = new Set([...item.gold.evidence, ...(item.gold.evidenceAlt ?? [])])
  const off = item.body.sentences.map((_, k) => k).find((k) => !allowed.has(k))!
  await runner.locator(`[data-choice="${right ? item.gold.answer : (item.gold.answer + 1) % 5}"]`).click()
  await runner.locator(`[data-sentence="${right ? item.gold.decisive : off}"]`).click()
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toContainText(right ? '정확히 해냈어요' : '이번에는 어긋났어요', { timeout: 30_000 })
}
const hrefOf = (ref: string, did: string) => `/csat/learn/${ref.slice('authored:'.length)}?d=${did}`

test('근거 찾기 대표 여정 — 독립 오답 → 바로잡기(안내 연습 · 자기 설명) → 적용 2 → 새 독립 확인 → G2 → MAP · PLAN', async ({ page }) => {
  test.setTimeout(420_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const email = `iso-evl-${Date.now()}@example.org`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  expect(created.error).toBeNull()
  const uid = created.data.user!.id
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
  expect(ex.status(), await ex.text()).toBe(200)
  const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
  expect(g.status(), await g.text()).toBe(200)
  const goal = (await g.json() as { goalVersionId: number }).goalVersionId
  await plan(page, 'initial', 0, goal)
  const ws = (await admin().from('learner_workspace').select('id').eq('user_id', uid).single()).data!.id as string

  // 확인 자료 — 실제 공급 API(단계 check · 수요 = independent_check)
  const first = await supply(page)
  expect(first.map((l) => l.role)).toEqual(['independent_check'])
  const firstRefs = first[0].delivered
  expect(firstRefs.length).toBe(2)
  await plan(page, 'content_change', 1, goal)
  for (const r of firstRefs) await solve(page, byRef(r), hrefOf(r, await deliveryOf(uid, r, 'independent_check')), false)
  await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid)).data ?? []).filter((b) => b.evidence === true).length, { timeout: 15_000 }).toBe(2)
  const need = await observe(page)
  expect(need.evidence, '서로 다른 독립 오답 2 → 보완 필요').toBe('need_confirmed')
  await plan(page, 'check_result', 2, goal)
  const v3 = await planRow(ws, 3)
  expect(v3.task?.stage).toBe('repair')

  // 바로잡기 — 실제 공급(교수 · 안내 연습만 · 평가 역할 0)
  const repair = await supply(page)
  expect(repair.some((l) => ['independent_check', 'transfer', 'delayed_check'].includes(l.role)), '평가 자료를 바로잡기로 공급하지 않는다').toBe(false)
  const guidedRef = repair.find((l) => l.role === 'guided_practice')!.delivered[0]
  const guided = byRef(guidedRef)
  const withGuided = await observe(page)
  expect(withGuided.next).toBe(`/csat/learn/${guided.id}`)
  // 안내 연습 오답 → 다시 풀기 → 정답(append-only)
  await solve(page, guided, withGuided.nextHref!, false)
  await page.locator('[data-testid="authored-retry"]').click()
  const runner = page.locator('[data-testid="authored-runner"]')
  await runner.locator(`[data-choice="${guided.gold.answer}"]`).click()
  await runner.locator(`[data-sentence="${guided.gold.decisive}"]`).click()
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toContainText('정확히 해냈어요', { timeout: 30_000 })
  // 원리 정리(T-0091) — 제공된 설명만 보이고 노트 작성 · 저장 · 대조는 없다(채점 · 근거 아님)
  const note = page.locator('[data-testid="reasoning-note"]')
  await expect(note).toContainText('제공된 설명(사람 검수 전)')
  await expect(note).toHaveAttribute('data-readonly', 'true')
  await expect(note.locator('textarea')).toHaveCount(0)
  const guidedBinds = ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid).eq('artifact_ref', guidedRef)).data ?? []).map((b) => b.evidence)
  expect(guidedBinds, '안내 연습은 근거가 아니다').toEqual([false, false])
  await plan(page, 'check_result', 3, goal)
  const v4 = await planRow(ws, 4)
  expect(v4.task?.stage, '바로잡기 성공 → 적용').toBe('transfer')

  // 적용 — 실제 공급(전이 2 · 서로 다른 지문)
  const tr = await supply(page)
  expect(tr.map((l) => l.role)).toEqual(['transfer'])
  const trRefs = tr[0].delivered
  expect(new Set(trRefs.map((r) => byRef(r).passageGroup)).size, '서로 다른 전이 지문 2').toBe(2)
  for (const r of trRefs) await solve(page, byRef(r), hrefOf(r, await deliveryOf(uid, r, 'transfer')), true)
  await plan(page, 'check_result', 4, goal)
  const v5 = await planRow(ws, 5)
  expect(v5.task?.stage).toBe('recheck')
  const afterTransfer = await observe(page)
  expect(afterTransfer.evidence, '적용은 독립 근거가 아니다').toBe('need_confirmed')

  // 다시 확인 — 실제 공급(새 지문 독립 확인 · 이미 본 평가 지문 제외)
  const re = await supply(page)
  expect(re.map((l) => l.role)).toEqual(['independent_check'])
  const fresh = re[0].delivered.filter((r) => !firstRefs.includes(r))
  expect(fresh.length, '새 미노출 독립 확인 2').toBe(2)
  for (const r of fresh) await solve(page, byRef(r), hrefOf(r, await deliveryOf(uid, r, 'independent_check')), true)
  await expect.poll(async () => {
    const rows = (await admin().from('workspace_delivery_attempt').select('artifact_ref, evidence').eq('user_id', uid)).data ?? []
    return rows.filter((b) => fresh.includes(b.artifact_ref) && b.evidence === true).length
  }, { timeout: 15_000 }).toBe(2)
  const resolved = await observe(page)
  await plan(page, 'check_result', 5, goal)
  const v6 = await planRow(ws, 6)
  console.log('JOURNEY_EVL=' + JSON.stringify({ need, withGuided, afterTransfer, resolved, v3: v3.task, v4: v4.task, v5: v5.task, v6: v6.task }))
  expect(resolved.evidence, '새 지문 독립 확인 2 정답 → 현재 정책 통과').toBe('passed_current_policy')
  expect(['repair', 'transfer']).not.toContain(v6.task?.stage ?? null)
  expect(v6).toMatchObject({ user_id: uid, reason: 'check_result', goal_version_id: goal })
  for (const [n, t] of [[3, v3.task], [4, v4.task], [5, v5.task]] as const) expect((await planRow(ws, n)).task, `PLAN v${n} 이력 불변`).toEqual(t)
  const firsts = (await admin().from('learning_first_attempts').select('item_ref, is_correct, help_level').eq('user_id', uid).in('item_ref', firstRefs)).data ?? []
  expect(firsts.length === 2 && firsts.every((x) => x.is_correct === false && x.help_level === 'independent'), '처음 독립 오답 불변').toBe(true)
})
