// apps/web/src/lib/csat/content-review/__tests__/t0148-scoring.test.ts
//
// T-0148 사람 블라인드 채점 — 단계 잠금 · CSV 왕복 · 판정 격리 회귀.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import blind from '../t0148/blind.json'
import { advance, counterexamplesVisible, editField, newSheet, parseCsv, toCsv, type ScoringSheet } from '../t0148/scoring'

const BLINDS = (blind as { scripts: { blind: string }[] }).scripts.map((s) => s.blind)

function filled(): ScoringSheet {
  let s = newSheet('채점자1', BLINDS)
  for (const b of BLINDS) {
    for (const [f, v] of [['score_A', 7], ['score_B', 5], ['teaches_wrong_rule_1', '모름']] as const) {
      const r = editField(s, b, f, v as never)
      if (!r.ok) throw new Error(r.message)
      s = r.sheet
    }
  }
  return s
}

describe('대본', () => {
  it('26건, W01~W26 순서', () => {
    expect(BLINDS).toHaveLength(26)
    expect(BLINDS[0]).toBe('W01')
    expect(BLINDS[25]).toBe('W26')
  })
})

describe('단계 잠금', () => {
  it('1단계가 다 차기 전에는 잠그지 못한다', () => {
    const r = advance(newSheet('x', BLINDS))
    expect(r.ok).toBe(false)
  })
  it('점수는 0~10 정수만', () => {
    const s = newSheet('x', BLINDS)
    expect(editField(s, 'W01', 'score_A', 11).ok).toBe(false)
    expect(editField(s, 'W01', 'score_A', 2.5).ok).toBe(false)
    expect(editField(s, 'W01', 'score_A', 0).ok).toBe(true)
  })
  it('1단계를 잠그면 1단계 값을 바꿀 수 없고, 2단계 칸은 따로 쓴다', () => {
    const locked = advance(filled())
    if (!locked.ok) throw new Error(locked.message)
    expect(locked.sheet.stage).toBe('locked1')
    expect(editField(locked.sheet, 'W01', 'score_A', 1).ok).toBe(false)
    const s2 = advance(locked.sheet)
    if (!s2.ok) throw new Error(s2.message)
    expect(editField(s2.sheet, 'W01', 'teaches_wrong_rule_1', '예').ok).toBe(false)
    const r = editField(s2.sheet, 'W01', 'teaches_wrong_rule_2', '예')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sheet.rows[0]!.teaches_wrong_rule_1).toBe('모름')
  })
  it('2단계 칸은 1단계 중에 못 쓴다', () => {
    expect(editField(newSheet('x', BLINDS), 'W01', 'teaches_wrong_rule_2', '예').ok).toBe(false)
  })
  it('반례 자료는 1단계를 잠근 뒤에만 보인다', () => {
    expect(counterexamplesVisible('stage1')).toBe(false)
    expect(counterexamplesVisible('locked1')).toBe(true)
  })
})

describe('CSV', () => {
  it('왕복해도 같다 — 쉼표·따옴표·줄바꿈이 든 메모 포함(셀 안 CRLF 는 LF 로 정규화)', () => {
    let s = filled()
    const r = editField(s, 'W02', 'memo', '반례 "2020#41", 선지 ②\r\n다음 줄')
    if (!r.ok) throw new Error(r.message)
    s = r.sheet
    const back = parseCsv(toCsv(s))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.sheet.rows[1]!.memo).toBe('반례 "2020#41", 선지 ②\n다음 줄')
    expect(back.sheet.rows.filter((_, i) => i !== 1)).toEqual(s.rows.filter((_, i) => i !== 1))
  })
})

describe('판정 격리', () => {
  // 정답 키의 집단 이름이 앱 소스 어디에도 없어야 한다 — 채점 화면이 키를 실을 수 없게.
  const SRC = join(__dirname, '..', '..', '..', '..')
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '__tests__') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(tsx?|json|mjs|js)$/.test(name)) out.push(p)
    }
    return out
  }
  it('apps/web/src 에 키 집단 라벨·키 파일 참조가 없다', () => {
    const hits = walk(SRC).filter((f) => {
      const t = readFileSync(f, 'utf8')
      return /good_unscoped_pass|good_scoped|grader_regression_key|grader_regression_scores/.test(t)
    })
    expect(hits).toEqual([])
  })
})
