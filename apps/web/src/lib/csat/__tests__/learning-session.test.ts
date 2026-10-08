// apps/web/src/lib/csat/__tests__/learning-session.test.ts
//
// G0 계약(`docs/csat-learner/G0_LEARNING_CONTRACT.md`)을 고정한다 — 상태 머신 · 멱등 · 삭제 표시 ·
// 다기기 병합 · 옛 기록 호환 · 적중률. 시각은 모두 고정값을 넘긴다(시계를 읽지 않는다).

import { describe, expect, it } from 'vitest'

import { mergeDissection, sameRecord } from '../continuity'
import { emptyDissectionRecord, predictionStats, type DissectionRecord, type Prediction } from '../dissect'
import {
  completionOf,
  countedPredictions,
  deleteSession,
  finishSession,
  isSkipPrediction,
  latestSession,
  mergeSessions,
  openSession,
  prune,
  restartSession,
  revealSession,
  reviewsDue,
  scheduleReview,
  sessionsOf,
  stepSession,
  unfinishedSessions,
  type LearningSession,
} from '../learning-session'

const T0 = Date.UTC(2026, 9, 8, 9, 0, 0)
const DAY = 86_400_000
const ITEM = '2026#34'

function ids() {
  let n = 0
  return () => `s-${++n}`
}

function base(): DissectionRecord {
  return emptyDissectionRecord(7)
}

function pred(over: Partial<Prediction> = {}): Prediction {
  return { item: ITEM, type: 'R-BLANK', step: 1, hit: false, at: T0, source: 'theater', sentence: 1, choice: 3, confidence: 4, ...over }
}

function opened(record = base(), steps = 14) {
  return openSession(record, { itemId: ITEM, steps, now: T0, newId: ids() })
}

describe('세션 열기 — 시도 0건이어도 세션이 있다', () => {
  it('처음 열면 stage=open · help=null 세션 하나', () => {
    const { record, session, resumed } = opened()
    expect(resumed).toBe(false)
    expect(session).toMatchObject({ item: ITEM, activity: 'theater', phase: 'practice', stage: 'open', help: null, step: 0, steps: 14, sv: 1 })
    expect(sessionsOf(record)).toHaveLength(1)
    expect(completionOf(session)).toBeNull()
  })

  it('마치지 않은 세션이 있으면 같은 세션을 재개한다(새로 만들지 않음)', () => {
    const a = opened()
    const stepped = stepSession(a.record, a.session.id, 6, T0 + 1000)
    const b = openSession(stepped, { itemId: ITEM, steps: 14, now: T0 + 2000, newId: () => 'never' })
    expect(b.resumed).toBe(true)
    expect(b.session.id).toBe(a.session.id)
    expect(b.session.step).toBe(6)
    expect(sessionsOf(b.record)).toHaveLength(1)
  })

  it('강의 단계 수가 바뀌었으면 재개 위치를 처음으로 돌린다', () => {
    const a = opened()
    const stepped = stepSession(a.record, a.session.id, 9, T0 + 1000)
    const b = openSession(stepped, { itemId: ITEM, steps: 10, now: T0 + 2000, newId: () => 'never' })
    expect(b.session.step).toBe(0)
    expect(b.session.steps).toBe(10)
  })

  it('마친 세션뿐이면 그것을 돌려준다 — 완료 화면(새 세션 없음)', () => {
    const a = opened()
    let r = revealSession(a.record, a.session.id, 'independent', 'att-1', T0 + 1)
    r = finishSession(r, a.session.id, T0 + 2)
    const b = openSession(r, { itemId: ITEM, steps: 14, now: T0 + 3, newId: () => 'never' })
    expect(b.resumed).toBe(false)
    expect(b.session.stage).toBe('finished')
    expect(b.record).toBe(r)
  })
})

