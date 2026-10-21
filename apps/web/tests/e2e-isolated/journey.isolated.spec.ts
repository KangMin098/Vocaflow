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
type Item = { id: string; role: string; passageGroup: string; gold: { answer: number; claim: number; support: number[]; relationProbe?: { sentence: number; relation: string } } }
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
  const scope = ['independent_check', 'transfer', 'delayed_check'].includes(item.role) ? 'assessment' : 'public' // 교수 · 안내 연습은 공개 범위 승인
  const a = (await admin().from('content_release_approval').select('id').eq('qualification_id', q).eq('scope', scope).single()).data!.id as string
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
/** 실제 자료 받기 API(학습자 세션) — 지금 저장 PLAN · 단계의 수요로 공급. 줄마다 역할 · 받은 ref */
async function supply(page: Page): Promise<{ role: string; delivered: string[]; requested: number }[]> {
  const r = await page.request.post('/api/csat/authored/supply', { data: { task: TASK, template: TEMPLATE } })
  const j = await r.json().catch(() => ({}))
  expect(r.status(), JSON.stringify(j)).toBe(200)
  expect(j.status, JSON.stringify(j)).toBe('ok')
  return (j.lines ?? []).map((l: { role: string; delivered: string[]; requested: number }) => ({ role: l.role, delivered: l.delivered, requested: l.requested })).filter((l: { delivered: string[] }) => l.delivered.length > 0)
}
/** 그 학습자 · 자료 · 역할의 납품 id(DB 원장) */
async function deliveryOf(uid: string, ref: string, role: string): Promise<string> {
  const r = await admin().from('workspace_content_delivery').select('id').eq('user_id', uid).eq('artifact_ref', ref).eq('role', role).order('delivered_at', { ascending: false }).limit(1)
  expect(r.error, r.error?.message).toBeNull()
  expect((r.data ?? []).length, `납품 없음 ${ref} ${role}`).toBe(1)
  return (r.data as { id: string }[])[0].id
}
/** UI 증거(UI Quality Gate) — 실제 화면 캡처를 시험 출력 폴더에(CI 가 e2e-isolated-report 로 올린다) · 가로 넘침 0 */
async function snap(page: Page, name: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over, `${name} 가로 넘침`).toBeLessThanOrEqual(0)
  await page.screenshot({ path: test.info().outputPath(`${name}-${page.viewportSize()?.width}.png`) })
}
async function planRow(ws: string, version: number) {
  const r = (await admin().from('learner_workspace_plan').select('user_id, plan_version, reason, goal_version_id, plan').eq('workspace_id', ws).eq('plan_version', version).single()).data!
  const t = (r.plan as { tasks: { task: string; stage?: string | null; planned?: unknown; available?: unknown }[] }).tasks.find((x) => x.task === TASK) ?? null
  return { ...r, stage: t?.stage ?? null, task: t ? { stage: t.stage ?? null, planned: t.planned ?? null, available: t.available ?? null } : null }
}
async function solve(page: Page, item: Item, did: string, query = '') {
  await page.goto(`/csat/learn/${item.id}?d=${did}${query}`, { waitUntil: 'domcontentloaded' })
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
  await solve(page, target.item, target.did)
  // T-0075 — 통제 손실: 전이 풀이는 실제로 저장 · 결속되지만 첫 응답의 binding · attemptId 만 지운다 → 실제 bind API 로 다시 연결 → 같은 수행으로 지도 복귀
  const rowCounts = async () => Promise.all(['learning_task_attempts', 'workspace_delivery_attempt', 'learner_workspace_plan'].map(async (t) => (await admin().from(t).select('*', { count: 'exact', head: true }).eq('user_id', uid)).count))
  await page.route('**/api/csat/authored/*/attempt', async (route) => {
    const res = await route.fetch()
    const j = await res.json() as Record<string, unknown>
    delete j.binding; delete j.attemptId
    await route.fulfill({ response: res, json: j })
  }, { times: 1 })
  await solve(page, delivered[2].item, delivered[2].did, `&from=map&map_task=${TASK}`)
  const lost = page.locator('[data-testid="authored-binding"]')
  await expect(lost, '응답 메타 손실 = 확인 못 함(근거 · 도움으로 추정하지 않음)').toHaveAttribute('data-kind', 'unknown')
  const backLink = page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' })
  expect(await backLink.getAttribute('href'), '특정 불가 = 이번 활동 없음').not.toContain('map_attempt=')
  const countsBefore = await rowCounts()
  const bindReq = page.waitForRequest((r) => r.url().endsWith('/api/csat/delivery/bind') && r.method() === 'POST')
  await page.locator('[data-testid="authored-rebind"]').focus(); await page.keyboard.press('Enter')
  const sentBind = (await bindReq).postDataJSON() as { deliveryId: string }
  expect(sentBind.deliveryId).toBe(delivered[2].did)
  await expect(lost).toHaveAttribute('data-kind', 'evidence', { timeout: 30_000 })
  const boundRow = (await admin().from('workspace_delivery_attempt').select('attempt_id').eq('user_id', uid).eq('delivery_id', delivered[2].did).single()).data!
  await expect(backLink, '같은 수행으로 복귀').toHaveAttribute('href', new RegExp(`map_attempt=${boundRow.attempt_id}(&|$)`))
  expect(await rowCounts(), '다시 연결 = 시도 · G2 결속 · PLAN 행 수 불변').toEqual(countsBefore)
  await snap(page, 'binding-recovered')

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

// 다시 확인 결과 두 갈래(T-0050 rev5 기준 3) — pass: 새 지문 정답 → 해소 · fail: 다시 틀림 → 새 바로잡기 회차(이전 안내 연습 성공 불승계)
for (const outcome of ['pass', 'fail'] as const) test(`양성 경로(${outcome}) — 서로 다른 독립 확인 2 오답 → 보완 필요 확정 → PLAN 확인 → 바로잡기 → 적용 → 다시 확인`, async ({ page }) => {
  test.setTimeout(300_000)
  const { uid, learner, ws, goalVersionId } = await begin(page, 'repair')
  // PC 두 폭 — pass 갈래 1440 · fail 갈래 1280(UI 수용 기준 · 같은 화면을 두 폭에서)
  if (outcome === 'fail') await page.setViewportSize({ width: 1280, height: 900 })
  const ind = R5.items.filter((i) => i.role === 'independent_check').slice(0, 2)
  const delivered: { item: Item; did: string }[] = []
  for (const item of ind) delivered.push({ item, did: await deliver(learner, uid, ws, 1, item) })
  // 전이 자료 1 — 바로잡기 성공 뒤 「적용」 단계로 넘어갈 자료(없으면 설계상 바로잡기에 머문다 · stageNow)
  const transferItem = R5.items.find((i) => i.role === 'transfer')!
  await deliver(learner, uid, ws, 1, transferItem)
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

  // 바로잡기 — 평가 자료는 다시 풀지 않는다. 자료가 없으면 「바로잡기 자료 필요」 대기(FI-011 · Codex 확정 설계)
  expect(after.next, '평가 자료를 바로잡기로 다시 내밀지 않는다').toBeNull()
  expect(after.blocked).toBe('repair_material_needed')
  await snap(page, 'map-repair-material-needed')
  // 바로잡기 자료(안내 연습 · 별도 자격 · 평가 지문과 분리)를 **실제 자료 받기 API** 로 받는다(T-0050 rev5 기준 0) — 지금 계획 단계(repair)의 수요만.
  //   평가 역할(혼자 확인 · 전이 · 다른 날)은 이 공급에 섞이지 않는다 → 지도 CTA 「바로잡기 · 안내 연습」
  const repairSupply = await supply(page)
  expect(repairSupply.map((l) => l.role).sort(), '바로잡기 단계 수요는 교수 · 안내 연습만').toEqual(expect.arrayContaining(['guided_practice', 'model_explanation']))
  expect(repairSupply.some((l) => ['independent_check', 'transfer', 'delayed_check'].includes(l.role)), '평가 자료를 바로잡기로 공급하지 않는다').toBe(false)
  const guidedRef = repairSupply.find((l) => l.role === 'guided_practice')!.delivered[0]
  const guided = R5.items.find((i) => `authored:${i.id}` === guidedRef)!
  const guidedDid = await deliveryOf(uid, guidedRef, 'guided_practice')
  const withMaterial = await observe(page)
  expect(withMaterial.nextLabel ?? '').toContain('안내 연습')
  expect(withMaterial.next).toBe(`/csat/learn/${guided.id}`)
  await snap(page, 'map-repair-guided-next')
  // 안내 연습 수행 — 실제 Runner · 서버 채점 · 연습 기록(G2 근거 false)
  const runner = page.locator('[data-testid="authored-runner"]')
  const solveGuided = async (choice: number) => {
    await expect(runner).toHaveAttribute('data-format', 'central_meaning', { timeout: 30_000 })
    await runner.locator(`[data-sentence="${guided.gold.claim}"]`).click()
    await runner.locator(`[data-sentence="${guided.gold.support[0]}"]`).click()
    if (await runner.locator('[data-relation]').count()) await runner.locator(`[data-relation="${guided.gold.relationProbe?.relation ?? 'reason'}"]`).click()
    await runner.locator(`[data-choice="${choice}"]`).click()
    await runner.getByRole('button', { name: '맞춰 보기' }).click()
  }
  // 1) 오답 — 바로잡기 성공이 아니다. 지도는 같은 안내 연습을 다시 내민다(Codex P1-1)
  await page.goto(withMaterial.nextHref!, { waitUntil: 'domcontentloaded' })
  await solveGuided((guided.gold.answer + 1) % 5) // 5지선다
  await expect(page.locator('[data-testid="authored-result"]')).toContainText('어긋났어요', { timeout: 30_000 })
  const afterWrong = await observe(page)
  expect(afterWrong.next, '오답 뒤에도 같은 안내 연습').toBe(`/csat/learn/${guided.id}`)
  expect(afterWrong.evidence).toBe('need_confirmed')
  // 2) 다시 열기 → 「다시 풀기」 → 정답(append-only 새 시도 · 앞 기록 유지)
  await page.goto(afterWrong.nextHref!, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="authored-retry"]').click()
  await solveGuided(guided.gold.answer)
  await expect(page.locator('[data-testid="authored-result"]')).toContainText('정확히 해냈어요', { timeout: 30_000 })
  await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid).eq('delivery_id', guidedDid)).data ?? []).map((b) => b.evidence), { timeout: 15_000 }).toEqual([false, false])
  const guidedRows = (await admin().from('learning_task_attempts').select('is_correct').eq('user_id', uid).eq('item_ref', `authored:${guided.id}`).order('answered_at')).data ?? []
  expect(guidedRows.map((r) => r.is_correct), '안내 연습 이력 append-only').toEqual([false, true])
  // 기록 — 처음 독립 오답 2 의 자격 · G2 결속은 그대로 · 안내 연습은 연습 활동
  const firstsAfter = (await admin().from('learning_first_attempts').select('item_ref, help_level, timing_uncertain, is_correct').eq('user_id', uid).in('item_ref', delivered.map((d) => `authored:${d.item.id}`))).data ?? []
  expect(firstsAfter.length).toBe(2)
  expect(firstsAfter.every((x) => x.help_level === 'independent' && x.timing_uncertain === false && x.is_correct === false), '처음 독립 오답 자격 불변').toBe(true)
  const indBinds = (await admin().from('workspace_delivery_attempt').select('delivery_id, evidence').eq('user_id', uid).in('delivery_id', delivered.map((d) => d.did))).data ?? []
  expect(indBinds.every((b) => b.evidence === true) && indBinds.length === 2).toBe(true)
  // 환류 — 안내 연습 정답 = 바로잡기 성공 → PLAN 적용 단계 · 연습은 독립 근거가 아니다(보완 필요 유지)
  const afterRepair = await observe(page)
  const p4 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 3, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p4.status(), await p4.text()).toBe(200)
  const v4 = await planRow(ws, 4)
  console.log('JOURNEY_REPAIR_DONE=' + JSON.stringify({ withMaterial, afterRepair, v4: v4.task }))
  expect(afterRepair.evidence, '안내 연습 정답은 독립 근거가 아니다').toBe('need_confirmed')
  expect(v4.task?.stage, '바로잡기 성공 → 적용 단계(전이 자료 있음)').toBe('transfer')
  expect(afterRepair.next).toBe(`/csat/learn/${transferItem.id}`)
  expect((await planRow(ws, 3)).task, 'PLAN v3 이력 불변').toEqual(v3.task)

  // ── T-0050 rev5: 적용(정본 2지문) → 다시 확인(새 미노출 독립 확인) → G2 → MAP → 다음 행동 → PLAN ──
  // 적용 둘째 지문은 실제 공급 API 로(적용 단계 수요 = transfer 만)
  const transferSupply = await supply(page)
  expect(transferSupply.map((l) => l.role), '적용 단계 수요는 전이만').toEqual(['transfer'])
  const transfers = [transferItem, ...transferSupply[0].delivered.filter((r) => r !== `authored:${transferItem.id}`).map((r) => R5.items.find((i) => `authored:${i.id}` === r)!)]
  expect(new Set(transfers.map((t) => t.passageGroup)).size, '서로 다른 전이 지문 2').toBe(2)
  for (const t of transfers) await solve(page, t, await deliveryOf(uid, `authored:${t.id}`, 'transfer'))
  const afterTransfer = await observe(page)
  const p5 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 4, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p5.status(), await p5.text()).toBe(200)
  const v5 = await planRow(ws, 5)
  expect(v5.task?.stage, '적용 2지문 → 다시 확인 단계').toBe('recheck')
  // 다시 확인 재고 0(혼자 확인 2 는 이미 봤다) → 정확한 대기(자료 필요) — 바로잡기로 되돌리지 않는다(FI-011 B)
  expect(afterTransfer.next).toBeNull()
  expect(afterTransfer.blocked).toBe('material_needed')
  await snap(page, 'map-recheck-material-needed')
  expect(afterTransfer.evidence, '적용 수행은 독립 근거가 아니다').toBe('need_confirmed')
  // 다시 확인 자료 — 실제 공급 API(수요 = independent_check) · 이미 본 평가 지문(ind-1 · 2)은 다시 납품하지 않는다
  const recheckSupply = await supply(page)
  expect(recheckSupply.map((l) => l.role)).toEqual(['independent_check'])
  const seen = new Set(delivered.map((d) => `authored:${d.item.id}`))
  const fresh = recheckSupply[0].delivered.filter((r) => !seen.has(r))
  expect(fresh.length, '새 미노출 독립 확인 2').toBe(2)
  const withRecheck = await observe(page)
  expect(fresh.map((r) => `/csat/learn/${r.slice('authored:'.length)}`)).toContain(withRecheck.next)
  await snap(page, 'map-recheck-next')
  // 새 독립 확인 2 — 지도 CTA 를 따라 실제 Runner · 서버 채점 · G2 결속(본인 · TASK · 납품 · 서버 결과). pass 는 정답, fail 은 명확한 오답
  const freshDids: string[] = []
  for (const ref of fresh) {
    const item = R5.items.find((i) => `authored:${i.id}` === ref)!
    const did = await deliveryOf(uid, ref, 'independent_check')
    freshDids.push(did)
    if (outcome === 'pass') {
      await solve(page, item, did)
      await expect(page.locator('[data-testid="authored-result"]')).toContainText('정확히 해냈어요', { timeout: 30_000 })
    } else await solveWrong(page, item as never, did)
  }
  await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('delivery_id, evidence').eq('user_id', uid).in('delivery_id', freshDids)).data ?? []).filter((b) => b.evidence === true).length, { timeout: 15_000 }).toBe(2)
  // MAP — 새 독립 근거로만 판정이 바뀐다 · 처음 독립 오답 · G2 · 과거 PLAN 은 그대로
  const resolved = await observe(page)
  await snap(page, `map-recheck-${outcome}`)
  const p6 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 5, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p6.status(), await p6.text()).toBe(200)
  const v6 = await planRow(ws, 6)
  console.log(`JOURNEY_RECHECK_${outcome.toUpperCase()}=` + JSON.stringify({ afterTransfer, withRecheck, resolved, v5: v5.task, v6: v6.task }))
  if (outcome === 'pass') {
    expect(resolved.evidence, '새 지문 독립 확인 2 정답 → 현재 정책 통과').toBe('passed_current_policy')
    expect(resolved.next, '해소 뒤 같은 TASK 를 다시 내밀지 않는다').not.toBe(withRecheck.next)
    expect(['repair', 'transfer'], '해소 → 바로잡기 · 적용 단계가 아니다').not.toContain(v6.task?.stage ?? null)
    // T-0074 — 목표 계획 요약: 지금 정책 통과여도 시간 지나 다시 확인은 아직 근거 없음 + 다른 날 유지 미확인 안내
    await expect(page.locator('[data-testid="goal-plan-evidence"][data-delay="NOT_ESTABLISHED"]').first()).toBeAttached()
    await expect(page.locator('[data-testid="goal-plan-scope-note"]').first()).toBeAttached()
  } else {
    // 다시 틀림 = 새 바로잡기 회차. 회차 전의 안내 연습 정답은 이번 회차 성공이 아니다 → 단계 repair · 다음 행동은 다시 안내 연습
    expect(resolved.evidence, '다시 확인 실패 → 보완 필요 유지').toBe('need_confirmed')
    expect(v6.task?.stage, '새 바로잡기 회차').toBe('repair')
    expect(resolved.nextLabel ?? '', '이전 안내 연습 성공을 승계하지 않는다').toContain('안내 연습')
    // 평가 자료는 첫 결과로 잠긴다 — 방금 틀린 새 독립 확인 화면에는 다시 풀기가 없다
    const freshItem = R5.items.find((i) => `authored:${i.id}` === fresh[0])!
    await page.goto(`/csat/learn/${freshItem.id}?d=${freshDids[0]}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-testid="authored-retry"]'), '평가 자료 재시도 금지').toHaveCount(0)
    // 실제 CTA 로 안내 연습 열기 → 이미 맞혔던 자료도 「한 번 더 풀어 보기」 → 새 답 저장(append-only) → PLAN 진전(Codex P1)
    expect(resolved.next).toBe(`/csat/learn/${guided.id}`)
    await page.goto(resolved.nextHref!, { waitUntil: 'domcontentloaded' })
    const again = page.locator('[data-testid="authored-retry"]')
    await expect(again).toHaveAttribute('data-after', 'right', { timeout: 30_000 })
    await snap(page, 'learn-guided-retry-after-right')
    await again.click()
    await solveGuided(guided.gold.answer)
    await expect(page.locator('[data-testid="authored-result"]')).toContainText('정확히 해냈어요', { timeout: 30_000 })
    await expect.poll(async () => ((await admin().from('learning_task_attempts').select('is_correct').eq('user_id', uid).eq('item_ref', `authored:${guided.id}`).order('answered_at')).data ?? []).map((r) => r.is_correct), { timeout: 15_000 }).toEqual([false, true, true])
    await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid).eq('delivery_id', guidedDid)).data ?? []).map((b) => b.evidence), { timeout: 15_000 }).toEqual([false, false, false])
    const afterRepair2 = await observe(page)
    const p7 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 6, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
    expect(p7.status(), await p7.text()).toBe(200)
    const v7 = await planRow(ws, 7)
    console.log('JOURNEY_REPAIR2=' + JSON.stringify({ afterRepair2, v7: v7.task }))
    expect(v7.task?.stage, '새 회차 안내 연습 정답 → 바로잡기 단계를 넘는다').not.toBe('repair')
    expect(afterRepair2.evidence, '안내 연습은 독립 근거가 아니다').toBe('need_confirmed')
    expect((await planRow(ws, 6)).task, 'PLAN v6 이력 불변').toEqual(v6.task)
  }
  expect(v6).toMatchObject({ user_id: uid, reason: 'check_result', goal_version_id: goalVersionId })
  for (const [n, t] of [[3, v3.task], [4, v4.task], [5, v5.task]] as const) expect((await planRow(ws, n)).task, `PLAN v${n} 이력 불변`).toEqual(t)
  const firstsEnd = (await admin().from('learning_first_attempts').select('item_ref, is_correct, help_level').eq('user_id', uid).in('item_ref', delivered.map((d) => `authored:${d.item.id}`))).data ?? []
  expect(firstsEnd.every((x) => x.is_correct === false && x.help_level === 'independent') && firstsEnd.length === 2, '처음 독립 오답 불변').toBe(true)
})
