// apps/web/src/lib/csat/map/v62/__tests__/fq-reader-binding.test.ts
//
// 정식 자격 reader — 원장 행이 있다고 적격이 되지 않는다. 결속(축 · 원천 · Gold · 승인 · 철회 · 현재 revision · 현재 주석) 반례.
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { fqRowVerdict, loadFqReader, type FqApprovalRow, type FqRow } from '../exposure-ledger'
import { supplyFor } from '../supply'

const REV = 'a'.repeat(64)
const ANN = 'b'.repeat(64)
const T = 'r.central_meaning'
const axes = (o: Record<string, string> = {}) => Object.fromEntries('ABCDEFGH'.split('').map((k) => [k, { state: o[k] ?? (k === 'D' || k === 'G' ? 'unknown' : 'pass') }]))
const row = (o: Partial<FqRow> = {}): FqRow => ({
  id: 'q1', artifact_kind: 'csat_item', artifact_ref: '2020#24', artifact_revision: REV,
  source_revision: 'kice:2020:suneung:짝수:24', source_hash: 'c'.repeat(64), gold_revision: 'g1', gold_hash: 'd'.repeat(64),
  task_id: T, role: 'transfer', axes: axes(), annotation_ref: 'claim-support-2020-24.v1', annotation_hash: ANN, supersedes: null, ...o,
})
const APPROVED: FqApprovalRow[] = [{ id: 'a1', qualification_id: 'q1', scope: 'public' }, { id: 'a2', qualification_id: 'q1', scope: 'assessment' }]
const ctx = (o: Partial<Parameters<typeof fqRowVerdict>[1]> = {}): Parameters<typeof fqRowVerdict>[1] => ({
  tasks: new Set([T]), supersededIds: new Set(), approvals: APPROVED, revoked: new Set(), currentRevision: REV, currentAnnotation: { ref: 'claim-support-2020-24.v1', hash: ANN }, ...o,
})

describe('fqRowVerdict — 결속 하나라도 빠지면 거절', () => {
  it('모든 결속이 맞으면 적격', () => expect(fqRowVerdict(row(), ctx())).toEqual({ ok: true }))
  it.each([
    ['E unknown(사람 Gold 없음)', row({ axes: axes({ E: 'unknown' }) }), ctx(), 'role_axes'],
    ['F unknown(권리 판단 없음)', row({ axes: axes({ F: 'unknown' }) }), ctx(), 'role_axes'],
    ['C unknown(TASK 수행 미관찰)', row({ axes: axes({ C: 'unknown' }) }), ctx(), 'role_axes'],
    ['H fail', row({ axes: axes({ H: 'fail' }) }), ctx(), 'role_axes'],
    ['다른 TASK', row({ task_id: 'r.flow_order' }), ctx(), 'task'],
    ['대체된 행', row(), ctx({ supersededIds: new Set(['q1']) }), 'superseded'],
    ['Gold 결속 없음', row({ gold_hash: null }), ctx(), 'gold_unbound'],
    ['원천 결속 없음', row({ source_hash: null }), ctx(), 'source_unbound'],
    ['공개 승인 없음', row(), ctx({ approvals: [APPROVED[1]] }), 'approval_public'],
    ['평가 승인 철회', row(), ctx({ revoked: new Set(['a2']) }), 'approval_assessment'],
    ['다른 자격 행의 승인', row(), ctx({ approvals: APPROVED.map((a) => ({ ...a, qualification_id: 'q2' })) }), 'approval_public'],
    ['문항 revision 변경', row(), ctx({ currentRevision: 'e'.repeat(64) }), 'revision_stale'],
    ['문항 revision 모름', row(), ctx({ currentRevision: null }), 'revision_stale'],
    ['주석 변경', row(), ctx({ currentAnnotation: { ref: 'claim-support-2020-24.v1', hash: 'f'.repeat(64) } }), 'annotation_unbound'],
    ['주석 모름', row(), ctx({ currentAnnotation: null }), 'annotation_unbound'],
    ['해시는 같고 주석 ref 가 다름', row({ annotation_ref: 'claim-support-2020-24.v0' }), ctx(), 'annotation_unbound'],
    ['정본 주석 결속 없음(evidence_ids 만으로는 인정 안 함)', row({ annotation_ref: null, annotation_hash: null }), ctx(), 'annotation_unbound'],
  ])('%s', (_, r, c, reason) => expect(fqRowVerdict(r, c)).toEqual({ ok: false, reason }))
  it('교수 역할은 D pass 가 필요하고 평가 승인은 필요 없다', () => {
    expect(fqRowVerdict(row({ role: 'model_explanation' }), ctx())).toEqual({ ok: false, reason: 'role_axes' })
    expect(fqRowVerdict(row({ role: 'model_explanation', axes: axes({ D: 'pass' }) }), ctx({ approvals: [APPROVED[0]] }))).toEqual({ ok: true })
  })
})

type Res = { data: unknown; error: unknown; count?: number | null }
function fake(tables: Record<string, Res>, rpc: Res = { data: REV, error: null }) {
  const calls: string[] = []
  const client = {
    from(table: string) {
      calls.push(table)
      const q = { select: () => q, eq: () => q, in: () => q, limit: () => q, then: (r: (v: Res) => unknown) => { const t = tables[table] ?? { data: [], error: null }; return Promise.resolve('count' in t ? t : { ...t, count: Array.isArray(t.data) ? t.data.length : null }).then(r) } }
      return q
    },
    rpc: () => Promise.resolve(rpc),
  }
  return { db: client as unknown as SupabaseClient, calls }
}

