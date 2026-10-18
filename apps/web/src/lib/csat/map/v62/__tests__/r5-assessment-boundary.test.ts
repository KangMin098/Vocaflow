// apps/web/src/lib/csat/map/v62/__tests__/r5-assessment-boundary.test.ts
//
// #281 · #283 재현 결함의 제품 경계 회귀 — 연습 ↔ 독립 평가 · 다른 TASK · 같은 지문 · FQ 미설치/오류/0건 · 수요(PLAN) 경계.
import { describe, expect, it } from 'vitest'

import { attemptRole, compactLedger, exposureOf, reservedFromPractice, unexposedForAssessment, type ExposureEvent, type ExposureLedger } from '../assessment-exposure'
import type { DemandLine, WorkspaceDemand } from '../demand'
import { existingAssetManifest } from '../factory-integration'
import { fulfillmentOf, supplyFor, type SupplyInput } from '../supply'

const e = (itemRef: string, o: Partial<ExposureEvent> = {}): ExposureEvent => ({ itemRef, source: 'g2_attempt', taskKey: null, activity: null, phase: null, helpLevel: null, sessionId: null, contentHash: null, deleted: false, ...o })
const P = { '2020#24': 'pA', '2021#24': 'pB', '2026#23': 'pC', '2020#20': 'pD', 'X#1': 'pA', 'Y#9': 'pZ' }
const ok = (events: ExposureEvent[] = []): ExposureLedger => ({ status: 'ok', events, passageKeys: P })

const line = (role: DemandLine['role'], n = 1): DemandLine => ({
  role, task: 'r.central_meaning' as DemandLine['task'], taskKeys: ['claim-support'], csatTypes: ['R-TITLE'], quantity: { n, unit: '문항' },
  requires: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true }, reuse: true, reason: 'stage_check',
} as DemandLine)
const demand = (planVersion: number, roles: DemandLine['role'][] = ['independent_check', 'transfer']) => ({ key: `wd-${planVersion}`, template: 'ws.central-meaning', workspaceId: 'w1', goalVersion: 3, planVersion, definitionVersion: 'v6.2', asOf: '2026-10-17T00:00:00Z', core: 'r.central_meaning', support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] }, lines: roles.map((r) => line(r)) }) as unknown as WorkspaceDemand
const input = (o: Partial<SupplyInput> = {}): SupplyInput => ({ unseenCheckItems: ['2020#20'], transferItems: ['2020#24', '2021#24'], transferDrafts: 0, study: { items: [], withheld: 0, sharedPassageUnchecked: true }, factoryStock: null, exposure: ok(), fq: { status: 'not_installed' }, ...o })
const roleOf = (s: ReturnType<typeof supplyFor>, r: string) => s.lines.find((l) => l.role === r)!

