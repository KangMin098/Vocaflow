// apps/web/src/lib/csat/k-regression/__tests__/k-targets.test.ts
//
// 목표 동작 — 결함이 고쳐진 뒤 지켜야 할 계약. open 결함은 skip(보고서에 skipped 로 남는다 · PASS 아님).
// owner 가 고치고 gaps.ts 를 fixed 로 바꾸면 이 파일이 회귀 검사로 돈다. 계약 모양(필드 이름)은 고치는 owner 가 정하므로
// 여기서는 관찰 가능한 결과(거절 여부 · 탐지 여부)만 단언한다.
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys } from '@/lib/csat/judgment/evidence'

import { exposureOf } from '@/lib/csat/map/v62/assessment-exposure'
import { loadExposureLedger } from '@/lib/csat/map/v62/exposure-ledger'

import { isOpen } from '../gaps'
import { fakeDb } from './fake-db'
import { ALL, fiveChoice, reveal, withCorrect } from './fixture'

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
  it('단일 정답 문항(answers 없음)에서 verdict=correct 가 둘이면 거절한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4, 5])).ok).toBe(false)
  })
  it('정상 단일 정답은 통과한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4])).ok).toBe(true)
  })
  it('정상 복수 정답(answers={4,5} · 판정 4,5)은 통과한다', () => {
    expect(checkReveal(fiveChoice(), { ...withCorrect(fiveChoice(), 4, [4, 5]), answers: [4, 5] }).ok).toBe(true)
  })
})

// 문자열 검사(SQL 에 'passage' 낱말이 있는가)는 주석 한 줄로 통과해 목표 검사가 될 수 없다(T-0155 K-R1).
// 목표는 같은 입력(같은 사용자 · 다른 문항 · 같은 지문 · 선행 노출)에서 DB 함수와 앱 판정이 같은 답을 내는지다.
// DB 쪽 행동 비교는 P6 스키마를 PGlite 에 올려야 하므로 고치는 owner 가 그 테스트를 이 자리에 넣는다 — 그 전에는 todo(PASS 아님).
describe.skipIf(isOpen('K6-a'))('TARGET K6-a 지문 공유 노출 기준 일치', () => {
  it.todo('PGlite: 지문 공유 문항 선행 노출 뒤 시도 → learning_attempt_independence = after_exposure, 앱 exposureOf = exposed')
})

describe.skipIf(isOpen('K6-b'))('TARGET K6-b 앱 노출 원장이 P6 정답 노출을 읽는다', () => {
  it('learning_exposures 의 정답 직접 노출이 있으면 그 문항은 exposed 다', async () => {
    const { db, read } = fakeDb({
      learning_exposures: [{ item_ref: '2015#25', kind: 'answer_direct', received_at: '2026-10-24T00:00:00Z' }],
      csat_items: [{ exam_id: '2015', no: 25, passage: { text: 'p' } }],
    })
    const ledger = await loadExposureLedger(db, 'u1', ['2015#25'])
    expect(read).toContain('learning_exposures')
    expect(exposureOf('2015#25', ledger).state).toBe('exposed')
  })
})
