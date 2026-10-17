// apps/web/src/lib/csat/map/v62/__tests__/supply-c-annotation-binding.pglite.test.ts
// Factory I2 R5 자격 패킷 — 주석 hash 결속 보류 SQL(`_pending_workspace_supply_c_annotation_binding.sql`)을 C 위에 격리 Postgres(PGlite)로 적용해 본다.
// 그리고 2020#24 전이의 **현재 실제 축 판정**(PACKET.md §2)을 그대로 넣으면 기록은 되지만 출시 · 평가 승인은 거절되는지 확인한다. 개발 DB 무관.
import fs from 'node:fs'
import path from 'node:path'

import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import EVIDENCE from '../../../../../../../../docs/research/factory-i2-r5-qualification-20261017/evidence.json'
import { as, errorOf, openSupplyDb } from './supply-sql-harness'

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const BIND_SQL = fs.readFileSync(path.join(__dirname, '../../../../../../../../supabase/migrations/_pending_workspace_supply_c_annotation_binding.sql'), 'utf8')
const E = EVIDENCE.items['2020#24']

type S = 'pass' | 'fail' | 'unknown' | 'not_applicable'
const axes = (o: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H', S>>) =>
  Object.fromEntries((['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map((k) => [k, { state: o[k] ?? 'unknown' }]))

/** PACKET.md §2 의 현재 판정 — A · B 만 pass, 나머지 unknown(D · G 는 전이 역할에서 비필수 · 공급 시점 판정) */
const CURRENT = axes({ A: 'pass', B: 'pass' })

let db: PGlite

async function record(o: { axes: object; annRef?: string | null; annHash?: string | null; role?: string }): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select public.content_qualification_record('FQ1.1', 'csat_item', $1, $2, 'r.central_meaning', $3, $4::jsonb,
       $5, $6, $7, null, null, $8, $9, '{}'::text[], $10::text[], 'AI 한정 검토(사람 0)') id`,
    [E.artifact.ref, E.artifact.bRevision, o.role ?? 'transfer', JSON.stringify(o.axes),
      'kice:2020:suneung:짝수:24', E.source.officialPdf.sha256, `v${E.analysis.version}:${E.analysis.contentSha256}`,
      o.annRef === undefined ? E.annotation.version : o.annRef, o.annHash === undefined ? E.annotation.annotationHash : o.annHash,
      [E.annotation.annotationHash, E.source.officialPdf.sha256, E.source.officialAnswerKey.sha256]],
  )
  return r.rows[0]!.id
}

beforeAll(async () => {
  db = await openSupplyDb()
  await db.exec(fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8'))
  await db.exec(fs.readFileSync(path.join(__dirname, '../../../../../../../../supabase/migrations/_pending_workspace_supply_i1_safety.sql'), 'utf8'))
  await db.exec(BIND_SQL)
  await db.exec(`insert into auth.users values ('${ADMIN}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  await as(db, ADMIN)
}, 60000)

describe('주석 hash 결속', () => {
  it('B · C · E 중 pass 가 있는데 주석 결속이 없으면 거절', async () => {
    expect(await errorOf(record({ axes: CURRENT, annHash: null }))).toMatch(/content_qualification_annotation_bound/)
    expect(await errorOf(record({ axes: CURRENT, annRef: null }))).toMatch(/content_qualification_annotation_bound/)
  })

  it('주석 hash 형식이 64 hex 가 아니면 거절', async () => {
    expect(await errorOf(record({ axes: CURRENT, annHash: 'xyz' }))).not.toBeNull()
  })

  it('B · C · E 가 모두 pass 아님이면 주석 없이도 기록된다(주석과 무관한 판정)', async () => {
    expect(await record({ axes: axes({ A: 'pass' }), annRef: null, annHash: null })).toMatch(/[0-9a-f-]{36}/)
  })

  it('옛 서명(주석 인자 없음)은 남지 않는다', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int n from pg_proc where proname = 'content_qualification_record'`)
    expect(r.rows[0]!.n).toBe(1)
  })
})

describe('2020#24 전이 — 현재 실제 판정', () => {
  it('기록은 되고 주석 hash 가 함께 남는다', async () => {
    const id = await record({ axes: CURRENT })
    const r = await db.query<{ annotation_hash: string; artifact_revision: string; source_hash: string }>(
      `select annotation_hash, artifact_revision, source_hash from content_qualification where id = $1`, [id])
    expect(r.rows[0]).toEqual({ annotation_hash: E.annotation.annotationHash, artifact_revision: E.artifact.bRevision, source_hash: E.source.officialPdf.sha256 })
  })

  it('public · assessment 승인 모두 거절 — C · E · F · H 가 pass 가 아니다', async () => {
    const id = await record({ axes: CURRENT })
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [id]))).toMatch(/required axes not pass/)
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'assessment')`, [id]))).toMatch(/required axes not pass/)
  })

  it('C · F · H 만 채워도 E(Gold) 없이는 전이 승인 불가 — E pass 는 Gold 결속도 요구', async () => {
    const id = await record({ axes: axes({ A: 'pass', B: 'pass', C: 'pass', F: 'pass', H: 'pass' }) })
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [id]))).toMatch(/required axes not pass/)
    expect(await errorOf(record({ axes: axes({ A: 'pass', B: 'pass', C: 'pass', E: 'pass', F: 'pass', H: 'pass' }) }))).toMatch(/check constraint/)
  })
})
