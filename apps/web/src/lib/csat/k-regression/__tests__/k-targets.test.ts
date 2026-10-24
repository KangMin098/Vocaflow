// apps/web/src/lib/csat/k-regression/__tests__/k-targets.test.ts
//
// 목표 동작 — 결함이 고쳐진 뒤 지켜야 할 계약. open 결함은 skip(보고서에 skipped 로 남는다 · PASS 아님).
// owner 가 고치고 gaps.ts 를 fixed 로 바꾸면 이 파일이 회귀 검사로 돈다. 계약 모양(필드 이름)은 고치는 owner 가 정하므로
// 여기서는 관찰 가능한 결과(거절 여부 · 탐지 여부)만 단언한다.
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys } from '@/lib/csat/judgment/evidence'

import { isOpen } from '../gaps'
import { ALL, fiveChoice, reveal, withCorrect } from './fixture'
import { latestFunctionDef } from './migrations'

describe.skipIf(isOpen('K2-a'))('TARGET K2-a 정답 키 별칭 탐지', () => {
  it.each(['is_correct', 'answer_no', 'correctIndex', 'correct_choice'])('%s 를 잡는다', (k) => {
    expect(leakedAnswerKeys({ [k]: 4 })).not.toEqual([])
  })
})

describe.skipIf(isOpen('K3-a'))('TARGET K3-a units 해시 결속', () => {
  it('해시가 다른 공개 자료는 version 으로 거절한다', () => {
    const item = ALL[0].item
    expect(checkReveal(item, { ...reveal(item), unitsHash: '0'.repeat(64) })).toEqual({ ok: false, reason: 'version' })
  })
  it('해시가 같으면 통과한다', () => {
    const item = ALL[0].item
    expect(checkReveal(item, { ...reveal(item), unitsHash: item.version.unitsHash }).ok).toBe(true)
  })
})

describe.skipIf(isOpen('K4-a'))('TARGET K4-a 정답 번호 ↔ 선지 판정 일치', () => {
  it('answer 와 verdict=correct 가 어긋나면 거절한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [2])).ok).toBe(false)
  })
  it('단일 정답 문항에서 verdict=correct 가 둘이면 거절한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4, 5])).ok).toBe(false)
  })
})

describe.skipIf(isOpen('K6-a'))('TARGET K6-a 지문 공유 노출 기준 일치', () => {
  it('DB 독립 판정의 노출 조건이 지문 공유 문항까지 본다', () => {
    const def = latestFunctionDef('learning_attempt_independence')
    expect(def, 'P6 마이그레이션이 기준 스냅샷에 있어야 한다').not.toBeNull()
    expect(def!.sql.slice(def!.sql.indexOf('exposed as'))).toMatch(/passage/i)
  })
})
