// apps/web/src/lib/csat/k-regression/__tests__/k-targets.test.ts
//
// 목표 동작 — 결함이 고쳐진 뒤 지켜야 할 계약. open 결함의 목표는 skip(보고서에 skipped 로 남는다 · PASS 아님).
// owner 가 고치고 gaps.ts 를 fixed 로 바꾸면 회귀 검사로 돈다. 계약 모양(필드 이름)은 고치는 owner 가 정하므로
// 여기서는 관찰 가능한 결과(거절 여부 · 탐지 여부)만 단언한다.
//
// 목표는 반드시 target(id, …) 로 등록한다. target 은 단언 없는 본문을 실패시키고(expect.hasAssertions) 실제로 끝까지 돈 횟수를 센다.
// 파일 끝 「목표 실행 결속」 이 fixed 결함마다 실행된 목표가 1개 이상인지 확인한다 — todo · 빈 본문 · target 을 거치지 않은 it 은
// 세지 않으므로 fixed 로 바꿔도 PASS 가 되지 않는다(T-0155 K-R1: 소스 문자열로 실행 가능성을 판정하던 가드는 우회됐다).
// 한계: 의미 없는 단언(expect(true).toBe(true))까지 기계로 막지는 않는다 — 목표 변경은 리뷰 대상이다.
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys } from '@/lib/csat/judgment/evidence'
import { exposureOf } from '@/lib/csat/map/v62/assessment-exposure'
import { loadExposureLedger } from '@/lib/csat/map/v62/exposure-ledger'

import { type GapId, isOpen, K_GAPS } from '../gaps'
import { fakeDb } from './fake-db'
import { ALL, fiveChoice, reveal, withCorrect } from './fixture'

const ran = new Map<GapId, number>()

function target(id: GapId, name: string, fn: () => void | Promise<void>) {
  it.skipIf(isOpen(id))(`TARGET ${id} ${name}`, async () => {
    expect.hasAssertions()
    await fn()
    ran.set(id, (ran.get(id) ?? 0) + 1)
  })
}

describe('TARGET K2-a 정답 키 별칭 탐지', () => {
  for (const k of ['is_correct', 'answer_no', 'correctIndex', 'correct_choice']) {
    target('K2-a', `${k} 를 잡는다`, () => {
      expect(leakedAnswerKeys({ [k]: 4 })).not.toEqual([])
    })
  }
})

describe('TARGET K3-a units 해시 결속', () => {
  target('K3-a', '해시가 다른 공개 자료는 version 으로 거절한다', () => {
    const item = ALL[0].item
    expect(checkReveal(item, { ...reveal(item), unitsHash: '0'.repeat(64) })).toEqual({ ok: false, reason: 'version' })
  })
  target('K3-a', '해시가 같으면 통과한다', () => {
    const item = ALL[0].item
    expect(checkReveal(item, { ...reveal(item), unitsHash: item.version.unitsHash }).ok).toBe(true)
  })
})

describe('TARGET K4-a 정답 번호 ↔ 선지 판정 일치', () => {
  target('K4-a', 'answer 와 verdict=correct 가 어긋나면 거절한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [2])).ok).toBe(false)
  })
  target('K4-a', '단일 정답 문항(answers 없음)에서 verdict=correct 가 둘이면 거절한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4, 5])).ok).toBe(false)
  })
  target('K4-a', '정상 단일 정답은 통과한다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4])).ok).toBe(true)
  })
  target('K4-a', '정상 복수 정답(answers={4,5} · 판정 4,5)은 통과한다', () => {
    expect(checkReveal(fiveChoice(), { ...withCorrect(fiveChoice(), 4, [4, 5]), answers: [4, 5] }).ok).toBe(true)
  })
})

// K6-a 목표는 아직 없다(NOT_IMPLEMENTED). 같은 입력(같은 사용자 · 다른 문항 · 같은 지문 · 선행 노출)에서
// DB learning_attempt_independence 와 앱 exposureOf 가 같은 답을 내는지를 PGlite 로 비교하는 target('K6-a', …) 를
// 고치는 owner 가 여기에 넣는다. 그 전에 fixed 로 바꾸면 아래 결속 검사가 실패한다.

describe('TARGET K6-b 앱 노출 원장이 P6 정답 노출을 읽는다', () => {
  target('K6-b', 'learning_exposures 의 정답 직접 노출이 있으면 그 문항은 exposed 다', async () => {
    const { db, read } = fakeDb({
      learning_exposures: [{ item_ref: '2015#25', kind: 'answer_direct', received_at: '2026-10-24T00:00:00Z' }],
      csat_items: [{ exam_id: '2015', no: 25, passage: { text: 'p' } }],
    })
    const ledger = await loadExposureLedger(db, 'u1', ['2015#25'])
    expect(read).toContain('learning_exposures')
    expect(exposureOf('2015#25', ledger).state).toBe('exposed')
  })
})

// 같은 파일의 테스트는 선언 순서대로 돈다 — 마지막에 결속을 확인한다. afterAll 은 파일의 테스트가 모두 skip 이면 돌지 않아
// 목표 없는 fixed 전환을 놓쳤다(변이 시험) — 항상 실행되는 it 으로 둔다
describe('목표 실행 결속', () => {
  it('fixed 결함은 단언 있는 목표가 1개 이상 실행됐고, open 결함은 목표가 실행되지 않았다', () => {
    for (const [id, g] of Object.entries(K_GAPS) as [GapId, (typeof K_GAPS)[GapId]][]) {
      const n = ran.get(id) ?? 0
      if (g.status === 'fixed') expect(n, `${id} 는 fixed 인데 실행된 목표가 0개다 — 단언 있는 target('${id}', …) 가 필요하다`).toBeGreaterThan(0)
      else expect(n, `${id} 는 open 인데 목표가 실행됐다`).toBe(0)
    }
  })
})
