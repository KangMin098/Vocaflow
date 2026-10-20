// scripts/db/factory-i1/d3-live-check.mts
// Explicitly opted-in live acceptance with one owned synthetic account. No DDL, deletion, production or delivery.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { canonicalJson } from '../../../apps/web/src/lib/csat/map/v62/canonical-json'
import { CANON_VERSION, templateOf } from '../../../apps/web/src/lib/csat/map/v4/definition'
import { lineageOrder } from '../../../apps/web/src/lib/csat/map/v62/__tests__/order-lineage.fixture'
import { lineageHash, specFromDemand } from '../../../packages/library-pipeline/src/textbook/order-lineage'
import { ADMIN_SECTIONS } from '../../../apps/web/src/lib/admin/navigation'
import { targetOf } from './deploy.mjs'
import { assertLiveFixtureOptIn, assertOwnedFixture, verifyOwnedFixture, liveFixtureEmail, sendOwnedRegistration, sendJournaledIntent, reconcileOwnedRegistration, runCleanupSteps } from './live-fixture-safety.mjs'

const option = (name: string) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined }
assertLiveFixtureOptIn(process.argv, process.env)
assert.ok(option('--deps') && option('--ca'), '--deps and --ca are required')
const base = new URL(option('--base') || 'http://localhost:3001')
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname) && base.protocol === 'http:')
const target = targetOf(process.env.SUPABASE_DB_URL)
assert.ok(target.ok, 'Expected development project/session connection required')
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname, 'jajenrevcbmrpaliomxv.supabase.co')
const req = createRequire(path.resolve('apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const { createServerClient } = req('@supabase/ssr')
const { default: AxeBuilder } = await import(pathToFileURL(req.resolve('@axe-core/playwright')).href)
const { Client } = createRequire(path.join(option('--deps'), 'package.json'))('pg')
const run = randomUUID()
const prefix = `D3-LIVE-${run}`
const out = path.resolve('.agent-logs/d3-live', run)
fs.mkdirSync(out, { recursive: true })
const adminDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const sql = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { ca: fs.readFileSync(option('--ca'), 'utf8'), rejectUnauthorized: true }, connectionTimeoutMillis: 15000, application_name: 'vf-d3-owned-live-check' })
const checks: Array<{ name: string; ok: boolean; detail?: unknown }> = []
const registrations = new Map<string, { product_order_id: string; order_revision: number; order_hash: string; request_key: string; command: any }>()
const intents = new Map<string, any>()
let uid: string | null = null, workspace: string | null = null, orderId: string | null = null
let browser: any, context: any, page: any, userDb: any
let step = 'preflight', failed = false, beforeRecorded = false
const cleanup: Record<string, unknown> = {}
const record = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok, detail }); process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`)
  assert.ok(ok, name)
}
const must = <T,>(r: { data: T; error: any }, name: string): T => { if (r.error) throw new Error(`${name}:${r.error.code ?? 'error'}`); return r.data }
const recovery = () => {
  const journal = path.join(out, 'ownership.json')
  const fd = fs.openSync(`${journal}.tmp`, 'w')
  try {
    fs.writeFileSync(fd, JSON.stringify({ run, uid, workspace, orderId, intents: Object.fromEntries(intents), registrations: [...registrations.values()], scope: 'Owned synthetic fixture; retain append-only history, close/withdraw/suspend only' }, null, 2) + '\n')
    fs.fsyncSync(fd)
  } finally { fs.closeSync(fd) }
  fs.renameSync(`${journal}.tmp`, journal)
}
const api = async (body: unknown, expected = 200) => {
  const r = await context.request.post(`${base.origin}/api/admin/csat/product-order-lineage`, { headers: { origin: base.origin }, data: body })
  const json = await r.json()
  if (r.status() !== expected) throw new Error(`lineage_api:${r.status()}:${json.code ?? json.error ?? 'unknown'}`)
  return json
}
const read = async () => {
  const r = await context.request.get(`${base.origin}/api/admin/csat/product-order-lineage?user=${uid}&workspace=${workspace}`)
  assert.equal(r.status(), 200)
  const data = await r.json(); assert.equal(data.status, 'installed'); return data
}
const show = async (name: string, expected: string[]) => {
  await page.goto(`${base.origin}/admin/csat/diagnosis/learners/${uid}`, { waitUntil: 'domcontentloaded' })
  assert.ok(!page.url().includes('/login'))
  const plans = page.locator('[data-admin-learner-plans]')
  await plans.locator(':scope > summary').click()
  const panel = page.locator('[data-product-order-lineage]')
  await panel.locator(':scope > summary').focus(); await page.keyboard.press('Enter')
  for (const label of expected) assert.ok((await panel.innerText()).includes(label), `UI label: ${label}`)
  assert.ok(!(await panel.innerText()).includes('조회 불가'))
  assert.ok(!(await plans.innerText()).includes('공급 원장 조회 불가'))
  assert.ok((await panel.locator('summary').boundingBox()).height >= 44)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  const a11y = await new AxeBuilder({ page }).include('[data-product-order-lineage]').analyze()
  assert.equal(a11y.violations.length, 0)
  await panel.screenshot({ path: path.join(out, `${name}.png`) })
  record(`production-page-${name}`, true, { labels: expected, axeViolations: 0 })
}
try {
  await sql.connect()
  const active = (await sql.query("select count(*)::integer n from pg_stat_activity where state='active' and wait_event_type='Lock'")).rows[0].n
  assert.equal(active, 0, 'Database lock contention; do not start fixture')
  await sql.query('select public.record_db_health_checkpoint($1,$2,$3)', [prefix, 'before', 'Owned D3 synthetic live acceptance; no production or schema changes'])
  beforeRecorded = true
  step = 'create-owned-account'
  const email = liveFixtureEmail(run), password = `D3!aA1${randomBytes(28).toString('base64url')}`
  // The supported auth-admin id attribute fixes identity before any uncertain response; never journal credentials.
  const account = { id: randomUUID(), email, email_confirm: true, user_metadata: { name: 'D3 controlled verification', e2e_run: run, synthetic: true } }
  const created: any = await sendJournaledIntent({ intents, key: 'account', input: account, persist: recovery, send: async (params: any) => {
    uid = params.id
    return must(await adminDb.auth.admin.createUser({ ...params, password }), 'create_owned_user')
  } })
  assert.equal(created.user.id, uid); recovery()
  const owner: any = must(await adminDb.auth.admin.getUserById(uid), 'verify_owned_user')
  assertOwnedFixture(owner.user, uid, run)
  const promoted: any = must(await adminDb.from('user_profiles').update({ role: 'admin', status: 'active' }).eq('user_id', uid).select('role,status').single(), 'set_owned_test_role')
  record('owned-test-admin-created', promoted.role === 'admin' && promoted.status === 'active')
  browser = await chromium.launch()
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (e: Error) => pageErrors.push(e.name))
  step = 'real-login'
  await page.goto(`${base.origin}/login?next=%2Fadmin`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await Promise.all([page.waitForURL(url => url.pathname.startsWith('/admin'), { timeout: 45000 }), page.locator('button[type=submit]').click()])
  record('real-password-login-admin-allowed', true)
  const cookies = await context.cookies(base.origin)
  userDb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookies.map((c: any) => ({ name: c.name, value: c.value })), setAll: () => {} } })
  const identity: any = must(await userDb.auth.getUser(), 'verify_real_session')
  assert.equal(identity.user.id, uid)
  step = 'create-owned-plan'
  const template = templateOf('ws.central-meaning')!
  const taskIds = [...new Set([...template.core, ...template.support])]
  const plan = { order: taskIds, tasks: taskIds.map(task => ({ task, available: 0, planned: null })) }
  const commit = async (expected: number, reason: string) => {
    const input = { p_user: uid, p_template: template.id, p_template_tasks: taskIds, p_canon: CANON_VERSION, p_plan: plan, p_reason: reason, p_note: `${prefix}: synthetic test, no learner recommendation or production`, p_as_of: new Date().toISOString(), p_goal_version: null, p_expected_version: expected, p_client_key: randomUUID(), p_restore_of: null }
    const rows: any = await sendJournaledIntent({ intents, key: `plan:${expected}`, input, persist: recovery, send: async (params: any) => must(await adminDb.rpc('learner_workspace_plan_commit', params), 'owned_plan_commit') })
    assert.equal(rows[0].plan_version, expected + 1); return rows[0]
  }
  workspace = (await commit(0, 'initial')).workspace_id; recovery()
  const canonical = canonicalJson({ v: 2, user: uid, template: template.id, workspaceId: workspace, goalVersion: null, planVersion: 1, definitionVersion: CANON_VERSION, core: 'r.central_meaning', support: [], lines: [{ role: 'guided_practice', task: 'r.central_meaning', n: 4, types: ['R-TOPIC'], keys: [], requires: {}, reason: `${prefix}: controlled test only` }] })
  const demand: any = must(await userDb.rpc('workspace_demand_record', { p_canonical: canonical }), 'owned_demand')
  const line: any = must(await userDb.from('workspace_content_demand_line').select('id').eq('demand_id', demand).eq('user_id', uid).single(), 'owned_line')
  orderId = await sendJournaledIntent({ intents, key: 'personal-order', input: { p_line: line.id, p_reason: 'initial', p_quantity: 4, p_request_key: randomUUID() }, persist: recovery, send: async (params: any) => must(await userDb.rpc('factory_order_open', params), 'owned_order') }) as string; recovery()
  const spec = specFromDemand(canonical, 0)
  const register = async (suffix: string, revision: number) => {
    const sealed = lineageOrder(`${prefix}-${suffix}`, revision)
    const cmd = { action: 'register', order: sealed.order, order_hash: sealed.order_hash, spec, quantity: 4, reason: `${prefix}: synthetic non-production registration`, request_key: randomUUID() }
    // The sealer returns exactly order/order_hash. Nothing is manufactured as production approval.
    const result = await sendOwnedRegistration({ command: cmd, run, registrations, persist: recovery, send: api })
    assert.equal(result.delivery, 'not_performed'); assert.equal(result.current, 'read_required')
    return { ...sealed, command: cmd, id: result.recorded_id }
  }
  const link = async (sealed: any) => {
    const command = { action: 'link', order_id: orderId, product_order_id: sealed.order.product_order_id, order_revision: sealed.order.order_revision, order_hash: sealed.order_hash, demand_signature: lineageHash(canonical), quantity: 1, reason: `${prefix}: synthetic planned coverage`, request_key: randomUUID() }
    const first = await api(command), replay = await api(command)
    assert.equal(first.recorded_id, replay.recorded_id)
    const alias = await api({ ...command, request_key: randomUUID() }); assert.equal(alias.recorded_id, first.recorded_id)
    await api({ ...command, reason: 'changed request must be rejected' }, 409)
    return first.recorded_id
  }
  step = 'register-link-replay'
  const a1 = await register('A', 1); await link(a1)
  record('actual-register-link-full-body-replay-and-conflict', (await read()).rows.some((r: any) => r.status === 'current'))
  await show('current', ['현재 계획 연결'])
  step = 'revision'
  const a2 = await register('A', 2); await link(a2)
  const revised = await read()
  record('actual-revision-preserves-old-link', revised.rows.some((r: any) => r.status === 'superseded') && revised.rows.some((r: any) => r.status === 'current'))
  await show('revision', ['이전 주문 판', '현재 계획 연결'])
  step = 'withdrawal'
  const withdrawal = { action: 'withdraw', product_order_id: a2.order.product_order_id, order_revision: 2, order_hash: a2.order_hash, reason: `${prefix}: controlled withdrawal`, request_key: randomUUID() }
  const w1 = await api(withdrawal), w2 = await api(withdrawal)
  assert.equal(w1.recorded_id, w2.recorded_id)
  record('actual-withdrawal-and-replay', (await read()).rows.some((r: any) => r.status === 'withdrawn'))
  await show('withdrawn', ['철회된 주문', '이전 주문 판'])
  step = 'personal-plan-change'
  const b1 = await register('B', 1); await link(b1)
  await commit(1, 'learner_adjust')
  record('actual-plan-change-invalidates-current-coverage', (await read()).rows.some((r: any) => r.status === 'personal_order_changed'))
  await show('personal-change', ['개인 계획·주문 변경', '철회된 주문', '이전 주문 판'])
  step = 'menu-reachability'
  const hrefs = [...new Set(ADMIN_SECTIONS.flatMap(section => [section.href, ...section.workspaces.map(w => w.href)]))]
  for (const href of hrefs) {
    const r = await context.request.get(new URL(href, base).href, { timeout: 45000 })
    record(`authenticated-menu:${href}`, r.status() === 200 && !new URL(r.url()).pathname.startsWith('/login'), { status: r.status() })
  }
  record('browser-no-runtime-errors', pageErrors.length === 0, { count: pageErrors.length })
} catch (e) {
  failed = true; checks.push({ name: `failed-at:${step}`, ok: false, detail: e instanceof Error ? e.message : 'unknown' })
  process.stdout.write(`FAIL ${step}\n`)
} finally {
  step = 'owned-cleanup'
  try {
    if (uid) {
      await verifyOwnedFixture({ expectedId: uid, run,
        lookupAuth: async () => (must(await adminDb.auth.admin.getUserById(uid), 'cleanup_verify_ownership') as any).user,
        lookupDb: async () => (await sql.query('select id,raw_user_meta_data user_metadata from auth.users where id=$1', [uid])).rows[0],
      })
      const operations: Array<[string, () => Promise<void>]> = []
      operations.push(['recover-workspace-identity', async () => {
        if (!workspace && intents.has('plan:0')) {
          const params = intents.get('plan:0'); assert.equal(params.p_user, uid)
          const rows: any = must(await adminDb.rpc('learner_workspace_plan_commit', params), 'recover_owned_workspace')
          workspace = rows[0].workspace_id; recovery()
        }
      }])
      operations.push(['recover-order-identity', async () => {
        if (!orderId && intents.has('personal-order')) {
          assert.ok(userDb)
          const params = intents.get('personal-order')
          const line = (await sql.query('select user_id from public.workspace_content_demand_line where id=$1', [params.p_line])).rows[0]
          assert.equal(line?.user_id, uid)
          orderId = must(await userDb.rpc('factory_order_open', params), 'recover_owned_order') as string; recovery()
        }
      }])
      for (const entry of registrations.values()) operations.push([`withdraw:${entry.product_order_id}:${entry.order_revision}`, async () => {
        await reconcileOwnedRegistration({ entry, run, actor: uid,
          settle: async (command: any) => { must(await adminDb.rpc('factory_product_order_register', { p_actor: uid, p_canonical: canonicalJson(command.order), p_hash: command.order_hash, p_spec: command.spec, p_quantity: command.quantity, p_reason: command.reason, p_request: command.request_key }), 'settle_owned_registration') },
          lookup: async (identity: any) => (await sql.query('select product_order_id,order_revision,order_hash,request_key,registered_by,public.factory_product_order_is_current(product_order_id,order_revision) is_current from public.factory_product_order where product_order_id=$1 and order_revision=$2', [identity.product_order_id, identity.order_revision])).rows[0],
          withdraw: async (identity: any) => { must(await adminDb.rpc('factory_product_order_withdraw', { p_actor: uid, p_id: identity.product_order_id, p_revision: identity.order_revision, p_hash: identity.order_hash, p_reason: `${prefix}: verification finished; retain history`, p_request: randomUUID() }), 'close_owned_product') },
        })
      }])
      operations.push(['close-order', async () => {
      if (orderId && userDb) {
        const owned: any = must(await userDb.from('factory_order').select('state').eq('id', orderId).eq('user_id', uid).single(), 'cleanup_owned_order_read')
        if (!['failed', 'delivered', 'cancelled'].includes(owned.state)) must(await userDb.rpc('factory_order_transition', { p_order: orderId, p_expected: owned.state, p_to: 'failed', p_reason: `${prefix}: test finished without production`, p_run_id: null, p_qualification: null, p_request_key: randomUUID() }), 'close_owned_order')
        cleanup.order_closed = true
      }
      }])
      operations.push(['close-workspace', async () => {
      if (workspace) {
        const closed: any = must(await adminDb.from('learner_workspace').update({ status: 'closed' }).eq('id', workspace).eq('user_id', uid).select('status').single(), 'close_owned_workspace')
        assert.equal(closed.status, 'closed'); cleanup.workspace_closed = true
      }
      }])
      operations.push(['remove-admin-privilege', async () => {
      const demoted: any = must(await adminDb.from('user_profiles').update({ role: 'user', status: 'suspended' }).eq('user_id', uid).select('role,status').single(), 'disable_owned_profile')
      assert.equal(demoted.role, 'user'); assert.equal(demoted.status, 'suspended'); cleanup.admin_privilege_removed = true
      }])
      operations.push(['ban-owned-account', async () => {
      must(await adminDb.auth.admin.updateUserById(uid, { ban_duration: '876000h' }), 'ban_owned_test_account'); cleanup.account_banned = true
      }])
      const errors = await runCleanupSteps(operations)
      cleanup.errors = errors
      if (errors.length) failed = true
      cleanup.products_withdrawn = !errors.some((e: any) => e.name.startsWith('withdraw:'))
      if (context) {
        const denied = await context.request.get(`${base.origin}/api/admin/csat/product-order-lineage?user=${uid}&workspace=${workspace}`)
        record('disabled-test-account-admin-access-revoked', denied.status() === 403 || denied.status() === 401, { status: denied.status() })
      }
    }
  } catch (e) { failed = true; cleanup.error = e instanceof Error ? e.message : 'unknown'; process.stdout.write('FAIL owned-cleanup\n') }
  await browser?.close().catch(() => {})
  if (beforeRecorded) {
    try { await sql.query('select public.record_db_health_checkpoint($1,$2,$3)', [prefix, 'after', 'Owned live fixture ended; retain append-only test history; no production/delivery']); cleanup.after_checkpoint = true }
    catch { failed = true; cleanup.after_checkpoint = false }
  }
  await sql.end().catch(() => {})
  fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify({ run, scope: 'Actual production app, real Supabase auth/DB, owned synthetic non-production fixture; not real learner efficacy or production/delivery', ok: !failed, checks, cleanup, fixture_history_retained: true, schema_changes: false, production: false, delivery: false }, null, 2) + '\n')
  process.stdout.write(JSON.stringify({ ok: !failed, evidence: path.relative(process.cwd(), out), checks: checks.length, cleanup }) + '\n')
  process.exitCode = failed ? 1 : 0
}
