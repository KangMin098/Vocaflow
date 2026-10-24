// apps/web/src/lib/csat/map/__tests__/source-repair-receipt.test.ts
// 2D — 원문 안내 연습 영수증 → 바로잡기 수행 투영. 고정 시각만 쓴다(Date.now 없음).
import { describe, expect, it } from 'vitest'
import { SOURCE_LESSON_STEPS, loadSourceRepairReceipts, parseRepairReceipts, receiptActivity, receiptTargets } from '../source-repair-receipt'
import { lifecycleEvidence, nextLifecycleAction, repairSuccess } from '../lifecycle-evidence'
import { authoredKeysOf } from '@/lib/knowledge/authored/tasks'
import { LESSON_STEPS } from '../v62/factory-bridge/source-lesson'
import { GUIDED_LESSON_ITEMS } from '../v62/demand'

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const T = (m: number) => new Date(Date.UTC(2026, 9, 21, 9, m)).toISOString()
const step = (s: string, n: number, correct: boolean, m: number) => ({ step: s, delivery_id: U(10 + n), dcp_item_id: U(20 + n), attempt_id: U(30 + n), is_correct: correct, attempt_received_at: T(m), reflected_at: T(m + 1) })
const raw = (over: Record<string, unknown> = {}, steps = [step('main_point', 1, true, 10), step('title', 2, false, 12), step('topic', 3, true, 14)]) => ([{
  workspace_id: U(1), order_id: U(2), task_id: 'r.central_meaning', current: true, complete: steps.length === 3, completed_at: steps.length === 3 ? T(15) : null, steps, ...over,
}])
const KEY = authoredKeysOf('r.central_meaning')[0]
const skill = { status: 'verified', verifiedAt: T(5), verifiedItems: ['2025-11#22', '2025-11#23'], check: { wrongItems: ['2025-11#22', '2025-11#23'], lastWrongAt: T(5) } }
const keys = new Set([KEY])
const NOW = new Date(T(30))

