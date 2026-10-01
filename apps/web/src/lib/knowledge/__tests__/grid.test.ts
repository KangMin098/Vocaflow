// apps/web/src/lib/knowledge/__tests__/grid.test.ts
import { describe, expect, it } from 'vitest'
import { COMMON, buildGrid, buildOriginGrid, cellTone } from '../grid'

const SKILLS = ['skill-reading', 'skill-vocab']

describe('buildGrid', () => {
  it('영역 없는 항목은 공통 열로', () => {
    const g = buildGrid([{ slug: 'active-recall', layer: 'principle', status: 'in_review', skillIds: [] }], SKILLS)
    expect(g.cells.principle[COMMON].total).toBe(1)
    expect(g.cells.principle['skill-reading'].total).toBe(0)
  })
  it('여러 영역 항목은 각 열에 센다 · 채택만 adopted', () => {
    const g = buildGrid(
      [
        { slug: 'a', layer: 'method', status: 'adopted', skillIds: ['skill-reading', 'skill-vocab'] },
        { slug: 'b', layer: 'method', status: 'extracted', skillIds: ['skill-reading'] },
      ],
      SKILLS
    )
    expect(g.cells.method['skill-reading']).toMatchObject({ total: 2, adopted: 1 })
    expect(g.cells.method['skill-vocab']).toMatchObject({ total: 1, adopted: 1 })
  })
  it('모르는 분류 id 는 공통으로 (지도 밖으로 새지 않는다)', () => {
    const g = buildGrid([{ slug: 'x', layer: 'practice', status: 'applied', skillIds: ['skill-unknown'] }], SKILLS)
    expect(g.cells.practice[COMMON]).toMatchObject({ total: 1, adopted: 1 })
  })
  it('본질 채택 여부', () => {
    const g = buildGrid([{ slug: 'e', layer: 'essence', status: 'adopted', skillIds: ['skill-reading'] }], SKILLS)
    expect(g.essenceKnown).toEqual({ 'skill-reading': true, 'skill-vocab': false })
  })
})

describe('buildOriginGrid', () => {
  it('공유 지문은 모든 문항 칸에 · 모르는 칸은 null', () => {
    const g = buildOriginGrid([
      { itemIds: ['2015#34'], grade: 'A' },
      { itemIds: ['M2209#41', 'M2209#42'], grade: 'G' },
    ])
    expect(g.exams).toEqual(['M2209', '2015'])
    expect(g.numbers).toEqual([34, 41, 42])
    expect(g.gradeAt('M2209', 42)).toBe('G')
    expect(g.gradeAt('2015', 41)).toBeNull()
  })
  it('형식이 다른 ID 는 버린다', () => {
    expect(buildOriginGrid([{ itemIds: ['broken'], grade: 'A' }]).exams).toEqual([])
  })
})

describe('cellTone', () => {
  it('빈칸은 0 이 아니라 모름', () => {
    expect(cellTone({ total: 0, adopted: 0, slugs: [] })).toBe('unknown')
    expect(cellTone({ total: 2, adopted: 0, slugs: ['a', 'b'] })).toBe('draft')
    expect(cellTone({ total: 2, adopted: 1, slugs: ['a', 'b'] })).toBe('known')
  })
})
