// apps/web/src/lib/csat/k-regression/__tests__/k-repro.test.ts
//
// 결함 재현 — open 결함마다 「결함이 지금 있다」를 직접 단언한다(it.fails 를 쓰지 않는다: it.fails 는 픽스처 누락 ·
// 오타 같은 아무 예외에도 통과해 재현력이 없다). 이 파일의 PASS = 결함 확인이지 해결이 아니다.
// 빨개지면 결함이 사라졌거나 재현 조건이 바뀐 것 → k-targets 를 켜서 확인하고 gaps.ts 를 fixed 로 옮긴다.
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys } from '@/lib/csat/judgment/evidence'
import { exposureOf, type ExposureEvent } from '@/lib/csat/map/v62/assessment-exposure'
import { loadExposureLedger, normalizedPassageKey } from '@/lib/csat/map/v62/exposure-ledger'

import { isOpen } from '../gaps'
import { fakeDb } from './fake-db'
import { ALL, fiveChoice, reveal, withCorrect } from './fixture'
import { latestFunctionDef } from './migrations'

if (isOpen('K2-a')) describe('REPRO K2-a 정답 키 별칭 미탐지', () => {
  it('정상 키는 잡는다(검사기 자체는 동작)', () => {
    expect(leakedAnswerKeys({ answer: 4 })).toEqual(['.answer'])
  })
  it.each(['is_correct', 'answer_no', 'correctIndex', 'correct_choice'])('%s 는 놓친다', (k) => {
    expect(leakedAnswerKeys({ [k]: 4 })).toEqual([])
  })
})

if (isOpen('K3-a')) describe('REPRO K3-a units 해시 미결속', () => {
  it('해시만 다른 공개 자료가 ok 로 통과한다', () => {
    const item = ALL[0].item
    expect(item.version.unitsHash).toMatch(/^[0-9a-f]{64}$/)
    const stale = { ...reveal(item), unitsHash: '0'.repeat(64) }
    expect(checkReveal(item, stale)).toMatchObject({ ok: true })
  })
})

if (isOpen('K4-a')) describe('REPRO K4-a 복수 정답 형태 미검사(2015#25 answers={4,5})', () => {
  it('answer=4 인데 4 · 5 가 모두 verdict=correct 인 자료를 통과시킨다', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [4, 5]))).toMatchObject({ ok: true })
  })
  it('answer=4 인데 verdict=correct 가 2번 하나뿐이어도 통과시킨다(정답 번호와 판정 불일치)', () => {
    expect(checkReveal(fiveChoice(), withCorrect(fiveChoice(), 4, [2]))).toMatchObject({ ok: true })
  })
})

const g2 = (itemRef: string): ExposureEvent => ({ itemRef, source: 'g2_attempt', taskKey: null, activity: null, phase: null, helpLevel: null, sessionId: null, contentHash: null, deleted: false })

if (isOpen('K6-a')) describe('REPRO K6-a 지문 공유 노출 기준 불일치', () => {
  it('앱: 다른 문항 · 같은 지문의 선행 노출을 exposed(samePassage) 로 판정한다', () => {
    const key = normalizedPassageKey({ text: 'a shared passage' })!
    expect(normalizedPassageKey({ text: 'A  shared\nPassage' })).toBe(key)
    const v = exposureOf('X#2', { status: 'ok', events: [g2('X#1')], passageKeys: { 'X#1': key, 'X#2': key } })
    expect(v).toMatchObject({ state: 'exposed', sameItem: false, samePassage: true })
  })
  const def = latestFunctionDef('learning_attempt_independence')
  // DB 쪽 재현은 P6 마이그레이션이 기준 스냅샷에 있을 때만 등록한다. 없으면 「기준에 없다」는 사실만 단언한다 —
  // 이 PASS 는 재현 PASS 가 아니다(재현은 NOT_RUN · RISK_MATRIX). 마이그레이션이 들어오면 아래 재현이 자동으로 등록된다.
  if (def) {
    it('DB: 독립 판정의 노출 조건이 item_ref 일치만 보고 지문을 보지 않는다', () => {
      const exposed = def.sql.slice(def.sql.indexOf('exposed as'))
      expect(exposed).toMatch(/e\.item_ref\s*=\s*a\.item_ref/)
      expect(exposed).not.toMatch(/passage/i)
    })
  } else {
    it('NOT_IN_BASELINE: 기준 스냅샷에 learning_attempt_independence 마이그레이션이 없다(DB 재현 NOT_RUN)', () => {
      expect(def).toBeNull()
    })
  }
})

if (isOpen('K6-b')) describe('REPRO K6-b 앱 노출 원장이 P6 정답 노출을 읽지 않는다', () => {
  it('learning_exposures 에 정답 직접 노출이 있어도 읽지 않고, 그 문항은 unseen 이다', async () => {
    const { db, read } = fakeDb({
      learning_exposures: [{ item_ref: '2015#25', kind: 'answer_direct', received_at: '2026-10-24T00:00:00Z' }],
      csat_items: [{ exam_id: '2015', no: 25, passage: { text: 'p' } }],
    })
    const ledger = await loadExposureLedger(db, 'u1', ['2015#25'])
    expect(ledger.status).toBe('ok')
    expect(read).toContain('learning_task_attempts')
    expect(read).not.toContain('learning_exposures')
    expect(exposureOf('2015#25', ledger)).toEqual({ state: 'unseen' })
  })
})
