// apps/web/tests/e2e-isolated/authored-formats.isolated.spec.ts
//
// FINAL §2 — R5 밖 과제 형식 9종을 실제 Chromium(1440 · 1280)으로 종단 검증한다. 러너 안 로컬 Supabase(보류 창작 SQL 은 러너 DB 에만) ·
// 실제 Next.js. 공유 개발 DB · 사람 Gold 승인과 무관하다 — 자격 · 결정 · 승인 행은 「CI 격리 fixture — 사람 결정 아님」(authored-isolated-seed).
//   형식마다: 학습자 세션으로 그 TASK 의 혼자 확인 문항을 납품 → /csat/learn/<id>?d=<납품> → 풀기 전 Gold 비노출 → Gold 대로 입력 → 서버 채점 결과 →
//   DB: 시도 1행 · 이 납품에만 결속 · 근거(evidence) · 열기 세션(FI-010).
//   추가: 오답(이유만 틀림) · 도움 받은 안내 연습(비근거) · 저장 뒤 응답 유실 → 같은 답 재시도(FI-008, 시도 1행) · 연속 클릭 ·
//   다른 페이지 재열기(첫 노출 아님) · 승인 철회 뒤 열기(FI-007) · 키보드 · 가로 넘침 · 지도 Workspace 받은 자료 표시.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SET_DIR = path.resolve(__dirname, '../../src/lib/knowledge/authored')
type Item = { id: string; role: string; body: Record<string, unknown>; gold: Record<string, unknown> }
type Set = { set: string; taskId: string; taskKey: string; format?: string; items: Item[] }
const SETS: Set[] = fs.readdirSync(SET_DIR).filter((x) => x.endsWith('.json')).map((x) => JSON.parse(fs.readFileSync(path.join(SET_DIR, x), 'utf8')))
const bySet = (name: string) => SETS.find((x) => x.set.startsWith(name))!

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
const canonical = (v: unknown): string => v === null ? 'null' : Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : typeof v === 'object' ? `{${Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v)

async function makeUser(tag: string) {
  const email = `iso-fmt-${tag}-${Date.now()}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const client = createClient(URL, ANON, { auth: { persistSession: false } })
  const s = await client.auth.signInWithPassword({ email, password })
  if (s.error) throw s.error
  return { id: data.user.id, email, password, client }
}
async function login(page: Page, u: { email: string; password: string }) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', u.email)
  await page.fill('input[type="password"]', u.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'))
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '가로 넘침').toBeLessThanOrEqual(1)
}

/** 학습자 세션으로 그 TASK · 역할의 수요 줄을 만들고 지정 문항을 납품받는다(DB 정의자 함수가 자격 · 승인 · 사람 결정 · 노출을 판정) */
async function deliver(learner: SupabaseClient, uid: string, ws: string, set: Set, item: Item): Promise<string> {
  const d = { v: 2, user: uid, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `fmt-${item.id}-${Date.now()}`, core: set.taskId, support: [],
    lines: [{ role: item.role, task: set.taskId, n: 1, types: [], keys: [], requires: {}, reason: 'need' }] }
  const dem = await learner.rpc('workspace_demand_record', { p_canonical: canonical(d) })
  if (dem.error) throw new Error(`수요: ${dem.error.message}`)
  const line = (await learner.from('workspace_content_demand_line').select('id').eq('demand_id', dem.data as string).single()).data!.id as string
  const ref = `authored:${item.id}`
  const q = (await admin().from('content_qualification').select('id').eq('artifact_ref', ref).eq('role', item.role).single()).data!.id as string
  const scope = ['independent_check', 'transfer', 'delayed_check'].includes(item.role) ? 'assessment' : 'public'
  const a = (await admin().from('content_release_approval').select('id').eq('qualification_id', q).eq('scope', scope).single()).data!.id as string
  const r = await learner.rpc('workspace_delivery_record', { p_line: line, p_order: null, p_qualification: q, p_approval: a, p_request_key: crypto.randomUUID() })
  if (r.error) throw new Error(`납품 ${item.id}: ${r.error.message}`)
  return r.data as string
}