describe('상태 전이 — open → revealed → finished 만', () => {
  it('확정은 independent · 「모르겠어요」는 viewed_first, 한 번 정한 help 는 바뀌지 않는다', () => {
    const a = opened()
    const r1 = revealSession(a.record, a.session.id, 'viewed_first', null, T0 + 1)
    expect(latestSession(r1, ITEM)?.help).toBe('viewed_first')
    const r2 = revealSession(r1, a.session.id, 'independent', 'att-x', T0 + 2)
    expect(r2).toBe(r1)
  })

  it('공개 전에는 마칠 수 없다', () => {
    const a = opened()
    expect(finishSession(a.record, a.session.id, T0 + 1)).toBe(a.record)
  })

  it('완료는 멱등 — 두 번 눌러도 기록이 그대로(완료 1건)', () => {
    const a = opened()
    const r1 = finishSession(revealSession(a.record, a.session.id, 'independent', 'att-1', T0 + 1), a.session.id, T0 + 2)
    const r2 = finishSession(r1, a.session.id, T0 + 99)
    expect(r2).toBe(r1)
    expect(sessionsOf(r2).filter((s) => s.finishedAt != null)).toHaveLength(1)
    expect(latestSession(r2, ITEM)?.finishedAt).toBe(T0 + 2)
  })

  it('마친 세션은 단계 위치를 바꾸지 않는다', () => {
    const a = opened()
    const r1 = finishSession(revealSession(a.record, a.session.id, 'independent', null, T0 + 1), a.session.id, T0 + 2)
    expect(stepSession(r1, a.session.id, 5, T0 + 3)).toBe(r1)
  })

  it('completion 은 stage · help 에서 파생한다', () => {
    expect(completionOf({ stage: 'open', help: null })).toBeNull()
    expect(completionOf({ stage: 'revealed', help: 'independent' })).toBe('viewed')
    expect(completionOf({ stage: 'finished', help: 'independent' })).toBe('independent')
    expect(completionOf({ stage: 'finished', help: 'viewed_first' })).toBe('guided')
    expect(completionOf({ stage: 'finished', help: 'hint' })).toBe('guided')
  })

  it('「처음부터 다시」는 새 세션 — 옛 세션의 완료는 그대로 남는다', () => {
    const a = opened()
    const r1 = finishSession(revealSession(a.record, a.session.id, 'independent', null, T0 + 1), a.session.id, T0 + 2)
    const b = restartSession(r1, ITEM, 14, T0 + 3, () => 's-new')
    expect(latestSession(b.record, ITEM)?.id).toBe('s-new')
    expect(sessionsOf(b.record).find((s) => s.id === a.session.id)?.finishedAt).toBe(T0 + 2)
  })
})

describe('다시 보기(복습) 예약', () => {
  const finished = () => {
    const a = opened()
    return { a, r: finishSession(revealSession(a.record, a.session.id, 'independent', null, T0 + 1), a.session.id, T0 + 2) }
  }

  it('한 번만 잡힌다(멱등) · 3일 뒤', () => {
    const { a, r } = finished()
    const r1 = scheduleReview(r, a.session.id, T0 + 10)
    expect(latestSession(r1, ITEM)?.reviewAt).toBe(T0 + 10 + 3 * DAY)
    expect(scheduleReview(r1, a.session.id, T0 + 20)).toBe(r1)
  })

  it('때가 되면 목록에 오르고, 열면 phase=review 새 세션이 열려 목록에서 빠진다', () => {
    const { a, r } = finished()
    const r1 = scheduleReview(r, a.session.id, T0 + 10)
    const due = T0 + 10 + 3 * DAY
    expect(reviewsDue(r1, due - 1)).toHaveLength(0)
    expect(reviewsDue(r1, due)).toHaveLength(1)
    const o = openSession(r1, { itemId: ITEM, steps: 14, now: due + 5, newId: () => 's-review' })
    expect(o.session).toMatchObject({ id: 's-review', phase: 'review', stage: 'open' })
    expect(reviewsDue(o.record, due + 6)).toHaveLength(0)
  })
})

describe('삭제 표시 — 병합으로 되살아나지 않는다', () => {
  it('한쪽에서 지운 세션은 다른 쪽 옛 사본과 합쳐도 지워진 채다', () => {
    const a = opened()
    const device1 = deleteSession(a.record, a.session.id, T0 + 5)
    const device2 = stepSession(a.record, a.session.id, 3, T0 + 9) // 더 늦게 고친 옛 사본
    const merged = mergeSessions(device1.sessions, device2.sessions)
    expect(merged).toHaveLength(1)
    expect(merged[0].deleted).toBe(true)
    expect(latestSession({ ...base(), sessions: merged }, ITEM)).toBeNull()
  })
})

