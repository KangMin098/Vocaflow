// apps/web/scripts/verify-final-assessment-live.mts
// Real Supabase auth + SSR cookie + local Next (3000) + dev DB: goal → map 「최종 평가」 bind in the browser → server binding →
// conflicts (same goal again · stale goal) → new goal version starts unbound → own-only RLS · direct RPC denied · original rows unchanged.
// Own synthetic account only (no email sent); it is signed out, suspended and banned afterwards. History is retained.
// The judged states (met · not_met · not_judgeable) need a record ON the bound date, which must be after today — those run in
// final-assessment.test.ts / final-assessment.pglite.test.ts, not here. Credentials, headers and traces are never stored or printed.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { chromium, expect } from '@playwright/test'

config({ path: path.resolve('.env.local'), quiet: true })
config({ path: path.resolve('../../.env.local'), quiet: true })
if (process.env.VF_ENV_PATH) config({ path: process.env.VF_ENV_PATH, quiet: true })
const SQL_SHA = 'a5bbdc46d48b7d028ae9522515dd5e1f3ce410b82b7b21e2a59dad110ccd34cb'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const attemptId = randomUUID()
const report = { schema: 'final-assessment-live/1', scope: 'authenticated map UI bind + API + real DB; judged states covered offline', head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sqlSha: SQL_SHA, checks: [] as string[], cleanup: 'not_created', status: 'running' }
const mark = (name: string) => { report.checks.push(name); console.log(`PASS ${name}`) }
const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) })
const seoulDay = (d: Date, plus = 0) => new Date(d.getTime() + 9 * 3600000 + plus * 86400000).toISOString().slice(0, 10)
const saveReport = () => {
  fs.mkdirSync('output', { recursive: true })
  const files = ['scripts/verify-final-assessment-live.mts', 'src/components/csat/diagnosis/map/FinalAssessment.tsx', 'src/lib/csat/map/v62/final-assessment.ts', 'src/lib/csat/map/v62/final-assessment-store.ts', 'src/app/api/csat/diagnosis/map/goal/final-assessment/route.ts', '../../supabase/migrations/20261023170000_csat_goal_final_assessment.sql']
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))
  const body = JSON.stringify({ ...report, sourceHashes }, null, 2) + '\n'
  fs.writeFileSync('output/final-assessment-live.json', body)
  fs.writeFileSync(`output/final-assessment-live-${attemptId}.json`, body)
}

