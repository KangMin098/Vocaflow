// apps/web/tests/e2e-isolated/journey.isolated.spec.ts
//
// FINAL A~H — **한 합성 학습자**의 종단 경로(격리 DB · 실제 Next.js · 실제 Chromium). 다른 spec 의 통과를 합산하지 않는다 — 이 파일 하나가
//   같은 user id 로 처음부터 끝까지 간다.
//   A 시험 기록(합성 회차 M9901 · scripts/ci/journey-exam-fixture.sql) → B 목표(목표 버전) → PLAN v1(목표 버전 결속)
//   → C 지도 As-Is · NeedRank(노드 순서) · 다음 행동(수행 전 관찰) → F Workspace 납품(R5 창작 · 격리 fixture 자격)
//   → 학습 · 독립 확인 2 · 전이 1(실제 Runner · 서버 채점) → G2 결속(evidence) → H 지도 재계산(수행 후 관찰) → PLAN v2(check_result · 같은 목표 버전)
// 핵심 구분: 「지도 화면으로 돌아왔다」가 아니라 **근거로 바뀐 값**(TASK 근거 상태 · 다음 행동 · 저장 PLAN 의 TASK 단계)을 수행 전후로 비교한다.
//   값이 그대로면 실패한다(실제 근거가 지도 · PLAN 에 반영되지 않았다는 뜻).
// 시험 기록은 합성 회차라 문항 · 속성 태깅이 없다 — As-Is 의 축 기록(proxy) 근거는 만들지 않는다(기록 저장 · 지도 기록 줄만). 그 한계는 결과에 적는다.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEMPLATE = 'ws.central-meaning'
const TASK = 'r.central_meaning'
const ORDER = ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure']
type Item = { id: string; role: string; gold: { answer: number; claim: number; support: number[]; relationProbe?: { sentence: number; relation: string } } }
const R5 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/knowledge/authored/r5-central-meaning.v1.json'), 'utf8')) as { taskId: string; items: Item[] }
const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } })
const canonical = (v: unknown): string => v === null ? 'null' : Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : typeof v === 'object' ? `{${Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v)

test.beforeAll(() => {
  expect(URL_, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

async function deliver(learner: SupabaseClient, uid: string, ws: string, planVersion: number, item: Item): Promise<string> {
  const d = { v: 2, user: uid, template: TEMPLATE, workspaceId: ws, goalVersion: null, planVersion, definitionVersion: `journey-${item.id}-${Date.now()}`, core: TASK, support: [],
    lines: [{ role: item.role, task: TASK, n: 1, types: [], keys: [], requires: {}, reason: 'need' }] }
  const dem = await learner.rpc('workspace_demand_record', { p_canonical: canonical(d) })
  if (dem.error) throw new Error(`수요: ${dem.error.message}`)
  const line = (await learner.from('workspace_content_demand_line').select('id').eq('demand_id', dem.data as string).single()).data!.id as string
  const q = (await admin().from('content_qualification').select('id').eq('artifact_ref', `authored:${item.id}`).eq('role', item.role).single()).data!.id as string
  const a = (await admin().from('content_release_approval').select('id').eq('qualification_id', q).eq('scope', 'assessment').single()).data!.id as string
  const r = await learner.rpc('workspace_delivery_record', { p_line: line, p_order: null, p_qualification: q, p_approval: a, p_request_key: crypto.randomUUID() })
  if (r.error) throw new Error(`납품 ${item.id}: ${r.error.message}`)
  return r.data as string
}
/** 지도에서 TASK 노드를 눌러 팝업의 근거 상태 · 다음 행동 · 우선순위를 읽는다(화면이 계산한 값) */
async function observe(page: Page) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  const node = page.locator(`[data-testid="umap-node"][data-node="${TASK}"]`)
  await expect(node).toBeVisible()
  const priority = await node.getAttribute('data-priority')
  // 첫 누름 = 초점 · 다시 누름 = 자세히(팝업) — 노드 aria-label 의 안내 그대로
  await node.click()
  const pop = page.locator('[data-testid="task-pop"]')
  if (!(await pop.isVisible())) await node.click()
  await expect(pop).toBeVisible({ timeout: 15_000 })
  const evidence = await pop.locator('[data-testid="pop-evidence"]').getAttribute('data-evidence')
  const next = (await pop.locator('[data-testid="pop-next"]').count()) ? await pop.locator('[data-testid="pop-next"]').getAttribute('href') : null
  const blocked = (await pop.locator('[data-testid="pop-blocked"]').count()) ? await pop.locator('[data-testid="pop-blocked"]').getAttribute('data-reason') : null
  const nextLabel = (await pop.locator('[data-testid="pop-next"]').count()) ? (await pop.locator('[data-testid="pop-next"]').innerText()).trim() : null
  return { priority, evidence, next: next?.split('?')[0] ?? null, nextHref: next ?? null, nextLabel, blocked }
}
async function planRow(ws: string, version: number) {
  const r = (await admin().from('learner_workspace_plan').select('user_id, plan_version, reason, goal_version_id, plan').eq('workspace_id', ws).eq('plan_version', version).single()).data!
  const t = (r.plan as { tasks: { task: string; stage?: string | null; planned?: unknown; available?: unknown }[] }).tasks.find((x) => x.task === TASK) ?? null
  return { ...r, stage: t?.stage ?? null, task: t ? { stage: t.stage ?? null, planned: t.planned ?? null, available: t.available ?? null } : null }
}
async function solve(page: Page, item: Item, did: string) {
  await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toHaveAttribute('data-format', 'central_meaning', { timeout: 30_000 })
  await expect(page.locator('[data-testid="authored-result"]')).toHaveCount(0)
  await runner.locator(`[data-sentence="${item.gold.claim}"]`).click()
  await runner.locator(`[data-sentence="${item.gold.support[0]}"]`).click()
  if (await runner.locator('[data-relation]').count()) await runner.locator(`[data-relation="${item.gold.relationProbe?.relation ?? 'reason'}"]`).click()
  await runner.locator(`[data-choice="${item.gold.answer}"]`).click()
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
}

test('한 학습자 종단 — 시험 기록 → 목표 → PLAN → 지도 → 납품 → 독립 확인 · 전이 → G2 → 지도 · PLAN 재계산', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  // 합성 도메인(example.com 등 · SYNTHETIC_EMAIL_DOMAINS)은 지도 근거에서 빠진다 — 실제 학습자처럼 근거가 쌓이는지 보려면 목록 밖 예약 도메인
  const email = `iso-journey-${Date.now()}@example.org`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  expect(created.error).toBeNull()
  const uid = created.data.user!.id
  const learner = createClient(URL_, ANON, { auth: { persistSession: false } })
  expect((await learner.auth.signInWithPassword({ email, password })).error).toBeNull()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'))

  // A 시험 기록 — 실제 API(서버 채점 · 기록 RPC). 합성 회차라 축 기록 근거는 만들지 않는다
  const choices = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1 === 3 ? 4 : ((i + 1) % 5) + 1]))
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices } })
  expect(ex.status(), await ex.text()).toBe(200)
  const exOut = await ex.json() as { raw: number; wrong: number[] }
  expect(exOut.wrong.length).toBeGreaterThan(0)
  const session = (await admin().from('csat_dx_session').select('id, user_id, exam_id, raw_score').eq('user_id', uid)).data ?? []
  expect(session).toHaveLength(1)
  expect(session[0]).toMatchObject({ user_id: uid, exam_id: 'M9901', raw_score: exOut.raw })

  // B 목표 — 실제 API · 목표 버전
  const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
  expect(g.status(), await g.text()).toBe(200)
  const goalVersionId = (await g.json() as { goalVersionId: number }).goalVersionId
  expect(goalVersionId).toBeTruthy()
  const gv = (await admin().from('csat_map_goal_version').select('id, user_id').eq('id', goalVersionId).single()).data!
  expect(gv.user_id).toBe(uid)

  // PLAN v1 — 목표 버전 결속
  const p1 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'initial', expectedVersion: 0, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p1.status(), await p1.text()).toBe(200)
  const ws = (await admin().from('learner_workspace').select('id, user_id').eq('user_id', uid).single()).data!
  const v1 = await planRow(ws.id, 1)
  expect(v1).toMatchObject({ user_id: uid, reason: 'initial', goal_version_id: goalVersionId })

  // F 납품 먼저(독립 확인 2 · 전이 1) — 「자료가 생겨서 바뀐 것」과 「근거로 바뀐 것」을 가르려고 수행 전 관찰 · 기준 PLAN 을 납품 뒤에 둔다
  const ind = R5.items.filter((i) => i.role === 'independent_check').slice(0, 2)
  const tr = R5.items.filter((i) => i.role === 'transfer').slice(0, 1)
  const delivered: { item: Item; did: string }[] = []
  for (const item of [...ind, ...tr]) delivered.push({ item, did: await deliver(learner, uid, ws.id, 1, item) })

  // PLAN v2(content_change) — 자료가 생긴 뒤의 기준 계획(같은 목표 버전)
  const p2 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'content_change', expectedVersion: 1, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p2.status(), await p2.text()).toBe(200)
  const base = await planRow(ws.id, 2)
  expect(base).toMatchObject({ user_id: uid, reason: 'content_change', goal_version_id: goalVersionId })

  // C 수행 전 관찰(자료 있음 · 근거 없음)
  const before = await observe(page)
  expect(['not_measured', 'axis_observation', 'checking']).toContain(before.evidence) // 화면 용어(v6.2 InspectorEvidence)

  // 학습 · 수행 — 독립 확인 1 · 전이 1 만 푼다(독립 확인 하나는 남겨 다음 행동이 옮겨 가는지 본다)
  // 다음 행동이 가리키는 바로 그 확인 자료 + 전이 1 을 푼다 — 그래야 다음 행동이 「근거로」 옮겨 가는지 본다(새 자료는 없다)
  const nextId = before.next?.split('/').pop() ?? null
  const target = delivered.find((d) => d.item.role === 'independent_check' && d.item.id === nextId) ?? delivered[0]
  const solved = [target, delivered[2]]
  for (const { item, did } of solved) await solve(page, item, did)

  // G2 — 푼 시도만 그 납품에 결속 · 독립 첫 시도 = 근거
  const bindings = (await admin().from('workspace_delivery_attempt').select('delivery_id, evidence, user_id').eq('user_id', uid)).data ?? []
  expect(bindings.map((b) => b.delivery_id).sort()).toEqual(solved.map((d) => d.did).sort())
  expect(bindings.every((b) => b.evidence === true && b.user_id === uid)).toBe(true)

  // H 수행 후 관찰 — 근거로 바뀐 값(단순 복귀가 아니다 · 새 자료는 없었다)
  const after = await observe(page)
  console.log('JOURNEY_OBSERVE=' + JSON.stringify({ before, after }))
  // 직접 확인 판정 — 정답 하나는 「보완 필요」 확정도 「다시 확인 통과」도 아니다(재확인은 시간을 둔다) → checking 이 규칙대로의 값
  expect(['checking', 'need_confirmed', 'passed_current_policy']).toContain(after.evidence)
  expect(after.evidence, 'TASK 근거 상태가 수행 근거로 바뀌어야 한다').not.toBe(before.evidence)
  if (before.blocked === 'relevance_unknown' && after.blocked === 'relevance_unknown') console.log('JOURNEY_NEXT=unchanged:relevance_unknown(기준 시험 연결 없음)')
  else expect({ next: after.next, blocked: after.blocked }, '다음 행동이 근거로 바뀌어야 한다').not.toEqual({ next: before.next, blocked: before.blocked })

  // PLAN v3(check_result) — 확인 결과로 다시 계산 · 같은 목표 버전 · 이력 보존. 기준(v2)과 TASK 항목(단계 · 계획량 · 가용량)을 비교
  const p3 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 2, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p3.status(), await p3.text()).toBe(200)
  const v3 = await planRow(ws.id, 3)
  console.log('JOURNEY_PLAN=' + JSON.stringify({ v1: v1.task, v2: base.task, v3: v3.task }))
  expect(v3).toMatchObject({ user_id: uid, reason: 'check_result', goal_version_id: goalVersionId })
  if (after.blocked === 'relevance_unknown') console.log('JOURNEY_PLAN_STAGE=unchanged:relevance_unknown')
  // 같은 확인 묶음 안의 1건 성공은 done · 남은 수 · 다음 문항을 바꾸지만 저장 TASK 의 stage · planned · available 은 같을 수 있다(가용량 = 미노출 + 수행 · 중복 차감 방지 계약).
  //   이 경로는 진행 · 복귀 대조로만 기록하고, 저장 PLAN 의 의미 전환은 아래 「양성 경로」(2 오답 → repair)가 단언한다(Codex 설계 2026-10-19)
  else console.log('JOURNEY_PLAN_TASK=' + (JSON.stringify(v3.task) === JSON.stringify(base.task) ? 'same(진행만 · 의미 전환 아님)' : 'changed'))
  expect((await planRow(ws.id, 1)).task, 'PLAN v1 이력은 그대로').toEqual(v1.task)
  expect((await planRow(ws.id, 2)).task, 'PLAN v2 이력은 그대로').toEqual(base.task)
})

/** 양성 경로용 — 같은 시작(기록 → 목표 → PLAN v1)을 새 계정으로 다시 밟는다(앞 계정과 결과를 섞지 않는다) */
async function begin(page: Page, tag: string) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const email = `iso-journey-${tag}-${Date.now()}@example.org` // 비합성 도메인 — 지도 근거에 들어간다(격리 DB 합성 학습자)
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  expect(created.error).toBeNull()
  const uid = created.data.user!.id
  const learner = createClient(URL_, ANON, { auth: { persistSession: false } })
  expect((await learner.auth.signInWithPassword({ email, password })).error).toBeNull()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'))
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const choices = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1]))
  const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices } })
  expect(ex.status(), await ex.text()).toBe(200)
  const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
  expect(g.status(), await g.text()).toBe(200)
  const goalVersionId = (await g.json() as { goalVersionId: number }).goalVersionId
  const p1 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'initial', expectedVersion: 0, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p1.status(), await p1.text()).toBe(200)
  const ws = (await admin().from('learner_workspace').select('id').eq('user_id', uid).single()).data!.id as string
  return { uid, learner, ws, goalVersionId }
}

/** 명확히 틀린 응답 — 정답이 아닌 선택지 · 중심(또는 다시 말하기)이 아닌 문장. 정당한 대체 정답을 오답으로 만들지 않는다 */
async function solveWrong(page: Page, item: Item & { gold: Item['gold'] & { claimRestated?: number[] } }, did: string) {
  await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toHaveAttribute('data-format', 'central_meaning', { timeout: 30_000 })
  const central = new Set([item.gold.claim, ...(item.gold.claimRestated ?? [])])
  const n = await runner.locator('[data-sentence]').count()
  const notCentral = Array.from({ length: n }, (_, k) => k).filter((k) => !central.has(k))
  await runner.locator(`[data-sentence="${notCentral[0]}"]`).click() // 중심이 아닌 문장을 중심으로
  await runner.locator(`[data-sentence="${notCentral[1]}"]`).click()
  if (await runner.locator('[data-relation]').count()) await runner.locator('[data-relation]').first().click()
  await runner.locator(`[data-choice="${(item.gold.answer + 1) % 5}"]`).click() // 정답이 아닌 선택지
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toContainText('이번에는 어긋났어요', { timeout: 30_000 })
}

test('양성 경로 — 서로 다른 독립 확인 2 오답 → 보완 필요 확정 → PLAN 확인 → 바로잡기', async ({ page }) => {
  test.setTimeout(300_000)
  const { uid, learner, ws, goalVersionId } = await begin(page, 'repair')
  const ind = R5.items.filter((i) => i.role === 'independent_check').slice(0, 2)
  const delivered: { item: Item; did: string }[] = []
  for (const item of ind) delivered.push({ item, did: await deliver(learner, uid, ws, 1, item) })
  // 기준 PLAN(자료 받은 뒤) · 수행 전 관찰
  const p2 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'content_change', expectedVersion: 1, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p2.status(), await p2.text()).toBe(200)
  const base = await planRow(ws, 2)
  const before = await observe(page)
  for (const { item, did } of delivered) await solveWrong(page, item as never, did)
  // 서버 채점 isCorrect=false · G2 독립 첫 노출 근거
  const atts = (await admin().from('learning_task_attempts').select('item_ref, is_correct').eq('user_id', uid)).data ?? []
  expect(atts.length).toBe(2)
  expect(atts.every((a) => a.is_correct === false)).toBe(true)
  const binds = (await admin().from('workspace_delivery_attempt').select('delivery_id, evidence').eq('user_id', uid)).data ?? []
  expect(binds.map((b) => b.delivery_id).sort()).toEqual(delivered.map((d) => d.did).sort())
  expect(binds.every((b) => b.evidence === true)).toBe(true)
  // 환류 — 보완 필요 확정 · 다음 행동 변화 · 저장 PLAN 단계 check → repair
  const after = await observe(page)
  const p3 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 2, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p3.status(), await p3.text()).toBe(200)
  const v3 = await planRow(ws, 3)
  console.log('JOURNEY_REPAIR=' + JSON.stringify({ before, after, base: base.task, v3: v3.task }))
  expect(after.evidence, '서로 다른 2 오답 → 보완 필요 확정').toBe('need_confirmed')
  // 다음 행동 — 바로잡기는 틀린 문항을 다시 푸는 링크라 주소가 같을 수 있다(단계 · 라벨이 바뀐다). 평가 자료 재사용 여부는 Codex 판정 항목
  expect({ label: after.nextLabel, blocked: after.blocked }, '다음 행동의 단계 · 라벨이 바뀌어야 한다').not.toEqual({ label: before.nextLabel, blocked: before.blocked })
  expect(base.task?.stage).toBe('check')
  expect(v3.task?.stage, '저장 PLAN 단계 check → repair').toBe('repair')
  expect(v3).toMatchObject({ user_id: uid, reason: 'check_result', goal_version_id: goalVersionId })
  expect((await planRow(ws, 2)).task, 'PLAN v2 이력 불변').toEqual(base.task)

  // 바로잡기 실행 — 지도 CTA(바로잡기 문맥 repair=1)를 그대로 따라가 다시 푼다 → 연습 · 도움받은 수행 · G2 결속 없음
  expect(after.nextLabel, '바로잡기 CTA').toContain('바로잡기')
  expect(after.nextHref ?? '').toMatch(/[?&]repair=1/)
  await page.goto(after.nextHref!, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toHaveAttribute('data-mode', 'repair', { timeout: 30_000 })
  const repairId = after.next!.split('/').pop()!
  const repairItem = delivered.find((d) => d.item.id === repairId)!.item
  await runner.locator(`[data-sentence="${repairItem.gold.claim}"]`).click()
  await runner.locator(`[data-sentence="${repairItem.gold.support[0]}"]`).click()
  if (await runner.locator('[data-relation]').count()) await runner.locator(`[data-relation="${repairItem.gold.relationProbe?.relation ?? 'reason'}"]`).click()
  await runner.locator(`[data-choice="${repairItem.gold.answer}"]`).click()
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toContainText('정확히 해냈어요', { timeout: 30_000 })
  await expect(page.locator('[data-testid="authored-binding"]')).toHaveAttribute('data-status', 'repair_practice')
  // 기록 — 새 시도는 연습 · viewed_first 정답, 처음 오답 2 · G2 결속 2 는 그대로
  const all = (await admin().from('learning_task_attempts').select('item_ref, is_correct, activity, help_level').eq('user_id', uid).order('id')).data ?? []
  expect(all.length).toBe(3)
  expect(all.slice(0, 2).every((a) => a.is_correct === false)).toBe(true)
  // 바로잡기 = 원래 세션을 잇는 도움받은 수행(활동 모양은 원래 역할 그대로 · help viewed_first 라 독립 근거 아님)
  expect(all[2]).toMatchObject({ item_ref: `authored:${repairId}`, is_correct: true, help_level: 'viewed_first' })
  const binds2 = (await admin().from('workspace_delivery_attempt').select('delivery_id, evidence').eq('user_id', uid)).data ?? []
  expect(binds2.map((b) => b.delivery_id).sort(), 'G2 결속 불변(바로잡기는 결속 안 함)').toEqual(delivered.map((d) => d.did).sort())
  // 환류 — 바로잡기 성공(repairGate)으로 PLAN 이 바로잡기 다음으로 · 연습 정답은 독립 근거가 아니다(근거 상태 need_confirmed 유지)
  // 진단 — 바로잡기 뒤 첫 시도 원장(지도 판정 입력)의 실효 도움 상태
  const firstsAfter = (await admin().from('learning_first_attempts').select('item_ref, activity, phase, help_level, after_viewed_first, after_explanation, timing_uncertain, is_correct, answered_at').eq('user_id', uid)).data ?? []
  console.log('JOURNEY_FIRSTS_AFTER_REPAIR=' + JSON.stringify(firstsAfter))
  const afterRepair = await observe(page)
  const p4 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 3, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p4.status(), await p4.text()).toBe(200)
  const v4 = await planRow(ws, 4)
  console.log('JOURNEY_REPAIR_DONE=' + JSON.stringify({ afterRepair, v4: v4.task }))
  expect(firstsAfter.every((x) => x.help_level === 'independent' && x.timing_uncertain === false && x.is_correct === false), '바로잡기가 처음 독립 오답의 자격을 소급해 바꾸지 않는다').toBe(true)
  expect(afterRepair.evidence, '도움받은 바로잡기 정답은 독립 근거가 아니다 — 보완 필요 유지').toBe('need_confirmed')
  expect(v4.task?.stage, '바로잡기 성공 → 다음 단계').not.toBe('repair')
  expect((await planRow(ws, 3)).task, 'PLAN v3 이력 불변').toEqual(v3.task)
})