describe('다기기 병합 — 단조 필드는 되돌리지 않는다', () => {
  it('한 기기는 마치고 다른 기기는 단계만 더 갔다 → finished · 먼저 정한 finishedAt', () => {
    const a = opened()
    const revealed = revealSession(a.record, a.session.id, 'independent', 'att-1', T0 + 1)
    const phoneDone = finishSession(revealed, a.session.id, T0 + 10)
    const laptopStepped = stepSession(revealed, a.session.id, 12, T0 + 20)
    const [m] = mergeSessions(phoneDone.sessions, laptopStepped.sessions)
    expect(m.stage).toBe('finished')
    expect(m.finishedAt).toBe(T0 + 10)
    expect(m.updatedAt).toBe(T0 + 20)
  })

  it('두 기기가 다르게 공개하면 먼저 공개한 쪽의 도움 수준 · 시도 id 가 이긴다(나중에 단계를 넘겨도)', () => {
    const a = opened()
    const phone = revealSession(a.record, a.session.id, 'viewed_first', null, T0 + 1) // 먼저 「모르겠어요」
    const laptop = revealSession(a.record, a.session.id, 'independent', 'att-late', T0 + 5)
    const phoneLater = stepSession(phone, a.session.id, 9, T0 + 50) // 나중에 단계만 넘김 — updatedAt 이 가장 크다
    for (const [x, y] of [[phoneLater, laptop], [laptop, phoneLater]] as const) {
      const [m] = mergeSessions(x.sessions, y.sessions)
      expect(m.help).toBe('viewed_first')
      expect(m.attempt).toBeUndefined()
      expect(m.revealedAt).toBe(T0 + 1)
      expect(m.step).toBe(9)
    }
  })

  it('sessions 를 모르는 옛 기기가 올려도(서버 병합) 세션이 사라지지 않는다', () => {
    const a = opened()
    const server: DissectionRecord = { ...a.record, updatedAt: T0 }
    const oldClient: DissectionRecord = { ...base(), predictions: [pred({ at: T0 + 50 })], updatedAt: T0 + 100 } // sessions 없음 · 더 최근
    const merged = mergeDissection(oldClient, server)
    expect(sessionsOf(merged)).toHaveLength(1)
    expect(sameRecord(merged, server)).toBe(false)
  })

  it('같은 시도 id 의 예측은 두 기기에서 와도 한 건', () => {
    const p = pred({ attempt: 'att-1', session: 's-1' })
    const a: DissectionRecord = { ...base(), predictions: [p], updatedAt: T0 + 1 }
    const b: DissectionRecord = { ...base(), predictions: [{ ...p }], updatedAt: T0 + 2 }
    expect(mergeDissection(a, b).predictions).toHaveLength(1)
  })

  it('다른 기기의 「마침」이 합쳐지면 updatedAt 이 같아도 다르다고 본다(E2E 6 회귀)', () => {
    const a = opened()
    const revealed = revealSession(a.record, a.session.id, 'independent', null, T0 + 1)
    const otherDevice = finishSession(revealed, a.session.id, T0 + 10)
    const mine: DissectionRecord = { ...stepSession(revealed, a.session.id, 4, T0 + 20), updatedAt: T0 + 20 }
    const merged = mergeDissection(mine, { ...otherDevice, updatedAt: T0 + 10 })
    expect(latestSession(merged, ITEM)?.updatedAt).toBe(T0 + 20) // 내 쪽과 같다
    expect(latestSession(merged, ITEM)?.stage).toBe('finished')
    expect(sameRecord(merged, mine)).toBe(false)
  })

  it('세션이 바뀌면 sameRecord 가 다르다고 본다(저장 누락 방지)', () => {
    const a = opened()
    const stepped = stepSession(a.record, a.session.id, 2, T0 + 1)
    expect(sameRecord(a.record, stepped)).toBe(false)
    expect(sameRecord(stepped, stepped)).toBe(true)
  })
})

