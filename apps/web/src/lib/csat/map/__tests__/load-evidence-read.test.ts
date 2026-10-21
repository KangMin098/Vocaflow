// apps/web/src/lib/csat/map/__tests__/load-evidence-read.test.ts
// T-0078 — 이미 조회하던 근거 의존성의 오류를 [] · 결속 없음으로 삼키지 않는다(던져서 loadMapPage 가 원장 미확인 = undefined 로 모은다).
//   정상 0행 · 명시적 비유효(철회) · 미설치 표는 기존 의미 그대로
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import { gateAuthoredFirsts, loadAuthoredDeliveries, markGuidedRepairs } from '../load'
import type { ActivityRow } from '../lifecycle-evidence'

type Res = { data: unknown; error: { code?: string; message: string } | null }
/** 최소 PostgREST 모의 — from(t).select().eq().in() 끝에서 표별 응답 · rpc 응답 */
function db(tables: Record<string, Res>, rpc: Record<string, Res> = {}) {
  const chain = (r: Res) => { const c: Record<string, unknown> = {}; for (const k of ['select', 'eq', 'in', 'limit', 'order']) c[k] = () => c; c.then = (f: (x: Res) => unknown) => Promise.resolve(r).then(f); return c }
  return { from: (t: string) => chain(tables[t] ?? { data: [], error: null }), rpc: async (n: string) => rpc[n] ?? { data: null, error: { message: 'no rpc' } } } as never
}
const first = (id: string) => ({ attemptId: id, itemRef: 'authored:x-' + id, taskKey: 'authored-central-meaning', phase: 'practice', isCorrect: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, answeredAt: '2026-10-01T00:00:00Z' }) as unknown as FindAttemptRow

describe('창작 첫 시도 결속(gateAuthoredFirsts)', () => {
  it('결속 조회 오류 = 던짐(원장 미확인) — 「결속 없음」으로 바꾸지 않는다', async () => {
    await expect(gateAuthoredFirsts(db({ workspace_delivery_attempt: { data: null, error: { message: 'boom' } } }), 'u', [first('1')])).rejects.toThrow('창작 결속 조회 실패')
  })
  it('정상 0행 = 결속 없음(fail-closed 비근거) 그대로', async () => {
    const rows = await gateAuthoredFirsts(db({ workspace_delivery_attempt: { data: [], error: null } }), 'u', [first('1')])
    expect((rows[0] as FindAttemptRow & { authoredBinding?: string }).authoredBinding).toBe('missing')
  })
})

describe('안내 연습 결속(markGuidedRepairs)', () => {
  const act = () => [{ attemptId: '3', itemRef: 'authored:g', taskKey: 'authored-central-meaning', phase: 'practice' }] as unknown as ActivityRow[]
  const repair = [{ id: 'd1', artifact_ref: 'authored:g', role: 'guided_practice' }]
  it('조회 오류 = 던짐(호출부가 수행 기록을 미확인으로)', async () => {
    await expect(markGuidedRepairs(db({ workspace_delivery_attempt: { data: null, error: { message: 'boom' } } }), 'u', act(), repair)).rejects.toThrow('안내 연습 결속 조회 실패')
  })
  it('정상 0행 = 표지 없음 · 정상 결속 = guided_practice', async () => {
    const a = act(); await markGuidedRepairs(db({ workspace_delivery_attempt: { data: [], error: null } }), 'u', a, repair); expect(a[0]!.repairRole).toBeUndefined()
    const b = act(); await markGuidedRepairs(db({ workspace_delivery_attempt: { data: [{ attempt_id: 3, delivery_id: 'd1' }], error: null } }), 'u', b, repair); expect(b[0]!.repairRole).toBe('guided_practice')
  })
})

describe('창작 납품(loadAuthoredDeliveries)', () => {
  it('조회 오류 = 던짐 · 미설치 표 = 정상 [] · 명시 비유효(철회) = 빠짐', async () => {
    await expect(loadAuthoredDeliveries(db({ workspace_content_delivery: { data: null, error: { message: 'boom' } } }), 'u')).rejects.toThrow('창작 납품 조회 실패')
    expect(await loadAuthoredDeliveries(db({ workspace_content_delivery: { data: null, error: { code: '42P01', message: 'missing' } } }), 'u')).toEqual([])
    const row = { id: 'd1', artifact_ref: 'authored:a', task_id: 'r.central_meaning', role: 'independent_check' }
    expect(await loadAuthoredDeliveries(db({ workspace_content_delivery: { data: [row], error: null } }, { workspace_delivery_current: { data: false, error: null } }), 'u')).toEqual([])
    expect(await loadAuthoredDeliveries(db({ workspace_content_delivery: { data: [row], error: null } }, { workspace_delivery_current: { data: true, error: null } }), 'u')).toEqual([row])
  })
})
