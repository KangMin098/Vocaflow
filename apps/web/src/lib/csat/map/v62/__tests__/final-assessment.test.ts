// apps/web/src/lib/csat/map/v62/__tests__/final-assessment.test.ts
import { describe, expect, it } from 'vitest'

import { bindWindow, finalAttainment, parseFinalBinding, type FinalBindingRead } from '../final-assessment'
import type { OutcomeSession } from '../goal-outcome'
import type { GoalVersion } from '../target-goal'

const goal: GoalVersion = { id: 7, score: 85, grade: 2, exam: 'suneung', date: '2026-11-19', createdAt: '2026-09-01T03:00:00Z' }
const bound = (date = '2026-11-19', goalVersionId = 7): FinalBindingRead => ({ status: 'ok', binding: { id: 1, goalVersionId, date, createdAt: '2026-10-23T01:00:00Z' } })
const s = (id: string, examId: string, takenAt: string, raw: number | null, over: Partial<OutcomeSession> = {}): OutcomeSession =>
  ({ id, examId, examLabel: examId, takenAt, enteredAt: `${takenAt}T12:00:00Z`, raw, grade: 2, diagnosable: true, examReady: true, mode: 'live', firstExposure: 'unseen', examScope: 'suneung', ...over })
const AFTER = '2026-11-25T00:00:00Z'

describe('bindWindow · parseFinalBinding — 학습자가 정하는 최종 평가', () => {
  it('목표를 정한 다음 날 ~ 목표일만 · 시험이나 목표일이 없으면 정할 수 없다', () => {
    expect(bindWindow(goal)).toEqual({ min: '2026-09-02', max: '2026-11-19' })
    expect(bindWindow({ ...goal, exam: null })).toBeNull()
    expect(bindWindow({ ...goal, date: null })).toBeNull()
    // 서울 날짜 기준: 2026-09-01T16:00Z = 서울 9/2 → 다음 날 9/3
    expect(bindWindow({ ...goal, createdAt: '2026-09-01T16:00:00Z' })?.min).toBe('2026-09-03')
    expect(bindWindow({ ...goal, date: '2026-09-01' })).toBeNull()
  })
  it('범위 · 형식 · 다른 목표 버전을 거절한다', () => {
    expect(parseFinalBinding({ goalVersionId: 7, date: '2026-11-19' }, goal)).toEqual({ ok: true, date: '2026-11-19', goalVersionId: 7 })
    expect(parseFinalBinding({ goalVersionId: 7, date: '2026-11-20' }, goal).ok).toBe(false)
    expect(parseFinalBinding({ goalVersionId: 7, date: '2026-09-01' }, goal).ok).toBe(false)
    expect(parseFinalBinding({ goalVersionId: 7, date: '2026-02-30' }, goal).ok).toBe(false)
    expect(parseFinalBinding({ goalVersionId: 6, date: '2026-11-19' }, goal)).toMatchObject({ ok: false, code: 'goal_changed' })
    expect(parseFinalBinding({ goalVersionId: 7, date: '2026-11-19' }, null).ok).toBe(false)
  })
})

describe('finalAttainment — 결속된 최종 평가 한 번으로만 최종 목표를 판정', () => {
  it('저장 구조 미설치 · 조회 실패 · 미결속은 미확인이다(빈 결속으로 삼키지 않는다)', () => {
    expect(finalAttainment(goal, { status: 'not_installed' }, [], [], AFTER).status).toBe('not_installed')
    expect(finalAttainment(goal, { status: 'error' }, [], [], AFTER).status).toBe('read_error')
    expect(finalAttainment(goal, { status: 'ok', binding: null }, [s('a', 'sn-2027', '2026-11-19', 95)], [], AFTER).status).toBe('unbound')
  })
  it('다른 목표 버전의 결속은 이어지지 않는다', () => {
    expect(finalAttainment(goal, bound('2026-11-19', 6), [s('a', 'sn-2027', '2026-11-19', 95)], [], AFTER).status).toBe('unbound')
  })
  it('응시일 전 = scheduled · 지난 뒤 기록 없음 = awaiting_record', () => {
    expect(finalAttainment(goal, bound(), [], [], '2026-10-23T00:00:00Z').status).toBe('scheduled')
    expect(finalAttainment(goal, bound(), [], [], AFTER).status).toBe('awaiting_record')
  })
  it('다른 날 · 다른 종류 기록으로 대신하지 않는다(더 높은 점수여도)', () => {
    const earlier = s('a', 'k9-2027', '2026-09-03', 99, { examScope: 'kice9' })
    const before = s('b', 'sn-2026', '2026-11-10', 99)
    const later = s('c', 'sn-x', '2026-11-22', 99)
    const otherKind = s('d', 'k9-x', '2026-11-19', 99, { examScope: 'kice9' })
    expect(finalAttainment(goal, bound(), [earlier, before, later, otherKind], [], AFTER).status).toBe('awaiting_record')
  })
  it('그날 첫 풀이 live · 미노출 기록이 점수 · 등급을 충족하면 met', () => {
    const a = finalAttainment(goal, bound(), [s('a', 'sn-2027', '2026-11-19', 88, { grade: 2 }), s('later', 'sn-x', '2026-11-22', 40)], [], AFTER)
    expect(a.status).toBe('met')
    expect(a.judged?.latest?.id).toBe('a')
  })
  it('점수 미달 또는 등급 미달이면 not_met', () => {
    expect(finalAttainment(goal, bound(), [s('a', 'sn-2027', '2026-11-19', 80)], [], AFTER).status).toBe('not_met')
    expect(finalAttainment(goal, bound(), [s('a', 'sn-2027', '2026-11-19', 90, { grade: 3 })], [], AFTER).status).toBe('not_met')
  })
  it('재풀이 · 노출 · 앱 모드 · 입력 신뢰 · 등급 미기록은 판정 불가(사유 보존)', () => {
    const cases: [Partial<OutcomeSession>, string][] = [
      [{ mode: 'retake' }, 'repeated_paper'], [{ firstExposure: 'exposed' }, 'repeated_paper'], [{ firstExposure: 'unknown' }, 'exposure_unknown'],
      [{ mode: 'app' }, 'not_live'], [{ mode: null }, 'mode_unknown'], [{ diagnosable: false }, 'unreliable'],
    ]
    for (const [over, reason] of cases) {
      const a = finalAttainment(goal, bound(), [s('a', 'sn-2027', '2026-11-19', 95, over)], [], AFTER)
      expect(a.status, reason).toBe('not_judgeable')
      expect(a.judged?.score.status).toBe(reason)
    }
    const g = finalAttainment(goal, bound(), [s('a', 'sn-2027', '2026-11-19', 95, { grade: null })], [], AFTER)
    expect(g.status).toBe('not_judgeable')
    expect(g.judged?.grade.status).toBe('no_record_grade')
  })
  it('목표 전에 같은 시험지를 풀었으면 그날 기록도 재풀이다', () => {
    const a = finalAttainment(goal, bound(), [s('old', 'sn-2027', '2026-08-01', 70), s('a', 'sn-2027', '2026-11-19', 95)], [], AFTER)
    expect(a.status).toBe('not_judgeable')
    expect(a.judged?.score.status).toBe('repeated_paper')
  })
  it('asOf 뒤에 입력된 기록은 보지 않는다', () => {
    expect(finalAttainment(goal, bound(), [s('a', 'sn-2027', '2026-11-19', 95, { enteredAt: '2026-11-26T00:00:00Z' })], [], AFTER).status).toBe('awaiting_record')
  })
})
