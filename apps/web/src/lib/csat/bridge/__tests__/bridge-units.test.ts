// apps/web/src/lib/csat/bridge/__tests__/bridge-units.test.ts
import { describe, expect, it } from 'vitest'

import { TASK_CSAT_TYPES } from '../../map/v62/demand'
import { meaningOfAttempt, meaningOfExposure } from '../activity-meaning'
import { buildEvidenceFeed, promotionGate, skillClaimOf, type FeedAttempt } from '../evidence-feed'
import { exposureLevelOf, itemExposureNow, parseIndependence, type AttemptForExposure, type ExposureRow } from '../exposure-consumer'
import { bridgeItemHref, bridgeReturnHref, bridgeReturnNotes, parseBridgeCtx } from '../round-trip'
import { itemFitsTask, skillOfType, skillsOfTask, tasksOfSkill, THINKING_SKILLS } from '../skill-map'

const T0 = '2026-10-24T01:00:00.000Z'
const before = '2026-10-24T00:59:00.000Z'
const after = '2026-10-24T01:01:00.000Z'
const base: AttemptForExposure = { itemRef: '2024#21', exposureOrderAt: T0, helpLevel: 'independent', afterExplanation: false, afterViewedFirst: false, timingUncertain: false }
const PASSAGES: Record<string, string> = { '2024#21': 'p1', '2024#22': 'p2', '2024#23': 'p1', '2024#99': 'p9' }
const P = (ref: string) => PASSAGES[ref]
const row = (o: Partial<ExposureRow> = {}): ExposureRow => ({ itemRef: '2024#21', kind: 'answer_direct', source: 'lecture_full', receivedAt: before, clockSuspect: false, analysisVersion: 1, ...o })

describe('H7 사고 기능 ↔ TASK 매핑', () => {
  it('정본 TASK_CSAT_TYPES 의 모든 TASK 가 사고 기능 하나 이상과 이어진다', () => {
    for (const task of Object.keys(TASK_CSAT_TYPES)) expect(skillsOfTask(task).length).toBeGreaterThan(0)
  })
  it('TASK 연결은 정본에서 계산 — 정본에 없는 기능은 UNMAPPED', () => {
    expect(tasksOfSkill('central_generalize')).toEqual(['e.option_correspondence', 'r.central_meaning'])
    expect(tasksOfSkill('data_compare')).toEqual([])
    expect(tasksOfSkill('central_generalize', { 'x.only': ['R-GIST'] })).toEqual(['x.only'])
  })
  it('사고 기능 사이 유형이 겹치지 않는다(한 유형은 한 기능)', () => {
    const all = THINKING_SKILLS.flatMap((s) => s.types)
    expect(new Set(all).size).toBe(all.length)
  })
  it('유형 미상 · 정본 조건 없음은 unknown, 다른 유형은 other', () => {
    expect(skillOfType('R-ORDER')).toBeNull()
    expect(itemFitsTask(null, 'r.central_meaning')).toBe('unknown')
    expect(itemFitsTask('R-TOPIC', 'r.central_meaning')).toBe('fits')
    expect(itemFitsTask('R-BLANK', 'r.central_meaning')).toBe('other')
    expect(itemFitsTask('R-TOPIC', 'no.such_task')).toBe('unknown')
  })
})