describe('노출 판정 — 경로 · TASK · 지문 무관', () => {
  it('unidentified past exposure stays unknown after privacy compaction', () => {
    const full = ok([e('2020#22', { source: 'paper' })])
    expect(exposureOf('2020#24', full)).toEqual({ state: 'unknown', reason: 'passage_unknown' })
    const compact = compactLedger(full, ['2020#24'])
    expect(exposureOf('2020#24', compact)).toEqual(exposureOf('2020#24', full))
    expect(exposureOf('2020#24', compactLedger(compact, ['2020#24']))).toEqual(exposureOf('2020#24', full))
    expect(JSON.stringify(compact)).not.toContain('2020#22')
  })
  it('known same-item exposure remains exposed despite another missing identity', () => {
    expect(exposureOf('2020#24', ok([e('2020#24'), e('2020#22')])).state).toBe('exposed')
  })
  it('같은 문항을 연습(activity=practice)으로 먼저 봤으면 평가 후보가 아니다', () => {
    expect(exposureOf('2020#24', ok([e('2020#24', { activity: 'practice', phase: 'transfer', taskKey: 'claim-support' })])).state).toBe('exposed')
  })
  it('다른 TASK(option-restate)로 먼저 본 같은 문항도 노출이다', () => {
    expect(exposureOf('2026#23', ok([e('2026#23', { taskKey: 'option-restate', activity: 'theater', phase: 'practice' })]))).toMatchObject({ state: 'exposed', sameItem: true })
  })
  it('함정 훈련만 한 학습자(2021#24 trap)도 노출이다 — G2 원장만 보면 빠지던 경로(E01)', () => {
    expect(exposureOf('2021#24', ok([e('2021#24', { source: 'trap' })]))).toMatchObject({ state: 'exposed', via: ['trap'] })
  })
  it('같은 정규화 지문을 공유한 다른 문항을 봤으면 노출이다', () => {
    expect(exposureOf('2020#24', ok([e('X#1', { source: 'paper' })]))).toMatchObject({ state: 'exposed', sameItem: false, samePassage: true })
  })
  it('지문이 다른 문항 노출은 영향이 없다', () => {
    expect(exposureOf('2020#24', ok([e('Y#9')])).state).toBe('unseen')
  })
  it('세션을 지워도 노출은 남는다', () => {
    expect(exposureOf('2020#24', ok([e('2020#24', { source: 'g2_session', deleted: true })])).state).toBe('exposed')
  })
  it('원장 오류 · 지문 미식별은 unknown — unseen 으로 승격하지 않는다', () => {
    expect(exposureOf('2020#24', { status: 'error', failed: ['trap'] })).toEqual({ state: 'unknown', reason: 'ledger_error' })
    expect(exposureOf('Q#1', ok())).toEqual({ state: 'unknown', reason: 'passage_unknown' })
    expect(unexposedForAssessment(['2020#24', 'Q#1'], ok())).toEqual({ unseen: ['2020#24'], exposed: [], unknown: ['Q#1'] })
  })
  it('화면용 축약 원장도 같은 판정을 낸다(다른 기록 · 해시 · 세션 id 를 보내지 않는다)', () => {
    const full = ok([e('X#1', { source: 'paper', sessionId: 's', contentHash: 'h' }), e('Y#9', { activity: 'practice' })])
    const c = compactLedger(full, ['2020#24'])
    expect(exposureOf('2020#24', c)).toEqual(exposureOf('2020#24', full))
    expect(c.status === 'ok' && c.events.map((x) => [x.itemRef, x.sessionId, x.contentHash])).toEqual([['X#1', null, null]])
  })
})

describe('연습 예약 — 확인 문항을 연습이 소모하지 않는다', () => {
  it('아직 안 본 확인 문항은 연습에서 빠지고, 이미 본 문항은 연습으로 열린다', () => {
    expect([...reservedFromPractice(['2020#20', '2026#23'], ok([e('2026#23', { source: 'trap' })]))]).toEqual(['2020#20'])
  })
  it('원장을 못 읽으면 전부 예약(fail-closed)', () => {
    expect([...reservedFromPractice(['2020#20', '2026#23'], { status: 'error', failed: [] })]).toEqual(['2020#20', '2026#23'])
  })
})

describe('시도 역할 — phase 하나로 가르지 않는다(E03)', () => {
  const x = { taskKey: 'claim-support', contentHash: 'h1' }
  const base = { taskKey: 'claim-support', phase: 'practice', helpLevel: 'independent', sessionId: 's1', contentHash: 'h1' }
  it('같은 phase=practice 라도 theater 는 확인, practice 는 연습', () => {
    expect(attemptRole({ ...base, activity: 'theater' }, x)).toBe('independent_check')
    expect(attemptRole({ ...base, activity: 'practice' }, x)).toBe('practice')
  })
  it('도움 · 세션 없음 · 다른 TASK · 내용 해시 불일치는 평가 수행이 아니다', () => {
    expect(attemptRole({ ...base, activity: 'theater', helpLevel: 'hint' }, x)).toBe('helped')
    expect(attemptRole({ ...base, activity: 'theater', sessionId: null }, x)).toBe('unbound')
    expect(attemptRole({ ...base, activity: 'theater', taskKey: 'option-restate' }, x)).toBe('unbound')
    expect(attemptRole({ ...base, activity: 'theater', contentHash: 'old' }, x)).toBe('unbound')
    expect(attemptRole({ ...base, activity: 'theater' }, { taskKey: 'claim-support', contentHash: null })).toBe('unbound')
  })
})

