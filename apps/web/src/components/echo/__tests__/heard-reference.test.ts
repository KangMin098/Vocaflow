// apps/web/src/components/echo/__tests__/heard-reference.test.ts
// T-0227 — 「기기가 인식한 참고문장」 스냅숏 · 보임 판정(순수). 실제 Player 왕복은 PC 하네스(pa-t227)가 덮는다.
import { describe, expect, it } from 'vitest'

import { HEARD_REASON_TEXT, snapshotHeard, visibleHeard } from '../heard-reference'

const bind = { gen: 3, materialKey: 's1|abc', authToken: 7 }
const now = (over: Partial<{ scored: boolean; gen: number; materialKey: string | null; ok: boolean }> = {}) => ({
  scored: over.scored ?? true,
  gen: over.gen ?? 3,
  materialKey: over.materialKey === undefined ? 's1|abc' : over.materialKey,
  authCurrent: (t: number) => (over.ok ?? true) && t === 7,
})

describe('snapshotHeard — 비율 계산에 쓴 문자열 그대로', () => {
  it('문자열이 있으면 그 문자열(0점이어도) · 결속 그대로', () => {
    expect(snapshotHeard({ supported: true, failed: false, usedTranscript: 'the gull did not move' }, bind)).toEqual({ kind: 'text', text: 'the gull did not move', ...bind })
  })
  it('미지원 · 실패 · 빈 값은 서로 다른 사유(확인 못 함) — 침묵 · 발음 실패로 말하지 않는다', () => {
    expect(snapshotHeard({ supported: false, failed: false, usedTranscript: null }, bind)).toMatchObject({ kind: 'unconfirmed', reason: 'unsupported' })
    expect(snapshotHeard({ supported: true, failed: true, usedTranscript: null }, bind)).toMatchObject({ kind: 'unconfirmed', reason: 'failed' })
    expect(snapshotHeard({ supported: true, failed: false, usedTranscript: null }, bind)).toMatchObject({ kind: 'unconfirmed', reason: 'empty' })
    for (const t of Object.values(HEARD_REASON_TEXT)) {
      expect(t).toContain('확인하지 못했어요')
      expect(t).not.toMatch(/발음|틀렸|못 말|침묵/)
    }
  })
})

describe('visibleHeard — 렌더 때도 시도 · 자료 · 계정이 같을 때만', () => {
  const snap = snapshotHeard({ supported: true, failed: false, usedTranscript: 'hello there' }, bind)
  it('결과 화면 · 같은 결속이면 보인다', () => {
    expect(visibleHeard(snap, now())).toEqual(snap)
  })
  it('결과 화면이 아니거나 · 다른 시도(재시도 · 이동) · 다른 문장 자료(같은 id 본문 변경) · 계정 경계 불일치면 없음', () => {
    expect(visibleHeard(snap, now({ scored: false }))).toBeNull()
    expect(visibleHeard(snap, now({ gen: 4 }))).toBeNull()
    expect(visibleHeard(snap, now({ materialKey: 's1|changed' }))).toBeNull()
    expect(visibleHeard(snap, now({ materialKey: null }))).toBeNull()
    expect(visibleHeard(snap, now({ ok: false }))).toBeNull()
    expect(visibleHeard(null, now())).toBeNull()
  })
})