/** Gold 대로 화면에 입력(형식별 · data-* 값 기준 — 화면 문구가 바뀌어도 시험이 깨지지 않게) */
async function answer(page: Page, format: string, g: Record<string, unknown>, body: Record<string, unknown>, o: { wrongReason?: boolean } = {}) {
  const runner = page.locator('[data-testid="authored-runner"]')
  const click = (sel: string) => runner.locator(sel).first().click()
  switch (format) {
    case 'choice_evidence':
      await click(`[data-choice="${g.answer}"]`); await click(`[data-sentence="${g.decisive}"]`); break
    case 'contextual_sense':
      await click(`[data-choice="${g.answer}"]`); await click(`[data-sentence="${(g.cue as number[])[0]}"]`); break
    case 'demand_choice':
      await click(`[data-choice="${g.answer}"]`); break
    case 'option_correspondence':
      for (const [i, op] of (g.options as { verdict: string; sentence: number | null }[]).entries()) {
        await click(`[data-option="${i}"][data-verdict="${op.verdict}"]`)
        if (op.sentence !== null) await runner.locator(`[data-option-sentence="${i}"]`).selectOption(String(op.sentence))
      }
      await click(`[data-choice="${g.answer}"]`); break
    case 'sentence_relation':
      for (const [i, p] of (g.pairs as { relation: string }[]).entries()) await click(`[data-pair="${i}"][data-pair-rel="${p.relation}"]`)
      break
    case 'form_scope':
      await click(`[data-mark="${g.answer}"]`)
      await click(`[data-reason="${o.wrongReason ? (g.reason === 'voice' ? 'agreement' : 'voice') : g.reason}"]`); break
    case 'segment_choice':
      await click(`[data-segment="${g.answer}"]`); await click(`[data-reason="${g.reason}"]`); break
    case 'discourse_roles':
      for (const [i, r] of (g.roles as string[]).entries()) await runner.locator(`[data-role-index="${i}"]`).selectOption(r)
      await click(`[data-pattern="${g.pattern}"]`); break
    case 'equivalence':
      await click(`[data-same="${String(g.same)}"]`); await click(`[data-mrel="${g.relation}"]`); break
    default: throw new Error(`형식 ${format}`)
  }
  void body
}

const FORMATS: [string, string][] = [
  ['e-evidence-location', 'choice_evidence'], ['e-option-correspondence', 'option_correspondence'], ['v-contextual-sense', 'contextual_sense'],
  ['r-relation', 'sentence_relation'], ['s-form-scope', 'form_scope'], ['r-discourse-function', 'discourse_roles'],
  ['e-task-demand', 'demand_choice'], ['s-sentence-core', 'segment_choice'], ['v-semantic-relation', 'equivalence'],
]

