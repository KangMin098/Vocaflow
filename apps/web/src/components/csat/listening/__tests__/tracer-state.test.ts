// apps/web/src/components/csat/listening/__tests__/tracer-state.test.ts
import { describe, expect, it } from 'vitest'

import { TRACE_FIXTURES, traceFixtureByKey } from '@/lib/csat/listening/fixtures'

import {
  STORAGE_KEY,
  compareCandidate,
  initialItemState,
  judge,
  loadSnapshot,
  moveLevel,
  parseSnapshot,
  remainingCount,
  saveSnapshot,
  shownLevel,
  submit,
  submitBlock,
  unjudge,
  type ItemTraceState,
} from '../tracer-state'

const fx = traceFixtureByKey('2023-L07')!
const all = (s: ItemTraceState): ItemTraceState =>
  [
    ['work', 'eliminated', '2023-L07-u6'],
    ['exam', 'eliminated', '2023-L07-u8'],
    ['sister', 'remaining', '2023-L07-u10'],
    ['canada', 'eliminated', '2023-L07-u3'],
  ].reduce((acc, [id, v, u]) => judge(acc, id, { verdict: v as 'eliminated', utteranceId: u }), s)

describe('판단 · 제출', () => {
  it('모두 판단해야 제출, 모두 지우면 막힘, 제출 뒤 잠김', () => {
    let s = initialItemState()
    expect(submitBlock(fx, s)).toBe('unjudged')
    s = all(s)
    expect(remainingCount(fx, s)).toBe(1)
    expect(submitBlock(fx, judge(s, 'sister', { verdict: 'eliminated', utteranceId: '2023-L07-u10' }))).toBe('none-remaining')
    const done = submit(fx, s)
    expect(done.submitted).toBe(true)
    expect(judge(done, 'work', { verdict: 'remaining', utteranceId: '2023-L07-u1' })).toBe(done)
    expect(unjudge(done, 'work')).toBe(done)
    expect(unjudge(s, 'work').judgments.work).toBeUndefined()
  })

  it('비교: 일치 · 발화 다름 · 판정 다름 · 미판단', () => {
    const s = all(initialItemState())
    expect(compareCandidate(fx, s, 'work')).toBe('match')
    expect(compareCandidate(fx, s, 'canada')).toBe('utterance-differs')
    expect(compareCandidate(fx, judge(s, 'exam', { verdict: 'remaining', utteranceId: '2023-L07-u8' }), 'exam')).toBe('verdict-differs')
    expect(compareCandidate(fx, initialItemState(), 'work')).toBe('unjudged')
  })
})

describe('노출 단계(계약 canTransition 재사용)', () => {
  it('제출 전엔 L3 이 끝, 보류(embargo)면 제출해도 L3, open + 제출이면 L4 → L5', () => {
    let s: ItemTraceState = { ...initialItemState(), level: 'L3' }
    expect(moveLevel(s, 'L4', { submitted: false, reveal: 'open' }).level).toBe('L3')
    s = submit(fx, all(s))
    expect(moveLevel(s, 'L4', { submitted: true, reveal: 'embargo' }).level).toBe('L3')
    expect(moveLevel(s, 'L4', { submitted: true, reveal: 'failure' }).level).toBe('L3')
    expect(moveLevel(s, 'L5', { submitted: true, reveal: 'open' }).level).toBe('L3') // 건너뛰기 금지
    const l4 = moveLevel(s, 'L4', { submitted: true, reveal: 'open' })
    expect(l4.level).toBe('L4')
    const l5 = moveLevel(l4, 'L5', { submitted: true, reveal: 'open' })
    expect(shownLevel(l5, { submitted: true, reveal: 'embargo' })).toBe('L3') // 보류가 시작되면 깎인다
  })
})

describe('복원', () => {
  it('깨진 값 · 낯선 id · 거짓 제출 표지는 버린다', () => {
    expect(parseSnapshot('{oops', TRACE_FIXTURES, '2023-L10')).toEqual({ selectedKey: '2023-L10', byItem: {} })
    const raw = JSON.stringify({
      selectedKey: '2023-L07',
      byItem: {
        '2023-L07': { level: 'L9', submitted: true, captions: false, judgments: { work: { verdict: 'eliminated', utteranceId: '2023-L07-u6' }, ghost: { verdict: 'eliminated', utteranceId: 'x' }, exam: { verdict: 'maybe', utteranceId: '2023-L07-u8' } } },
        unknown: {},
      },
    })
    const s = parseSnapshot(raw, TRACE_FIXTURES, '2023-L10')
    expect(s.selectedKey).toBe('2023-L07')
    expect(Object.keys(s.byItem)).toEqual(['2023-L07'])
    expect(s.byItem['2023-L07']).toEqual({ level: 'L1', submitted: false, captions: false, judgments: { work: { verdict: 'eliminated', utteranceId: '2023-L07-u6' } } })
  })

  it('저장소가 던져도 화면 상태는 기본값으로', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadSnapshot(TRACE_FIXTURES, '2023-L10', bad)).toEqual({ selectedKey: '2023-L10', byItem: {} })
    expect(() => saveSnapshot({ selectedKey: '2023-L10', byItem: {} }, bad)).not.toThrow()
  })

  it('왕복: 저장한 판단 · 단계 · 제출이 그대로 돌아온다', () => {
    const mem = new Map<string, string>()
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const st = { ...submit(fx, all(initialItemState())), level: 'L3' as const }
    saveSnapshot({ selectedKey: '2023-L07', byItem: { '2023-L07': st } }, store)
    expect(mem.has(STORAGE_KEY)).toBe(true)
    expect(loadSnapshot(TRACE_FIXTURES, '2023-L10', store).byItem['2023-L07']).toEqual(st)
  })
})
