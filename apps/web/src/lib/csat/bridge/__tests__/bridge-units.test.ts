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
    expect(exposureLevelOf({ ...base, exposureOrderAt: null }, []).rule).toBe('R1')
    expect(exposureLevelOf({ ...base, itemRef: null }, []).rule).toBe('R2')
  })
  it('창 안 정답 노출은 X3 · 동률 포함 · 시도 뒤 노출은 앞 판정을 바꾸지 않는다', () => {
    expect(exposureLevelOf(base, [row()]).level).toBe('X3')
    expect(exposureLevelOf(base, [row({ receivedAt: T0 })]).level).toBe('X3')
    expect(exposureLevelOf(base, [row({ receivedAt: after })]).level).toBe('X0')
  })
  it('다른 문항 노출은 이 시도에 영향 없음', () => {
    expect(exposureLevelOf(base, [row({ itemRef: '2024#22' })]).level).toBe('X0')
  })
  it('해설 · 정답 먼저 보기 · viewed_first 는 X3, 결정적 단서는 X2', () => {
    expect(exposureLevelOf({ ...base, afterExplanation: true }, []).rule).toBe('R4')
    expect(exposureLevelOf({ ...base, afterViewedFirst: true }, []).rule).toBe('R5')
    expect(exposureLevelOf({ ...base, helpLevel: 'viewed_first' }, []).rule).toBe('R6')
    expect(exposureLevelOf(base, [row({ kind: 'decisive_hint' })]).level).toBe('X2')
  })
  it('시계 의심 · 시각 보류 · 도움 기록 없음은 UNKNOWN, hint 는 X1', () => {
    expect(exposureLevelOf(base, [row({ kind: 'decisive_hint', clockSuspect: true })]).level).toBe('X2')
    expect(exposureLevelOf(base, [row({ receivedAt: 'bad' })]).rule).toBe('R8')
    expect(exposureLevelOf({ ...base, timingUncertain: true }, []).rule).toBe('R9')
    expect(exposureLevelOf({ ...base, helpLevel: null }, []).rule).toBe('R10')
    expect(exposureLevelOf({ ...base, helpLevel: 'hint' }, []).level).toBe('X1')
    expect(exposureLevelOf(base, []).external).toBe('UNKNOWN')
  })
  it('문항 단위 현재 노출 · 원장 없음은 unknown', () => {
    expect(itemExposureNow('2024#21', null)).toBe('unknown')
    expect(itemExposureNow('2024#21', [row({ kind: 'decisive_hint' })])).toBe('hint_seen')
    expect(itemExposureNow('2024#99', [row()])).toBe('none_observed')
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

const fa = (o: Partial<FeedAttempt> = {}): FeedAttempt => ({ ...base, attemptId: '1', taskKey: 'claim-support', isCorrect: true, contentHash: 'h1', passageKey: 'p1', skill: 'central_generalize', independence: 'independent_candidate', ...o })

describe('H5 증거 공급 계약', () => {
  const hash = () => 'h1'
  it('유효한 독립 수행만 공급', () => {
    const f = buildEvidenceFeed([fa()], [], hash)
    expect(f.accepted).toHaveLength(1)
    expect(f.accepted[0].scope).toBe('observed_independent')
    expect(f.learningEffect).toBe('NOT_EVALUATED')
  })
  it('원장 못 읽음 · 독립 판정 실패 · 판본 변경은 보류(UNKNOWN 보존)', () => {
    expect(buildEvidenceFeed([fa()], null, hash).held[0].reason).toBe('ledger_unavailable')
    expect(buildEvidenceFeed([fa({ independence: null })], [], hash).held[0].reason).toBe('independence_unknown')
    expect(buildEvidenceFeed([fa({ contentHash: 'h0' })], [], hash).held[0].reason).toBe('stale_analysis')
    expect(buildEvidenceFeed([fa()], [], () => undefined).held[0].reason).toBe('stale_analysis')
  })
  it('도움 · 정답 노출 뒤 · 반복 · 미채점 · 중복은 거절', () => {
    expect(buildEvidenceFeed([fa()], [row()], hash).rejected[0].reason).toBe('helped_or_exposed')
    expect(buildEvidenceFeed([fa({ independence: 'repeat' })], [], hash).rejected[0].reason).toBe('not_check_phase')
    expect(buildEvidenceFeed([fa({ isCorrect: null })], [], hash).rejected[0].reason).toBe('not_performed')
    const d = buildEvidenceFeed([fa(), fa()], [], hash)
    expect(d.accepted).toHaveLength(1)
    expect(d.rejected[0].reason).toBe('duplicate')
  })
  it('숙달 주장은 서로 다른 지문 2개 이상 — 그래도 NOT_ESTABLISHED', () => {
    const one = buildEvidenceFeed([fa(), fa({ attemptId: '2', itemRef: '2024#22' })], [], hash)
    expect(skillClaimOf(one, 'central_generalize')).toEqual({ claim: 'single_independent_success', passages: 1, mastery: 'NOT_ESTABLISHED' })
    expect(promotionGate(one, ['1', '2'])).toEqual({ ok: false, reason: 'single_passage' })
    const two = buildEvidenceFeed([fa(), fa({ attemptId: '2', itemRef: '2024#22', passageKey: 'p2' })], [], hash)
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