describe('옛 기록 호환', () => {
  it('세션 없이 남은 극장 확정은 공개된 세션으로 이어 받는다 — 확정이면 independent', () => {
    const legacy = pred({ attempt: undefined })
    const r: DissectionRecord = { ...base(), predictions: [legacy] }
    const o = openSession(r, { itemId: ITEM, steps: 14, now: T0, newId: () => 's-1', legacy })
    expect(o.session).toMatchObject({ stage: 'revealed', help: 'independent' })
  })

  it('옛 「모르겠어요」 기록은 viewed_first 로 이어 받는다 · 저장값은 바꾸지 않는다', () => {
    const legacy = pred({ sentence: null, choice: null, confidence: 1, hit: false })
    const r: DissectionRecord = { ...base(), predictions: [legacy] }
    const o = openSession(r, { itemId: ITEM, steps: 14, now: T0, newId: () => 's-1', legacy })
    expect(o.session.help).toBe('viewed_first')
    expect(o.record.predictions[0]).toEqual(legacy)
  })

  it('모양이 깨진 세션은 읽을 때 거른다(나머지 기록은 그대로)', () => {
    const bad = { id: 'x', item: ITEM } as unknown as LearningSession
    const a = opened()
    const r: DissectionRecord = { ...a.record, sessions: [...(a.record.sessions ?? []), bad] }
    expect(sessionsOf(r)).toHaveLength(1)
    expect(mergeSessions(r.sessions, [])).toHaveLength(1)
  })
})

describe('적중률 — 「모르겠어요」는 분모 · 분자 모두에서 뺀다', () => {
  it('극장 skip 판정은 source=theater · sentence=null · choice=null 일 때만', () => {
    expect(isSkipPrediction(pred({ sentence: null, choice: null }))).toBe(true)
    expect(isSkipPrediction(pred({ sentence: null, choice: 3 }))).toBe(false)
    expect(isSkipPrediction(pred({ source: undefined, sentence: null, choice: null }))).toBe(false)
  })

  it('맞음 1 · 틀림 1 · 모르겠어요 2 → 50% (모르겠어요가 들어가면 25%)', () => {
    const r: DissectionRecord = {
      ...base(),
      predictions: [
        pred({ hit: true, at: T0 + 1 }),
        pred({ hit: false, at: T0 + 2 }),
        pred({ hit: false, sentence: null, choice: null, confidence: 1, at: T0 + 3 }),
        pred({ hit: false, sentence: null, choice: null, confidence: 1, at: T0 + 4 }),
      ],
    }
    expect(countedPredictions(r.predictions)).toHaveLength(2)
    expect(predictionStats(r, []).hit).toBe(50)
  })

  it('모르겠어요만 있으면 적중률은 없음(—)', () => {
    const r: DissectionRecord = { ...base(), predictions: [pred({ sentence: null, choice: null, confidence: 1 })] }
    expect(predictionStats(r, []).hit).toBeNull()
  })
})

describe('이어 보기 목록 · 상한', () => {
  it('하다 만 문항 = 공개 뒤 마치지 않았거나 단계를 넘긴 세션(열기만 한 것은 아님)', () => {
    const a = opened()
    expect(unfinishedSessions(a.record)).toHaveLength(0)
    const stepped = stepSession(a.record, a.session.id, 2, T0 + 1)
    expect(unfinishedSessions(stepped)).toHaveLength(1)
    const done = finishSession(revealSession(stepped, a.session.id, 'independent', null, T0 + 2), a.session.id, T0 + 3)
    expect(unfinishedSessions(done)).toHaveLength(0)
  })

  it('상한을 넘으면 마친 세션부터 빼고, 삭제 표시는 마지막까지 남긴다(부활 방지)', () => {
    const mk = (i: number, over: Partial<LearningSession> = {}): LearningSession => ({
      id: `s${i}`, sv: 1, item: `2026#${i}`, activity: 'theater', phase: 'practice', stage: 'open', help: null, step: 0, steps: 1, startedAt: T0 + i, updatedAt: T0 + i, ...over,
    })
    const list = [mk(1, { deleted: true }), mk(2, { stage: 'finished', finishedAt: T0 }), mk(3), mk(4)]
    expect(prune(list, 2).map((s) => s.id)).toEqual(['s1', 's4'])
  })

  it('열기만 하고 나간 복습 세션도 하다 만 문항에 남는다', () => {
    const a = opened()
    const done = scheduleReview(finishSession(revealSession(a.record, a.session.id, 'independent', null, T0 + 1), a.session.id, T0 + 2), a.session.id, T0 + 3)
    const due = T0 + 3 + 3 * DAY
    const o = openSession(done, { itemId: ITEM, steps: 14, now: due, newId: () => 's-rev' })
    expect(reviewsDue(o.record, due)).toHaveLength(0)
    expect(unfinishedSessions(o.record).map((s) => s.id)).toEqual(['s-rev'])
  })
})
