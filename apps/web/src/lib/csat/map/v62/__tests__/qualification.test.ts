// apps/web/src/lib/csat/map/v62/__tests__/qualification.test.ts
// v6.2 P-F6b · P-F7c — FQ1.0 A~H ↔ 공급 자격 변환 · 결속 · 승인 기록 · 공급 시점 G · 실제 판정 20건 · 연구 결함 fixture
import { describe, expect, it } from 'vitest'

import FQ1 from '../fq1-results.data.json'
import {
  approvalState, bindResult, deliveryCheck, supplyEligible, toSupplyQualification,
  type Axis, type AxisState, type FqResult, type ReleaseApproval,
} from '../qualification'

const results = FQ1.results as unknown as FqResult[]
const all = (s: AxisState) => Object.fromEntries('ABCDEFGH'.split('').map((k) => [k, { state: s }])) as FqResult['axes']
const with_ = (o: Partial<Record<Axis, AxisState>>) => ({ ...all('pass'), ...Object.fromEntries(Object.entries(o).map(([k, s]) => [k, { state: s }])) }) as FqResult['axes']
const r = (o: Partial<FqResult> = {}): FqResult => ({ content: { id: 'c1', revision: '3' }, task: 'v.contextual_sense', role: 'guided_practice', axes: all('pass'), eligibleRoles: [], publicQualified: false, assessmentQualified: false, ...o })
const APPROVED = { public: true, assessment: true }
const appr = (o: Partial<ReleaseApproval>): ReleaseApproval => ({ id: 'a', qualificationId: 'q1', scope: 'public', approverRole: 'admin', revoked: false, ...o })

describe('A~H → 공급 자격(FQ1-CONTRACT 매핑)', () => {
  it('unknown · not_applicable 은 null(통과 아님) · fail 은 false', () => {
    const q = toSupplyQualification(r({ axes: with_({ D: 'unknown', H: 'not_applicable', B: 'fail' }) }), APPROVED)
    expect(q).toMatchObject({ teaching: null, runnable: null, content: false })
  })
  it('연구자 플래그 publicQualified=true 는 승인이 아니다 — 서버 승인 기록이 없으면 rights · assessment 는 true 가 아니다', () => {
    const q = toSupplyQualification(r({ publicQualified: true, assessmentQualified: true }))
    expect(q.rights).toBeNull()
    expect(q.assessment).toBeNull()
    expect(supplyEligible(q, 'guided_practice').ok).toBe(false)
  })
  it('승인 기록이 있으면 F · E pass 가 true 가 된다 · F/E fail 은 승인이 있어도 false', () => {
    expect(toSupplyQualification(r(), APPROVED)).toMatchObject({ rights: true, assessment: true })
    expect(toSupplyQualification(r({ axes: with_({ F: 'fail', E: 'fail' }) }), APPROVED)).toMatchObject({ rights: false, assessment: false })
  })
  it('approvalState — 그 자격 행 · 철회 안 된 승인만 센다', () => {
    expect(approvalState('q1', [appr({}), appr({ scope: 'assessment', revoked: true })])).toEqual({ public: true, assessment: false })
    expect(approvalState('q1', [appr({ qualificationId: 'q0' })])).toEqual({ public: false, assessment: false })
  })
  it('지도 연습은 권리 · 내용 · 실행 · 교수, 독립 확인은 평가까지 필요', () => {
    expect(supplyEligible(toSupplyQualification(r(), APPROVED), 'guided_practice').ok).toBe(true)
    const check = supplyEligible(toSupplyQualification(r({ role: 'independent_check' }), { public: true, assessment: false }), 'independent_check')
    expect(check).toEqual({ ok: false, missing: ['assessment'] })
  })
  it('결속 — 다른 revision · TASK · 역할의 결과는 쓰지 않는다(수정된 콘텐츠는 이전 검수를 상속하지 않는다)', () => {
    const x = r()
    expect(bindResult(x, { contentId: 'c1', revision: '4', task: 'v.contextual_sense', role: 'guided_practice' })).toEqual({ ok: false, error: 'revision_mismatch' })
    expect(bindResult(x, { contentId: 'c1', revision: '3', task: 's.form_scope', role: 'guided_practice' })).toEqual({ ok: false, error: 'task_mismatch' })
    expect(bindResult(x, { contentId: 'c1', revision: '3', task: 'v.contextual_sense', role: 'independent_check' })).toEqual({ ok: false, error: 'role_mismatch' })
  })
})

