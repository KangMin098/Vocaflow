// apps/web/src/lib/csat/bridge/__tests__/scenario.test.ts
//
// H8 — 목표 설정 → 기출 진입 → 학습 → 기록 → 다음 TASK 결정 통합 격리 시나리오(실계정 · DB 없음).
// 실제 지도 판정 함수(studyItemsFor · reservedPracticePool · returnNotes · withMapReturn)와 연구 v1.4 실데이터를 그대로 쓴다.
import { describe, expect, it } from 'vitest'

import type { ExposureLedger } from '../../map/v62/assessment-exposure'
import type { NeedRankEntry } from '../../map/v62/rank'
import type { AsIsTask } from '../../map/v4/as-is'
import type { SavedPlans } from '../../map/v4/plan-store'
import { entriesFor, type EntryInput } from '../entry'
import { buildEvidenceFeed, promotionGate, type FeedAttempt } from '../evidence-feed'
import type { ExposureRow } from '../exposure-consumer'
import { learnerSummary } from '../learner-summary'
import { bridgeReturnNotes, parseBridgeCtx } from '../round-trip'

const TASK = 'r.central_meaning'
const TYPES: Record<string, string> = { '2019#23': 'R-TOPIC', '2015#32': 'R-BLANK', '2014B#38': 'R-ORDER', '2020#36': 'R-ORDER', '2024#21': 'R-GIST', '2024#22': 'R-TITLE', '2025#24': 'R-TITLE' }
const check = (unseen: string[]): NonNullable<AsIsTask['check']> => ({ taskKey: 'claim-support', status: 'unverified', independentItems: 0, attemptedItems: 1, verifiedItems: [], wrongItems: [], unseen, examSeen: [], verifiedAt: null })
const confirm = [{ target: '2024-21', href: '/csat/item/2024-21', label: '' }, { target: '2024-22', href: '/csat/item/2024-22', label: '' }]
const transfer = [{ target: '2025-24', href: '/csat/item/2025-24', label: '' }]
// 2020#36 은 아직 안 푼 확인 문항 2024#22 와 같은 지문(공유 지문 보호 대상)
const passageKeys = { '2019#23': 'pA', '2015#32': 'pB', '2014B#38': 'pC', '2020#36': 'pShared', '2024#21': 'pD', '2024#22': 'pShared', '2025#24': 'pE' }
const ledger = (): ExposureLedger => ({ status: 'ok', events: [], passageKeys })
const need: NeedRankEntry = { rank: 1, task: TASK, need: 'CONFIRM', evidence: 'insufficient' as NeedRankEntry['evidence'], confirmed: false }
const saved = (ws: string, version: number, goal: number) => ({ status: 'installed', byTemplate: { 'ws.central-meaning': { workspaceId: ws, template: 'ws.central-meaning', latest: { version } } }, goalVersionId: goal }) as unknown as SavedPlans
const WS = '0e6a2f9c-1d2b-4c3d-8e4f-5a6b7c8d9e0f'

const input = (o: Partial<EntryInput> = {}): EntryInput => ({
  task: TASK, need, goalNeed: { relevance: { items: 4, pointsPerExam: 9 }, reason: 'goal' }, goalSet: true,
  check: check(['2024#22']), confirm, transfer, ledger: ledger(), typeOf: (r) => TYPES[r] ?? null,
  ctx: { ws: 'ws.central-meaning', mapWs: WS, mapPlan: '1', mapGoal: '5', step: 'evidence', analysisVersion: '1' }, ...o,
})

