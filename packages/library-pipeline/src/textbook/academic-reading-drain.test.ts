// packages/library-pipeline/src/textbook/academic-reading-drain.test.ts
import { describe, expect, it } from 'vitest'
import {
  adaptationKey,
  canonical,
  readingTask,
  targetKey,
  validateReadingDraft,
} from '../../../../scripts/textbook/academic-reading-contract.mjs'
import { analysis, quote, rights, target } from './academic-reading-fixtures'

const now = Date.parse('2026-10-04T00:00:00Z')
const current = {
  id: 'source-1',
  content: quote,
  source: 'noaa',
  source_url: rights.canonical_url,
  license: rights.license,
  license_class: 'public_domain',
  updated_at: '2026-10-01T00:00:00Z',
  status: 'ready',
  display_only: false,
  copyright_safe_in_kr: true,
  csat_fit: { gate: { verdict: 'use' } },
}
const exported = {
  adapted_from_id: current.id,
  target_v_level: 3,
  target_band: 'middle',
  source_text: quote,
  source_feed: 'noaa',
  source_url: current.source_url,
  source_license: 'public_domain',
  reading: readingTask(current, target),
}
const row = {
  ...exported,
  title: 'Ocean habitats',
  text: quote,
  reading: { ...exported.reading, source_rights: rights, reading_analysis: analysis },
}

describe('각색 드레인 계보와 재실행 계약', () => {
  it('같은 원문·같은 V-Level의 서로 다른 학년 목표는 별도 판이다', () => {
    const high = { ...target, age_band: 'high_1', reasoning_band: 'high_1' }
    expect(adaptationKey(current.id, target)).not.toBe(adaptationKey(current.id, high))
    expect(adaptationKey(current.id, target)).toBe(
      adaptationKey(current.id, structuredClone(target))
    )
  })
  it('JSONB의 키 순서는 식별키를 바꾸지 않는다', () => {
    expect(targetKey({ ...target, words: { max: 250, min: 180 } })).toBe(targetKey(target))
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }))
  })
  it('자료의 권리 확인일·근거 갱신은 같은 교육 목적의 새 판을 만들지 않는다', () => {
    const resource = {
      kind: 'text',
      canonical_source: 'noaa',
      canonical_url: rights.canonical_url,
      content: quote,
      checked_at: rights.checked_at,
      license_evidence: 'Reviewed article-specific rights.',
    }
    const a = { ...target, resources: [resource] }
    expect(targetKey(a)).toBe(
      targetKey({
        ...target,
        resources: [
          {
            ...resource,
            checked_at: '2026-10-03T00:00:00Z',
            license_evidence: 'Rights were checked again.',
          },
        ],
      })
    )
    expect(targetKey(a)).not.toBe(
      targetKey({ ...target, resources: [{ ...resource, content: 'A revised additional text.' }] })
    )
  })
  it('최신 원문에 묶인 완성형 결과만 통과하고 원문을 바꾸지 않는다', () => {
    const before = structuredClone(current)
    const result = validateReadingDraft(row, exported, current, now)
    expect(result.ok).toBe(true)
    expect(result.spec?.provenance.source_id).toBe(current.id)
    expect(current).toEqual(before)
  })
  it.each([
    { content: 'Changed source body.' },
    { updated_at: '2026-10-03T00:00:00Z' },
    { license_class: 'cc_by_nd' },
    { display_only: true },
    { status: 'archived' },
    { csat_fit: { gate: { verdict: 'reject' } } },
    { csat_fit: { gate: { retain: { verdict: 'discard' } } } },
  ])('변경·반려·권리 차단 원문을 거절한다: %j', (change) => {
    expect(validateReadingDraft(row, exported, { ...current, ...change }, now).ok).toBe(false)
  })
  it('채운 청크의 부모·수준·원문·출처 바꿔치기를 거절한다', () => {
    for (const change of [
      { adapted_from_id: 'other' },
      { source_text: 'Changed exported text.' },
      { target_v_level: 4 },
      { source_url: 'https://example.org/wrong' },
    ])
      expect(validateReadingDraft({ ...row, ...change }, exported, current, now).ok).toBe(false)
    expect(
      validateReadingDraft(
        { ...row, reading: { ...row.reading, target: { ...target, age_band: 'high_1' } } },
        exported,
        current,
        now
      ).ok
    ).toBe(false)
  })
  it('기사별 권리 증거 누락과 미래 확인일을 막는다', () => {
    expect(
      validateReadingDraft(
        { ...row, reading: { ...row.reading, source_rights: null } },
        exported,
        current,
        now
      ).ok
    ).toBe(false)
    expect(
      validateReadingDraft(
        {
          ...row,
          reading: {
            ...row.reading,
            source_rights: { ...rights, checked_at: '2026-10-05T00:00:00Z' },
          },
        },
        exported,
        current,
        now
      ).ok
    ).toBe(false)
  })
})
