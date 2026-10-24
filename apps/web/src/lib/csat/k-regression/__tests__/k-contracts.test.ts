// apps/web/src/lib/csat/k-regression/__tests__/k-contracts.test.ts
//
// 대량작업 K — 지금 지켜지는 계약(PASS 만). 결함 재현은 k-repro, 고친 뒤의 목표 동작은 k-targets 에 있다.
// 제품 코드를 고치지 않고 공개 계약 함수만 부른다.
import { describe, expect, it } from 'vitest'

import { checkReveal, leakedAnswerKeys, refsOf, splitRefs } from '@/lib/csat/judgment/evidence'
import { revealOf } from '@/lib/csat/judgment/fixtures'
import { normalizedPassageKey } from '@/lib/csat/map/v62/exposure-ledger'

import { ALL, containsText, fiveChoice, reveal, withCorrect } from './fixture'

describe('K2 공개 전 정답 누출 — 초기 props', () => {
  it('D 픽스처 13건의 초기 JudgmentItem 에 정답 키가 없다', () => {
    expect(ALL.length).toBe(13)
    for (const { item } of ALL) expect(leakedAnswerKeys(item), item.id).toEqual([])
  })

  it('정답 키는 깊이와 배열 안에서도 잡힌다', () => {
    expect(leakedAnswerKeys({ a: [{ b: { answerLocus: {} } }] })).toEqual(['.a[0].b.answerLocus'])
  })

  // 키 이름이 아니라 값으로 — 공개 자료의 정답 근거 · 소거 문장이 초기 자료의 어떤 문자열 값에도 들어 있지 않다.
  // JSON 직렬화 문자열을 검색하면 따옴표 · 줄바꿈 · 역슬래시가 이스케이프돼 누출을 놓친다(T-0155 K-R3) — 값을 순회한다
  it('검사기 자가 검증: 따옴표 · 줄바꿈이 든 정답 근거를 심으면 잡는다', () => {
    const s = '정답은 "the key"\n이다 \\ 근거'
    expect(containsText({ a: [{ note: `앞 ${s} 뒤` }] }, s)).toBe(true)
    expect(containsText({ a: [{ note: '무관' }] }, s)).toBe(false)
  })

  it('공개 자료의 정답 근거 · 오답 소거 문장이 초기 JudgmentItem 문자열 값에 없다', async () => {
    let checked = 0
    for (const { t, item } of ALL) {
      const initial = item
      const r = await revealOf(t, item.id)
      for (const c of r.choices) {
        const texts = c.verdict === 'correct' ? [c.why_correct] : [c.how_to_reject, c.why_tempting]
        for (const s of texts) {
          if (!s || s.length < 12) continue
          checked++
          expect(containsText(initial, s), `${item.id} 선지 ${c.n}`).toBe(false)
        }
      }
    }
    expect(checked).toBeGreaterThan(13)
  })
})

describe('K3 판본 불일치 — 잘못된 근거 거절', () => {
  const item = ALL[0].item

  it('분석 판본이 다르면 version 으로 거절', () => {
    expect(checkReveal(item, reveal(item, { analysisVersion: item.version.analysisVersion + 1 }))).toEqual({ ok: false, reason: 'version' })
  })
  it('units 판본이 다르면 version 으로 거절', () => {
    expect(checkReveal(item, reveal(item, { unitsVersion: item.version.unitsVersion + 1 }))).toEqual({ ok: false, reason: 'version' })
  })
  it('다른 문항 id 는 version 으로 거절', () => {
    expect(checkReveal(item, reveal(item, { id: ALL[1].item.id }))).toEqual({ ok: false, reason: 'version' })
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
  it('실제 픽스처 공개 자료 13건은 모두 자기 문항 판본과 맞는다', async () => {
    for (const { t, item: it2 } of ALL) expect(checkReveal(it2, await revealOf(t, it2.id)).ok, it2.id).toBe(true)
  })
})

describe('K4 복수 정답 칸', () => {
  // 남는 키는 통과시킨다 — 복수 정답 칸을 더해도 판본 검사가 거절하지는 않는다(타입 RevealData 에는 아직 없다)
  // 입력 자체가 일관돼야 한다 — 정답 4 · 판정 4,5 · answers {4,5}(2015#25 모양). 수정 뒤에도 수용돼야 하는 정상 복수 정답이다(T-0155 K-R2)
  it('일관된 복수 정답 자료(answers={4,5} · 판정 4,5)는 판본 검사를 통과한다', () => {
    const five = fiveChoice()
    expect(checkReveal(five, { ...withCorrect(five, 4, [4, 5]), answers: [4, 5] }).ok).toBe(true)
  })
})

describe('K6 노출 원장 지문 식별(앱)', () => {
  it('공백 · 대소문자만 다른 지문은 같은 키(공유 지문 노출로 본다)', () => {
    expect(normalizedPassageKey('The  cat\nsat')).toBe(normalizedPassageKey('the cat sat'))
  })
  it('빈 지문은 키가 없다(식별 불가 → unknown, 미노출로 세지 않는다)', () => {
    for (const v of ['', [], {}, null, undefined]) expect(normalizedPassageKey(v)).toBeNull()
  })
})