describe('H4 P6 노출 소비자(R1~R12)', () => {
  it('추적 이전 · 문항 없음은 X_UNKNOWN', () => {
    expect(exposureLevelOf({ ...base, exposureOrderAt: null }, [], P).rule).toBe('R1')
    expect(exposureLevelOf({ ...base, itemRef: null }, [], P).rule).toBe('R2')
  })
  it('창 안 정답 노출은 X3 · 동률 포함 · 시도 뒤 노출은 앞 판정을 바꾸지 않는다', () => {
    expect(exposureLevelOf(base, [row()], P).level).toBe('X3')
    expect(exposureLevelOf(base, [row({ receivedAt: T0 })], P).level).toBe('X3')
    expect(exposureLevelOf(base, [row({ receivedAt: after })], P).level).toBe('X0')
  })
  it('다른 문항 노출은 이 시도에 영향 없음', () => {
    expect(exposureLevelOf(base, [row({ itemRef: '2024#22' })], P).level).toBe('X0')
  })
  it('해설 · 정답 먼저 보기 · viewed_first 는 X3, 결정적 단서는 X2', () => {
    expect(exposureLevelOf({ ...base, afterExplanation: true }, [], P).rule).toBe('R4')
    expect(exposureLevelOf({ ...base, afterViewedFirst: true }, [], P).rule).toBe('R5')
    expect(exposureLevelOf({ ...base, helpLevel: 'viewed_first' }, [], P).rule).toBe('R6')
    expect(exposureLevelOf(base, [row({ kind: 'decisive_hint' })], P).level).toBe('X2')
  })
  it('시계 의심 · 시각 보류 · 도움 기록 없음은 UNKNOWN, hint 는 X1', () => {
    expect(exposureLevelOf(base, [row({ kind: 'decisive_hint', clockSuspect: true })], P).level).toBe('X2')
    expect(exposureLevelOf(base, [row({ receivedAt: 'bad' })], P).rule).toBe('R8')
    expect(exposureLevelOf({ ...base, timingUncertain: true }, [], P).rule).toBe('R9')
    expect(exposureLevelOf({ ...base, helpLevel: null }, [], P).rule).toBe('R10')
    expect(exposureLevelOf({ ...base, helpLevel: 'hint' }, [], P).level).toBe('X1')
    expect(exposureLevelOf(base, [], P).external).toBe('UNKNOWN')
  })
  it('문항 단위 현재 노출 · 원장 없음은 unknown', () => {
    expect(itemExposureNow('2024#21', null)).toBe('unknown')
    expect(itemExposureNow('2024#21', [row({ kind: 'decisive_hint' })], P)).toBe('hint_seen')
    expect(itemExposureNow('2024#99', [row()], P)).toBe('none_observed')
    expect(parseIndependence('independent_candidate')).toBe('independent_candidate')
    expect(parseIndependence('mastered')).toBeNull()
  })
})

describe('H3 활동 의미', () => {
  it('정답 열람 · 강의는 수행이 아니다', () => {
    expect(meaningOfExposure('reveal_api')).toMatchObject({ kind: 'answer_viewed', performed: false, independent: false })
    expect(meaningOfExposure('lecture_until')).toMatchObject({ kind: 'lecture_viewed', performed: false })
  })
  it('해설 뒤 확인은 정오와 무관하게 도움 받은 수행', () => {
    expect(meaningOfAttempt('independent_candidate', 'X3').kind).toBe('post_explanation_check')
    expect(meaningOfAttempt('helped', 'X0').kind).toBe('post_explanation_check')
    expect(meaningOfAttempt('independent_candidate', 'X2').kind).toBe('helped_attempt')
  })
  it('독립 = P6 후보 + X0/X1 둘 다, 모르면 보류', () => {
    expect(meaningOfAttempt('independent_candidate', 'X0')).toMatchObject({ kind: 'independent_attempt', independent: true })
    expect(meaningOfAttempt('independent_candidate', 'X_UNKNOWN').kind).toBe('held_attempt')
    expect(meaningOfAttempt(null, 'X0').kind).toBe('held_attempt')
    expect(meaningOfAttempt('legacy_unknown', 'X0').kind).toBe('held_attempt')
    expect(meaningOfAttempt('repeat', 'X0').kind).toBe('not_evidence')
  })
})

const fa = (o: Partial<FeedAttempt> = {}): FeedAttempt => ({ ...base, attemptId: '1', taskKey: 'claim-support', isCorrect: true, contentHash: 'h1', skill: 'central_generalize', independence: 'independent_candidate', ...o })