async function run(now: Date) {
  assert.ok(url && key && anon, 'Supabase environment missing')
  assert.equal(new URL(url).hostname.split('.')[0], 'jajenrevcbmrpaliomxv', 'Only the approved development project is allowed')
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Only the local Next server is allowed')
  assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve('../../supabase/migrations/20261023170000_csat_goal_final_assessment.sql'))).digest('hex'), SQL_SHA)
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } })
  const installed = await admin.from('csat_map_goal_final_assessment').select('id').limit(1)
  assert.equal(installed.error, null, 'Approved final-assessment table must be installed')
  type Table = 'csat_map_goal_version' | 'learner_workspace_plan' | 'csat_map_goal_final_assessment'
  const snapshot = async (table: Table) => {
    const rows: { id: unknown }[] = []
    for (let offset = 0; ; offset += 1000) {
      const r = await admin.from(table).select('*').order('id').range(offset, offset + 999)
      assert.equal(r.error, null)
      rows.push(...(r.data ?? []))
      if ((r.data ?? []).length < 1000) return rows
    }
  }
  const assertPreserved = async (table: Table, before: { id: unknown }[]) => {
    const after = new Map((await snapshot(table)).map(row => [row.id, row]))
    for (const row of before) assert.deepEqual(after.get(row.id), row, `Original ${table} row changed`)
  }
  const original = { goals: await snapshot('csat_map_goal_version'), plans: await snapshot('learner_workspace_plan'), finals: await snapshot('csat_map_goal_final_assessment') }
  const browser = await chromium.launch()
  let uid: string | null = null
  let revokeSession: (() => Promise<void>) | null = null
  let page: import('@playwright/test').Page | null = null
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } })
    page = await context.newPage()
    assert.equal((await context.request.post('/api/csat/diagnosis/map/goal/final-assessment', { data: {} })).status(), 401)
    const email = `final-assessment-qa-${randomUUID()}@example.com`
    const password = `QA-${randomBytes(24).toString('base64url')}-Aa1`
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: '최종 평가 검증', synthetic: true } })
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
    mark('real Supabase sign-in + SSR cookie; anonymous final-assessment API 401')

    const deadline = seoulDay(now, 28)
    const put = (data: unknown) => context.request.put('/api/csat/diagnosis/map/goal', { data, timeout: 120_000 })
    const g1 = await put({ target: 85, grade: 2, exam: 'suneung', date: deadline, clientKey: randomUUID() })
    assert.equal(g1.status(), 200)
    const goal1 = (await g1.json()).goalVersionId as number
    mark('goal v1 saved through the real goal API')

    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded', timeout: 180_000 })
    const card = page.getByTestId('final-assessment')
    await expect(card).toHaveAttribute('data-status', 'unbound', { timeout: 180_000 })
    await expect(page.getByTestId('final-date')).toHaveAttribute('min', seoulDay(now, 1))
    await expect(page.getByTestId('final-date')).toHaveAttribute('max', deadline)
    await expect(page.getByTestId('goal-attainment')).toContainText('미확인')
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'output/final-assessment-live-unbound.png', fullPage: false })
    const chosen = seoulDay(now, 21)
    await page.getByTestId('final-date').fill(chosen)
    await page.getByTestId('final-bind').click()
    await expect(card).toHaveAttribute('data-status', 'scheduled', { timeout: 180_000 })
    await expect(page.getByTestId('final-wait')).toContainText(chosen)
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'output/final-assessment-live-scheduled.png', fullPage: false })
    mark('authenticated map UI: unbound card → choose date → bind → reloaded server state shows scheduled')

    const own = await admin.from('csat_map_goal_final_assessment').select('goal_version_id, assessment_date').eq('user_id', uid)
    assert.equal(own.error, null)
    assert.deepEqual(own.data, [{ goal_version_id: goal1, assessment_date: chosen }])
    const bind = (data: unknown) => context.request.post('/api/csat/diagnosis/map/goal/final-assessment', { data, timeout: 120_000 })
    const again = await bind({ goalVersionId: goal1, date: seoulDay(now, 20), clientKey: randomUUID() })
    assert.equal(again.status(), 409); assert.equal((await again.json()).code, 'final_assessment_conflict')
    const outOfWindow = await bind({ goalVersionId: goal1, date: seoulDay(now, 29), clientKey: randomUUID() })
    assert.equal(outOfWindow.status(), 400)
    mark('one binding per goal version: second bind 409 · out-of-window 400 · stored row = chosen date')

    const g2 = await put({ target: 90, grade: 1, exam: 'suneung', date: deadline, clientKey: randomUUID() })
    assert.equal(g2.status(), 200)
    const stale = await bind({ goalVersionId: goal1, date: chosen, clientKey: randomUUID() })
    assert.equal(stale.status(), 409); assert.equal((await stale.json()).code, 'goal_changed')
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 })
    await expect(page.getByTestId('final-assessment')).toHaveAttribute('data-status', 'unbound', { timeout: 180_000 })
    mark('new goal version starts unbound in the map; binding the old version 409 goal_changed; old binding retained')

    const mine = await learner.from('csat_map_goal_final_assessment').select('id')
    assert.equal(mine.error, null); assert.equal(mine.data?.length, 1)
    const others = await learner.from('csat_map_goal_final_assessment').select('id').neq('user_id', uid)
    assert.equal(others.error, null); assert.deepEqual(others.data, [])
    const direct = await learner.rpc('csat_map_goal_final_assessment_bind', { p_user: uid, p_goal: goal1, p_date: chosen, p_client_key: randomUUID() })
    assert.ok(direct.error && ['42501', 'PGRST202'].includes(direct.error.code ?? ''), 'Authenticated direct writer execution must be denied')
    const insert = await learner.from('csat_map_goal_final_assessment').insert({ user_id: uid, goal_version_id: goal1, assessment_date: chosen, client_key: randomUUID() })
    assert.ok(insert.error, 'Authenticated direct insert must be denied')
    await assertPreserved('csat_map_goal_version', original.goals)
    await assertPreserved('learner_workspace_plan', original.plans)
    await assertPreserved('csat_map_goal_final_assessment', original.finals)
    mark('own-only RLS · direct RPC/insert denied · every original goal/PLAN/final row unchanged')
    report.status = 'passed'
  } finally {
    if (report.status !== 'passed' && page) await page.screenshot({ path: 'output/final-assessment-live-failure.png', fullPage: true }).catch(() => {})
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
  }
  assert.equal(report.status, 'passed', 'Live acceptance or synthetic account suspension failed')
}

run(new Date()).catch(error => {
  report.status = 'failed'
  saveReport()
  // Playwright call logs can contain Cookie headers — print the first line only, with the DB host masked.
  let message = error instanceof Error ? error.message.split('\n')[0] : 'Live verification failed'
  if (url) message = message.split(url).join('[dev-db]').split(new URL(url).hostname).join('[dev-db-host]')
  console.error(message)
  process.exitCode = 1
})
