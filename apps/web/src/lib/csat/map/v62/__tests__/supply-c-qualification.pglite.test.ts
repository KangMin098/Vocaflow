// apps/web/src/lib/csat/map/v62/__tests__/supply-c-qualification.pglite.test.ts
// v6.2 P-F7c — 승인안 C(자격 원장) 보류 SQL 을 격리 Postgres(PGlite)에 적용해 계약을 확인한다. 개발 DB 무관.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import FQ1 from '../fq1-results.data.json'
import { AXES, as, errorOf, openSupplyDb } from './supply-sql-harness'

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const LEARNER = '00000000-0000-4000-8000-0000000000b1'
const H64 = 'a'.repeat(64)

let db: PGlite

async function record(o: {
  kind?: string; ref?: string; rev?: string; task?: string; role?: string; axes?: object
  src?: string | null; srcHash?: string | null; gold?: string | null; goldHash?: string | null; supersedes?: string | null; defects?: string[]
}): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select public.content_qualification_record('FQ1.0', $1, $2, $3, $4, $5, $6::jsonb, $7, $8, null, $9, $10, $11::text[], '{ev-1}', '2인 검수', $12) id`,
    [o.kind ?? 'dcp_item', o.ref ?? 'item-1', o.rev ?? 'r1', o.task ?? 'r.central_meaning', o.role ?? 'guided_practice',
      JSON.stringify(o.axes ?? AXES()), o.src === undefined ? 'src-r1' : o.src, o.srcHash === undefined ? H64 : o.srcHash,
      o.gold === undefined ? 'gold-r1' : o.gold, o.goldHash === undefined ? H64 : o.goldHash, o.defects ?? [], o.supersedes ?? null],
  )
  return r.rows[0]!.id
}

beforeAll(async () => {
  db = await openSupplyDb({ withB: false })
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${LEARNER}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  await as(db, ADMIN)
}, 60000)

describe('C — 자격 원장 기록', () => {
  it('학습자 · 로그아웃은 기록할 수 없다', async () => {
    await as(db, LEARNER)
    expect(await errorOf(record({}))).toMatch(/Forbidden/)
    await as(db, null)
    expect(await errorOf(record({}))).toMatch(/Forbidden/)
    await as(db, ADMIN)
  })
  it('A~H 8축 · 4상태만 — 축 누락 · 모르는 상태는 거절', async () => {
    const missing = AXES() as Record<string, unknown>
    delete missing.H
    expect(await errorOf(record({ axes: missing }))).toMatch(/check/i)
    expect(await errorOf(record({ axes: AXES({ B: 'maybe' }) }))).toMatch(/check/i)
  })
  it('A pass 인데 원천 revision · 해시가 없으면 거절(FQ1.0 「생성 당시 원문 revision 미결속」)', async () => {
    expect(await errorOf(record({ src: null }))).toMatch(/check/i)
    expect(await errorOf(record({ srcHash: null }))).toMatch(/check/i)
    // A 가 unknown 이면 원천 결속 없이 기록할 수 있다(보류 기록)
    expect(await errorOf(record({ ref: 'unbound', src: null, srcHash: null, axes: AXES({ A: 'unknown' }) }))).toBeNull()
  })
  it('E pass 인데 Gold 결속이 없으면 거절', async () => {
    expect(await errorOf(record({ gold: null, goldHash: null }))).toMatch(/check/i)
  })
  it('추가 전용 — UPDATE · DELETE 거부(서비스 권한도)', async () => {
    const id = await record({ ref: 'immutable' })
    expect(await errorOf(db.query(`update public.content_qualification set method = 'x' where id = $1`, [id]))).toMatch(/append-only/)
    expect(await errorOf(db.query(`delete from public.content_qualification where id = $1`, [id]))).toMatch(/append-only/)
  })
  it('대체(supersedes) — 정체성이 같아야 하고, 한 행은 한 번만 대체된다', async () => {
    const v1 = await record({ ref: 'chain' })
    expect(await errorOf(record({ ref: 'other', supersedes: v1 }))).toMatch(/identity mismatch/)
    const v2 = await record({ ref: 'chain', rev: 'r2', supersedes: v1 })
    expect(v2).toBeTruthy()
    expect(await errorOf(record({ ref: 'chain', rev: 'r3', supersedes: v1 }))).toMatch(/unique|duplicate/i)
  })
})

describe('C — 출시 · 평가 승인', () => {
  it('필수 축이 unknown · not_applicable 이면 승인할 수 없다(통과로 바꾸지 않는다)', async () => {
    for (const axes of [AXES({ F: 'unknown' }), AXES({ H: 'not_applicable' }), AXES({ D: 'unknown' })]) {
      const id = await record({ ref: `u-${JSON.stringify(axes).length}-${Math.random()}`, axes })
      expect(await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [id]))).toMatch(/required axes not pass/)
    }
  })
  it('대체된 자격은 승인할 수 없다(revision 이 바뀌면 이전 자격을 상속하지 않는다)', async () => {
    const v1 = await record({ ref: 'old-rev' })
    await record({ ref: 'old-rev', rev: 'r2', supersedes: v1 })
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [v1]))).toMatch(/superseded/)
  })
  it('평가 승인은 E pass 가 필요하다 · 평가 역할(독립 확인)은 E 가 필수 축', async () => {
    const guided = await record({ ref: 'g-e-unknown', axes: AXES({ E: 'unknown' }), gold: null, goldHash: null })
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'assessment')`, [guided]))).toMatch(/E not pass/)
    const check = await record({ ref: 'c-e-unknown', role: 'independent_check', axes: AXES({ E: 'unknown' }), gold: null, goldHash: null })
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [check]))).toMatch(/required axes not pass/)
  })
  it('학습자는 승인할 수 없다 · 승인자 권한이 기록된다', async () => {
    const id = await record({ ref: 'approve-me' })
    await as(db, LEARNER)
    expect(await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [id]))).toMatch(/Forbidden/)
    await as(db, ADMIN)
    const a = await db.query<{ id: string }>(`select public.content_release_approve($1, 'public') id`, [id])
    const row = await db.query<{ approver_role: string }>(`select approver_role from public.content_release_approval where id = $1`, [a.rows[0]!.id])
    expect(row.rows[0]!.approver_role).toBe('admin')
  })
})

describe('C — 실제 FQ1.0 판정 20건을 원장에 넣으면', () => {
  it('하나도 승인되지 않는다(F unknown 18 · fail 2 — 연구자 플래그가 아니라 축이 막는다)', async () => {
    let approved = 0
    for (const [n, r] of FQ1.results.entries()) {
      const axes = r.axes as Record<string, { state: string }>
      const id = await record({
        ref: `fq1-${n}`, rev: r.content.revision, task: r.task, role: r.role, axes,
        // 원천 · Gold 결속은 연구 원장에만 있으므로 축이 pass 일 때만 대표 값을 넣는다(A · E 제약 충족용)
        src: axes.A!.state === 'pass' ? 'src' : null, srcHash: axes.A!.state === 'pass' ? H64 : null,
        gold: axes.E!.state === 'pass' ? 'gold' : null, goldHash: axes.E!.state === 'pass' ? H64 : null,
      })
      if ((await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [id]))) === null) approved++
    }
    expect(approved).toBe(0)
  })
})