describe('supplyFor — 공개 경로 이용 가능 ≠ 정식 FQ 적격(E04)', () => {
  it('FQ 미설치: 확인 · 전이는 open_unqualified · 7필드 true 없음 · 공급 0', () => {
    const s = supplyFor(demand(1), input())
    for (const r of ['independent_check', 'transfer']) {
      const l = roleOf(s, r)
      expect(l.state).toBe('open_unqualified')
      expect(l.qualification.assessment).toBeNull()
      expect(l.qualification.rights).toBeNull()
      expect(fulfillmentOf(l)).toBe('not_supplied')
      expect(l.reason).toContain('미설치')
    }
    expect(s.anyAvailable).toBe(false)
  })
  it('FQ 조회 오류와 설치됨 · 적격 0건은 각각 다르게 말한다', () => {
    expect(roleOf(supplyFor(demand(1), input({ fq: { status: 'error' } })), 'transfer').reason).toContain('조회 실패')
    const zero = roleOf(supplyFor(demand(1), input({ fq: { status: 'installed', eligible: [] } })), 'transfer')
    expect(zero.state).toBe('open_unqualified')
    expect(zero.reason).not.toContain('미설치')
  })
  it('FQ 가 적격이라 한 미노출 문항만 available', () => {
    const l = roleOf(supplyFor(demand(1), input({ fq: { status: 'installed', eligible: [{ ref: '2020#24', task: 'r.central_meaning', role: 'transfer', qualificationId: 'q1' }] } })), 'transfer')
    expect(l.state).toBe('available')
    expect(l.delivered.map((d) => d.ref)).toEqual(['2020#24'])
    expect(fulfillmentOf(l)).toBe('fully_supplied')
  })
  it('적격이어도 이미 연습으로 본 문항은 공급하지 않는다(연습 후 평가 차단)', () => {
    const l = roleOf(supplyFor(demand(1), input({ transferItems: ['2020#24'], fq: { status: 'installed', eligible: [{ ref: '2020#24', task: 'r.central_meaning', role: 'transfer', qualificationId: 'q1' }] }, exposure: ok([e('2020#24', { activity: 'practice' })]) })), 'transfer')
    expect(l.state).toBe('unsupported')
    expect(l.delivered).toEqual([])
  })
  it('함정 훈련으로 2021#24 를 본 학습자에게 대체 납품하지 않는다', () => {
    const l = roleOf(supplyFor(demand(1), input({ transferItems: ['2021#24'], exposure: ok([e('2021#24', { source: 'trap' })]) })), 'transfer')
    expect(l.delivered).toEqual([])
  })
  it('노출 원장을 못 읽으면 needs_review — 정상 0건(unsupported)과 구별', () => {
    const l = roleOf(supplyFor(demand(1), input({ exposure: { status: 'error', failed: ['review_queue'] } })), 'independent_check')
    expect(l.state).toBe('needs_review')
    expect(l.delivered).toEqual([])
  })
  it('노출 · FQ 입력이 빠진 호출은 모름으로 처리(available 이 되지 않는다)', () => {
    const rest: Partial<SupplyInput> = input()
    delete rest.exposure
    delete rest.fq
    const l = roleOf(supplyFor(demand(1), rest as SupplyInput), 'transfer')
    expect(l.state).toBe('needs_review')
  })
  it('기존 자산 manifest 는 open_unqualified 를 accept 하지 않는다', () => {
    const l = roleOf(supplyFor(demand(1), input()), 'transfer')
    const req = { requestId: 'r1', role: 'transfer', task: 'r.central_meaning', versions: { plan: 1 } } as never
    const { verdicts } = existingAssetManifest(req, l, () => 'a'.repeat(64))
    const vs = Object.values(verdicts)
    expect(vs.length).toBeGreaterThan(0)
    for (const v of vs) {
      expect(v.state).toBe('review_pending')
      expect(v.reasons).toEqual(expect.arrayContaining(['existing_not_available', 'existing_unverified:assessment', 'existing_unverified:rights']))
    }
  })
})

describe('수요 · PLAN 버전 경계', () => {
  it('공급 결과는 입력 수요의 key 에만 묶인다 — 옛 PLAN 수요와 섞지 않는다', () => {
    const a = supplyFor(demand(1), input())
    const b = supplyFor(demand(2), input({ exposure: ok([e('2020#24', { activity: 'practice' })]) }))
    expect(a.demandKey).toBe('wd-1')
    expect(b.demandKey).toBe('wd-2')
    expect(roleOf(a, 'transfer').delivered.map((d) => d.ref)).toEqual(['2020#24'])
    // 같은 학습자의 이후 노출은 새 수요에서만 반영 — 이전 결과 객체를 바꾸지 않는다
    expect(roleOf(b, 'transfer').delivered.map((d) => d.ref)).toEqual(['2021#24'])
  })
  it('2020#24 는 미노출 · FQ 미설치에서 검수 후보(open_unqualified)일 뿐 적격 1이 아니다', () => {
    const l = roleOf(supplyFor(demand(1), input({ transferItems: ['2020#24'] })), 'transfer')
    expect(l.state).toBe('open_unqualified')
    expect(fulfillmentOf(l)).toBe('not_supplied')
  })
})
