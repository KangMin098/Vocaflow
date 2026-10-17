// apps/web/src/lib/csat/map/v62/__tests__/r5-2020-24-ch-isolated.test.ts
// R5 첫 후보 2020#24(전이) — C/H 격리 실행 증거(VERIFIED_ISOLATED). DB 쓰기 0: 가짜 DB 클라이언트 + 메모리 기록기.
// 실제 주석 · 실제 구운 골격 · 실제 레지스트리(item-tasks) · 실제 recordItemTaskAttempt 를 그대로 탄다.
// 이 시험이 통과해도 원장의 C/H PASS 가 아니다 — 원장 기록은 노출 원장에서 분리된 검수 계정 실행이 따로 필요하다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AttemptWrite, AttemptWriter } from '@/lib/knowledge/practice-writer'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { annotationFor, annotationHash, gradeClaimSupport, parseResponse } from '@/lib/knowledge/claim-support'
import { currentItemTask } from '@/lib/knowledge/item-tasks'
import { recordItemTaskAttempt } from '@/lib/knowledge/product-server'

const ITEM = '2020#24'
const HASH = '72c534f8543a48f0212a842c4943589a3662d4f5449e0bee92eb51112ac02441'
const SIG = '6b2493db6e785ee2995570d57a1da0b162f5210ee48021e1b223dd82fb1b4983'
const now = Date.parse('2026-10-18T00:00:00Z')

function database(audience: Record<string, unknown> = { item: ITEM, role: 'transfer', type: 'R-TITLE', exam: 'suneung' }) {
  return { from(table: string) {
    const values: Record<string, unknown> = {
      knowledge_applications: [{ id: 'app-2020-24', item_id: 'p', surface: 'csat_item_task', surface_ref: 'claim-support:2020-24', status: 'active', version: 1, audience }],
      knowledge_items: ['practice', 'method', 'principle'].map((layer, i) => ({ id: ['p', 'm', 'r'][i], slug: layer, title: layer, layer, kind: null, status: 'adopted', version: 1, efficacy: 'unknown' })),
      knowledge_links: [{ from_id: 'p', to_id: 'm', kind: 'implements' }, { from_id: 'm', to_id: 'r', kind: 'implements' }],
    }
    const q = { select() { return q }, eq() { return q }, order() { return q }, limit() { return q },
      maybeSingle() { return Promise.resolve({ data: null, error: null }) },
      then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: values[table] ?? [], count: 1, error: null }).then(resolve) } }
    return q
  } } as unknown as SupabaseClient
}
const body = (response: unknown, n = 1) => ({ response, sec: 90, helpLevel: 'independent', answeredAt: new Date(now).toISOString(),
  clientMutationId: `00000000-0000-4000-8000-00000000000${n}`, clientSessionId: '00000000-0000-4000-8000-0000000000aa' })
function memWriter() {
  const rows: AttemptWrite[] = []
  const writer: AttemptWriter = { kind: 'g2', reveal: async () => 'session', record: async (w) => { rows.push(w); return 'inserted' }, noteExplanationView: async () => true }
  return { rows, writer }
}
const ann = () => annotationFor(ITEM)!

beforeEach(() => { state.db = database() })

describe('2020#24 결속 사실(현재 저장소)', () => {
  it('주석 ref · hash · 골격 서명이 패킷 값과 같고 지금 골격에서 살아 있다', () => {
    const live = currentItemTask(ITEM)
    expect(live?.def.key).toBe('claim-support')
    expect(live?.ann.version).toBe('claim-support-2020-24.v1')
    expect(live?.ann.skeletonSig).toBe(SIG)
    expect(live?.ann.sentenceCount).toBe(6)
    expect(annotationHash(ann())).toBe(HASH)
    expect(live!.def.hash(live!.ann)).toBe(HASH)
  })
})

