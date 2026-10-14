// apps/web/src/lib/csat/map/v62/__tests__/qualification.test.ts
// v6.2 P-F6b — FQ1.0 A~H ↔ 공급 자격 변환 · 결속 · 실제 판정 20건이 공급되지 않음
import { describe, expect, it } from 'vitest'

import FQ1 from '../fq1-results.data.json'
import { bindResult, supplyEligible, toSupplyQualification, type FqResult } from '../qualification'

const results = FQ1.results as unknown as FqResult[]
const all = (s: 'pass' | 'fail' | 'unknown' | 'not_applicable') => Object.fromEntries('ABCDEFGH'.split('').map((k) => [k, { state: s }])) as FqResult['axes']
const r = (o: Partial<FqResult> = {}): FqResult => ({ content: { id: 'c1', revision: '3' }, task: 'v.contextual_sense', role: 'guided_practice', axes: all('pass'), eligibleRoles: [], publicQualified: true, assessmentQualified: false, ...o })

describe('A~H → 공급 자격(FQ1-CONTRACT 매핑)', () => {
  it('unknown · not_applicable 은 null(통과 아님) · fail 은 false', () => {
    const q = toSupplyQualification(r({ axes: { ...all('pass'), D: { state: 'unknown' }, H: { state: 'not_applicable' }, B: { state: 'fail' } } }))
    expect(q).toMatchObject({ teaching: null, runnable: null, content: false })
  })
  it('F pass 여도 실제 승인 기록(publicQualified) 없으면 rights 는 true 가 아니다 · E pass 여도 평가 자격 없으면 assessment null', () => {
    const q = toSupplyQualification(r({ publicQualified: false }))
    expect(q.rights).toBeNull()
    expect(q.assessment).toBeNull()
    expect(toSupplyQualification(r({ assessmentQualified: true })).assessment).toBe(true)
  })
  it('지도 연습은 권리 · 내용 · 실행 · 교수, 독립 확인은 평가까지 필요', () => {
    expect(supplyEligible(toSupplyQualification(r()), 'guided_practice').ok).toBe(true)
    const check = supplyEligible(toSupplyQualification(r({ role: 'independent_check' })), 'independent_check')
    expect(check).toEqual({ ok: false, missing: ['assessment'] })
  })
  it('결속 — 다른 revision · TASK · 역할의 결과는 쓰지 않는다(수정된 콘텐츠는 이전 검수를 상속하지 않는다)', () => {
    const x = r()
    expect(bindResult(x, { contentId: 'c1', revision: '4', task: 'v.contextual_sense', role: 'guided_practice' })).toEqual({ ok: false, error: 'revision_mismatch' })
    expect(bindResult(x, { contentId: 'c1', revision: '3', task: 's.form_scope', role: 'guided_practice' })).toEqual({ ok: false, error: 'task_mismatch' })
    expect(bindResult(x, { contentId: 'c1', revision: '3', task: 'v.contextual_sense', role: 'independent_check' })).toEqual({ ok: false, error: 'role_mismatch' })
  })
})

describe('실제 FQ1.0 판정 20건 — 승인 기록 없이 공급 불가', () => {
  it('20건 모두 어떤 역할로도 공급 자격이 없다(공개 0 · 평가 0)', () => {
    expect(results).toHaveLength(20)
    for (const x of results) expect(supplyEligible(toSupplyQualification(x), x.role).ok, `${x.content.id}/${x.role}`).toBe(false)
    expect(results.every((x) => !x.publicQualified && !x.assessmentQualified && x.eligibleRoles.length === 0)).toBe(true)
  })
  it('연구가 찾은 결함이 그대로 false 로 남는다(의미 B fail 2 · TASK C fail 8 · Gold E fail 7)', () => {
    const qs = results.map((x) => ({ x, q: toSupplyQualification(x) }))
    expect(results.filter((x) => x.axes.B.state === 'fail')).toHaveLength(2)
    expect(results.filter((x) => x.axes.C.state === 'fail')).toHaveLength(8)
    expect(results.filter((x) => x.axes.E.state === 'fail')).toHaveLength(7)
    expect(qs.filter(({ x }) => x.axes.C.state === 'fail').every(({ q }) => q.content === false)).toBe(true)
    // 학습자 노출 G · 실행 H 는 20건 모두 unknown → null
    expect(qs.every(({ q }) => q.learner === null && q.runnable === null)).toBe(true)
  })
})
