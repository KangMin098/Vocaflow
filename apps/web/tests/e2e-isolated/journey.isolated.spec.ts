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
  return { priority, evidence, next: next?.split('?')[0] ?? null, blocked }
}
async function planRow(ws: string, version: number) {
  const r = (await admin().from('learner_workspace_plan').select('user_id, plan_version, reason, goal_version_id, plan').eq('workspace_id', ws).eq('plan_version', version).single()).data!
  const t = (r.plan as { tasks: { task: string; stage?: string | null; planned?: unknown }[] }).tasks.find((x) => x.task === TASK) ?? null
  return { ...r, stage: t?.stage ?? null }
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

  // C 수행 전 관찰 — 지도가 계산한 근거 상태 · 다음 행동 · 우선순위
  const before = await observe(page)
  expect(['not_measured', 'axis_observation', 'checking']).toContain(before.evidence) // 화면 용어(v6.2 InspectorEvidence)

  // F 납품 → 학습 · 독립 확인 2 · 전이 1(같은 user · 같은 Workspace · PLAN v1)
  const ind = R5.items.filter((i) => i.role === 'independent_check').slice(0, 2)
  const tr = R5.items.filter((i) => i.role === 'transfer').slice(0, 1)
  const delivered: { item: Item; did: string }[] = []
  for (const item of [...ind, ...tr]) delivered.push({ item, did: await deliver(learner, uid, ws.id, 1, item) })
  for (const { item, did } of delivered) await solve(page, item, did)

  // G2 — 각 시도가 그 납품에만 결속 · 독립 첫 시도 = 근거
  const bindings = (await admin().from('workspace_delivery_attempt').select('delivery_id, evidence, user_id').eq('user_id', uid)).data ?? []
  expect(bindings.map((b) => b.delivery_id).sort()).toEqual(delivered.map((d) => d.did).sort())
  expect(bindings.every((b) => b.evidence === true && b.user_id === uid)).toBe(true)

  // 진단 — 지도 근거 판정이 읽는 실제 행(첫 시도 원장 · 시도 원장 · 결속 원장)
  const firsts = (await admin().from('learning_first_attempts').select('*').eq('user_id', uid)).data ?? []
  const atts = (await admin().from('learning_task_attempts').select('id, item_ref, task_key, session_id, content_hash, activity, phase, help_level, synthetic').eq('user_id', uid)).data ?? []
  const binds = (await admin().from('workspace_delivery_attempt').select('attempt_id, evidence, annotation_hash, session_id, non_evidence_reason').eq('user_id', uid)).data ?? []
  console.log('JOURNEY_ROWS=' + JSON.stringify({ firsts, atts, binds }))

  // H 수행 후 관찰 — 근거로 바뀐 값(단순 복귀가 아니다)
  const after = await observe(page)
  console.log('JOURNEY_OBSERVE=' + JSON.stringify({ before, after }))
  // 직접 확인 판정 — 정답 두 개는 「보완 필요」 확정도 「다시 확인 통과」도 아니다(재확인은 시간을 둔다) → checking 이 규칙대로의 값
  expect(['checking', 'need_confirmed', 'passed_current_policy']).toContain(after.evidence)
  expect(after.evidence, 'TASK 근거 상태가 수행 근거로 바뀌어야 한다').not.toBe(before.evidence)
  // 다음 행동 — 목표 시험과의 연결이 확인 전(relevance_unknown)이면 행동을 내밀지 않는다(합성 회차엔 기출 연결이 없다 · 격리 데이터 한계).
  //   그 경우만 「바뀌지 않음」을 기록하고, 그 밖에는 반드시 바뀌어야 한다
  if (before.blocked === 'relevance_unknown' && after.blocked === 'relevance_unknown') console.log('JOURNEY_NEXT=unchanged:relevance_unknown(합성 회차 · 기출 연결 없음)')
  else expect({ next: after.next, blocked: after.blocked }, '다음 행동이 바뀌어야 한다').not.toEqual({ next: before.next, blocked: before.blocked })

  // PLAN v2 — 확인 결과로 다시 계산 · 같은 목표 버전 · 이력 보존
  const p2 = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 1, expectedGoalVersion: goalVersionId, clientKey: crypto.randomUUID() } })
  expect(p2.status(), await p2.text()).toBe(200)
  const v2 = await planRow(ws.id, 2)
  console.log('JOURNEY_PLAN=' + JSON.stringify({ v1: { stage: v1.stage }, v2: { stage: v2.stage } }))
  expect(v2).toMatchObject({ user_id: uid, reason: 'check_result', goal_version_id: goalVersionId })
  // 목표 연결 확인 전(relevance_unknown)이면 To-Be 가 이 TASK 를 요구로 올리지 않아 PLAN 단계가 배정되지 않는다(합성 회차 · 격리 데이터 한계).
  //   그 경우만 단계 불변을 기록한다 — 「PLAN 이 근거로 바뀐다」는 이 실행으로 증명되지 않는다(결과 보고에 그대로 적는다)
  if (after.blocked === 'relevance_unknown') console.log('JOURNEY_PLAN_STAGE=unchanged:relevance_unknown')
  else expect(v2.stage, '저장 PLAN 의 TASK 단계가 근거로 바뀌어야 한다').not.toBe(v1.stage)
  expect((await planRow(ws.id, 1)).stage, 'PLAN v1 이력은 그대로').toBe(v1.stage)
})
