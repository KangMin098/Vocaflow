// apps/web/src/lib/csat/__tests__/reveal-gate.test.ts
import { describe, expect, it } from 'vitest'

import { emptyDissectionRecord } from '../dissect'
import { committedOf, grade, maskChip, maskName, toPrediction } from '../reveal-gate'

const KEY = { answer: 3, evidence: [3, 4] }

describe('공개 게이트 — 채점', () => {
  it('근거 문장과 정답을 따로 채점한다', () => {
    expect(grade({ sentence: 4, choice: 3, confidence: 3 }, KEY)).toMatchObject({ sentenceHit: true, choiceHit: true, overconfident: false })
    expect(grade({ sentence: 0, choice: 3, confidence: 2 }, KEY)).toMatchObject({ sentenceHit: false, choiceHit: true, overconfident: false })
  })
  it('확신 4 이상인데 틀리면 따로 표시한다', () => {
    expect(grade({ sentence: 3, choice: 1, confidence: 4 }, KEY).overconfident).toBe(true)
    expect(grade({ sentence: 3, choice: 1, confidence: 3 }, KEY).overconfident).toBe(false)
  })
  it('「모르겠어요」와 채점할 수 없는 문항은 null — 틀림으로 세지 않는다', () => {
    expect(grade({ sentence: null, choice: null, confidence: 1 }, KEY)).toMatchObject({ sentenceHit: null, choiceHit: null, overconfident: false })
    expect(grade({ sentence: 2, choice: 2, confidence: 5 }, { answer: null, evidence: [] })).toMatchObject({ sentenceHit: null, choiceHit: null, overconfident: false })
  })
})

describe('공개 게이트 — 기록', () => {
  it('출제 사고 화면의 예측만 게이트 통과로 본다(해부 세션 예측은 아니다)', () => {
    const rec = emptyDissectionRecord(1)
    rec.predictions.push({ item: 'M2706#31', type: 'R-BLANK', step: 1, hit: true, at: 1 })
    expect(committedOf(rec, 'M2706#31')).toBeNull()
    const commit = { sentence: 3, choice: 3, confidence: 5 }
    rec.predictions.push(toPrediction('M2706#31', 'R-BLANK', commit, grade(commit, KEY), 2))
    expect(committedOf(rec, 'M2706#31')).toMatchObject({ source: 'theater', sentence: 3, choice: 3, confidence: 5, hit: true })
  })
})

describe('공개 게이트 — 가리기', () => {
  it('이름만으로 답이 새는 단계를 가린다', () => {
    expect(maskName('오답 ② 지우기', '배제')).toBe('배제 · 확정 뒤 열림')
    expect(maskName('4번째 문장', '근거')).toBe('근거 · 확정 뒤 열림')
    expect(maskName('③가 왜 아닌가', '배제')).toBe('배제 · 확정 뒤 열림')
    expect(maskName('이 문항이 재는 것', '열기')).toBe('이 문항이 재는 것')
    expect(maskName('다시 풀 때의 절차', '정리')).toBe('다시 풀 때의 절차')
  })
  it('정답 칩만 가린다', () => {
    expect(maskChip('정답 ③')).toBe(true)
    expect(maskChip('정답 근거')).toBe(true)
    expect(maskChip('빈칸 추론')).toBe(false)
  })
})