for (const width of [1440, 1280]) {
  test(`창작 형식 9종 종단 — ${width}px`, async ({ page, browser }) => {
    test.setTimeout(600_000)
    await page.setViewportSize({ width, height: 1000 })
    const u = await makeUser(`w${width}`)
    await login(page, u)
    const plan = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: 'ws.central-meaning', order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], planned: {}, reason: 'initial', expectedVersion: 0, clientKey: crypto.randomUUID() } })
    expect(plan.status(), await plan.text()).toBe(200)
    const ws = (await admin().from('learner_workspace').select('id').eq('user_id', u.id).limit(1).single()).data!.id as string

    for (const [name, format] of FORMATS) {
      const set = bySet(name)
      const item = set.items.find((i) => i.role === 'independent_check')!
      const did = await deliver(u.client, u.id, ws, set, item)
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      const runner = page.locator('[data-testid="authored-runner"]')
      await expect(runner, `${name} 화면`).toHaveAttribute('data-format', format, { timeout: 30_000 })
      await expect(page.locator('[data-testid="authored-result"]')).toHaveCount(0)
      await noOverflow(page)
      // 열기 세션(FI-010) — 본문을 연 순간 노출 원장에 남는다
      await expect.poll(async () => (await admin().from('learning_sessions').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('item_ref', `authored:${item.id}`)).count ?? 0).toBeGreaterThan(0)
      await answer(page, format, item.gold, item.body)
      const submit = runner.getByRole('button', { name: '맞춰 보기' })
      await expect(submit, `${name} 입력 완료`).toBeEnabled()
      await submit.click()
      await submit.click({ timeout: 500 }).catch(() => undefined) // 연속 클릭 — 저장 중 잠금(아래 시도 1행으로 확인)
      const result = page.locator('[data-testid="authored-result"]')
      await expect(result, `${name} 결과`).toBeVisible({ timeout: 30_000 })
      await expect(result).toContainText('정확히 해냈어요')
      await noOverflow(page)
      await expect.poll(async () => (await admin().from('workspace_delivery_attempt').select('delivery_id, evidence').eq('user_id', u.id).eq('artifact_ref', `authored:${item.id}`)).data ?? [], { timeout: 15_000 })
        .toEqual([{ delivery_id: did, evidence: true }])
      expect((await admin().from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('item_ref', `authored:${item.id}`)).count, `${name} 시도 1행`).toBe(1)
    }

    // 오답 — 어법: 위치만 맞고 이유가 틀리면 오답(우연 정답 구별) · 결속은 남는다
    {
      const set = bySet('s-form-scope')
      const item = set.items.filter((i) => i.role === 'independent_check')[1]
      const did = await deliver(u.client, u.id, ws, set, item)
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      await answer(page, 'form_scope', item.gold, item.body, { wrongReason: true })
      await page.locator('[data-testid="authored-runner"]').getByRole('button', { name: '맞춰 보기' }).click()
      await expect(page.locator('[data-testid="authored-result"]')).toContainText('이번에는 어긋났어요', { timeout: 30_000 })
    }

    // 도움 받은 안내 연습 — 단서를 열고 풀면 결속은 남지만 근거가 아니다
    {
      const set = bySet('e-evidence-location')
      const item = set.items.find((i) => i.role === 'guided_practice')!
      const did = await deliver(u.client, u.id, ws, set, item)
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: /단서 1 열기/ }).click()
      await answer(page, 'choice_evidence', item.gold, item.body)
      await page.locator('[data-testid="authored-runner"]').getByRole('button', { name: '맞춰 보기' }).click()
      await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
      await expect.poll(async () => (await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', u.id).eq('delivery_id', did)).data?.[0]?.evidence ?? null).toBe(false)
    }

    // FI-008 — 저장은 됐는데 응답이 유실 → 같은 답으로 다시 누르면 같은 제출(시도 1행 · 결과 표시)
    {
      const set = bySet('v-contextual-sense')
      const item = set.items.filter((i) => i.role === 'independent_check')[1]
      const did = await deliver(u.client, u.id, ws, set, item)
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      let dropped = false
      await page.route(`**/api/csat/authored/${item.id}/attempt`, async (route) => {
        if (dropped) return route.continue()
        dropped = true
        await route.fetch() // 서버는 저장한다
        await route.fulfill({ status: 502, body: '{"error":"gateway"}' }) // 응답만 유실
      })
      await answer(page, 'contextual_sense', item.gold, item.body)
      const submit = page.locator('[data-testid="authored-runner"]').getByRole('button', { name: '맞춰 보기' })
      await submit.click()
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 })
      await submit.click()
      await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
      expect((await admin().from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('item_ref', `authored:${item.id}`)).count).toBe(1)
      await page.unroute(`**/api/csat/authored/${item.id}/attempt`)
    }

    // FI-010 — 응답 없이 닫고 다른 페이지로 다시 열어 풀면 첫 노출이 아니다(비근거)
    {
      const set = bySet('s-sentence-core')
      const item = set.items.filter((i) => i.role === 'independent_check')[1]
      const did = await deliver(u.client, u.id, ws, set, item)
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-testid="authored-runner"]')).toBeVisible()
      const other = await page.context().newPage()
      await other.setViewportSize({ width, height: 1000 })
      await other.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      await answer(other, 'segment_choice', item.gold, item.body)
      await other.locator('[data-testid="authored-runner"]').getByRole('button', { name: '맞춰 보기' }).click()
      await expect(other.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
      await expect.poll(async () => (await admin().from('workspace_delivery_attempt').select('evidence, non_evidence_reason').eq('user_id', u.id).eq('delivery_id', did)).data?.[0] ?? null)
        .toEqual({ evidence: false, non_evidence_reason: 'not_first_exposure' })
      await other.close()
    }

    // FI-007 — 승인 철회 뒤에는 자료가 열리지 않는다(지난 결과는 기록에 남는다). 철회는 격리 관리자 fixture 세션으로
    {
      const creds = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../.agent-logs/authored-isolated-admin.json'), 'utf8')) as { email: string; password: string }
      const adm = createClient(URL, ANON, { auth: { persistSession: false } })
      expect((await adm.auth.signInWithPassword({ email: creds.email, password: creds.password })).error).toBeNull()
      // 철회는 공유 fixture 를 바꾼다(추가 전용 · 되돌릴 수 없다) — 너비마다 다른 문항을 철회해 다른 시험이 정상 거부를 오탐하지 않게
      const set = bySet('v-semantic-relation')
      const item = set.items.find((i) => i.role === (width === 1440 ? 'independent_check' : 'delayed_check') && (width !== 1440 || i.id.endsWith('-2')))!
      const did = await deliver(u.client, u.id, ws, set, item)
      const dec = (await admin().from('content_human_decision').select('id').eq('artifact_ref', `authored:${item.id}`).eq('kind', 'rights').single()).data!.id as string
      expect((await adm.rpc('content_human_decision_revoke', { p_decision: dec, p_reason: 'e2e 철회' })).error).toBeNull()
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('지금은 열 수 없는 자료예요')).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-testid="authored-runner"]')).toHaveCount(0)
    }

    // 키보드 — 근거 문장 버튼을 Tab 초점 · Enter 로 고른다
    {
      const set = bySet('e-evidence-location')
      const item = set.items.filter((i) => i.role === 'independent_check')[1]
      const did = await deliver(u.client, u.id, ws, set, item)
      await page.goto(`/csat/learn/${item.id}?d=${did}`, { waitUntil: 'domcontentloaded' })
      const bar = page.locator('[data-testid="authored-runner"] [data-sentence="0"]')
      await bar.focus(); await expect(bar).toBeFocused(); await page.keyboard.press('Enter')
      await expect(bar).toHaveAttribute('aria-pressed', 'true')
    }

    // 지도 복귀 — 같은 TASK 의 Workspace(정본 content_needed 템플릿도) 「받은 자료」에 결과가 보인다
    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator('[data-testid="ws-row"][data-ws="ws.vocab-context"] [data-testid="ws-open"]').click()
    await expect(page.locator('[data-testid="ws-authored-list"]')).toContainText('풀었어요')
    await noOverflow(page)
    void browser
  })
}
