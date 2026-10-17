// scripts/research/factory-i2-r5-qualification/independent-cases.ts
// Same adversarial SQL cases on PGlite and real isolated PostgreSQL. Never connects to development DB.
import { randomUUID } from 'node:crypto'

export interface SqlDb {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>
}
export async function annotationCases(db: SqlDb) {
  const results: { name: string; ok: boolean; detail: string }[] = []
  const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail })
  const err = async (sql: string, args?: unknown[]) => {
    try { await db.query(sql, args); return null } catch (e) { return (e as Error).message }
  }
  const one = async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows[0]!
  const admin = randomUUID(), me = randomUUID(), other = randomUUID(), H = 'a'.repeat(64), H2 = 'b'.repeat(64)
  const as = (id: string) => db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id])
  await db.query(`insert into auth.users values ($1),($2),($3)`, [admin, me, other])
  await db.query(`insert into admins values ($1,'admin')`, [admin])
  await db.query(`insert into csat_items (id,exam_id,no,stem,passage,choices,answer) values
    ('I2#24','I2',24,'s','Independent passage','[1,2,3,4,5]',2)`)
  const rev = (await one(`select supply_artifact_revision('csat_item','I2#24') r`)).r as string
  const ws = (await one(`insert into learner_workspace(user_id) values ($1) returning id`, [me])).id
  await db.query(`insert into learner_workspace_plan(workspace_id,user_id,plan_version) values ($1,$2,1)`, [ws, me])
  const axes = (over: Record<string, string> = {}) => JSON.stringify(Object.fromEntries([... 'ABCDEFGH'].map(k => [k, { state: over[k] ?? 'pass' }])))
  const record = async (over: { axes?: string; hash?: string | null; ref?: string | null; revision?: string; gold?: string | null } = {}) => {
    return (await one(`select content_qualification_record('FQ1.1','csat_item','I2#24',$1,'r.central_meaning','transfer',$2::jsonb,
      'source',$3,null,$4,$5,$6,$7,'{}','{evidence}','isolated fixture',null) id`,
      [over.revision ?? rev, over.axes ?? axes(), H, over.gold === undefined ? 'gold' : over.gold,
        over.gold === null ? null : H, over.ref === undefined ? 'annotation.v1' : over.ref, over.hash === undefined ? H : over.hash])).id as string
  }
  const failedRecord = async (over: Parameters<typeof record>[0]) => { try { await record(over); return null } catch (e) { return (e as Error).message } }
  await as(admin)
  check('B PASS requires non-NULL hash', /annotation_bound/.test(await failedRecord({ hash: null }) ?? ''))
  check('B PASS requires non-NULL ref', /annotation_bound/.test(await failedRecord({ ref: null }) ?? ''))
  check('hash format rejects non-hex', (await failedRecord({ hash: 'xyz' })) !== null)
  check('ref rejects empty', (await failedRecord({ ref: '' })) !== null)
  check('ref rejects whitespace', (await failedRecord({ ref: '   ' })) !== null)
  check('E PASS without Gold rejected', (await failedRecord({ gold: null })) !== null)
  await as(me)
  check('NULL administrator helper denies new writer', /Forbidden/.test(await failedRecord({}) ?? ''))
  await as(admin)
  const q = await record()
  const pub = (await one(`select content_release_approve($1,'public') id`, [q])).id
  const asm = (await one(`select content_release_approve($1,'assessment') id`, [q])).id
  for (const axis of ['C', 'E', 'F', 'H']) {
    const u = await record({ axes: axes({ [axis]: 'unknown' }) })
    for (const scope of ['public', 'assessment']) check(`${axis} UNKNOWN blocks ${scope}`, /required axes not pass/.test(await err(`select content_release_approve($1,$2)`, [u, scope]) ?? ''))
  }
  const oldSig = 'public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid)'
  check('old writer signature absent after S + binding', (await one(`select to_regprocedure($1) r`, [oldSig])).r === null)
  const current = (await one(`select to_regclass('public.supply_current_annotation') r`)).r !== null
  check('authoritative current annotation table installed', current)
  const setCurrent = async (over: { hash?: string; ref?: string; revision?: string; task?: string } = {}) => {
    if (!current) return
    await db.query(`delete from supply_current_annotation`)
    await db.query(`insert into supply_current_annotation values ('I2#24',$1,$2,$3,$4)`,
      [over.task ?? 'r.central_meaning', over.revision ?? rev, over.ref ?? 'annotation.v1', over.hash ?? H])
  }
  const line = async () => {
    await as(me)
    const c = JSON.stringify({ v: 2, user: me, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1,
      definitionVersion: randomUUID(), core: 'r.central_meaning', lines: [{ role: 'transfer', task: 'r.central_meaning', n: 2, types: [], keys: [], requires: [], reason: 'need' }] })
    const demand = (await one(`select workspace_demand_record($1) id`, [c])).id
    return (await one(`select id from workspace_content_demand_line where demand_id=$1`, [demand])).id
  }
  const supply = async (l: unknown, qualification: unknown = q, approval: unknown = asm, key: string = randomUUID()) =>
    db.query(`select workspace_delivery_record($1,null,$2,$3,$4) id`, [l, qualification, approval, key])
  await as(me)
  for (const missing of [true, false]) {
    const c: Record<string, unknown> = { v: null, user: me, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1,
      definitionVersion: 'version-probe', core: 'r.central_meaning', lines: [{ role: 'transfer', task: 'r.central_meaning', n: 1 }] }
    if (missing) delete c.v
    check(`demand version ${missing ? 'missing' : 'NULL'} rejected`, /demand: user mismatch/.test(await err(`select workspace_demand_record($1)`, [JSON.stringify(c)]) ?? ''))
  }
  const rejectedSupply = async (l: unknown, qualification: unknown = q, approval: unknown = asm) => {
    try { await supply(l, qualification, approval); return null } catch (e) { return (e as Error).message }
  }
  check('missing current annotation blocks supply', /annotation/.test(await rejectedSupply(await line()) ?? ''))
  for (const [name, over] of [
    ['forged/current hash mismatch', { hash: H2 }], ['current ref mismatch', { ref: 'annotation.v2' }],
    ['current source revision mismatch', { revision: H2 }], ['current TASK mismatch', { task: 'r.other_task' }],
  ] as const) {
    await setCurrent(over)
    check(name, /annotation/.test(await rejectedSupply(await line()) ?? ''))
  }
  await setCurrent()
  const l = await line(), key = randomUUID()
  let delivery: unknown
  try { delivery = (await supply(l, q, asm, key)).rows[0]!.id; check('exact current ref/hash/revision supplies', true) }
  catch (e) { check('exact current ref/hash/revision supplies', false, (e as Error).message) }
  if (delivery) {
    check('current delivery valid', (await one(`select supply_delivery_valid($1) v`, [delivery])).v === true)
    await setCurrent({ hash: H2 })
    check('annotation edit invalidates present fulfillment', (await one(`select supply_delivery_valid($1) v`, [delivery])).v === false)
    check('history replay returns same ID after annotation edit', (await supply(l, q, asm, key)).rows[0]!.id === delivery)
    check('history qualification hash preserved', (await one(`select annotation_hash h from content_qualification where id=$1`, [q])).h === H)
    check('history delivery row preserved', Number((await one(`select count(*) n from workspace_content_delivery where id=$1`, [delivery])).n) === 1)
  }
  await setCurrent()
  check('public-only approval cannot supply assessment', /assessment/.test(await rejectedSupply(await line(), q, pub) ?? ''))
  // G2 content_hash remains an annotation hash. Even a different historical hash still means exposure.
  await db.query(`alter table learning_task_attempts add column content_hash text`)
  await db.query(`insert into learning_task_attempts(user_id,item_ref,content_hash) values ($1,'I2#24',$2)`, [other, H2])
  check('another learner exposure does not block me', (await rejectedSupply(await line())) === null)
  await db.query(`insert into learning_task_attempts(user_id,item_ref,content_hash,synthetic) values ($1,'I2#24',$2,true)`, [me, H2])
  check('old G2 hash and synthetic exposure block same learner', /exposure/.test(await rejectedSupply(await line()) ?? ''))
  check('G2 content_hash not rewritten', (await one(`select content_hash h from learning_task_attempts where user_id=$1`, [me])).h === H2)
  // SET ROLE exercises actual ACLs; no superuser bypass is used for these attack calls.
  await as(other)
  await db.query(`set role authenticated`)
  check('authenticated cannot bypass wrapper', /permission denied|does not exist/.test(await err(`select workspace_delivery_record_i1(null,null,null,null,null)`) ?? ''))
  check('authenticated cannot call current helper', /permission denied|does not exist/.test(await err(`select supply_annotation_matches(null)`) ?? ''))
  if (current) {
    check('authenticated cannot read current registry', /permission denied/.test(await err(`select * from supply_current_annotation`) ?? ''))
    check('authenticated cannot forge current registry', /permission denied/.test(await err(`insert into supply_current_annotation values ('I2#24','r.central_meaning',$1,'forged',$1)`, [H2]) ?? ''))
    check('authenticated cannot TRUNCATE current registry', /permission denied/.test(await err(`truncate supply_current_annotation`) ?? ''))
    check('other learner delivery hidden by RLS', Number((await one(`select count(*) n from workspace_content_delivery where user_id=$1`, [me])).n) === 0)
  }
  await db.query(`reset role`)
  await db.query(`set role anon`)
  check('anon cannot call delivery', /permission denied/.test(await err(`select workspace_delivery_record(null,null,null,null,null)`) ?? ''))
  await db.query(`reset role`)
  if (current) {
    // Detect any unlocked re-read after the locking statement, including the zero-row insertion gap.
    const original = (await one(`select pg_get_functiondef('public.supply_annotation_matches(uuid)'::regprocedure) sql`)).sql as string
    try {
      await db.query(`create or replace function public.supply_annotation_matches(p_qualification uuid)
        returns boolean language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
        begin raise exception 'unlocked annotation helper re-read'; end $$`)
      await db.query('delete from supply_current_annotation')
      check('zero locked rows reject before any unlocked helper read', /current annotation unavailable/.test(await rejectedSupply(await line()) ?? ''))
      await setCurrent()
      // This learner already has exposure: reach the unchanged I1 G guard using the locked row only.
      check('locked annotation tuple compared without helper re-read', /exposure/.test(await rejectedSupply(await line()) ?? ''))
    } finally { await db.query(original) }
  }
  return { admin, me, q, pub, asm, l, delivery, current, rev, results }
}
