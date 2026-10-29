// apps/web/src/components/csat/judgment/__tests__/IrrelevantTool.compare.test.tsx
// @vitest-environment node
// U02-COMPARE-01 — 해설 요청 순간 스냅샷 규칙과 같은 선지 · 이음매 비교 행. 화면 흐름(실패 뒤 재시도 · 늦은 응답 · 호출 수)은 PC 하네스가 잰다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { initialState, setVerdict, toggleCue, toggleSuspect, toggleTopic } from '@/lib/csat/judgment/r-irrelevant'
import { IrrelevantTool, compareRows, snapshotOnRequest } from '../IrrelevantTool'

const s0 = initialState()
const s1 = toggleSuspect(setVerdict(s0, 3, 'back', 'breaks'), 3)

describe('snapshotOnRequest', () => {
  it('hidden · error 에서 누르면 지금 표시를 잡는다(재시도는 새 스냅샷)', () => {
    expect(snapshotOnRequest(null, s1, 'hidden')).toBe(s1)
    expect(snapshotOnRequest(s0, s1, 'error')).toBe(s1)
  })
  it('loading 중 중복 누름 · shown 뒤에는 이전 스냅샷을 지킨다', () => {
    expect(snapshotOnRequest(s0, s1, 'loading')).toBe(s0)
    expect(snapshotOnRequest(s0, s1, 'shown')).toBe(s0)
    expect(snapshotOnRequest(null, s1, 'loading')).toBeNull()
  })
})

describe('compareRows', () => {
  const slot = { n: 3, nextId: 'u5' }
  it('변경 없음은 바뀌었다고 하지 않는다 · 표시 없음은 그대로 말한다', () => {
    const rows = compareRows(s1, s1, slot)
    expect(rows.map((r) => r.key)).toEqual(['topic', 'suspect', 'back', 'forward', 'bridge'])
    expect(rows.every((r) => !r.changed)).toBe(true)
    expect(rows.find((r) => r.key === 'forward')).toMatchObject({ asked: '표시 없음', now: '표시 없음' })
    expect(rows.find((r) => r.key === 'suspect')).toMatchObject({ asked: '③', now: '③' })
  })
  it('해설 뒤 고친 판단 · 근거 · 후보만 바뀜', () => {
    const now = toggleSuspect(toggleCue(setVerdict(s1, 3, 'back', 'holds'), 3, 'back', 'connective'), 4)
    const rows = compareRows(s1, now, slot)
    expect(rows.find((r) => r.key === 'back')).toMatchObject({ asked: '✕ 끊김', now: '○ 이어짐 · 연결사', changed: true })
    expect(rows.find((r) => r.key === 'suspect')).toMatchObject({ asked: '③', now: '④', changed: true })
    expect(rows.find((r) => r.key === 'bridge')!.changed).toBe(false)
  })
  it('다른 선지 표시는 이 선지 비교에 섞이지 않는다 · 마지막 문장은 앞 이음매만', () => {
    const other = setVerdict(s1, 2, 'back', 'holds')
    expect(compareRows(s1, other, slot).filter((r) => r.changed)).toEqual([])
    expect(compareRows(s1, s1, { n: 5, nextId: null }).map((r) => r.key)).toEqual(['topic', 'suspect', 'back'])
  })
})

describe('compareRows — 중심 화제', () => {
  const units = [{ id: 'u1', n: 1 }, { id: 'u2', n: 2 }]
  const slot = { n: 3, nextId: 'u5' }
  it('해설 뒤 화제만 바꾸면 그 한 행만 바뀜', () => {
    const asked = toggleTopic(s1, 'u1')
    const rows = compareRows(asked, toggleTopic(asked, 'u2'), slot, units)
    expect(rows.filter((r) => r.changed).map((r) => r.key)).toEqual(['topic'])
    expect(rows[0]).toMatchObject({ asked: '1번', now: '1번·2번' })
  })
  it('고정 순서만 다르면 바뀌지 않음 · 없으면 고정 없음', () => {
    const a = toggleTopic(toggleTopic(s1, 'u2'), 'u1'), b = toggleTopic(toggleTopic(s1, 'u1'), 'u2')
    expect(compareRows(a, b, slot, units)[0].changed).toBe(false)
    expect(compareRows(s1, s1, slot, units)[0]).toMatchObject({ asked: '고정 없음', now: '고정 없음' })
  })
})

describe('공개 전 마크업', () => {
  for (const item of itemsOf('R-IRRELEVANT')) {
    it(`${item.id}: 비교 표 없음 · 공개 호출 없음 · 금지 문구 없음`, () => {
      const reveal = vi.fn()
      const html = renderToString(<IrrelevantTool item={item} reveal={reveal} />)
      expect(reveal).not.toHaveBeenCalled()
      expect(html).not.toContain('data-irr-compare')
      for (const w of ['정답 보기 전', '독립 수행']) expect(html).not.toContain(w)
    })
  }
})
