// apps/web/src/lib/csat/k-regression/__tests__/k-targets.test.ts
//
// 목표 동작 — 결함이 고쳐진 뒤 지켜야 할 계약. 목표는 TARGETS 표에 결함 id 별로 보관한다.
//   fixed 결함의 목표 → 테스트로 등록되어 실제로 돈다(회귀 검사).
//   open  결함의 목표 → 등록하지 않는다(조건부 미실행 · skip 으로도 PASS 로도 세지 않는다). 대신 「목표 보관 정합」 이 표 자체를 단언한다.
// 실행 결속: 등록된 목표는 expect.hasAssertions 로 단언 없는 본문을 실패시키고, 끝까지 돈 횟수를 센다.
// 파일 끝 「목표 실행 결속」 이 fixed 결함마다 실행된 목표 ≥1 을 확인한다 — 표에 없는 it · 빈 본문 · 목표 없는 fixed 는 실패한다.
// 한계: 의미 없는 단언(expect(true).toBe(true))까지 기계로 막지는 않는다 — 목표 변경은 리뷰 대상이다.
// 조건부 미실행 목표 수 · 이름은 RISK_MATRIX 에 따로 적는다(실행하지 않은 것을 PASS 로 보고하지 않는다).
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys } from '@/lib/csat/judgment/evidence'
import { exposureOf } from '@/lib/csat/map/v62/assessment-exposure'
import { loadExposureLedger } from '@/lib/csat/map/v62/exposure-ledger'

import { type GapId, K_GAPS, statusOf } from '../gaps'
import { fakeDb } from './fake-db'
import { ALL, fiveChoice, reveal, withCorrect } from './fixture'

type Target = { name: string; fn: () => void | Promise<void> }

/** 목표가 아직 설계되지 않은 결함 — 고치는 owner 가 목표를 넣는다. 이 목록에 있는 동안 fixed 로 바꿀 수 없다 */
export const NOT_IMPLEMENTED: readonly GapId[] = ['K6-a']

export const TARGETS: Partial<Record<GapId, Target[]>> = {
  'K2-a': ['is_correct', 'answer_no', 'correctIndex', 'correct_choice'].map((k) => ({
    name: `${k} 를 중첩 객체 · 배열 안에서도 잡는다`,
    fn: () => { expect(leakedAnswerKeys({ item: { choices: [{ n: 1 }, { n: 2, [k]: 4 }] } })).toEqual([`.item.choices[1].${k}`]) },
  })),
  'K3-a': [
    { name: '해시가 다른 공개 자료는 version 으로 거절한다', fn: () => {
      const item = ALL[0].item
      expect(checkReveal(item, { ...reveal(item), unitsHash: '0'.repeat(64) })).toEqual({ ok: false, reason: 'version' })
    } },
    { name: '해시가 같으면 통과한다', fn: () => {
      const item = ALL[0].item
      expect(checkReveal(item, { ...reveal(item), unitsHash: item.version.unitsHash }).ok).toBe(true)
    } },
  ],
  'K4-a': [
    { name: 'answer 와 verdict=correct 가 어긋나면 거절한다', fn: () => { expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [2])).ok).toBe(false) } },
    { name: '단일 정답 문항(answers 없음)에서 verdict=correct 가 둘이면 거절한다', fn: () => { expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4, 5])).ok).toBe(false) } },
    { name: '정상 단일 정답은 통과한다', fn: () => { expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4])).ok).toBe(true) } },
    { name: '정상 복수 정답(answers={4,5} · 판정 4,5)은 통과한다', fn: () => { expect(checkReveal(fiveChoice(), { ...withCorrect(fiveChoice(), 4, [4, 5]), answers: [4, 5] }).ok).toBe(true) } },
  ],
  // K6-a: NOT_IMPLEMENTED. 같은 입력(같은 사용자 · 다른 문항 · 같은 지문 · 선행 노출)에서 DB learning_attempt_independence 와
  // 앱 exposureOf 가 같은 답을 내는지 PGlite 로 비교하는 목표를 고치는 owner 가 넣고 NOT_IMPLEMENTED 에서 뺀다.
  'K6-b': [
    { name: 'learning_exposures 의 정답 직접 노출이 있으면 그 문항은 exposed 다', fn: async () => {
      const { db, read } = fakeDb({
        learning_exposures: [{ item_ref: '2015#25', kind: 'answer_direct', received_at: '2026-10-24T00:00:00Z' }],
        csat_items: [{ exam_id: '2015', no: 25, passage: { text: 'p' } }],
      })
      const ledger = await loadExposureLedger(db, 'u1', ['2015#25'])
      expect(read).toContain('learning_exposures')
      expect(exposureOf('2015#25', ledger).state).toBe('exposed')
    } },
  ],
}

const ids = Object.keys(K_GAPS) as GapId[]
const ran = new Map<GapId, number>()

for (const id of ids.filter((x) => statusOf(x) === 'fixed')) {
  describe(`TARGET ${id}`, () => {
    for (const t of TARGETS[id] ?? []) {
      it(`TARGET ${id} ${t.name}`, async () => {
        expect.hasAssertions()
        await t.fn()
        ran.set(id, (ran.get(id) ?? 0) + 1)
      })
    }
  })
}

describe('목표 보관 정합', () => {
  it('모든 결함은 목표가 1개 이상 보관됐거나 NOT_IMPLEMENTED 에 있다(둘 다는 아니다)', () => {
    for (const id of ids) {
      const n = TARGETS[id]?.length ?? 0
      if (NOT_IMPLEMENTED.includes(id)) expect(n, `${id}: NOT_IMPLEMENTED 인데 목표가 있다 — 목록에서 빼라`).toBe(0)
      else expect(n, `${id}: 보관된 목표가 없다`).toBeGreaterThan(0)
    }
  })
  it('표의 키는 모두 등록된 결함이다', () => {
    for (const k of Object.keys(TARGETS)) expect(ids, k).toContain(k)
  })
  it('NOT_IMPLEMENTED 결함은 fixed 로 바꿀 수 없다', () => {
    for (const id of NOT_IMPLEMENTED) expect(statusOf(id), `${id}: 목표 없이 fixed`).toBe('open')
  })
})

// 같은 파일의 테스트는 선언 순서대로 돈다 — 마지막에 결속을 확인한다(afterAll 은 등록 테스트가 없으면 돌지 않아 쓰지 않는다)
describe('목표 실행 결속', () => {
  it('fixed 결함은 단언 있는 목표가 1개 이상 실행됐고, open 결함은 목표가 실행되지 않았다', () => {
    for (const id of ids) {
      const n = ran.get(id) ?? 0
      if (statusOf(id) === 'fixed') expect(n, `${id} 는 fixed 인데 실행된 목표가 0개다`).toBeGreaterThan(0)
      else expect(n, `${id} 는 open 인데 목표가 실행됐다`).toBe(0)
    }
  })
})
