// apps/web/src/lib/csat/k-regression/__tests__/k-contracts.test.ts
//
// 대량작업 K — 기출분석 통합 회귀 하네스(계약 단위). 제품 코드를 고치지 않고 공개 계약 함수만 불러 재발 사례를 고정한다.
// `it` = 지금 지켜지는 계약(PASS). `it.fails` = 확인된 결함(KNOWN_GAP) — 결함이 고쳐지면 이 테스트가 빨개져
// RISK_MATRIX.md 의 상태를 PASS 로 옮기라고 알린다. 제품에 아직 없는 동작은 여기서 검증하지 않는다(NOT_READY 는 표에만).
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys, refsOf, splitRefs } from '@/lib/csat/judgment/evidence'
import { FIXTURE_TYPES, itemsOf, revealOf } from '@/lib/csat/judgment/fixtures'
import type { JudgmentItem, RevealData } from '@/lib/csat/judgment/types'
import { normalizedPassageKey } from '@/lib/csat/map/v62/exposure-ledger'

const ALL = FIXTURE_TYPES.flatMap((t) => itemsOf(t).map((item) => ({ t, item })))

const reveal = (item: JudgmentItem, o: Partial<RevealData> = {}): RevealData => ({
  id: item.id,
  analysisVersion: item.version.analysisVersion,
  unitsVersion: item.version.unitsVersion,
  answer: 1,
  choices: item.choices.map((_, i) => (i === 0 ? { n: 1, verdict: 'correct' as const, why_correct: 'x' } : { n: i + 1, verdict: 'distractor' as const })),
  ...o,
})

describe('K2 공개 전 정답 누출 — 초기 props', () => {
  it('D 픽스처 13건의 초기 JudgmentItem 에 정답 키가 없다', () => {
    expect(ALL.length).toBe(13)
    for (const { item } of ALL) expect(leakedAnswerKeys(item), item.id).toEqual([])
  })

  it('정답 키는 깊이와 배열 안에서도 잡힌다', () => {
    expect(leakedAnswerKeys({ a: [{ b: { answerLocus: {} } }] })).toEqual(['.a[0].b.answerLocus'])
  })

  // 학습 기록 열 이름(learning_task_attempts.is_correct)·흔한 별칭은 목록 밖이라 통과한다
  it.fails('KNOWN_GAP K2-a: is_correct · answer_no · correctIndex 별칭을 잡는다', () => {
    expect(leakedAnswerKeys({ is_correct: true })).not.toEqual([])
    expect(leakedAnswerKeys({ answer_no: 4 })).not.toEqual([])
    expect(leakedAnswerKeys({ correctIndex: 3 })).not.toEqual([])
  })
})

describe('K3 판본 · 해시 불일치 — 잘못된 근거 거절', () => {
  const item = ALL[0].item

  it('분석 판본이 다르면 version 으로 거절', () => {
    expect(checkReveal(item, reveal(item, { analysisVersion: item.version.analysisVersion + 1 }))).toEqual({ ok: false, reason: 'version' })
  })
  it('units 판본이 다르면 version 으로 거절', () => {
    expect(checkReveal(item, reveal(item, { unitsVersion: item.version.unitsVersion + 1 }))).toEqual({ ok: false, reason: 'version' })
  })
  it('다른 문항 id 는 거절', () => {
    expect(checkReveal(item, reveal(item, { id: ALL[1].item.id })).ok).toBe(false)
  })
  it('선지 수가 다르거나 정답이 범위를 벗어나면 shape 로 거절', () => {
    expect(checkReveal(item, reveal(item, { answer: item.choices.length + 1 }))).toEqual({ ok: false, reason: 'shape' })
    expect(checkReveal(item, reveal(item, { choices: [] }))).toEqual({ ok: false, reason: 'shape' })
    expect(checkReveal(item, null)).toEqual({ ok: false, reason: 'shape' })
  })
  it('원문에 없는 [uN] 참조는 끊긴 링크로 표시(known=false), refsOf 에서 빠진다', () => {
    const parts = splitRefs('근거 [u1] 와 [u999]', item.units)
    expect(parts.filter((p) => p.kind === 'ref').map((p) => p.kind === 'ref' && p.known)).toEqual([true, false])
    expect(refsOf('[u999] [u1] [u1]', item.units)).toEqual(['u1'])
  })

  // RevealData 에 unitsHash 가 없어 같은 번호 · 다른 본문(재분절 뒤 번호 재사용)을 구별하지 못한다
  it.fails('KNOWN_GAP K3-a: units 해시가 다른 공개 자료를 거절한다', () => {
    const stale = { ...reveal(item), unitsHash: '0'.repeat(64) }
    expect(checkReveal(item, stale).ok).toBe(false)
  })

  it('실제 픽스처 공개 자료 13건은 모두 자기 문항 판본과 맞는다', async () => {
    for (const { t, item: it2 } of ALL) expect(checkReveal(it2, await revealOf(t, it2.id)).ok, it2.id).toBe(true)
  })
})

describe('K4 공식 복수 정답(2015#25 answers={4,5}) × 단일 정답 계약', () => {
  // 개발 DB 실측(2026-10-24): csat_items 2015#25 answer=4 · answers={4,5} — 복수 정답 문항은 이 1건
  const five = ALL.find(({ item }) => item.choices.length === 5)!.item

  it.fails('KNOWN_GAP K4-a: 정답 번호와 어긋나는 verdict=correct 선지가 둘이면 거절한다', () => {
    const r = reveal(five, {
      answer: 4,
      choices: five.choices.map((_, i) => (i === 3 || i === 4 ? { n: i + 1, verdict: 'correct' as const, why_correct: 'x' } : { n: i + 1, verdict: 'distractor' as const })),
    })
    expect(checkReveal(five, r).ok).toBe(false)
  })

  // 남는 키는 통과시킨다 — 복수 정답 칸을 더해도 거절되지 않는다(타입 RevealData 에는 아직 없다)
  it('추가 answers 칸이 있어도 판본 검사는 그대로 통과한다', () => {
    const c = checkReveal(five, { ...reveal(five, { answer: 4 }), answers: [4, 5] })
    expect(c.ok).toBe(true)
  })
})

describe('K6 노출 원장 지문 식별', () => {
  it('공백 · 대소문자만 다른 지문은 같은 키(공유 지문 노출로 본다)', () => {
    expect(normalizedPassageKey('The  cat\nsat')).toBe(normalizedPassageKey('the cat sat'))
  })
  it('빈 지문은 키가 없다(식별 불가 → unknown, 미노출로 세지 않는다)', () => {
    for (const v of ['', [], {}, null, undefined]) expect(normalizedPassageKey(v)).toBeNull()
  })
})