describe('G — 공급 시점 학습자별 노출(fail-closed)', () => {
  const q = toSupplyQualification(r(), APPROVED)
  it('평가 역할은 노출 없음(none)일 때만 · 시도 · 해설 열람 · 공유 지문 열람 · 모름은 실패', () => {
    expect(deliveryCheck(q, 'independent_check', 'none').ok).toBe(true)
    for (const e of ['attempted', 'explanation_seen', 'shared_passage_seen', 'unknown'] as const) {
      expect(deliveryCheck(q, 'independent_check', e)).toEqual({ ok: false, missing: [`learner:${e}`] })
      expect(deliveryCheck(q, 'delayed_check', e).ok).toBe(false)
    }
  })
  it('교수 · 연습 역할은 노출과 무관(콘텐츠 자격만)', () => {
    expect(deliveryCheck(q, 'guided_practice', 'attempted').ok).toBe(true)
    expect(deliveryCheck(q, 'model_explanation', 'unknown').ok).toBe(true)
  })
})

describe('실제 FQ1.0 판정 20건 — 승인 기록 없이 공급 불가', () => {
  it('20건 모두 어떤 역할로도 공급 자격이 없다(승인 기록 0 · 연구 플래그도 0)', () => {
    expect(results).toHaveLength(20)
    for (const x of results) expect(supplyEligible(toSupplyQualification(x), x.role).ok, `${x.content.id}/${x.role}`).toBe(false)
    expect(results.every((x) => !x.publicQualified && !x.assessmentQualified && x.eligibleRoles.length === 0)).toBe(true)
  })
  it('승인 기록을 가정해도 공급 불가 — 축 자체가 막는다(F unknown 18 · fail 2)', () => {
    for (const x of results) expect(supplyEligible(toSupplyQualification(x, APPROVED), x.role).ok, `${x.content.id}/${x.role}`).toBe(false)
  })
  it('연구가 찾은 결함이 그대로 false 로 남는다(의미 B fail 2 · TASK C fail 8 · Gold E fail 7)', () => {
    const qs = results.map((x) => ({ x, q: toSupplyQualification(x) }))
    expect(results.filter((x) => x.axes.B.state === 'fail')).toHaveLength(2)
    expect(results.filter((x) => x.axes.C.state === 'fail')).toHaveLength(8)
    expect(results.filter((x) => x.axes.E.state === 'fail')).toHaveLength(7)
    expect(qs.filter(({ x }) => x.axes.C.state === 'fail').every(({ q }) => q.content === false)).toBe(true)
    expect(qs.every(({ q }) => q.learner === null && q.runnable === null)).toBe(true)
  })
})

/**
 * FQ1-REPORT 의 구체 결함을 보류 · 거절 fixture 로 — 승인 기록이 있다고 가정해도 공급되면 실패해야 한다.
 * 축 상태는 보고서 서술을 그대로 옮겼다(나머지 축은 pass 로 두어 그 결함 하나만으로 막히는지 본다).
 */
const DEFECTS: { name: string; role: FqResult['role']; axes: Partial<Record<Axis, AxisState>> }[] = [
  { name: 'V2-3 지시문이 요청하지 않은 두 산출물을 루브릭이 요구(교수 · Gold 결함)', role: 'guided_practice', axes: { D: 'fail', E: 'fail' } },
  { name: 'S5-1/2/3 판독 불가 응답의 defect/defer 경계 충돌(Gold 결함)', role: 'independent_check', axes: { E: 'fail' } },
  { name: 'S5-2 강도 확대 응답을 partial 로 처리(Gold 결함)', role: 'transfer', axes: { E: 'fail' } },
  { name: 'DCP 의미 · 해설 실패', role: 'guided_practice', axes: { B: 'fail' } },
  { name: '정답 근거 실패(숫자 · 대상 결속 · 잘못된 근거)', role: 'independent_check', axes: { E: 'fail' } },
  { name: '원천 cache stale', role: 'guided_practice', axes: { A: 'unknown' } },
  { name: '원천 cache missing', role: 'guided_practice', axes: { A: 'unknown' } },
  { name: '생성 당시 원문 revision 미결속(created_at 대체 금지)', role: 'model_explanation', axes: { A: 'unknown' } },
  { name: '미관찰 루브릭(E pass 를 완전 평가 루브릭으로 승격 금지)', role: 'delayed_check', axes: { E: 'unknown' } },
  { name: '실행기 없음(H)', role: 'guided_practice', axes: { H: 'unknown' } },
  { name: '권리 미승인(F)', role: 'source_analysis', axes: { F: 'unknown' } },
]

describe('FQ1.0 결함 fixture — 미검증 콘텐츠가 PASS 로 승격되지 않는다', () => {
  for (const d of DEFECTS) {
    it(d.name, () => {
      const q = toSupplyQualification(r({ role: d.role, axes: with_(d.axes) }), APPROVED)
      expect(deliveryCheck(q, d.role, 'none').ok).toBe(false)
    })
  }
  it('대조: 결함이 없는 같은 fixture 는 통과한다(위 실패가 결함 때문임을 확인)', () => {
    for (const d of DEFECTS) expect(deliveryCheck(toSupplyQualification(r({ role: d.role }), APPROVED), d.role, 'none').ok, d.name).toBe(true)
  })
})
