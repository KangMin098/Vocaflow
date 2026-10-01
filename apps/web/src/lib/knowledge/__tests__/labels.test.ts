// apps/web/src/lib/knowledge/__tests__/labels.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ATTRIBUTIONS, GRADES, LAYERS, LAYER_RANK, STATUSES, isGrade, isLayer, isStatus, share } from '../labels'

const MIGRATION = readFileSync(
  resolve(__dirname, '../../../../../../supabase/migrations/20260928120000_knowledge_registry.sql'),
  'utf8'
)

/** `check (<col> in ('a','b'))` 의 값 목록을 뽑는다. */
function checkValues(column: string): string[] {
  const m = MIGRATION.match(new RegExp(`${column} in \\(([^)]*)\\)`))
  if (!m) throw new Error(`${column} CHECK 를 못 찾았다`)
  return m[1].split(',').map((v) => v.trim().replace(/'/g, ''))
}

describe('knowledge labels ↔ DB CHECK', () => {
  it('층 값이 마이그레이션과 같다', () => {
    expect([...LAYERS].sort()).toEqual(checkValues('layer').sort())
  })
  it('상태 값이 마이그레이션과 같다', () => {
    expect([...STATUSES].sort()).toEqual(checkValues('status').sort())
  })
  it('근거 등급 A/B/C 가 마이그레이션과 같고 G 는 원천 전용이다', () => {
    expect(checkValues('grade').sort()).toEqual(GRADES.filter((g) => g !== 'G').sort())
  })
  it('근거 귀속 값이 최신 마이그레이션(20261001130000) CHECK 와 같다', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../../../../supabase/migrations/20261001130000_knowledge_evidence_observed.sql'),
      'utf8'
    )
    // 정규식 대신 문자열 자르기 — 셸 heredoc 이 역슬래시를 먹어 정규식이 조용히 바뀌는 사고를 피한다
    const at = sql.indexOf('attribution in (')
    expect(at).toBeGreaterThan(-1)
    const inner = sql.slice(at + 'attribution in ('.length, sql.indexOf(')', at))
    const values = inner.split(',').map((v) => v.trim().split("'").join(''))
    expect([...ATTRIBUTIONS].sort()).toEqual(values.sort())
  })
  it('층 번호는 본질 1 → 공부법 4 로 겹치지 않는다', () => {
    expect(new Set(Object.values(LAYER_RANK)).size).toBe(4)
    expect(LAYER_RANK.essence).toBe(1)
    expect(LAYER_RANK.practice).toBe(4)
  })
})

describe('guards', () => {
  it('알 수 없는 값을 거른다', () => {
    expect(isLayer('method')).toBe(true)
    expect(isLayer('tip')).toBe(false)
    expect(isStatus('adopted')).toBe(true)
    expect(isStatus('done')).toBe(false)
    expect(isGrade('G')).toBe(true)
    expect(isGrade('D')).toBe(false)
  })
})

describe('share', () => {
  it('분모 0 은 0% 가 아니라 null', () => {
    expect(share(0, 0)).toBeNull()
  })
  it('소수 첫째 자리로 반올림', () => {
    expect(share(49, 713)).toBe(6.9)
    expect(share(0, 713)).toBe(0)
  })
})