describe('2D source lesson repair receipt', () => {
  it('blueprint: completion requires every lesson activity (projection steps = LESSON_STEPS of one passage)', () => {
    expect(KEY).toBeTruthy()
    expect([...SOURCE_LESSON_STEPS]).toEqual([...LESSON_STEPS])
  })

  it('complete lesson with a real correct step = repair success at its reflection receipt; not transfer', () => {
    const rows = receiptActivity(parseRepairReceipts(raw())!, authoredKeysOf, NOW)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.repairRole === 'guided_practice' && r.itemRef!.startsWith('dcp:') && r.answeredAt === r.receivedAt)).toBe(true)
    const r = repairSuccess(skill, keys, rows)
    expect(r.at, '2E 성공 = 세 단계 완료 시각(마지막 설명 수신)').toBe(T(15))
    // 원장 시각은 그대로 — 행마다 자기 설명 수신 시각 · 시작 = 첫 시도 수신
    expect(rows.map((x) => x.answeredAt)).toEqual([T(11), T(13), T(15)])
    expect(rows.every((x) => x.lessonStartedAt === T(10))).toBe(true)
    const ev = lifecycleEvidence(skill, [{ itemRef: '2025-11#22', taskKey: KEY }], rows)
    expect(ev.transferAt).toBeNull()
    expect(nextLifecycleAction('verified', ev)).toBe('transfer')
  })

  it('incomplete (no saved explanation for one step) or all-wrong = not complete', () => {
    const part = receiptActivity(parseRepairReceipts(raw({}, [step('main_point', 1, true, 10), step('title', 2, true, 12)]))!, authoredKeysOf, NOW)
    expect(part.every((r) => r.isCorrect === null)).toBe(true)
    expect(repairSuccess(skill, keys, part)).toMatchObject({ at: null, tried: true })
    const wrong = receiptActivity(parseRepairReceipts(raw({}, [step('main_point', 1, false, 10), step('title', 2, false, 12), step('topic', 3, false, 14)]))!, authoredKeysOf, NOW)
    expect(repairSuccess(skill, keys, wrong).at).toBeNull()
  })

  it('asOf before completion: future reflections do not leak into a past window', () => {
    const rows = receiptActivity(parseRepairReceipts(raw())!, authoredKeysOf, new Date(T(13)))
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.isCorrect === null)).toBe(true)
  })

  it('completed before this cycle (verifiedAt after) does not carry over', () => {
    const rows = receiptActivity(parseRepairReceipts(raw())!, authoredKeysOf, NOW)
    expect(repairSuccess({ ...skill, verifiedAt: T(20), check: { ...skill.check, lastWrongAt: T(20) } }, keys, rows).at).toBeNull()
  })

  it('stale plan (current=false): fact survives, no new-learning link', () => {
    const rec = parseRepairReceipts(raw({ current: false }))!
    expect(repairSuccess(skill, keys, receiptActivity(rec, authoredKeysOf, NOW)).at).toBe(T(15))
    expect(receiptTargets(rec, authoredKeysOf)).toEqual({})
    expect(receiptTargets(parseRepairReceipts(raw())!, authoredKeysOf)[KEY][0]).toMatchObject({ href: `/csat/factory/${U(11)}`, role: 'guided_practice' })
  })

  it('2E counterexample: projected at now(12:10) then replayed at an older asOf(12:03) before completion(12:05) = no success', () => {
    // runtime/source-history-counterexample-before.json — 수정 전에는 앞 단계 정오가 이미 true 라 12:01 성공이 나왔다
    const H = (m: number) => new Date(Date.UTC(2026, 9, 21, 12, m)).toISOString()
    const st = (s: string, n: number, m: number) => ({ ...step(s, n, true, 0), attempt_received_at: H(m), reflected_at: H(m) })
    const rec = parseRepairReceipts([{ workspace_id: U(1), order_id: U(2), task_id: 'r.central_meaning', current: true, complete: true, completed_at: H(5),
      steps: [st('main_point', 1, 1), st('title', 2, 2), st('topic', 3, 5)] }])!
    const cycle = { ...skill, verifiedAt: H(0), check: { ...skill.check, lastWrongAt: H(0) } }
    const projected = receiptActivity(rec, authoredKeysOf, new Date(H(10)))
    // composeV4 의 과거 회차 재생 = 그 asOf 까지의 행만 본다
    const replay = projected.filter((a) => Date.parse(a.answeredAt!) <= Date.parse(H(3)))
    expect(replay).toHaveLength(2)
    expect(repairSuccess(cycle, keys, replay).at).toBeNull()
    expect(repairSuccess(cycle, keys, projected).at).toBe(H(5))
  })

  it('2E lesson started before this cycle and finished inside it = not a new-cycle completion', () => {
    const rows = receiptActivity(parseRepairReceipts(raw())!, authoredKeysOf, NOW)
    // 회차 시작 T(12): 마지막 단계(T(15))는 회차 안이지만 첫 단계 시작(T(10))은 회차 앞
    expect(repairSuccess({ ...skill, verifiedAt: T(12), check: { ...skill.check, lastWrongAt: T(12) } }, keys, rows).at).toBeNull()
  })

  it('2E loader: user-scoped args · not-installed = [] · permission / DB error / bad shape = throw', async () => {
    const db = (r: { data: unknown; error: { message: string; code?: string } | null }) => {
      const calls: unknown[] = []
      return { calls, rpc: async (fn: string, args: Record<string, unknown>) => { calls.push([fn, args]); return r } }
    }
    const ok = db({ data: raw(), error: null })
    expect(await loadSourceRepairReceipts(ok, U(9), NOW)).toHaveLength(1)
    expect(ok.calls).toEqual([['source_lesson_repair_receipts', { p_user: U(9), p_as_of: NOW.toISOString() }]])
    expect(await loadSourceRepairReceipts(db({ data: null, error: { message: 'x', code: '42883' } }), U(9), NOW)).toEqual([])
    expect(await loadSourceRepairReceipts(db({ data: null, error: { message: 'x', code: 'PGRST202' } }), U(9), NOW)).toEqual([])
    await expect(loadSourceRepairReceipts(db({ data: null, error: { message: 'Forbidden', code: '42501' } }), U(9), NOW)).rejects.toThrow(/42501/)
    await expect(loadSourceRepairReceipts(db({ data: null, error: { message: 'timeout', code: '57014' } }), U(9), NOW)).rejects.toThrow(/57014/)
    await expect(loadSourceRepairReceipts(db({ data: {}, error: null }), U(9), NOW)).rejects.toThrow(/bad_shape/)
    await expect(loadSourceRepairReceipts(ok, 'not-a-user', NOW)).rejects.toThrow(/bad_user/)
  })

  it('2E guided quantity = public blueprint step count (no literal)', () => {
    expect(GUIDED_LESSON_ITEMS['r.central_meaning']).toBe(LESSON_STEPS.length)
  })

  it('closed shape: tampered complete / completed_at / duplicate step / attempt after reflection = null', () => {
    expect(parseRepairReceipts(raw({ complete: false }))).toBeNull()
    expect(parseRepairReceipts(raw({ completed_at: T(29) }))).toBeNull()
    expect(parseRepairReceipts(raw({}, [step('title', 1, true, 10), step('title', 2, true, 12)]))).toBeNull()
    expect(parseRepairReceipts(raw({}, [{ ...step('main_point', 1, true, 10), attempt_received_at: T(40) }]))).toBeNull()
    expect(parseRepairReceipts(raw({ task_id: 'e.evidence_location' }))).toBeNull()
    expect(parseRepairReceipts({})).toBeNull()
  })
})
