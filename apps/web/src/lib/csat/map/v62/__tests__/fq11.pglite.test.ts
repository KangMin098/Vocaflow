// apps/web/src/lib/csat/map/v62/__tests__/fq11.pglite.test.ts
// v6.2 P-F8c — FQ1.1 최종 16개를 자격 원장에 기록해도 승인 · 공급이 0 이고, 기존 R5 공급 판정은 그대로인지
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import { dcpRefOf, FQ11_CANDIDATES, toLedgerRecord } from '../fq11'
import { deliveryCheck, supplyEligible, toSupplyQualification } from '../qualification'
import { as, errorOf, openSupplyDb } from './supply-sql-harness'

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
let db: PGlite

beforeAll(async () => {
  db = await openSupplyDb()
  await db.exec(`insert into auth.users values ('${ADMIN}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  // 수정 대상 DCP 문항이 DB 에 (수정 전 내용으로) 있다고 둔다
  for (const c of FQ11_CANDIDATES) {
    const ref = dcpRefOf(c)
    if (ref) await db.query(`insert into public.csat_dcp_items (id, kind, ref_id, payload, answer_key) values ($1, 'article', gen_random_uuid(), '{"before":"repair"}', '{}')`, [ref])
  }
  await as(db, ADMIN)
}, 60000)

describe('FQ1.1 최종 16개 → 자격 원장', () => {
  it('16개 · 연구 4 + DCP 12 · 숫자 원장 그대로(공개 0 · 평가 0 · 완전 A~H 0)', () => {
    expect(FQ11_CANDIDATES).toHaveLength(16)
    expect(FQ11_CANDIDATES.filter((c) => c.cohort === 'research')).toHaveLength(4)
    expect(FQ11_CANDIDATES.filter((c) => dcpRefOf(c))).toHaveLength(12)
    for (const k of ['A', 'E', 'F', 'G', 'H'] as const) expect(FQ11_CANDIDATES.every((c) => c.axes[k].state === 'unknown'), k).toBe(true)
  })
  it('원장 행으로 기록된다(축별 방법 · 검토 revision · 근거 해시 보존) — 원천 · Gold 결속은 지어내지 않는다', async () => {
    for (const c of FQ11_CANDIDATES) {
      const r = toLedgerRecord(c)
      expect(r.sourceHash).toBeNull()
      expect(r.goldHash).toBeNull()
      expect(Object.values(r.axes).every((a) => a.method && a.review_revision)).toBe(true)
      const err = await errorOf(db.query(
        `select public.content_qualification_record($1,$2,$3,$4,$5,$6,$7::jsonb,null,null,$8,null,null,$9::text[],$10::text[],$11,null)`,
        [r.rulesVersion, r.kind, r.ref, r.revision, r.task, r.role, JSON.stringify(r.axes), r.analysisRevision, r.defects, r.evidenceIds, r.method]))
      expect(err, c.content.id).toBeNull()
    }
    expect((await db.query<{ n: number }>(`select count(*)::int n from public.content_qualification where rules_version = 'FQ1.1'`)).rows[0]!.n).toBe(16)
  })
  it('16개 모두 승인 불가(A · F · H unknown) — AI 내용 검토가 출시 승인을 대신하지 않는다', async () => {
    const ids = (await db.query<{ id: string }>(`select id from public.content_qualification where rules_version = 'FQ1.1'`)).rows
    let approved = 0
    for (const { id } of ids) if ((await errorOf(db.query(`select public.content_release_approve($1, 'public')`, [id]))) === null) approved++
    expect(approved).toBe(0)
  })
  it('DCP 수정본 revision ≠ DB 문항 현재 내용 — 수정본이 적재 · 재검수되기 전엔 공급 함수가 거절할 값이다', async () => {
    for (const c of FQ11_CANDIDATES.filter((x) => dcpRefOf(x))) {
      const cur = (await db.query<{ r: string }>(`select public.supply_artifact_revision('dcp_item', $1) r`, [dcpRefOf(c)])).rows[0]!.r
      expect(cur).toBeTruthy()
      expect(toLedgerRecord(c).revision).not.toBe(cur)
    }
    // 연구 활동은 제품 표가 없는 종류 → 현재 revision 없음(공급 불가)
    const research = FQ11_CANDIDATES.find((c) => c.cohort === 'research')!
    expect((await db.query<{ r: string | null }>(`select public.supply_artifact_revision('textbook_activity', $1) r`, [research.content.id])).rows[0]!.r).toBeNull()
  })
  it('승인 기록을 가정해도 앱 판정도 공급 0(축이 막는다)', () => {
    for (const c of FQ11_CANDIDATES) {
      const q = toSupplyQualification(c, { public: true, assessment: true })
      expect(supplyEligible(q, c.role).ok, c.content.id).toBe(false)
      expect(deliveryCheck(q, c.role, 'none').ok).toBe(false)
    }
  })
})
