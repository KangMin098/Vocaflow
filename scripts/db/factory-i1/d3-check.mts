// scripts/db/factory-i1/d3-check.mts
// Real PostgreSQL, multiple connections, owned disposable cluster only. No dotenv or shared DB connector.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

import { loadDeps, startCluster } from './isolated-db.mjs'
import { CATALOG_SQL, catalogDiff } from './catalog.mjs'
import { BASELINE_SQL } from './d3-baseline-query.mjs'
import { buildD3Package, D3_VERSION } from './d3-package.mjs'
import { canonicalJson } from '../../../apps/web/src/lib/csat/map/v62/canonical-json'
import {
  lineageHash,
  prepareLineageRegistration,
  specFromDemand,
} from '../../../packages/library-pipeline/src/textbook/order-lineage'
import { lineageOrder } from '../../../apps/web/src/lib/csat/map/v62/__tests__/order-lineage.fixture'

const deps = process.argv[process.argv.indexOf('--deps') + 1]
if (!process.argv.includes('--deps') || !deps) throw new Error('--deps is required')
const cluster = await startCluster(await loadDeps(deps))
const checks: Array<{ name: string; passed: true }> = []
const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const CURATOR = '00000000-0000-4000-8000-0000000000a2'
const A = '00000000-0000-4000-8000-0000000000b1'
const B = '00000000-0000-4000-8000-0000000000b2'
const read = (p: string) => fs.readFileSync(path.resolve(p), 'utf8')
const sql = read('scripts/db/factory-i1/d3.sql')
const test = async (name: string, fn: () => Promise<void>) => {
  await fn()
  checks.push({ name, passed: true })
  process.stdout.write(`PASS ${name}\n`)
}
try {
  const db = await cluster.newDb('lineage')
  // Mirror the production role/default-ACL threat model, including a service role with BYPASSRLS.
  await db.query(`create role service_role nologin bypassrls; grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter table public.admins add column status text default 'active';
    create or replace view public.user_profiles as select user_id,role,status from public.admins;`)
  for (const f of ['c_qualification', 'b_orders', 'i1_safety', 'i1_partial'])
    await db.query(read(`supabase/migrations/_pending_workspace_supply_${f}.sql`))
  const before = (await db.query(CATALOG_SQL)).rows
  await db.query('begin')
  await db.query(sql)
  await db.query('commit')
  const after = (await db.query(CATALOG_SQL)).rows
  const diff = catalogDiff(before, after)
  assert.deepEqual(diff.changed, [])
  assert.deepEqual(diff.removed, [])
  fs.writeFileSync('.agent-logs/d3-catalog-diff.json', JSON.stringify(diff, null, 2) + '\n')
  async function rpc(
    query: string,
    params: unknown[] = [],
    role = 'service_role',
    uid: string | null = null
  ) {
    const client = await db.connect()
    try {
      await client.query('begin')
      await client.query(`set local role ${role}`)
      await client.query(`select set_config('request.jwt.claim.sub',$1,true)`, [uid ?? ''])
      const r = await client.query(query, params)
      await client.query('commit')
      return r
    } catch (e) {
      await client.query('rollback')
      throw e
    } finally {
      client.release()
    }
  }
  async function reg(
    id = 'TPO-test',
    revision = 1,
    quantity = 4,
    overrides: Record<string, unknown> = {}
  ) {
    const sealed = lineageOrder(id, revision)
    const body = prepareLineageRegistration({
      action: 'register',
      order: sealed.order,
      order_hash: sealed.order_hash,
      spec,
      quantity,
      reason: 'synthetic test registration',
      request_key: randomUUID(),
      ...overrides,
    })
    await rpc(`select public.factory_product_order_register($1,$2,$3,$4,$5,$6,$7)`, [
      ADMIN,
      body.canonical_order,
      body.order_hash,
      body.spec,
      body.quantity,
      body.reason,
      body.request_key,
    ])
    return body
  }
  await db.query(`insert into auth.users values ($1),($2),($3),($4)`, [ADMIN, CURATOR, A, B])
  await db.query(`insert into admins(user_id,role) values ($1,'admin'),($2,'curator')`, [
    ADMIN,
    CURATOR,
  ])
  async function personal(uid: string, qty = 4, requires: unknown = {}, role = 'guided_practice') {
    const ws = randomUUID()
    await db.query(`insert into learner_workspace(id,user_id) values($1,$2)`, [ws, uid])
    await db.query(
      `insert into learner_workspace_plan(workspace_id,user_id,plan_version) values($1,$2,1)`,
      [ws, uid]
    )
    const canonical = canonicalJson({
      v: 2,
      user: uid,
      template: 'ws.reading',
      workspaceId: ws,
      goalVersion: null,
      planVersion: 1,
      definitionVersion: 'v6.2-test',
      core: 'r.central_meaning',
      support: [],
      lines: [
        {
          role,
          task: 'r.central_meaning',
          n: qty,
          types: ['R-TOPIC'],
          keys: [],
          requires,
          reason: 'test',
        },
      ],
    })
    const dem = (
      await rpc(`select public.workspace_demand_record($1) id`, [canonical], 'authenticated', uid)
    ).rows[0].id
    const line = (
      await db.query(`select id from workspace_content_demand_line where demand_id=$1`, [dem])
    ).rows[0].id
    const order = (
      await rpc(
        `select public.factory_order_open($1,'initial',$2::smallint,$3) id`,
        [line, qty, randomUUID()],
        'authenticated',
        uid
      )
    ).rows[0].id
    return { uid, ws, canonical, signature: lineageHash(canonical), order, dem }
  }
  const a = await personal(A)
  const b = await personal(B)
  const spec = specFromDemand(a.canonical, 0)
  const link = (
    p: typeof a,
    body: Awaited<ReturnType<typeof reg>>,
    qty = 2,
    key = randomUUID(),
    reason = 'synthetic coverage',
    actor = ADMIN
  ) =>
    rpc(`select public.factory_order_link_product($1,$2,$3,$4,$5,$6,$7,$8,$9) id`, [
      actor,
      p.order,
      body.order.product_order_id,
      body.order.order_revision,
      body.order_hash,
      p.signature,
      qty,
      reason,
      key,
    ])
  const query = (p: typeof a, actor = ADMIN) =>
    rpc(`select public.factory_lineage_read($1,$2,$3) result`, [actor, p.uid, p.ws])
  let po: Awaited<ReturnType<typeof reg>>
  await test('canonical JSON profile matches Factory sealer including Unicode strings, arrays and safe integers', async () => {
    const samples = [
      lineageOrder().order,
      spec,
      { a: '한글 🧭 / " \n \\', z: [null, true, 0, -1, 9007199254740991] },
    ]
    for (const sample of samples)
      assert.equal(
        (await db.query(`select public.factory_lineage_canonical($1::jsonb) c`, [sample])).rows[0]
          .c,
        canonicalJson(sample)
      )
    await assert.rejects(
      db.query(`select public.factory_lineage_canonical('{"a":0.5}')`),
      /integer_required/
    )
    await assert.rejects(
      db.query(`select public.factory_lineage_canonical('{"1":1}')`),
      /ascii_key_required/
    )
  })
  await test('register exact sealed bytes; hash tampering and revision gaps rejected', async () => {
    po = await reg()
    await assert.rejects(reg('TPO-gap', 2), /next revision/)
    await assert.rejects(
      rpc(`select public.factory_product_order_register($1,$2,$3,$4,4,'bad',$5)`, [
        ADMIN,
        po.canonical_order,
        '0'.repeat(64),
        spec,
        randomUUID(),
      ]),
      /different body/
    )
    const bad = canonicalJson({ ...po.order, product_order_id: 'TPO-bad' })
    await assert.rejects(
      rpc(`select public.factory_product_order_register($1,$2,$3,$4,4,'bad',$5)`, [
        ADMIN,
        bad,
        '0'.repeat(64),
        spec,
        randomUUID(),
      ]),
      /check constraint/
    )
  })
  await test('registration idempotency compares reason, quantity, actor and every body field', async () => {
    await rpc(`select public.factory_product_order_register($1,$2,$3,$4,$5,$6,$7)`, [
      ADMIN,
      po.canonical_order,
      po.order_hash,
      po.spec,
      po.quantity,
      po.reason,
      po.request_key,
    ])
    await assert.rejects(reg('TPO-test', 1, 4, { reason: 'changed' }), /different body/)
    await assert.rejects(reg('TPO-test', 1, 3), /different body/)
    assert.equal((await db.query(`select count(*)::int n from factory_product_order`)).rows[0].n, 1)
  })
  let linkId: string
  await test('non-consumptive per-learner coverage; one common plan can cover two learners', async () => {
    linkId = (await link(a, po, 4)).rows[0].id
    await link(b, po, 4)
    assert.equal(
      (await db.query(`select sum(quantity)::int n from factory_order_product_link`)).rows[0].n,
      8
    )
    const r = (await query(a)).rows[0].result
    assert.equal(r.rows[0].status, 'current')
    assert.equal(r.rows[0].product_quantity, 4)
    assert.equal(
      (await db.query(`select count(*)::int n from workspace_content_delivery`)).rows[0].n,
      0
    )
  })
  await test('natural-key replay matches full body and does not add quantity', async () => {
    assert.equal((await link(a, po, 4)).rows[0].id, linkId)
    await assert.rejects(link(a, po, 3), /different body/)
    await assert.rejects(link(a, po, 4, randomUUID(), 'changed'), /different body/)
  })
  await test('natural-key retry UUID aliases are reserved across registration, link and withdrawal actions', async () => {
    const alias = randomUUID()
    await reg('TPO-test', 1, 4, { request_key: alias })
    await assert.rejects(reg('TPO-other-alias', 1, 4, { request_key: alias }), /different body/)
    const linkAlias = randomUUID()
    await link(a, po, 4, linkAlias)
    await assert.rejects(link(b, po, 4, linkAlias), /different body/)
    await assert.rejects(
      rpc(`select factory_product_order_withdraw($1,$2,1,$3,'test',$4)`, [
        ADMIN,
        'TPO-test',
        po.order_hash,
        linkAlias,
      ]),
      /different body/
    )
  })
  await test('all six personal material roles retain exact role and assessment constraints without issuing delivery approval', async () => {
    for (const role of [
      'source_analysis',
      'model_explanation',
      'guided_practice',
      'independent_check',
      'transfer',
      'delayed_check',
    ]) {
      const p = await personal(A, 4, { gold: true, unseen: true }, role)
      const b = await reg(`TPO-role-${role}`, 1, 4, { spec: specFromDemand(p.canonical, 0) })
      await link(p, b, 2)
    }
    assert.equal(
      (await db.query(`select count(*)::int n from workspace_content_delivery`)).rows[0].n,
      0
    )
  })
  await test('wrong personal signature, spec and capacity fail closed', async () => {
    const other = await personal(A, 4, { gold: true })
    await assert.rejects(link(other, po), /spec mismatch/)
    const good = await personal(A)
    await assert.rejects(link({ ...good, signature: 'f'.repeat(64) }, po), /signature mismatch/)
    await assert.rejects(link(good, po, 5), /quantity exceeded/)
  })
  await test('concurrent allocations to one personal order cannot over-cover requested items', async () => {
    const p = await personal(A, 3)
    const x = await reg('TPO-x')
    const y = await reg('TPO-y')
    const results = await Promise.allSettled([link(p, x, 2), link(p, y, 2)])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.match(
      String((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason),
      /quantity exceeded/
    )
    assert.equal(
      (
        await db.query(
          `select sum(quantity)::int n from factory_order_product_link where order_id=$1`,
          [p.order]
        )
      ).rows[0].n,
      2
    )
  })
  await test('same-request concurrent retries return one historical link', async () => {
    const p = await personal(A)
    const k = randomUUID()
    const results = await Promise.all(Array.from({ length: 12 }, () => link(p, po, 2, k)))
    assert.equal(new Set(results.map((r) => r.rows[0].id)).size, 1)
  })
  async function waitForBlocked(queryName: string) {
    for (let i = 0; i < 100; i++) {
      const rows = (
        await db.query(
          `select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1`,
          [`%${queryName}%`]
        )
      ).rows
      if (rows.length) return
    }
    throw new Error(`expected waiting connection: ${queryName}`)
  }
  for (const action of ['revision', 'withdrawal'])
    for (const first of ['product', 'link']) {
      await test(`${action} versus link race: ${first} commits first, history remains and current state is recomputed`, async () => {
        const current = await reg(`TPO-race-${action}-${first}`)
        const p = await personal(A)
        const next = lineageOrder(current.order.product_order_id, 2)
        const registerSQL = `select public.factory_product_order_register($1,$2,$3,$4,4,'race',$5)`
        const registerArgs = [ADMIN, canonicalJson(next.order), next.order_hash, spec, randomUUID()]
        const withdrawSQL = `select public.factory_product_order_withdraw($1,$2,1,$3,'race',$4)`
        const withdrawArgs = [
          ADMIN,
          current.order.product_order_id,
          current.order_hash,
          randomUUID(),
        ]
        const productSQL = action === 'revision' ? registerSQL : withdrawSQL
        const productArgs = action === 'revision' ? registerArgs : withdrawArgs
        const c = await db.connect()
        try {
          await c.query('begin')
          if (first === 'product') {
            await c.query(productSQL, productArgs)
            const pending = link(p, current).then(
              () => ({ ok: true, error: '' }),
              (e) => ({ ok: false, error: String(e) })
            )
            await waitForBlocked('factory_order_link_product')
            await c.query('commit')
            const result = await pending
            assert.equal(result.ok, false)
            assert.match(result.error, /not current/)
          } else {
            await c.query(
              `select public.factory_order_link_product($1,$2,$3,1,$4,$5,2,'race',$6)`,
              [
                ADMIN,
                p.order,
                current.order.product_order_id,
                current.order_hash,
                p.signature,
                randomUUID(),
              ]
            )
            const pending = rpc(productSQL, productArgs)
            await waitForBlocked(
              action === 'revision'
                ? 'factory_product_order_register'
                : 'factory_product_order_withdraw'
            )
            await c.query('commit')
            await pending
            assert.equal(
              (await query(p)).rows[0].result.rows[0].status,
              action === 'revision' ? 'superseded' : 'withdrawn'
            )
          }
        } finally {
          await c.query('rollback').catch(() => {})
          c.release()
        }
      })
    }
  await test('a real failed-state transition closes the personal order and prevents new linkage', async () => {
    const p = await personal(A)
    await rpc(
      `select factory_order_transition($1,'requested','failed','test closure',null,null,$2)`,
      [p.order, randomUUID()],
      'authenticated',
      ADMIN
    )
    await assert.rejects(link(p, po), /not current/)
  })
  await test('canonical revision supersedes old links without rewriting history or deliveries', async () => {
    const revision = await reg('TPO-test', 2)
    assert.equal((await query(a)).rows[0].result.rows[0].status, 'superseded')
    assert.equal((await link(a, po, 4)).rows[0].id, linkId)
    const p = await personal(A)
    await assert.rejects(link(p, po), /not current/)
    await link(p, revision)
  })
  await test('withdrawal is a separate immutable event; replay is historical and new linking is blocked', async () => {
    const current = await reg('TPO-withdraw')
    const p = await personal(A)
    const l = (await link(p, current)).rows[0].id
    const key = randomUUID()
    const args = [ADMIN, 'TPO-withdraw', 1, current.order_hash, 'test withdrawal', key]
    const first = await rpc(
      `select public.factory_product_order_withdraw($1,$2,$3,$4,$5,$6) id`,
      args
    )
    assert.equal(
      (await rpc(`select public.factory_product_order_withdraw($1,$2,$3,$4,$5,$6) id`, args))
        .rows[0].id,
      first.rows[0].id
    )
    await assert.rejects(
      rpc(`select public.factory_product_order_withdraw($1,$2,$3,$4,'changed',$5)`, [
        ADMIN,
        'TPO-withdraw',
        1,
        current.order_hash,
        randomUUID(),
      ]),
      /different body/
    )
    assert.equal((await link(p, current)).rows[0].id, l)
    assert.equal((await query(p)).rows[0].result.rows[0].status, 'withdrawn')
    await assert.rejects(link(await personal(B), current), /not current/)
    assert.equal(
      (
        await db.query(
          `select max(order_revision) r from factory_product_order where product_order_id='TPO-withdraw'`
        )
      ).rows[0].r,
      1
    )
  })
  await test('new PLAN, goal and paused Workspace block new linkage; old facts remain', async () => {
    const p = await personal(A)
    await link(p, (po = await reg('TPO-plan')))
    await db.query(
      `insert into learner_workspace_plan(workspace_id,user_id,plan_version) values($1,$2,2)`,
      [p.ws, A]
    )
    assert.equal((await query(p)).rows[0].result.rows[0].status, 'personal_order_changed')
    await assert.rejects(link(p, await reg('TPO-plan-alt')), /not current/)
    const q = await personal(B)
    await db.query(`update learner_workspace set status='paused' where id=$1`, [q.ws])
    await assert.rejects(link(q, po), /not current/)
    const g = await personal(B)
    await db.query(`insert into csat_map_goal_version(user_id) values($1)`, [B])
    await assert.rejects(link(g, po), /not current/)
  })
  await test('ordinary/admin JWT cannot bypass server sealer; curator cannot write even through trusted gateway', async () => {
    const args = [ADMIN, po.canonical_order, po.order_hash, spec, 4, 'x', randomUUID()]
    for (const role of ['anon', 'authenticated'])
      await assert.rejects(
        rpc(
          `select public.factory_product_order_register($1,$2,$3,$4,$5,$6,$7)`,
          args,
          role,
          ADMIN
        ),
        /permission denied/
      )
    await assert.rejects(link(a, po, 1, randomUUID(), 'test', CURATOR), /Forbidden/)
    await assert.rejects(query(a, A), /Forbidden/)
    assert.equal((await query(a, CURATOR)).rows[0].result.rows.length, 1)
    await db.query(`update admins set status='suspended' where user_id=$1`, [ADMIN])
    await assert.rejects(query(a), /Forbidden/)
    await db.query(`update admins set status='active' where user_id=$1`, [ADMIN])
  })
  await test('table DML/TRUNCATE revoked including service role and spoofed writer GUC', async () => {
    for (const table of [
      'factory_product_order',
      'factory_order_product_link',
      'factory_product_order_withdrawal',
      'factory_lineage_request',
    ]) {
      for (const role of ['anon', 'authenticated', 'service_role'])
        for (const priv of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES']) {
          assert.equal(
            (await db.query(`select has_table_privilege($1,$2,$3) ok`, [role, table, priv])).rows[0]
              .ok,
            false,
            `${role}:${table}:${priv}`
          )
        }
      await assert.rejects(
        rpc(
          `select set_config('vocaflow.supply_writer','rpc',true); delete from public.${table}`,
          []
        ),
        /permission denied/
      )
      await assert.rejects(db.query(`delete from public.${table}`), /append-only/)
      assert.equal(
        (await rpc(`select count(*)::int n from public.${table}`, [], 'authenticated', A)).rows[0]
          .n,
        0
      )
    }
  })
  await test('RPC search paths fixed; internal helpers have no inherited PUBLIC/service execution', async () => {
    const funcs = (
      await db.query(
        `select p.oid,p.proname,p.proconfig,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'factory_lineage_%' or p.proname in ('factory_product_order_is_current','factory_product_order_register','factory_order_link_product','factory_product_order_withdraw'))`
      )
    ).rows
    assert.equal(funcs.length, 11)
    for (const f of funcs) {
      assert.ok(f.proconfig.some((c: string) => c.includes('pg_temp')))
      const flags = (
        await db.query(
          `select has_function_privilege('anon',$1,'execute') a,has_function_privilege('service_role',$1,'execute') s`,
          [f.oid]
        )
      ).rows[0]
      assert.equal(flags.a, false)
      if (
        ![
          'factory_lineage_read',
          'factory_product_order_register',
          'factory_order_link_product',
          'factory_product_order_withdraw',
        ].includes(f.proname)
      )
        assert.equal(flags.s, false)
    }
  })
  await test('failed schema transaction leaves no partial DDL', async () => {
    const rollbackDb = await cluster.newDb('rollback_probe')
    // No supply prerequisites: failure must roll back every earlier CREATE as well.
    await rollbackDb.query('begin')
    await assert.rejects(rollbackDb.query(sql))
    await rollbackDb.query('rollback')
    assert.equal(
      (
        await rollbackDb.query(
          `select to_regprocedure('public.factory_lineage_canonical(jsonb,integer)')::text x`
        )
      ).rows[0].x,
      null
    )
  })
  await test('guarded package applies atomically, seals exact history, blocks replay and stops writes without dropping data', async () => {
    const isolated = await cluster.newDb('packaged')
    for (const f of ['c_qualification', 'b_orders', 'i1_safety', 'i1_partial'])
      await isolated.query(read(`supabase/migrations/_pending_workspace_supply_${f}.sql`))
    const baselineRows = (await isolated.query(BASELINE_SQL)).rows[0].baseline
    const pkg = buildD3Package({ baselineRows })
    await isolated.query(pkg.sql)
    const verified = (await isolated.query(pkg.verify)).find(
      (r: unknown) =>
        Array.isArray((r as { rows: unknown[] }).rows) &&
        (r as { rows: unknown[] }).rows.length === 9
    ).rows
    assert.equal(verified.length, 9)
    assert.ok(verified.every((r: { ok: boolean }) => r.ok))
    assert.equal(
      (
        await isolated.query(
          `select encode(sha256(convert_to(array_to_string(statements,''),'UTF8')),'hex') hash from supabase_migrations.schema_migrations where version=$1`,
          [D3_VERSION]
        )
      ).rows[0].hash,
      lineageHash(sql)
    )
    await assert.rejects(isolated.query(pkg.sql), /target already exists/)
    await isolated.query('rollback')
    await isolated.query(`drop function public.factory_lineage_read(uuid,uuid,uuid)`)
    const missing = (await isolated.query(pkg.verify)).find(
      (r: unknown) =>
        Array.isArray((r as { rows: unknown[] }).rows) &&
        (r as { rows: unknown[] }).rows.length === 9
    ).rows
    assert.equal(missing.length, 9)
    assert.equal(
      missing.find((r: { name: string }) => r.name === 'factory_lineage_read(uuid,uuid,uuid)').ok,
      false
    )
    assert.equal(
      missing.find((r: { name: string }) => r.name === 'factory_lineage_read(uuid,uuid,uuid)')
        .detail.installed,
      false
    )
    await isolated.query(pkg.restore)
    assert.equal(
      (
        await isolated.query(
          `select has_function_privilege('service_role','public.factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid)','execute') ok`
        )
      ).rows[0].ok,
      false
    )
    assert.equal(
      (await isolated.query(`select to_regclass('public.factory_order_product_link')::text t`))
        .rows[0].t,
      'factory_order_product_link'
    )
    const blocked = await cluster.newDb('bad_baseline')
    for (const f of ['c_qualification', 'b_orders', 'i1_safety', 'i1_partial'])
      await blocked.query(read(`supabase/migrations/_pending_workspace_supply_${f}.sql`))
    const wrong = buildD3Package({ baselineRows: [] })
    await assert.rejects(blocked.query(wrong.sql), /fingerprint changed/)
    await blocked.query('rollback')
    const noHistory = (await blocked.query(pkg.verify)).find(
      (r: unknown) =>
        Array.isArray((r as { rows: unknown[] }).rows) &&
        (r as { rows: unknown[] }).rows.length === 9
    ).rows
    assert.equal(noHistory.length, 9)
    assert.ok(noHistory.every((r: { ok: boolean }) => !r.ok))
    assert.equal(
      (await blocked.query(`select to_regclass('public.factory_product_order')::text t`)).rows[0].t,
      null
    )
    const fresh = (await blocked.query(BASELINE_SQL)).rows[0].baseline
    const isolatedPkg = buildD3Package({ baselineRows: fresh })
    await assert.rejects(
      blocked.query(
        isolatedPkg.sql.replace(
          '-- <<< VF-D3 SOURCE',
          () => `do $$ begin raise exception 'injected_failure'; end $$;\n-- <<< VF-D3 SOURCE`
        )
      ),
      /injected_failure/
    )
    await blocked.query('rollback')
    assert.equal(
      (await blocked.query(`select to_regclass('public.factory_product_order')::text t`)).rows[0].t,
      null
    )
    assert.equal(
      (
        await blocked.query(
          `select count(*)::int n from supabase_migrations.schema_migrations where version=$1`,
          [D3_VERSION]
        )
      ).rows[0].n,
      0
    )
  })
  fs.writeFileSync(
    '.agent-logs/d3-isolated-proof.json',
    JSON.stringify(
      {
        postgres: cluster.version,
        sql_sha256: lineageHash(sql),
        checks,
        shared_db_writes: 0,
        limitation:
          'Isolated dependency copies; not proof of shared DB application or policy/crosswalk approval.',
      },
      null,
      2
    ) + '\n'
  )
  process.stdout.write(`${checks.length} isolated checks passed\n`)
} finally {
  await cluster.stop()
}
