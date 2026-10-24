// apps/web/src/lib/csat/binding/__tests__/binding.real.test.ts
// 실제 기출 문항(DB 읽기 전용 export — fixtures/real-items.json)으로 결속·결함 검출을 검증한다.
// 기대값은 문항 원문을 사람이 읽고 확인한 것이다(각 테스트 이름에 근거를 적는다).
import { describe, expect, it } from 'vitest'
import { bindItem, findQuote, toJudgmentItem, type BindInput } from '../adapter'
import { isBlocking } from '../readiness'
import { anchorValidity, judgmentItemValidity, keepValid, lectureValidity } from '../invalidate'
import fx from './fixtures/real-items.json'

const rows = (fx as unknown as { rows: BindInput[] }).rows
const row = (id: string) => {
  const r = rows.find((x) => x.item.id === id)
  if (!r) throw new Error(`픽스처 없음: ${id}`)
  return r
}
const bind = (id: string) => bindItem(row(id))
const codes = (id: string) => bind(id).defects.map((d) => d.code)

describe('복수 정답 — 2015#25 (도표, 정답 ④·⑤)', () => {
  it('정답 집합은 answers 배열을 따른다(단일 answer=4 로 줄이지 않는다)', () => {
    expect(bind('2015#25').answer).toEqual({ answers: [4, 5], multiple: true, legacyMismatch: false })
  })
  it('공개 분석이 ⑤를 정답으로 다루지 않으면 partial · 차단', () => {
    const b = bind('2015#25')
    expect(b.coverage).toEqual({ status: 'partial', missing: [5], extra: [] })
    expect(b.reasons).toContain('multi_answer_partial_analysis')
  })
  it('분석이 그림에만 있는 막대 값을 단정하면 chart_value_unverified', () => {
    expect(bind('2015#25').reasons).toContain('chart_value_unverified')
  })
  it('근거 단위가 없어 분석이 결속되지 않았다 — 앵커를 만들지 않는다', () => {
    const b = bind('2015#25')
    expect(b.analysisPick).toBe('unbound')
    expect(b.answerAnchors).toEqual([])
  })
})

describe('누락 각주 — 2014A#29 (안내문)', () => {
  it('Hours* 표지에 정의가 없고 「month.」 조각만 남은 것을 잡는다', () => {
    const c = codes('2014A#29')
    expect(c).toContain('footnote_mark_without_gloss')
    expect(c).toContain('orphan_fragment')
    expect(bind('2014A#29').reasons).toContain('footnote_missing')
  })
  it('각주 앵커는 unavailable 로 남는다(빠진 정의를 지어내지 않는다)', () => {
    const f = bind('2014A#29').structure.footnotes
    expect(f.length).toBeGreaterThan(0)
    expect(f.every((x) => x.precision === 'unavailable' && x.gloss === null)).toBe(true)
  })
  it('안내문 조건(요일·시간대·요금)을 원문 오프셋으로 잡고, 오프셋 글자가 원문과 같다', () => {
    const b = bind('2014A#29')
    const p = row('2014A#29').item.passage!
    const cues = new Set(b.structure.conditions.map((c) => c.cue))
    for (const k of ['weekday', 'time_range', 'fee'] as const) expect(cues.has(k)).toBe(true)
    for (const c of b.structure.conditions) expect(p.slice(c.start, c.end)).toBe(c.quote)
  })
})

describe('어법 — 2024#29 (밑줄 범위)', () => {
  it('①–⑤ 표지가 각각 한 번 — 표지 앵커 5개, 밑줄 시작 낱말은 원문 그대로', () => {
    const b = bind('2024#29')
    expect(b.structure.markers.map((m) => m.choice)).toEqual([1, 2, 3, 4, 5])
    expect(b.structure.markers.map((m) => m.head)).toEqual(['seeming to', 'which they', 'do succeed', 'those of', 'to be'])
    expect(b.structure.markers.every((m) => m.precision === 'marker')).toBe(true)
  })
  it('다음 표지까지 이어 붙은 선지를 choice_overrun 으로, ⑤에 붙은 각주를 merged 로 구분한다', () => {
    const d = bind('2024#29').defects
    expect(d.filter((x) => x.code === 'choice_overrun').map((x) => ('choice' in x ? x.choice : 0))).toEqual([1, 2, 3, 4])
    expect(d.some((x) => x.code === 'choice_footnote_merged' && x.choice === 5)).toBe(true)
    expect(bind('2024#29').reasons).not.toContain('marker_anchor_unavailable')
  })
})

describe('쪽번호·각주가 섞인 선지', () => {
  it('2024#30 어휘 ⑤ 「… 일치 5」 — 쪽번호 5 와 각주를 따로 잡는다', () => {
    const d = bind('2024#30').defects
    expect(d).toContainEqual({ code: 'choice_page_number', choice: 5, raw: '5' })
    expect(d.some((x) => x.code === 'choice_footnote_merged' && x.choice === 5)).toBe(true)
  })
  it('2016#24 도표 ⑤ 끝의 8 은 쪽번호다(도표 값으로 읽지 않는다)', () => {
    expect(bind('2016#24').defects).toContainEqual({ code: 'choice_page_number', choice: 5, raw: '8' })
  })
  it('2015#38 삽입 ⑤ — 각주 두 개 + 쪽번호 7 + 괄호 잔재', () => {
    const d = bind('2015#38').defects
    expect(d).toContainEqual({ code: 'choice_page_number', choice: 5, raw: '7' })
    expect(d.filter((x) => x.code === 'choice_paren_residue').length).toBe(5)
  })
})

