// apps/web/src/lib/csat/__tests__/map-return.test.ts
//
// 지도 활동 복귀 문맥 — 형식 검증 · 문항 링크에만 싣기 · 해시 유지 · 임의 문자열 거부
import { describe, expect, it } from 'vitest'

import { mapReturnQuery, parseMapReturn, parseMapStep, parseMapWs, withMapReturn } from '../map-return'

describe('parseMapWs · parseMapStep', () => {
  it('학습 묶음 id 는 ws.<소문자 · 하이픈> 만', () => {
    expect(parseMapWs('ws.central-meaning')).toBe('ws.central-meaning')
    expect(parseMapWs('central-meaning')).toBeNull()
    expect(parseMapWs('ws.Evil')).toBeNull()
    expect(parseMapWs('ws.a/../x')).toBeNull()
    expect(parseMapWs('https://evil.example')).toBeNull()
    expect(parseMapWs(undefined)).toBeNull()
  })
  it('단계 키는 지도 단계 열거형만', () => {
    expect(parseMapStep('evidence')).toBe('evidence')
    expect(parseMapStep('l-sound')).toBe('l-sound')
    expect(parseMapStep('admin')).toBeNull()
    expect(parseMapStep('')).toBeNull()
  })
  it('과제 키는 홈 과제 형식 그대로(공백 · 주소 거부)', () => {
    expect(parseMapReturn({ task: 'B6-FIND-1', ws: 'ws.cohesion', step: 'relation' })).toEqual({ task: 'B6-FIND-1', mapTask: null, ws: 'ws.cohesion', step: 'relation' })
    expect(parseMapReturn({ task: 'a b', ws: 'x', step: 'y' })).toEqual({ task: null, mapTask: null, ws: null, step: null })
  })
  it('map_task 는 영구 TASK slug 형식만(v6.2 §9.3 — 활동 id task 와 구별)', () => {
    expect(parseMapReturn({ map_task: 'r.central_meaning' }).mapTask).toBe('r.central_meaning')
    expect(parseMapReturn({ map_task: 's.o.sentence_meaning_model' }).mapTask).toBe('s.o.sentence_meaning_model')
    expect(parseMapReturn({ map_task: 'B6-FIND-1' }).mapTask).toBeNull()
    expect(parseMapReturn({ map_task: 'r.central meaning' }).mapTask).toBeNull()
    expect(parseMapReturn({ map_task: 'https://evil.example' }).mapTask).toBeNull()
    expect(mapReturnQuery({ mapTask: 'e.evidence_location', ws: 'ws.evidence-locate' })).toBe('&map_task=e.evidence_location&ws=ws.evidence-locate')
    expect(withMapReturn('/csat/item/2026-31?check=1#principle', { mapTask: 'e.evidence_location' })).toBe('/csat/item/2026-31?check=1&from=map&map_task=e.evidence_location#principle')
  })
})

describe('mapReturnQuery', () => {
  it('검증된 값만 &키=값 으로', () => {
    expect(mapReturnQuery({ task: 'T1', ws: 'ws.cohesion', step: 'option' })).toBe('&task=T1&ws=ws.cohesion&step=option')
    expect(mapReturnQuery({ task: null, ws: 'bad' })).toBe('')
  })
})

describe('withMapReturn', () => {
  it('문항 링크에 from=map 과 문맥을 싣고 해시는 끝에 둔다', () => {
    expect(withMapReturn('/csat/item/2026-34?check=1#principle', { task: 'T1', ws: 'ws.cohesion', step: 'relation' })).toBe('/csat/item/2026-34?check=1&from=map&task=T1&ws=ws.cohesion&step=relation#principle')
  })
  it('같은 키는 덮어쓰고 · 검증 못 한 값은 싣지 않는다', () => {
    expect(withMapReturn('/csat/item/2026-34?from=map&task=old', { task: 'new', ws: 'nope' })).toBe('/csat/item/2026-34?from=map&task=new')
  })
  it('문항 화면이 아니면 그대로(연습 · 기록 · 외부)', () => {
    expect(withMapReturn('/csat/practice/claim-support?item=x', { task: 'T1' })).toBe('/csat/practice/claim-support?item=x')
    expect(withMapReturn('https://evil.example/csat/item/x', { task: 'T1' })).toBe('https://evil.example/csat/item/x')
  })
})
