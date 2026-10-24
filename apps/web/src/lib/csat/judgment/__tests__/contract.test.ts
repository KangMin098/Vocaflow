// apps/web/src/lib/csat/judgment/__tests__/contract.test.ts
// D9 공개 상태 · 데이터 계약 정적 검증 — 격리 계약만 본다. 실제 제품 서버 공개 제어는 여기서 검증되지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkReveal, leakedAnswerKeys, refsOf, splitRefs, unitsAtIndex } from '../evidence'
import { FIXTURE_TYPES, itemsOf, revealOf } from '../fixtures'

const COMPONENTS = path.resolve(__dirname, '../../../../components/csat/judgment')
const sources = () =>
  fs.readdirSync(COMPONENTS, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(tsx?|mts)$/.test(f) && !f.includes('__tests__'))
    .map((f) => ({ f, text: fs.readFileSync(path.join(COMPONENTS, f), 'utf8') }))

describe('공개 전 문항 자료', () => {
  for (const type of FIXTURE_TYPES) {
    it(`${type}: items 에 정답을 확정하는 키가 없다`, () => {
      const items = itemsOf(type)
      expect(items.length).toBeGreaterThan(0)
      expect(leakedAnswerKeys(items)).toEqual([])
    })
    it(`${type}: 실제 원문 단위 · 선지 5개 · 판본이 있다`, () => {
      for (const it of itemsOf(type)) {
        expect(it.choices).toHaveLength(5)
        expect(it.units.length).toBeGreaterThan(1)
        expect(it.version.unitsHash).toMatch(/\S/)
        expect(new Set(it.units.map((u) => u.id)).size).toBe(it.units.length)
      }
    })
    it(`${type}: 공개 자료의 [uN] 참조가 모두 같은 판본 원문에 있다`, async () => {
      for (const it of itemsOf(type)) {
        const r = await revealOf(type, it.id)
        expect(checkReveal(it, r).ok).toBe(true)
        const texts = r.choices.flatMap((c) => (c.verdict === 'correct' ? [c.why_correct] : [c.why_tempting ?? '', c.how_to_reject ?? '']))
        const dead = texts.flatMap((t) => splitRefs(t, it.units)).filter((p) => p.kind === 'ref' && !p.known)
        expect(dead).toEqual([])
      }
    })
  }
})

describe('판단 컴포넌트 소스', () => {
  it('공개 자료 파일(*.reveal.json)을 정적 import 하지 않는다', () => {
    for (const { f, text } of sources()) expect(text, f).not.toMatch(/reveal\.json/)
  })
  it('숙달·진도·학습기록 API 를 부르지 않는다(탐색·클릭을 숙달로 세지 않음)', () => {
    for (const { f, text } of sources()) {
      expect(text, f).not.toMatch(/\/api\/(csat\/)?(attempt|mastery|progress|session|record)/)
      expect(text, f).not.toMatch(/from '@\/lib\/(supabase|analytics)/)
    }
  })
  it('scrollIntoView 는 학습자가 누른 위치 칩(EvidencePassage go)에서만 쓴다', () => {
    for (const { f, text } of sources()) {
      const n = (text.match(/scrollIntoView/g) ?? []).length
      expect(n, f).toBe(f.endsWith('EvidencePassage.tsx') ? 1 : 0)
    }
  })
})

describe('근거 참조 도우미', () => {
  const units = [{ id: 'u1', n: 1, kind: 'sentence', text: 'a' }, { id: 'u2', n: 2, kind: 'sentence', text: 'b' }]
  it('없는 참조는 끊긴 링크로 두지 않는다', () => {
    expect(splitRefs('x [u2] y [u9]', units)).toEqual([
      { kind: 'text', text: 'x ' }, { kind: 'ref', unitId: 'u2', label: '2번 문장', known: true },
      { kind: 'text', text: ' y ' }, { kind: 'ref', unitId: 'u9', label: 'u9', known: false },
    ])
    expect(refsOf('[u2][u2][u9][u1]', units)).toEqual(['u2', 'u1'])
    expect(unitsAtIndex([2, 7], units)).toEqual(['u2'])
  })
  it('판본이 다르거나 형식이 틀린 공개 자료는 거부한다', () => {
    const item = itemsOf('R-ORDER')[0]
    expect(checkReveal(item, { id: item.id, analysisVersion: 99, unitsVersion: item.version.unitsVersion, answer: 1, choices: [1, 2, 3, 4, 5] })).toEqual({ ok: false, reason: 'version' })
    expect(checkReveal(item, { id: item.id, answer: 'x' })).toEqual({ ok: false, reason: 'shape' })
    expect(checkReveal(item, null)).toEqual({ ok: false, reason: 'shape' })
  })
})
