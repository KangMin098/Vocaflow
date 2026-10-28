// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/rationale-correction.pglite.test.ts
// Executes the proposed two-row DATA SQL in isolated PostgreSQL; no shared DB connection.
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONTENT, SOURCE_ID } from './dcp-fixture'

const folder = path.resolve(__dirname, '../../../../../../../../../supabase/deploy/learning-outcomes-20261021')
const forward = fs.readFileSync(path.join(folder, 'rationale-correction.sql'), 'utf8')
const reverse = fs.readFileSync(path.join(folder, 'rationale-correction-rollback.sql'), 'utf8')
const observed = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/existing-dcp-observed-20261021.json'), 'utf8')) as {
  rows: { id: string; type: string; payload: Record<string, unknown>; answer_key: Record<string, unknown> }[]
}
let db: PGlite
const rows = async () => (await db.query<{ id: string; payload: unknown; answer_key: { answer: number; rationale_ko: string } }>('select id,payload,answer_key from public.csat_dcp_items order by id')).rows
async function apply(sql: string) {
  await db.exec('begin')
  try { await db.exec(sql); await db.exec('commit') } catch (e) { await db.exec('rollback'); throw e }
}
beforeEach(async () => {
  db = new PGlite()
  await db.exec(`create table public.library_articles(id uuid primary key,content text);
    create table public.csat_dcp_items(id uuid primary key,kind text,ref_id uuid,type text,paragraph_idx int,item_role text,payload jsonb,answer_key jsonb);
    create table public.content_qualification(artifact_kind text,artifact_ref text);
    create table public.factory_dcp_admission(dcp_item_id uuid);
    create table public.csat_item_attempts(id int primary key,dcp_item_id uuid references public.csat_dcp_items);`)
  await db.query('insert into public.library_articles values ($1,$2)', [SOURCE_ID, CONTENT])
  for (const r of observed.rows) await db.query("insert into public.csat_dcp_items values ($1,'article',$2,$3,0,'practice',$4,$5)", [r.id, SOURCE_ID, r.type, JSON.stringify(r.payload), JSON.stringify(r.answer_key)])
  for (let i = 0; i < observed.rows.length; i++) await db.query('insert into public.csat_item_attempts values ($1,$2)', [i + 1, observed.rows[i]!.id])
}, 120000)
afterEach(async () => { await db.close() })

describe('proposed rationale correction SQL', () => {
  it('updates only the two explanations, preserves payload/keys/attempts, and exact recovery restores originals', async () => {
    const before = await rows()
    await apply(forward)
    const after = await rows()
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.id).toBe(before[i]!.id)
      expect(after[i]!.payload).toEqual(before[i]!.payload)
      expect(after[i]!.answer_key.answer).toBe(before[i]!.answer_key.answer)
      expect(after[i]!.answer_key.rationale_ko).not.toBe(before[i]!.answer_key.rationale_ko)
    }
    expect((await db.query('select * from public.csat_item_attempts')).rows).toHaveLength(2)
    await expect(apply(forward)).rejects.toThrow(/answer key changed/)
    expect(await rows()).toEqual(after)
    await apply(reverse)
    expect(await rows()).toEqual(before)
    expect((await db.query('select * from public.csat_item_attempts')).rows).toHaveLength(2)
  })
  it('a stale second row rolls the whole correction back, including an earlier matching row', async () => {
    const last = (await rows())[1]!
    await db.query("update public.csat_dcp_items set answer_key=jsonb_set(answer_key,'{answer}','5') where id=$1", [last.id])
    const before = await rows()
    await expect(apply(forward)).rejects.toThrow(/answer key changed/)
    expect(await rows()).toEqual(before)
  })
  it('a changed source blocks every update', async () => {
    const before = await rows()
    await db.query("update public.library_articles set content=content || ' changed'")
    await expect(apply(forward)).rejects.toThrow(/source changed/)
    expect(await rows()).toEqual(before)
  })
  it.each(['qualification', 'admission'])('already %s bound rows cannot be corrected implicitly', async (kind) => {
    const id = observed.rows[0]!.id, before = await rows()
    if (kind === 'qualification') await db.query("insert into public.content_qualification values ('dcp_item',$1)", [id])
    else await db.query('insert into public.factory_dcp_admission values ($1)', [id])
    await expect(apply(forward)).rejects.toThrow(/qualification\/admission already exists/)
    expect(await rows()).toEqual(before)
  })
})
