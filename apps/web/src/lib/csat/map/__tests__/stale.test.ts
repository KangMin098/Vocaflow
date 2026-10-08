// apps/web/src/lib/csat/map/__tests__/stale.test.ts
import { describe, expect, it } from 'vitest'

import { ENGINE_VERSION } from '../../diagnosis/engine/rule-v1'
import { staleMapEvidence } from '../stale'

const ok = { status: 'ok', den: 12 }
describe('staleMapEvidence — 저장된 지도 지표를 다시 계산할 조건', () => {
  it('같은 버전 · ok · den 있음 → 그대로 쓴다', () => {
    expect(staleMapEvidence({ engineVersion: ENGINE_VERSION, evidence: { mapStatus: 'ok', lineAccuracy: { R1: ok }, attributePoints: { A1: ok } } })).toBe(false)
  })
  it('옛 엔진 버전 → 다시 계산', () => {
    expect(staleMapEvidence({ engineVersion: 'rule-v0', evidence: { mapStatus: 'ok', lineAccuracy: { R1: ok } } })).toBe(true)
  })
  it('같은 버전이어도 지도 계산이 꺼졌거나 실패한 채 저장 → 다시 계산(시드 전 기록이 「분석 준비 중」에 갇히지 않게)', () => {
    expect(staleMapEvidence({ engineVersion: ENGINE_VERSION, evidence: { mapStatus: 'off' } })).toBe(true)
    expect(staleMapEvidence({ engineVersion: ENGINE_VERSION, evidence: { mapStatus: 'failed' } })).toBe(true)
    expect(staleMapEvidence({ engineVersion: ENGINE_VERSION, evidence: null })).toBe(true)
  })
  it('같은 버전이어도 판정된 지표에 den 이 없으면 → 다시 계산(k=8 축소 추정이 빠지지 않게)', () => {
    expect(staleMapEvidence({ engineVersion: ENGINE_VERSION, evidence: { mapStatus: 'ok', attributePoints: { A1: { status: 'ok' } } } })).toBe(true)
  })
  it('근거 부족 지표는 den 이 없어도 괜찮다', () => {
    expect(staleMapEvidence({ engineVersion: ENGINE_VERSION, evidence: { mapStatus: 'ok', attributePoints: { A1: ok, A2: { status: 'insufficient' } } } })).toBe(false)
  })
})