describe('loadFqReader — 학습자 세션이 아니라 서버 전용 클라이언트로만 판정', () => {
  const learner = fake({ content_qualification: { data: [], error: null, count: 0 } }).db
  const ledger = { content_qualification: { data: [row()], error: null }, content_release_approval: { data: APPROVED, error: null }, content_release_revocation: { data: [], error: null }, supply_current_annotation: { data: [{ artifact_ref: '2020#24', task_id: T, artifact_revision: REV, annotation_ref: 'claim-support-2020-24.v1', annotation_hash: ANN }], error: null } }
  const opts = { refs: ['2020#24'], tasks: [T], currentAnnotation: async () => ({ ref: 'claim-support-2020-24.v1', hash: ANN }) }

  it('표가 없으면 not_installed', async () => {
    expect(await loadFqReader(fake({ content_qualification: { data: null, error: { code: '42P01' } } }).db, opts)).toEqual({ status: 'not_installed' })
  })
  it('후보가 있는데 서버 클라이언트가 없으면 error(정상 0건 · RLS 0행과 구별)', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: null })).toEqual({ status: 'error' })
    expect(await loadFqReader(learner, { ...opts, refs: [], admin: null })).toEqual({ status: 'installed', eligible: [] })
  })
  it('철회 조회가 반환 상한에 잘리면(exact count ≠ 반환량) error', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: fake({ ...ledger, content_release_revocation: { data: [], error: null, count: 3 } }).db })).toEqual({ status: 'error' })
  })
  it('결속이 모두 맞으면 역할 · TASK 와 함께 적격', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: fake(ledger).db })).toEqual({ status: 'installed', eligible: [{ ref: '2020#24', task: T, role: 'transfer', qualificationId: 'q1' }] })
  })
  it('승인 철회 기록을 못 읽으면 error — 적격으로 올리지 않는다', async () => {
    const r = await loadFqReader(learner, { ...opts, admin: fake({ ...ledger, content_release_revocation: { data: null, error: { code: 'XX' } } }).db })
    expect(r).toEqual({ status: 'error' })
  })
  it('I2 주석 칸이 없으면 적격 0건(오류와 구별)', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: fake({ ...ledger, content_qualification: { data: null, error: { code: '42703' } } }).db })).toEqual({ status: 'installed', eligible: [] })
  })
  it('창을 가득 채운 응답은 부분 원장이라 error', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: fake({ ...ledger, content_qualification: { data: Array.from({ length: 2000 }, () => row()), error: null } }).db })).toEqual({ status: 'error' })
  })
  it('I2 등록부가 없으면 적격 0건 · 등록이 다르면 거절(납품 SQL 과 같은 기준)', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: fake({ ...ledger, supply_current_annotation: { data: null, error: { code: '42P01' } } }).db })).toEqual({ status: 'installed', eligible: [] })
    expect(await loadFqReader(learner, { ...opts, admin: fake({ ...ledger, supply_current_annotation: { data: [], error: null } }).db })).toEqual({ status: 'installed', eligible: [] })
  })
  it('현재 revision 조회 실패는 error', async () => {
    expect(await loadFqReader(learner, { ...opts, admin: fake(ledger, { data: null, error: { code: 'XX' } }).db })).toEqual({ status: 'error' })
  })
})

describe('공급 — 적격은 역할 · TASK 에 묶인다', () => {
  it('다른 TASK 의 전이 자격은 R5 전이 줄을 채우지 않는다', () => {
    const demand = { key: 'd', task: T, lines: [{ role: 'transfer', task: T, quantity: { n: 1 }, taskKeys: ['claim-support'], csatTypes: [] }] }
    const input = { unseenCheckItems: [], transferItems: ['2020#24'], transferDrafts: 0, study: { items: [], withheld: 0 }, factoryStock: null, exposure: { status: 'ok', events: [], passageKeys: { '2020#24': 'p' } }, fq: { status: 'installed', eligible: [{ ref: '2020#24', task: 'r.flow_order', role: 'transfer', qualificationId: 'q1' }] } }
    expect(supplyFor(demand as never, input as never).lines[0].state).toBe('open_unqualified')
    const ok = { ...input, fq: { status: 'installed', eligible: [{ ref: '2020#24', task: T, role: 'transfer', qualificationId: 'q1' }] } }
    expect(supplyFor(demand as never, ok as never).lines[0].state).toBe('available')
  })
  it('독립 확인 역할의 적격은 전이 줄을 채우지 않는다', () => {
    const demand = { key: 'd', task: T, lines: [{ role: 'transfer', task: T, quantity: { n: 1 }, taskKeys: ['claim-support'], csatTypes: [] }] }
    const input = { unseenCheckItems: [], transferItems: ['2020#24'], transferDrafts: 0, study: { items: [], withheld: 0 }, factoryStock: null, exposure: { status: 'ok', events: [], passageKeys: { '2020#24': 'p' } }, fq: { status: 'installed', eligible: [{ ref: '2020#24', task: T, role: 'independent_check', qualificationId: 'q1' }] } }
    const s = supplyFor(demand as never, input as never)
    expect(s.lines[0].state).toBe('open_unqualified')
  })
})