describe('H5 증거 공급 계약', () => {
  const hash = () => 'h1'
  it('유효한 독립 수행만 공급', () => {
    const f = buildEvidenceFeed([fa()], [], hash, P)
    expect(f.accepted).toHaveLength(1)
    expect(f.accepted[0].scope).toBe('observed_independent')
    expect(f.learningEffect).toBe('NOT_EVALUATED')
  })
  it('원장 못 읽음 · 독립 판정 실패 · 판본 변경은 보류(UNKNOWN 보존)', () => {
    expect(buildEvidenceFeed([fa()], null, hash, P).held[0].reason).toBe('ledger_unavailable')
    expect(buildEvidenceFeed([fa({ independence: null })], [], hash, P).held[0].reason).toBe('independence_unknown')
    expect(buildEvidenceFeed([fa({ contentHash: 'h0' })], [], hash, P).held[0].reason).toBe('stale_analysis')
    expect(buildEvidenceFeed([fa()], [], () => undefined, P).held[0].reason).toBe('stale_analysis')
  })
  it('도움 · 정답 노출 뒤 · 반복 · 미채점 · 중복은 거절', () => {
    expect(buildEvidenceFeed([fa()], [row()], hash, P).rejected[0].reason).toBe('helped_or_exposed')
    expect(buildEvidenceFeed([fa({ independence: 'repeat' })], [], hash, P).rejected[0].reason).toBe('not_check_phase')
    expect(buildEvidenceFeed([fa({ isCorrect: null })], [], hash, P).rejected[0].reason).toBe('not_performed')
    const d = buildEvidenceFeed([fa(), fa()], [], hash, P)
    expect(d.accepted).toHaveLength(1)
    expect(d.rejected[0].reason).toBe('duplicate')
  })
  it('숙달 주장은 서로 다른 지문 2개 이상 — 그래도 NOT_ESTABLISHED', () => {
    const one = buildEvidenceFeed([fa(), fa({ attemptId: '2', itemRef: '2024#23' })], [], hash, P) // 2024#23 은 2024#21 과 같은 지문
    expect(skillClaimOf(one, 'central_generalize')).toEqual({ claim: 'single_independent_success', passages: 1, mastery: 'NOT_ESTABLISHED' })
    expect(promotionGate(one, ['1', '2'])).toEqual({ ok: false, reason: 'single_passage' })
    const two = buildEvidenceFeed([fa(), fa({ attemptId: '2', itemRef: '2024#22' })], [], hash, P)
    expect(skillClaimOf(two, 'central_generalize').claim).toBe('repeated_independent_success')
    expect(promotionGate(two, ['1', '2'])).toEqual({ ok: true })
    expect(promotionGate(two, ['1', '9'])).toEqual({ ok: false, reason: 'invalid_evidence' })
    expect(promotionGate(two, [])).toEqual({ ok: false, reason: 'no_evidence' })
  })
})

describe('H6 왕복 문맥', () => {
  const ctx = { mapTask: 'r.central_meaning', ws: 'ws.central-meaning', step: 'evidence' as const, mapWs: '0e6a2f9c-1d2b-4c3d-8e4f-5a6b7c8d9e0f', mapPlan: '3', mapGoal: '7', analysisVersion: '2' }
  it('문항 주소에 TASK · Workspace · 판본 · 복귀 단계를 싣고 그대로 되돌린다', () => {
    const href = bridgeItemHref('2024#21', ctx)
    expect(href.startsWith('/csat/item/2024-21?from=map')).toBe(true)
    const sp = Object.fromEntries(new URL(href, 'http://x').searchParams)
    const back = parseBridgeCtx(sp)
    expect(back).toMatchObject({ mapTask: ctx.mapTask, ws: ctx.ws, step: 'evidence', mapWs: ctx.mapWs, mapPlan: '3', mapGoal: '7', analysisVersion: '2' })
    expect(bridgeReturnHref(sp)).toContain('map_av=2')
    expect(bridgeReturnHref(sp)).toContain('map_task=r.central_meaning')
  })
  it('형식이 틀린 값은 버린다(열린 리디렉트 · 주입 없음)', () => {
    const back = parseBridgeCtx({ map_av: '0; drop', map_task: 'https://evil', ws: '../x' })
    expect(back.analysisVersion).toBeNull()
    expect(back.mapTask).toBeNull()
    expect(bridgeReturnHref({ map_task: '//evil.com' })).toBe('/csat')
  })
  it('판본 변경을 알리고, 지금 판본을 모르면 비교하지 않는다', () => {
    expect(bridgeReturnNotes(null, { analysisVersion: '2' }, 3)).toEqual([{ kind: 'analysis_changed', from: 2, to: 3 }])
    expect(bridgeReturnNotes(null, { analysisVersion: '2' }, null)).toEqual([])
    expect(bridgeReturnNotes(null, { analysisVersion: '2' }, 2)).toEqual([])
  })
})

