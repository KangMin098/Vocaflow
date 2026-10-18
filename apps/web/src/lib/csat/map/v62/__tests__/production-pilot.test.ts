// apps/web/src/lib/csat/map/v62/__tests__/production-pilot.test.ts
// v6.2 P-F5a · P-F5b — 단위 생산 dry-run: 지도 연습만 · 미지원 원천 제외 · 연구 자격 승격 금지 · 원문/Gold 미반입
import { describe, expect, it } from 'vitest'

import V15 from '../research-v15.data.json'
import { UNSUPPORTED_EXAMS, examSourceUsable, productionPilotFor } from '../production-pilot'

describe('시험 원천 안전성', () => {
  it('연구 v1.5 미지원 시험(2014A · 2014B · M2009)은 생산 원천에서 제외', () => {
    expect([...UNSUPPORTED_EXAMS].sort()).toEqual(['2014A', '2014B', 'M2009'])
    expect(examSourceUsable('2014A#32')).toBe(false)
    expect(examSourceUsable('M2009#20')).toBe(false)
    expect(examSourceUsable('2024#28')).toBe(true)
  })
})

describe('V2 · S5 파일럿 명세', () => {
  it('V2(ws.vocab-context) — 공장 vocab_choice · 권 단위만 · 활동 단위 미지원 · 지도 연습만', () => {
    const p = productionPilotFor('v.contextual_sense')!
    expect(p.workspace).toBe('ws.vocab-context')
    expect(p.productionUnit).toMatchObject({ factoryTypes: ['vocab_choice'], unit: 'volume', activityUnitSupported: false })
    expect(p.deliveryPackage.allowedRole).toBe('guided_practice')
    expect(p.deliveryPackage.candidates.length).toBe(4)
    expect(p.qualification).toEqual({ publicQualified: 0, assessmentQualified: 0, students: 0, release: 'hold' })
  })
  it('S5 후보 중 2014A 원천은 막힌다', () => {
    const p = productionPilotFor('s.form_scope')!
    const blocked = p.deliveryPackage.candidates.filter((c) => !c.usable)
    expect(blocked.map((c) => c.item)).toEqual(['2014A#32'])
    expect(blocked[0].blocked).toBe('unsupported_exam_source')
  })
  it('연구 패킷이 없는 TASK 는 파일럿 없음', () => {
    expect(productionPilotFor('r.central_meaning')).toBeNull()
  })
  it('스냅샷에 원문 · 정답 · Gold · 로컬 경로가 없다', () => {
    expect(JSON.stringify(V15)).not.toMatch(/"(passage|options|answer|gold|path|response)"\s*:/i)
    expect(JSON.stringify(V15)).not.toMatch(/scripts\/research\/csat-reading\/local/)
  })
})
