// apps/web/src/lib/knowledge/__tests__/rules.test.ts
import { describe, expect, it } from 'vitest'
import { checkExternalEvidence, checkImplements, checkNewItem, checkTaxonomyIds, checkTransition } from '../rules'

describe('checkTransition', () => {
  it('검토 중 → 채택은 근거가 있어야 한다', () => {
    expect(checkTransition({ from: 'in_review', to: 'adopted', reason: '', evidenceCount: 0 }).ok).toBe(false)
    expect(checkTransition({ from: 'in_review', to: 'adopted', reason: '', evidenceCount: 1 }).ok).toBe(true)
  })
  it('반려는 이유가 필수', () => {
    expect(checkTransition({ from: 'in_review', to: 'rejected', reason: '  ', evidenceCount: 3 }).ok).toBe(false)
    expect(checkTransition({ from: 'in_review', to: 'rejected', reason: '근거가 제목뿐', evidenceCount: 3 }).ok).toBe(true)
  })
  it('추출됨에서 바로 채택으로 건너뛰지 않는다', () => {
    expect(checkTransition({ from: 'extracted', to: 'adopted', reason: '', evidenceCount: 5 }).ok).toBe(false)
  })
  it('채택된 것도 재검토로 되돌릴 수 있다', () => {
    expect(checkTransition({ from: 'adopted', to: 'in_review', reason: '', evidenceCount: 0 }).ok).toBe(true)
  })
})

describe('checkNewItem', () => {
  const base = { layer: 'method' as const, slug: 'retrieval-cloze', title: '빈칸 인출', statement: '문장.', skillIds: [], conditionIds: [] }
  it('slug 형식', () => {
    expect(checkNewItem({ ...base, slug: 'Bad Slug' }).ok).toBe(false)
    expect(checkNewItem(base).ok).toBe(true)
  })
  it('본질은 영역 정확히 하나', () => {
    expect(checkNewItem({ ...base, layer: 'essence', skillIds: [] }).ok).toBe(false)
    expect(checkNewItem({ ...base, layer: 'essence', skillIds: ['skill-reading', 'skill-vocab'] }).ok).toBe(false)
    expect(checkNewItem({ ...base, layer: 'essence', skillIds: ['skill-reading'] }).ok).toBe(true)
  })
})

describe('checkTaxonomyIds', () => {
  const TAX = [
    { id: 'skill-reading', dimension: 'skill' },
    { id: 'age-high', dimension: 'age' },
    { id: 'exam-suneung', dimension: 'exam' },
  ]
  it('있는 ID · 맞는 차원만 통과', () => {
    expect(checkTaxonomyIds(['skill-reading'], ['age-high', 'exam-suneung'], TAX).ok).toBe(true)
  })
  it('없는 ID 는 거부 — 본질도 가짜 영역 하나로 통과하지 못한다', () => {
    expect(checkTaxonomyIds(['skill-made-up'], [], TAX).ok).toBe(false)
  })
  it('차원이 바뀐 값은 거부', () => {
    expect(checkTaxonomyIds(['age-high'], [], TAX).ok).toBe(false)
    expect(checkTaxonomyIds([], ['skill-reading'], TAX).ok).toBe(false)
  })
  it('중복 거부', () => {
    expect(checkTaxonomyIds(['skill-reading', 'skill-reading'], [], TAX).ok).toBe(false)
  })
  it('분류를 못 읽었으면 통과시키지 않는다', () => {
    expect(checkTaxonomyIds([], [], []).ok).toBe(false)
  })
})

describe('checkImplements', () => {
  it('한 층 위로만', () => {
    expect(checkImplements('practice', 'method').ok).toBe(true)
    expect(checkImplements('method', 'principle').ok).toBe(true)
    expect(checkImplements('principle', 'essence').ok).toBe(true)
    expect(checkImplements('practice', 'principle').ok).toBe(false)
    expect(checkImplements('principle', 'principle').ok).toBe(false)
    expect(checkImplements('essence', 'principle').ok).toBe(false)
  })
})

describe('checkExternalEvidence', () => {
  it('https · 제목 · 위치 길이', () => {
    expect(checkExternalEvidence({ url: 'http://x.org', title: 't', locator: '' }).ok).toBe(false)
    expect(checkExternalEvidence({ url: 'https://x.org', title: ' ', locator: '' }).ok).toBe(false)
    expect(checkExternalEvidence({ url: 'https://x.org', title: 't', locator: 'x'.repeat(201) }).ok).toBe(false)
    expect(checkExternalEvidence({ url: 'https://x.org/a', title: 't', locator: '03:12–04:05' }).ok).toBe(true)
  })
})