describe('장문 세트 표지 (a)–(e)', () => {
  it('2014A#44 지칭 · 2019#42 어휘 — (a)–(e) 를 표지로 읽는다(①–⑤ 가 없다고 막지 않는다)', () => {
    for (const id of ['2014A#44', '2019#42']) {
      const b = bind(id)
      expect(b.structure.markers.map((m) => m.mark)).toEqual(['(a)', '(b)', '(c)', '(d)', '(e)'])
      expect(b.reasons).not.toContain('marker_anchor_unavailable')
      expect(b.defects.map((x) => x.code)).not.toContain('marker_missing')
    }
  })
})

describe('오탐 방지', () => {
  it('H1811G1#27 「1:00 p.m. every day.」 는 조각이 아니다', () => {
    expect(codes('H1811G1#27')).not.toContain('orphan_fragment')
  })
})

describe('결속된 문항 — 근거 앵커와 무효화', () => {
  const bound = rows.map((r) => bindItem(r)).filter((b) => b.analysisPick === 'bound')
  it('픽스처에 결속된 문항이 하나 이상 있다', () => {
    expect(bound.length).toBeGreaterThan(0)
  })
  it('결속된 분석의 단위 앵커는 현재 단위 판본을 basis 로 갖는다', () => {
    for (const b of bound) {
      const u = rows.find((r) => r.item.id === b.id)!.units!
      for (const a of [...b.answerAnchors, ...b.choices.flatMap((c) => c.anchors)]) {
        expect(a.basis.unitsHash).toBe(u.units_hash)
        if (a.kind === 'unit') expect(u.units.some((x) => x.id === a.unitId && x.n === a.n)).toBe(true)
      }
    }
  })
  it('원문을 같은 길이로 고치면 span·marker 앵커가 text_mismatch 로 무효가 된다', () => {
    const b = bind('2024#29')
    const p = row('2024#29').item.passage!
    const cur = { itemId: b.id, inputHash: b.basis.inputHash, passage: p, unitsVersion: b.basis.unitsVersion, unitsHash: b.basis.unitsHash, analysisVersion: b.analysisVersion }
    const m = b.structure.markers[1]
    expect(anchorValidity(m, cur)).toEqual({ status: 'valid' })
    const edited = p.slice(0, m.at) + 'X' + p.slice(m.at + 1)
    expect(anchorValidity(m, { ...cur, passage: edited })).toEqual({ status: 'stale', reasons: ['text_mismatch'] })
  })
  it('원문 해시·단위 판본이 바뀌면 모든 앵커가 빠진다', () => {
    const b = bind('2024#29')
    const p = row('2024#29').item.passage!
    const cur = { itemId: b.id, inputHash: 'changed', passage: p, unitsVersion: (b.basis.unitsVersion ?? 0) + 1, unitsHash: 'x', analysisVersion: b.analysisVersion }
    const { valid, dropped } = keepValid(b.structure.markers, cur)
    expect(valid).toEqual([])
    expect(dropped[0].reasons).toEqual(expect.arrayContaining(['input_hash', 'units_version', 'units_hash']))
  })
  it('결속 정보가 없는 강의는 valid 가 아니라 unverifiable', () => {
    const cur = { itemId: '2024#29', inputHash: 'h', passage: '', unitsVersion: 4, unitsHash: 'u', analysisVersion: 5 }
    expect(lectureValidity({ item_id: '2024#29' }, cur).status).toBe('unverifiable')
    expect(lectureValidity({ item_id: '2024#29', binding: { analysis_version: 5, units_hash: 'u' } }, cur).status).toBe('valid')
    expect(lectureValidity({ item_id: '2024#29', binding: { analysis_version: 4, units_hash: 'u' } }, cur)).toEqual({ status: 'stale', reasons: ['analysis_version'] })
  })
  it('판단 도구 판본이 하나라도 다르면 stale', () => {
    const cur = { itemId: 'A', inputHash: 'h', passage: '', unitsVersion: 4, unitsHash: 'u', analysisVersion: 5 }
    expect(judgmentItemValidity({ id: 'A', version: { unitsVersion: 4, unitsHash: 'u', analysisVersion: 5 } }, cur).status).toBe('valid')
    expect(judgmentItemValidity({ id: 'A', version: { unitsVersion: 3, unitsHash: 'u', analysisVersion: 5 } }, cur)).toEqual({ status: 'stale', reasons: ['units_version'] })
  })
})

describe('D 판단 도구로 넘기기', () => {
  it('복수 정답 문항은 넘기지 않는다(D 계약은 정답 하나)', () => {
    const r = row('2015#25')
    const out = toJudgmentItem(bind('2015#25'), r.item, r.units, isBlocking)
    expect(out.item).toBeNull()
  })
  it('넘긴 JudgmentItem 에 정답 키가 없고 판본이 basis 와 같다', async () => {
    const { leakedAnswerKeys } = await import('../../judgment/evidence')
    for (const r of rows) {
      const b = bindItem(r)
      const out = toJudgmentItem(b, r.item, r.units, isBlocking)
      if (!out.item) continue
      expect(leakedAnswerKeys(out.item)).toEqual([])
      expect(out.item.version).toEqual({ unitsVersion: b.basis.unitsVersion, unitsHash: b.basis.unitsHash, analysisVersion: b.analysisVersion })
    }
  })
})

describe('findQuote', () => {
  it('따옴표·대시·공백 차이를 넘어 원래 오프셋을 돌려준다', () => {
    const p = 'He said “stop”  ― now. Then left.'
    const h = findQuote(p, 'said "stop" - now')
    expect(h && p.slice(h.start, h.end)).toBe('said “stop”  ― now')
  })
  it('두 번 나오는 인용은 자리를 확정하지 않는다', () => {
    expect(findQuote('a cat. a cat.', 'a cat')).toBeNull()
  })
})
