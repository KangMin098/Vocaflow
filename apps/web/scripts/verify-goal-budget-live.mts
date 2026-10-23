// apps/web/scripts/verify-goal-budget-live.mts
// Explicitly approved live acceptance. Own synthetic account only; retain goal/PLAN history and suspend the account afterward. No deletion, mail, tracing, or saved credentials.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { chromium, expect } from '@playwright/test'
import { templateOf } from '../src/lib/csat/map/v4/definition'

config({ path: path.resolve('.env.local'), quiet: true })
config({ path: path.resolve('../../.env.local'), quiet: true })
const SHA = 'fbd370acc6d2c2eba552678de101079fff26a589629b38a4a800d83ba47181ae'
const PATCH_SHA = '29fe915485f0fc772262228776a1ce9cce1fefd12109c83e8cc5fdc7c5577b4c'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const WS = 'ws.central-meaning'
const attemptId = randomUUID()
const apiOnly = process.argv.includes('--api-only')
const rpcRace = process.argv.includes('--rpc-race')
const report: { schema: string; scope: string; head: string; approvedSha: string; checks: string[]; cleanup: string; status: string } = { schema: 'goal-budget-live/1', scope: apiOnly ? 'authenticated goal API / real DB only; map and PLAN UI unconfirmed' : 'authenticated map and PLAN UI', head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), approvedSha: SHA, checks: [], cleanup: 'not_created', status: 'running' }
report.scope += rpcRace ? '; concurrency via real RPC, parallel HTTP unconfirmed' : '; concurrency via parallel HTTP'
const mark = (name: string) => { report.checks.push(name); console.log(`PASS ${name}`) }
const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) })
const saveReport = () => {
  fs.mkdirSync('output', { recursive: true })
  const sourceFiles = ['scripts/verify-goal-budget-live.mts', 'src/lib/csat/map/v4/plan-store.ts', 'src/lib/csat/map/v62/target-goal.ts', 'src/lib/csat/map/v62/goal-budget.ts', 'src/app/api/csat/diagnosis/map/goal/route.ts', 'src/lib/csat/map/server.ts', '../../supabase/migrations/20261023090000_csat_goal_budget.sql', '../../supabase/migrations/20261023142000_csat_goal_budget_conflict.sql']
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
  const body = JSON.stringify({ ...report, sourceHashes }, null, 2) + '\n'
  fs.writeFileSync(`output/goal-schedule-live${apiOnly ? '-api' : ''}.json`, body)
  fs.writeFileSync(`output/goal-schedule-live-${attemptId}.json`, body)
}

