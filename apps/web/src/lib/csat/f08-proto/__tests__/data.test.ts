// apps/web/src/lib/csat/f08-proto/__tests__/data.test.ts
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { buildItem, buildReveal, splitSentences } from '../data'
import { answerLeaks } from '../leak'
import snapshot from '../snapshot-2026-34.json'

describe('F08 프로토타입 데이터', () => {
  it('스냅숏 원문 해시가 기록과 같고 문장 분할이 원문을 그대로 복원한다', () => {
    expect(createHash('sha256').update(snapshot.passage).digest('hex')).toBe(snapshot.passage_sha256)
    const s = splitSentences(snapshot.passage)
    expect(s).toHaveLength(7)
    expect(s.join(' ')).toBe(snapshot.passage)
  })

  it('공개 전 묶음에 정답 번호·정답 선지 구절·판정이 없다', () => {
    const r = buildItem('2026#34')
    expect(r.state).toBe('ready')
    if (r.state !== 'ready') return
    const json = JSON.stringify({ ...r.item, choices: [] })
    expect(answerLeaks(json, 3, snapshot.choices[2])).toEqual([])
    expect(json).not.toMatch(/"answer"|isAnswer|selected_as_answer|decisive/)
    expect(r.item.blankSentence).toBe(7)
    // 정답을 말하는 c4 이후 큐는 잠겨 있다
    expect(r.item.lecture.state === 'ready' && r.item.lecture.cues.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('m1 노트의 정답 예시는 빠지고 부정 범위 설명은 남는다', () => {
    const r = buildItem('2026#34')
    if (r.state !== 'ready') throw new Error(r.state)
    const m1 = r.item.meanings.find((m) => m.id === 'm1')!
    expect(m1.scope).toBe('negation')
    expect(m1.scopeNote).toContain('표현 전체')
    expect(m1.scopeNote).not.toContain('restraint')
  })

  it('누출 검사기는 정답 번호 문구와 정답 선지 구절을 잡는다', () => {
    expect(answerLeaks('정답은 삼 번입니다', 3, snapshot.choices[2])).not.toEqual([])
    expect(answerLeaks('(예: understood as a restraint)', 3, snapshot.choices[2])).not.toEqual([])
    expect(answerLeaks('7번 문장의 If 조건', 3, snapshot.choices[2])).toEqual([])
  })

  it('검증 원문이 없는 문항은 조립을 거부한다', () => {
    expect(buildItem('2026#35').state).toBe('no-source')
    expect(buildReveal('2026#35')).toBeNull()
  })

  it('공개 묶음은 공식 정답 3과 다섯 선지 판정을 준다', () => {
    const r = buildReveal('2026#34')!
    expect(r.answer).toBe(3)
    expect(r.verdicts.map((v) => v.isAnswer)).toEqual([false, false, true, false, false])
    expect(r.verdicts[1].truth).toBe('unknown')
    expect(r.cues[0].id).toBe('c4')
  })
})