describe('채점기(순수) — 대표 답안', () => {
  const g = (r: unknown) => gradeClaimSupport(ann(), parseResponse(r, ann())!)
  it('정답: 주장 2 · 근거 3·4·5 · 관계 reason', () => {
    expect(g({ claim: 2, support: [3, 4, 5], relation: 'reason' })).toMatchObject({ claimOk: true, supportOk: true, relationOk: true, isCorrect: true })
  })
  it('쟁점 문장 0·1 을 더 골라도 감점하지 않는다(supportDisputed)', () => {
    expect(g({ claim: 2, support: [0, 1, 3, 4, 5], relation: 'reason' })).toMatchObject({ supportOk: true, supportExtra: [], isCorrect: true })
  })
  it('부분: 주장 맞음 · 근거 하나 빠짐 → 정오는 오답, 부분 정보는 남는다', () => {
    expect(g({ claim: 2, support: [3, 4], relation: 'reason' })).toMatchObject({ claimOk: true, supportOk: false, supportMissed: [5], relationOk: true, isCorrect: false })
  })
  it('부분: 주장 · 근거 맞음 · 관계 example → 오답', () => {
    expect(g({ claim: 2, support: [3, 4, 5], relation: 'example' })).toMatchObject({ claimOk: true, supportOk: true, relationOk: false, isCorrect: false })
  })
  it('오답: 배경 문장 0 을 주장으로 · 주장 문장 2 를 근거로', () => {
    expect(g({ claim: 0, support: [2, 3], relation: 'opposed' })).toMatchObject({ claimOk: false, claimRestated: false, supportExtra: [2], supportMissed: [4, 5], relationOk: false, isCorrect: false })
  })
  it('범위 밖 · 중복 · 빈 근거 · 모르는 관계는 입력 거절', () => {
    for (const r of [{ claim: 6, support: [3], relation: 'reason' }, { claim: 2, support: [3, 3], relation: 'reason' }, { claim: 2, support: [], relation: 'reason' }, { claim: 2, support: [3], relation: 'because' }]) expect(parseResponse(r, ann())).toBeNull()
  })
})

describe('기록 경로(recordItemTaskAttempt) — 메모리 기록기, DB 쓰기 0', () => {
  it('정답 제출: phase=transfer · activity=theater · content_hash=주석 hash · 정답 키는 응답에 없다', async () => {
    const { rows, writer } = memWriter()
    const r = await recordItemTaskAttempt(database(), { id: 'reviewer', email: null }, ITEM, body({ claim: 2, support: [5, 3, 4], relation: 'reason' }), now, writer)
    expect(r.outcome).toBe('inserted')
    expect(r.grade.isCorrect).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ taskKey: 'claim-support', applicationId: 'app-2020-24', itemRef: ITEM, contentHash: HASH, activity: 'theater', phase: 'transfer',
      helpLevel: 'independent', synthetic: false, isCorrect: true, sec: 90, answer: { claim: 2, support: [3, 4, 5], relation: 'reason' },
      extra: { annotation: 'claim-support-2020-24.v1', appVersion: 1, grade: { claim: true, support: true, relation: true } } })
  })
  it('부분 · 오답 제출도 같은 hash · phase 로 남고 요약이 축별로 갈린다', async () => {
    const { rows, writer } = memWriter()
    await recordItemTaskAttempt(database(), { id: 'reviewer', email: null }, ITEM, body({ claim: 2, support: [3, 4], relation: 'reason' }, 2), now, writer)
    await recordItemTaskAttempt(database(), { id: 'reviewer', email: null }, ITEM, body({ claim: 0, support: [2, 3], relation: 'opposed' }, 3), now, writer)
    expect(rows.map((w) => [w.phase, w.contentHash, w.isCorrect, w.extra])).toEqual([
      ['transfer', HASH, false, { annotation: 'claim-support-2020-24.v1', appVersion: 1, grade: { claim: true, support: false, relation: true } }],
      ['transfer', HASH, false, { annotation: 'claim-support-2020-24.v1', appVersion: 1, grade: { claim: false, support: false, relation: false } }],
    ])
  })
  it('전이 역할이 아닌 출시면 phase=practice — 역할이 phase 를 정한다', async () => {
    state.db = database({ item: ITEM })
    const { rows, writer } = memWriter()
    await recordItemTaskAttempt(database({ item: ITEM }), { id: 'reviewer', email: null }, ITEM, body({ claim: 2, support: [3, 4, 5], relation: 'reason' }), now, writer)
    expect(rows[0].phase).toBe('practice')
  })
  it('잘못된 입력은 기록 전에 거절된다', async () => {
    const { rows, writer } = memWriter()
    await expect(recordItemTaskAttempt(database(), { id: 'reviewer', email: null }, ITEM, body({ claim: 9, support: [3], relation: 'reason' }), now, writer)).rejects.toMatchObject({ code: 'invalid_input' })
    expect(rows).toHaveLength(0)
  })
})