async function run(now: Date) {
  assert.equal(process.env.GOAL_BUDGET_LIVE_APPROVED_SHA, SHA, 'Explicit approved SHA flag required for live writes')
  assert.equal(process.env.GOAL_BUDGET_CONFLICT_PATCH_APPROVED_SHA, PATCH_SHA, 'Stop: first obtain separate approval and install the conflict patch; rev2 raises retryable 40001')
  assert.ok(url && key && anon, 'Supabase environment missing')
  assert.equal(new URL(url).hostname.split('.')[0], 'jajenrevcbmrpaliomxv', 'Only the approved development project is allowed')
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Only the local Next server is allowed')
  assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve('../../supabase/migrations/20261023090000_csat_goal_budget.sql'))).digest('hex'), SHA)
  assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve('../../supabase/migrations/20261023142000_csat_goal_budget_conflict.sql'))).digest('hex'), PATCH_SHA)
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } })
  const snapshot = async (table: 'csat_map_goal_version' | 'learner_workspace_plan') => {
    const rows: { id: unknown }[] = []
    for (let offset = 0; ; offset += 1000) {
      const result = await admin.from(table).select('*').order('id').range(offset, offset + 999)
      assert.equal(result.error, null)
      const page = result.data ?? []
      rows.push(...page)
      if (page.length < 1000) return rows
    }
  }
  const assertPreserved = async (table: 'csat_map_goal_version' | 'learner_workspace_plan', before: { id: unknown }[]) => {
    const after = new Map((await snapshot(table)).map(row => [row.id, row]))
    for (const row of before) assert.deepEqual(after.get(row.id), row, `Original ${table} row changed`)
  }
  console.log('STEP installed writer REST preflight (30s limit)')
  const validator = await admin.rpc('csat_goal_budget_valid', { p_budget: { weeklyMinutes: 0, dailyMinutes: null, minutesPerUnit: 10, priorities: [] } })
  assert.equal(validator.error, null, 'Approved validator must be installed before account creation')
  assert.equal(validator.data, true)
  const originalGoals = await snapshot('csat_map_goal_version')
  const originalPlans = await snapshot('learner_workspace_plan')
  const browser = await chromium.launch()
  let uid: string | null = null
  let captureFailure: (() => Promise<void>) | null = null
  let revokeSession: (() => Promise<void>) | null = null
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    captureFailure = async () => { await page.screenshot({ path: 'output/goal-schedule-live-failure.png', fullPage: true }) }
    const loggedOut = await context.request.get('/api/csat/diagnosis/map/plan')
    assert.equal(loggedOut.status(), 401)
    const email = `goal-budget-qa-${randomUUID()}@example.com`
    const password = `QA-${randomBytes(24).toString('base64url')}-Aa1`
    console.log('STEP create own synthetic account; no email sent')
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: '목표 예산 검증', synthetic: true } })
    assert.equal(made.error, null, 'Synthetic account creation failed')
    uid = made.data.user!.id
    report.cleanup = 'pending'
    const learner = createServerClient(url, anon, { global: { fetch: boundedFetch }, cookies: {
      getAll: async () => (await context.cookies()).map(c => ({ name: c.name, value: c.value })),
      setAll: async cookies => { await context.addCookies(cookies.map(({ name, value, options }) => ({ name, value, domain: new URL(baseURL).hostname, path: options.path ?? '/', secure: options.secure ?? false, httpOnly: options.httpOnly ?? false, sameSite: options.sameSite === 'strict' ? 'Strict' : options.sameSite === 'none' ? 'None' : 'Lax' }))) },
    } })
    const signed = await learner.auth.signInWithPassword({ email, password })
    assert.equal(signed.error, null, 'Real synthetic-user authentication failed')
    if (signed.data.session) {
      const token = signed.data.session.access_token
      revokeSession = async () => { assert.equal((await admin.auth.admin.signOut(token, 'global')).error, null, 'Own QA global sign-out failed') }
    }
    assert.equal((await learner.auth.getUser()).data.user?.id, uid)
    mark('real Supabase sign-in, browser SSR session and anonymous Next API rejection')
    const deadline = new Date(now.getTime() + 28 * 86400000).toISOString().slice(0, 10)
    const read = async () => {
      const res = await context.request.get('/api/csat/diagnosis/map/plan', { timeout: 120_000 })
      assert.equal(res.status(), 200)
      const body = await res.json()
      assert.ok(!body.error, 'Saved-state read must succeed')
      return body
    }
    const race = async (requests: { target: number; grade: number; exam: string; date: string; expectedGoalVersion: number | null; clientKey: string; budget: { weeklyMinutes: number; dailyMinutes: null; minutesPerUnit: number; priorities: never[] } }[]) => {
      if (!rpcRace) return Promise.all(requests.map(data => context.request.put('/api/csat/diagnosis/map/goal', { data, timeout: 120_000 })))
      const result = await Promise.all(requests.map(data => admin.rpc('csat_map_goal_budget_set', { p_user: uid, p_score: data.target, p_grade: data.grade, p_exam: data.exam, p_date: data.date, p_client_key: data.clientKey, p_budget: data.budget, p_expected_goal: data.expectedGoalVersion })))
      assert.deepEqual(result.map(r => r.error?.code ?? 'ok').sort(), ['PT409', 'ok'])
      mark('parallel real PostgreSQL RPC: one committed version, one non-retryable SQLSTATE PT409')
      // Independently require the authenticated HTTP boundary to classify the stale goal.
      const loser = result.findIndex(r => r.error)
      const stale = await context.request.put('/api/csat/diagnosis/map/goal', { data: requests[loser], timeout: 120_000 })
      assert.equal(stale.status(), 409)
      assert.equal((await stale.json()).code, 'goal_changed')
      mark('real authenticated HTTP stale-goal conflict returns 409 goal_changed')
      return result.map(r => ({ status: () => r.error ? 409 : 200, json: async () => r.error ? { code: 'goal_changed' } : { goalVersionId: r.data } }))
    }
    if (apiOnly) {
      const goal = { target: 85, grade: 2, exam: 'kice9', date: deadline, budget: { weeklyMinutes: 120, dailyMinutes: null, minutesPerUnit: 10, priorities: [] }, expectedGoalVersion: null as number | null, clientKey: randomUUID() }
      const put = (data: unknown) => context.request.put('/api/csat/diagnosis/map/goal', { data, timeout: 120_000 })
      assert.equal((await put(goal)).status(), 200)
      const a = await read()
      assert.equal(a.goal.budget.weeklyMinutes, 120)
      const requests = [60, 90].map(weeklyMinutes => ({ ...goal, expectedGoalVersion: a.goal.id as number, budget: { ...goal.budget, weeklyMinutes }, clientKey: randomUUID() }))
      const raced = await race(requests)
      if (raced.some(r => r.status() === 500) && raced.filter(r => r.status() === 200).length === 1) {
        const failed = raced.findIndex(r => r.status() === 500)
        const retry = await put(requests[failed])
        const direct = await admin.rpc('csat_map_goal_budget_set', { p_user: uid, p_score: 85, p_grade: 2, p_exam: 'kice9', p_date: deadline, p_client_key: randomUUID(), p_budget: goal.budget, p_expected_goal: a.goal.id })
        console.log(JSON.stringify({ diagnostic: 'Unexpected HTTP500; original strict race assertion remains', original: raced.map(r => r.status()), sameKeyRetry: retry.status(), directStaleRpcCode: direct.error?.code }))
      }
      assert.deepEqual(raced.map(r => r.status()).sort(), [200, 409])
      const winner = raced.findIndex(r => r.status() === 200)
      assert.equal((await raced[1 - winner].json()).code, 'goal_changed')
      const b = await read()
      assert.equal(b.goal.budget.weeklyMinutes, requests[winner].budget.weeklyMinutes)
      assert.equal(b.goalHistory.length, 2)
      mark(`real Next goal save / server read / ${rpcRace ? 'RPC' : 'HTTP'} CAS: one winner, one goal_changed`)
      const replay = await put(requests[winner])
      assert.equal(replay.status(), 200); assert.equal((await replay.json()).reused, true)
      const changed = await put({ ...requests[winner], target: 86 })
      assert.equal(changed.status(), 409); assert.equal((await changed.json()).code, 'client_key_reused')
      mark('real Next idempotent replay and same-key changed-body rejection')
      const zero = await put({ ...goal, expectedGoalVersion: b.goal.id as number, budget: { ...goal.budget, weeklyMinutes: 0 }, clientKey: randomUUID() })
      assert.equal(zero.status(), 200)
      const c = await read()
      assert.equal(c.goal.budget.weeklyMinutes, 0)
      const clear = await put({ ...goal, expectedGoalVersion: c.goal.id as number, budget: null, clientKey: randomUUID() })
      assert.equal(clear.status(), 200)
      const d = await read()
      assert.equal(d.goal.budget ?? null, null)
      assert.equal(d.goalHistory.length, 4)
      const stale = await put({ ...goal, expectedGoalVersion: c.goal.id as number, clientKey: randomUUID() })
      assert.equal(stale.status(), 409); assert.equal((await stale.json()).code, 'goal_changed')
      assert.equal((await read()).goalHistory.length, 4)
      mark('real zero budget / NULL clearing / stale clear CAS, with all four immutable goal versions retained')
      const own = await learner.from('csat_map_goal_version').select('id').eq('user_id', uid)
      assert.equal(own.error, null); assert.equal(own.data?.length, 4)
      const other = await learner.from('csat_map_goal_version').select('id').neq('user_id', uid)
      assert.equal(other.error, null); assert.deepEqual(other.data, [])
      const denied = await learner.rpc('csat_map_goal_budget_set', { p_user: uid, p_score: 85, p_grade: 2, p_exam: 'kice9', p_date: deadline, p_client_key: randomUUID(), p_budget: null, p_expected_goal: d.goal.id })
      assert.ok(denied.error && ['42501', 'PGRST202'].includes(denied.error.code))
      await assertPreserved('csat_map_goal_version', originalGoals)
      await assertPreserved('learner_workspace_plan', originalPlans)
      mark('real authenticated own-only RLS / direct RPC denied / every original goal and PLAN unchanged')
      report.status = 'passed'
      return
    }
    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.waitForLoadState('networkidle', { timeout: 120_000 })
    await expect(page.getByTestId('unified-map')).toBeVisible({ timeout: 120_000 })
    await page.getByTestId('map-goal-edit').first().click()
    const dialog = page.getByTestId('goal-dialog')
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await dialog.locator('#map-goal-input').fill('85')
    await dialog.locator('[data-testid="goal-more"] > summary').click()
    await dialog.getByTestId('goal-exam').selectOption('kice9')
    await dialog.getByTestId('goal-grade').selectOption('2')
    await dialog.getByTestId('goal-date').fill(deadline)
    await dialog.getByTestId('goal-budget-enable').check()
    await dialog.getByTestId('goal-weekly-minutes').fill('120')
    const savedResponse = page.waitForResponse(r => r.url().endsWith('/api/csat/diagnosis/map/goal') && r.request().method() === 'PUT', { timeout: 120_000 })
    await dialog.getByTestId('goal-apply-all').click()
    assert.equal((await savedResponse).status(), 200, 'Goal UI must use the installed budget writer')
    const a = await read()
    assert.equal(a.goal.budget.weeklyMinutes, 120)
    assert.equal(a.goal.score, 85)
    assert.equal(a.goal.date, deadline)
    const aId: number = a.goal.id
    mark('UI goal, grade, deadline and weekly budget persisted in one goal version')
    const tpl = templateOf(WS)!
    const plan = { template: WS, order: [...tpl.core, ...tpl.support], planned: {}, expectedVersion: 0, expectedGoalVersion: aId, reason: 'initial', clientKey: randomUUID() }
    const commit = await context.request.post('/api/csat/diagnosis/map/plan', { data: plan, timeout: 120_000 })
    assert.equal(commit.status(), 200, `Initial PLAN HTTP ${commit.status()}: ${await commit.text()}`)
    const p1 = (await read()).byTemplate[WS].latest
    assert.equal(p1.version, 1); assert.equal(p1.goalVersionId, aId)
    mark('real PLAN v1 bound to the saved goal')
    const baseGoal = { target: 85, grade: 2, exam: 'kice9', date: deadline, expectedGoalVersion: aId }
    const requests = [60, 90].map(weeklyMinutes => ({ ...baseGoal, budget: { weeklyMinutes, dailyMinutes: null, minutesPerUnit: 10, priorities: [] }, clientKey: randomUUID() }))
    const raced = await race(requests)
    assert.deepEqual(raced.map(r => r.status()).sort(), [200, 409])
    const winner = raced.findIndex(r => r.status() === 200)
    assert.equal((await raced[1 - winner].json()).code, 'goal_changed')
    const b = await read()
    assert.equal(b.goal.budget.weeklyMinutes, requests[winner].budget.weeklyMinutes)
    assert.equal(b.goalHistory.length, 2)
    assert.deepEqual(b.byTemplate[WS].latest, p1)
    mark(`parallel ${rpcRace ? 'RPC' : 'authenticated HTTP'} goal requests: one committed version and one CAS conflict; old PLAN retained`)
    const replay = await context.request.put('/api/csat/diagnosis/map/goal', { data: requests[winner] })
    assert.equal(replay.status(), 200); assert.equal((await replay.json()).reused, true)
    const different = await context.request.put('/api/csat/diagnosis/map/goal', { data: { ...requests[winner], target: 86 } })
    assert.equal(different.status(), 409)
    assert.equal((await different.json()).code, 'client_key_reused')
    const stale = await context.request.post('/api/csat/diagnosis/map/plan', { data: { ...plan, clientKey: randomUUID(), expectedVersion: 1 }, timeout: 120_000 })
    assert.equal(stale.status(), 409); assert.equal((await stale.json()).code, 'goal_changed')
    mark('idempotent goal replay, changed-body rejection and stale-goal PLAN rejection')
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
    await expect(page.getByTestId('goal-schedule')).toContainText(`목표 v${b.goal.id}`, { timeout: 120_000 })
    await expect(page.getByTestId('schedule-start')).toHaveCount(0)
    await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
    const ws = page.locator(`[role="dialog"][data-ws="${WS}"]`)
    await ws.getByTestId('ws-tab-plan').click()
    await expect(ws.getByTestId('plan-goal-changed')).toBeVisible()
    const confirmedResponse = page.waitForResponse(r => r.url().endsWith('/api/csat/diagnosis/map/plan') && r.request().method() === 'POST', { timeout: 120_000 })
    await ws.getByTestId('plan-save').click()
    assert.equal((await confirmedResponse).status(), 200)
    const confirmed = await read()
    assert.equal(confirmed.byTemplate[WS].latest.version, 2)
    assert.equal(confirmed.byTemplate[WS].latest.goalVersionId, b.goal.id)
    assert.ok(confirmed.byTemplate[WS].history.some((p: { version: number; goalVersionId: number }) => p.version === 1 && p.goalVersionId === aId))
    mark('Workspace UI reconfirmation creates PLAN v2 and preserves v1/old goal')
    await page.keyboard.press('Escape')
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
      await expect(page.getByTestId('goal-schedule')).toContainText(`목표 v${b.goal.id}`, { timeout: 120_000 })
      await expect(page.getByTestId('goal-outcome')).toHaveAttribute('data-verdict', 'no_record')
      await expect(page.getByTestId('goal-attainment')).toContainText('미확인')
      await expect(page.getByTestId('goal-schedule')).not.toContainText(/\d+일 남음/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'Horizontal overflow')
      assert.equal((await read()).byTemplate[WS].latest.version, 2)
      await page.screenshot({ path: `output/goal-schedule-live-${width}.png`, fullPage: true })
      mark(`authenticated ${width}px page / server goal and PLAN v2 agree; no false attainment`)
    }
    const own = await learner.from('csat_map_goal_version').select('id').eq('user_id', uid)
    assert.equal(own.error, null); assert.equal(own.data?.length, 2)
    const other = await learner.from('csat_map_goal_version').select('id').neq('user_id', uid)
    assert.equal(other.error, null); assert.deepEqual(other.data, [])
    const forbidden = await learner.rpc('csat_map_goal_budget_set', { p_user: uid, p_score: 85, p_grade: 2, p_exam: 'kice9', p_date: deadline, p_client_key: randomUUID(), p_budget: null, p_expected_goal: b.goal.id })
    assert.ok(forbidden.error && ['42501', 'PGRST202'].includes(forbidden.error.code), 'Authenticated direct writer execution must be forbidden or hidden')
    await assertPreserved('csat_map_goal_version', originalGoals)
    await assertPreserved('learner_workspace_plan', originalPlans)
    mark('authenticated own-only RLS, direct RPC denied and every original goal/PLAN row unchanged')
    report.status = 'passed'
  } finally {
    if (report.status !== 'passed' && captureFailure) await captureFailure().catch(() => {})
    if (uid) {
      let revoked = true
      if (revokeSession) await revokeSession().catch(() => { revoked = false })
      const profile = await admin.from('user_profiles').update({ status: 'suspended' }).eq('user_id', uid)
      const ban = await admin.auth.admin.updateUserById(uid, { ban_duration: '876000h' })
      report.cleanup = !profile.error && !ban.error && revoked ? 'synthetic account signed out / suspended / banned; history retained' : `FAILED: profile=${profile.error?.code ?? 'ok'}, ban=${ban.error?.status ?? 'ok'}, signedOut=${revoked}`
      if (profile.error || ban.error || !revoked) report.status = 'failed'
    }
    await browser.close()
    saveReport()
    if (report.cleanup.startsWith('FAILED:')) throw new Error('Synthetic account suspension failed')
  }
  assert.equal(report.status, 'passed', 'Live acceptance or synthetic account suspension failed')
}

run(new Date()).catch(error => {
  report.status = 'failed'
  saveReport()
  // Playwright's multiline call log contains Cookie headers. Never print request logs or credentials.
  let message = error instanceof Error ? error.message.split('\n')[0] : 'Live verification failed'
  if (url) message = message.split(url).join('[dev-db]').split(new URL(url).hostname).join('[dev-db-host]')
  console.error(message)
  process.exitCode = 1
})
