// apps/web/src/lib/csat/map/v62/__tests__/target-goal.test.ts
//
// LM-G1.3a — 저장 목표(점수 · 시험 · 등급 · 목표일)의 검증 · 멱등 비교 · 시험 범위 · 등급 구분 · 자료 없음의 정직한 계산.

import { describe, expect, it } from 'vitest'

import { gradeOf } from '../../goal-view'
import { gradeView, parseGoalInput, sameGoal, scopeCandidates, type ScopeCandidate } from '../target-goal'
import { toBeMap } from '../../v4/to-be'
import { asIsMap } from '../../v4/as-is'
import { DOMAINS, type Domain } from '../../v4/definition'

const TODAY = '2026-10-16'

describe('parseGoalInput — 점수 필수 · 모르는 값은 거절(조용히 null 로 바꾸지 않음)', () => {
  it('점수-only(기존 호환)', () => {
    expect(parseGoalInput({ target: 80 }, TODAY)).toEqual({ ok: true, goal: { score: 80, grade: null, exam: null, date: null } })
  })
  it('점수 · 시험 · 등급 · 목표일', () => {
    expect(parseGoalInput({ target: 90, exam: 'suneung', grade: 1, date: '2026-11-19' }, TODAY)).toEqual({ ok: true, goal: { score: 90, grade: 1, exam: 'suneung', date: '2026-11-19' } })
  })
  it('등급만(점수 없음)은 거절 — DB target_score NOT NULL · 임의 점수로 채우지 않는다(LM-G1.3b)', () => {
    expect(parseGoalInput({ grade: 2 }, TODAY).ok).toBe(false)
  })
  it('범위 밖 · 모르는 시험 · 잘못된 날짜 · 지난 날짜는 거절', () => {
    for (const b of [{ target: 101 }, { target: 80, grade: 0 }, { target: 80, grade: 10 }, { target: 80, exam: 'toeic' }, { target: 80, date: '2026-13-01' }, { target: 80, date: '2026-02-30' }, { target: 80, date: '2026-10-15' }]) {
      expect(parseGoalInput(b, TODAY).ok, JSON.stringify(b)).toBe(false)
    }
  })
  it('빈 문자열 날짜 · null 은 「정하지 않음」', () => {
    expect(parseGoalInput({ target: 80, date: '', exam: null, grade: null }, TODAY)).toMatchObject({ ok: true, goal: { date: null, exam: null, grade: null } })
  })
})

describe('sameGoal — 같은 요청키 재전송만 같은 결과(다른 본문은 409)', () => {
  const prior = { score: 80, grade: 2, exam: 'suneung' as const, date: '2026-11-19' }
  it('같으면 true · 하나라도 다르면 false', () => {
    expect(sameGoal({ ...prior }, prior)).toBe(true)
    expect(sameGoal({ ...prior, score: 90 }, prior)).toBe(false)
    expect(sameGoal({ ...prior, exam: 'kice9' }, prior)).toBe(false)
    expect(sameGoal({ ...prior, grade: null }, prior)).toBe(false)
    expect(sameGoal({ ...prior, date: null }, prior)).toBe(false)
  })
})

describe('scopeCandidates — 목표 시험이 기준 시험 범위를 정한다(미지원은 대체하지 않음)', () => {
  const c = (id: string, organizer: string, month: number, hasRates = true): ScopeCandidate => ({ id, label: id, held: 202500 + month, itemCount: 45, pointsTotal: 100, organizer, kind: organizer === 'kice' ? (month === 11 ? 'suneung' : 'mock') : 'academic', month, hasRates })
  const all = [c('S25', 'kice', 11), c('J25', 'kice', 6), c('N25', 'kice', 9), c('O25', 'edu_office', 3, false), c('O26', 'edu_office', 7, false)]
  it('미지정 = 기존 기본(평가원 전체)', () => {
    expect(scopeCandidates(null, all)).toMatchObject({ status: 'default' })
    expect(scopeCandidates(null, all).candidates.map((x) => x.id)).toEqual(['S25', 'J25', 'N25'])
  })
  it('수능 = 평가원 11월만 · 6월 · 9월 모의평가는 그 달만', () => {
    expect(scopeCandidates('suneung', all).candidates.map((x) => x.id)).toEqual(['S25'])
    expect(scopeCandidates('kice6', all).candidates.map((x) => x.id)).toEqual(['J25'])
    expect(scopeCandidates('kice9', all).candidates.map((x) => x.id)).toEqual(['N25'])
  })
  it('수능 종류는 시행 월과 분리하며 모평과 혼동하지 않는다', () => {
    const unusual = { ...c('S21', 'kice', 12), kind: 'suneung' }
    const notSuneung = { ...c('J', 'kice', 11), kind: 'mock' }
    expect(scopeCandidates('suneung', [unusual, notSuneung]).candidates.map(x => x.id)).toEqual(['S21'])
    expect(scopeCandidates('kice9', [{ ...unusual, month: 9 }]).candidates).toEqual([])
  })
  it('학평 — 오답률 관측이 없으면 미지원(no_rates) · 평가원 회차로 대신하지 않는다(후보 0)', () => {
    const r = scopeCandidates('hakpyeong', all)
    expect(r).toMatchObject({ status: 'unsupported_content', reason: 'no_rates' })
    expect(r.candidates).toEqual([])
  })
  it('학평 일부 오답률은 시험 전체 자격을 만들지 않는다', () => {
    const r = scopeCandidates('hakpyeong', [...all, c('O27', 'edu_office', 9, true)])
    expect(r.status).toBe('unsupported_content')
    expect(r.reason).toBe('unqualified_rates')
    expect(r.candidates).toEqual([])
  })
  it('그 시험 회차가 하나도 없으면 미지원(no_exams)', () => {
    expect(scopeCandidates('kice9', all.filter((x) => x.id !== 'N25'))).toMatchObject({ status: 'unsupported_content', reason: 'no_exams', candidates: [] })
  })
})

describe('gradeView — 저장 등급 · 점수 참고 등급을 섞지 않는다', () => {
  it('저장 등급이 없으면 참고 등급만', () => {
    expect(gradeView(80, null, gradeOf)).toEqual({ saved: null, referenceFromScore: gradeOf(80), mismatch: false })
  })
  it('점수 80 · 저장 1등급 → 모순을 알리되 바꾸지 않는다', () => {
    const v = gradeView(80, 1, gradeOf)
    expect(v.saved).toBe(1)
    expect(v.referenceFromScore).toBe(gradeOf(80))
    expect(v.mismatch).toBe(gradeOf(80) !== 1)
  })
})

describe('자료 없는 목표 시험(기준 문항 0) — 「요구 없음」이 아니라 「연결 확인 전」 · 약점으로 만들지 않는다', () => {
  it('직접 확인 전 TASK 는 relevanceUnknown 으로 · needs 에 확인 요구를 지어내지 않는다', () => {
    const proxy = { state: Object.fromEntries(DOMAINS.map((d) => [d, 'check_first'])) as Record<Domain, 'check_first'>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> }
    const a = asIsMap({ asOf: '2026-10-11T00:00:00Z', sessions: [], axisProxy: proxy, checks: [], attempts: [] })
    const tb = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: [], lineRefItems: {}, confirmLinks: {} })!
    expect(tb.exams).toBe(0)
    expect(tb.needs.filter((n) => n.type !== 'REPAIR')).toEqual([])
    expect(tb.relevanceUnknown.length).toBeGreaterThan(0)
  })
})