describe('K6-a 같은 지문 공유 문항 노출', () => {
  it('같은 지문의 다른 문항에서 정답을 봤으면 이 문항 시도도 X3 — DB 함수가 independent_candidate 를 내도 공급하지 않는다', () => {
    const sibling = row({ itemRef: '2024#23' }) // 2024#21 과 같은 지문 p1
    expect(exposureLevelOf(base, [sibling], P)).toMatchObject({ level: 'X3', rule: 'R3' })
    const f = buildEvidenceFeed([fa()], [sibling], () => 'h1', P)
    expect(f.accepted).toHaveLength(0)
    expect(f.rejected[0].reason).toBe('helped_or_exposed')
    expect(itemExposureNow('2024#21', [sibling], P)).toBe('answer_seen')
  })
  it('지문을 식별하지 못하면 기록이 없어도 X0 을 주지 않는다', () => {
    expect(exposureLevelOf(base, [], () => undefined)).toMatchObject({ level: 'X_UNKNOWN', rule: 'passage_unknown' })
    expect(exposureLevelOf(base, [])).toMatchObject({ level: 'X_UNKNOWN', rule: 'passage_unknown' })
    expect(exposureLevelOf({ ...base, helpLevel: 'hint' }, [], () => undefined).level).toBe('X_UNKNOWN')
    // 원장에 지문 미상 문항 노출이 있으면 이 문항과 같은 지문인지 모른다
    expect(exposureLevelOf(base, [row({ itemRef: '1999#1' })], P).level).toBe('X_UNKNOWN')
    expect(itemExposureNow('2024#99', [row({ itemRef: '1999#1' })], P)).toBe('unknown')
    expect(buildEvidenceFeed([fa()], [], () => 'h1', () => undefined).held[0].reason).toBe('exposure_unknown')
  })
})

describe('T-0156 P1 회귀 — 지문 집계는 노출 판정과 같은 정규화 키', () => {
  it('같은 지문의 서로 다른 두 문항은 한 지문으로 센다(호출자 입력 키에 의존하지 않음)', () => {
    const f = buildEvidenceFeed([fa(), fa({ attemptId: '2', itemRef: '2024#23' })], [], () => 'h1', P)
    expect(f.accepted.map((o) => o.passageKey)).toEqual(['p1', 'p1'])
    expect(promotionGate(f, ['1', '2'])).toEqual({ ok: false, reason: 'single_passage' })
    expect(skillClaimOf(f, 'central_generalize')).toMatchObject({ claim: 'single_independent_success', passages: 1 })
  })
})

describe('T-0167 — map_av 는 map-return 한 곳에서', () => {
  it('bridgeItemHref 는 map_av 를 한 번만 싣는다(중복 없음) · mapAv 와 analysisVersion 둘 다 받는다', () => {
    const a = bridgeItemHref('2024#21', { analysisVersion: '2' })
    const b = bridgeItemHref('2024#21', { mapAv: '2' })
    expect(a).toBe(b)
    expect(new URL(a, 'http://x').searchParams.getAll('map_av')).toEqual(['2'])
  })
  it('parseBridgeCtx 의 analysisVersion 은 mapAv 와 같다 · 형식 밖이면 둘 다 null', () => {
    expect(parseBridgeCtx({ map_av: '5' })).toMatchObject({ mapAv: '5', analysisVersion: '5' })
    expect(parseBridgeCtx({ map_av: '012' })).toMatchObject({ mapAv: null, analysisVersion: null })
  })
  it('bridgeReturnHref 는 map_av 를 한 번만', () => {
    const h = bridgeReturnHref({ map_av: '3', map_goal: '7' })
    expect(new URL(h, 'http://x').searchParams.getAll('map_av')).toEqual(['3'])
  })
})