describe('H8 통합 시나리오', () => {
  it('① 목표 · NeedRank 에서 진입 — 안 푼 확인 · 전이 · 같은 지문 문항은 링크를 만들지 않는다', () => {
    const r = entriesFor(input())
    const items = r.entries.map((e) => e.item)
    expect(items).toContain('2024#21') // 이미 푼 확인 문항
    expect(items).toContain('2019#23') // 연구 합의 사례
    expect(items).not.toContain('2024#22') // 안 푼 확인
    expect(items).not.toContain('2025#24') // 전이
    expect(items).not.toContain('2020#36') // 안 푼 확인과 같은 지문
    expect(r.withheld).toBeGreaterThanOrEqual(3)
    // 다른 유형(R-BLANK · R-ORDER)은 뒤로
    expect(r.entries.findIndex((e) => e.item === '2015#32')).toBeGreaterThan(r.entries.findIndex((e) => e.item === '2019#23'))
  })

  it('② 추천 이유 — 근거 미확정을 약점으로 말하지 않고, 목표 역할은 사실만', () => {
    const e = entriesFor(input()).entries.find((x) => x.item === '2019#23')!
    expect(e.rationale.why).toEqual({ need: '추가 확인', confirmed: false, basis: 'research_case' })
    expect(e.rationale.skills.map((s) => s.id)).toEqual(['central_generalize'])
    expect(e.rationale.goalRole).toEqual({ status: 'linked', items: 4, pointsPerExam: 9 })
    expect(entriesFor(input({ goalSet: false })).entries[0].rationale.goalRole).toEqual({ status: 'goal_not_set' })
  })

  it('③ 원장 오류 — 연구 사례는 모두 보류, 이미 푼 문항만 연다(fail-closed)', () => {
    const r = entriesFor(input({ ledger: { status: 'error', failed: ['trap'] } }))
    expect(r.entries.map((e) => e.item)).toEqual(['2024#21'])
    expect(r.ledger).toBe('error')
  })

  it('④ 확인 기록을 못 읽음 — 확인 문항 전체 보류', () => {
    const r = entriesFor(input({ check: null }))
    expect(r.entries.some((e) => e.item.startsWith('2024'))).toBe(false)
  })

  it('⑤ 왕복 · 목표 변경 · 판본 변경 · 재로그인 — 기록은 보존되고 달라진 사실만 알린다', () => {
    const e = entriesFor(input()).entries.find((x) => x.item === '2019#23')!
    const sp = Object.fromEntries(new URL(e.href, 'http://x').searchParams)
    const ctx = parseBridgeCtx(sp)
    expect(ctx).toMatchObject({ mapTask: TASK, ws: 'ws.central-meaning', mapWs: WS, step: 'evidence', analysisVersion: '1' })
    // 같은 상태로 복귀
    expect(bridgeReturnNotes(saved(WS, 1, 5), ctx, 1)).toEqual([])
    // 목표 변경 + 분석 판본 변경
    expect(bridgeReturnNotes(saved(WS, 1, 6), ctx, 2).map((n) => n.kind)).toEqual(['goal_changed', 'analysis_changed'])
    // Workspace 다시 만듦
    expect(bridgeReturnNotes(saved('11111111-2222-4333-8444-555555555555', 1, 5), ctx, 1).map((n) => n.kind)).toEqual(['workspace_replaced'])
    // 재로그인 = 같은 주소 문맥 재해석 — 결과 동일(세션 저장소에 의존하지 않는다)
    expect(parseBridgeCtx(sp)).toEqual(ctx)
  })

  it('⑥ 학습 → 기록 → 다음 TASK — 정답 열람 뒤 수행 · 도움 · 서버 오류 · 중복 · 판본 변경을 가른다', () => {
    const exposures: ExposureRow[] = [{ itemRef: '2019#23', kind: 'answer_direct', source: 'lecture_full', receivedAt: '2026-10-24T01:00:00Z', clockSuspect: false, analysisVersion: 1 }]
    const a = (o: Partial<FeedAttempt>): FeedAttempt => ({ attemptId: '1', itemRef: '2024#22', taskKey: 'claim-support', isCorrect: true, contentHash: 'h1', passageKey: 'pShared', skill: 'central_generalize', independence: 'independent_candidate', exposureOrderAt: '2026-10-24T02:00:00Z', helpLevel: 'independent', afterExplanation: false, afterViewedFirst: false, timingUncertain: false, ...o })
    const attempts = [
      a({ attemptId: '10', itemRef: '2019#23', passageKey: 'pA' }), // 정답 열람 뒤 같은 문항 — 도움 받은 수행
      a({ attemptId: '11' }), // 안 푼 확인 문항 첫 독립 시도
      a({ attemptId: '11' }), // 중복 요청
      a({ attemptId: '12', itemRef: '2024#21', passageKey: 'pD', independence: null }), // 서버 오류
      a({ attemptId: '13', itemRef: '2014B#38', passageKey: 'pC', contentHash: 'h0' }), // 옛 판본
      a({ attemptId: '14', itemRef: '2015#32', passageKey: 'pB', independence: 'helped', helpLevel: 'hint' }), // 도움 받은 시도
    ]
    const P = (r: string) => (passageKeys as Record<string, string>)[r]
    const feed = buildEvidenceFeed(attempts, exposures, () => 'h1', P)
    expect(feed.accepted.map((o) => o.attemptId)).toEqual(['11'])
    expect(Object.fromEntries(feed.rejected.map((r) => [r.attemptId, r.reason]))).toEqual({ 10: 'helped_or_exposed', 11: 'duplicate', 14: 'helped_or_exposed' })
    expect(Object.fromEntries(feed.held.map((r) => [r.attemptId, r.reason]))).toEqual({ 12: 'independence_unknown', 13: 'stale_analysis' })
    // 유효하지 않은 숙달 승격 거절 — 도움 받은 시도를 근거로 · 한 지문만으로
    expect(promotionGate(feed, ['10', '11'])).toEqual({ ok: false, reason: 'invalid_evidence' })
    expect(promotionGate(feed, ['11'])).toEqual({ ok: false, reason: 'single_passage' })

    const entry = entriesFor(input()).entries.find((x) => x.item === '2019#23')!
    const s = learnerSummary(entry, exposures, feed, false, P)
    // K6-a — 안 푼 확인 문항과 같은 지문(2020#36)의 정답을 먼저 봤다면 그 확인 시도는 독립 증거가 아니다
    const shared = buildEvidenceFeed([a({ attemptId: '11' })], [{ ...exposures[0], itemRef: '2020#36' }], () => 'h1', P)
    expect(shared.accepted).toHaveLength(0)
    expect(s.help.observed.map((m) => m.kind)).toEqual(['lecture_viewed'])
    expect(s.help.external).toBe('UNKNOWN')
    expect(s.understood[0].claim).toBe('single_independent_success')
    expect(s.unconfirmed.some((x) => x.includes('판단 보류된 수행 2건'))).toBe(true)
    expect(s.next).toMatchObject({ kind: 'wait_for_material', optional: true })
    expect(s.learningEffect).toBe('NOT_EVALUATED')
    expect(JSON.stringify(s)).not.toMatch(/해소|달성했|숙달했/)
    // 원장을 못 읽으면 도움 여부도 미확인
    expect(learnerSummary(entry, null, buildEvidenceFeed([], null, () => 'h1', P), null).unconfirmed[0]).toContain('도움 여부는 미확인')
  })
})
