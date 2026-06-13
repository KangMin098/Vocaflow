// apps/web/src/lib/library/__tests__/admin-queries.test.ts
// Phase 12 단계 3 smoke test — 모듈 import + 타입 시그니처 + 헬퍼 검증

import { describe, it, expect } from 'vitest'
import {
  parseLlmCost,
  classifyStatus,
  type SourceCatalog,
  type LibraryBookAdminRow,
  type BookStatus,
} from '../admin-queries'

describe('admin-queries — pure helpers', () => {
  it('parseLlmCost: null/empty → 0', () => {
    expect(parseLlmCost(null)).toBe(0)
    expect(parseLlmCost('')).toBe(0)
  })

  it('parseLlmCost: valid string → number', () => {
    expect(parseLlmCost('0.123456')).toBeCloseTo(0.123456)
    expect(parseLlmCost('1.5')).toBe(1.5)
  })

  it('parseLlmCost: invalid → 0', () => {
    expect(parseLlmCost('abc')).toBe(0)
  })

  it('classifyStatus: 모든 BookStatus가 매핑됨', () => {
    const allStatuses: BookStatus[] = [
      'queued',
      'ingesting',
      'normalizing',
      'segmenting',
      'analyzing',
      'curating',
      'ready',
      'published',
      'archived',
      'failed',
    ]
    for (const s of allStatuses) {
      const { label, tone } = classifyStatus(s)
      expect(label).toBeTruthy()
      expect(['success', 'warning', 'info', 'danger', 'neutral']).toContain(tone)
    }
  })

  it('타입 시그니처 컴파일 시 검증', () => {
    const _catalog: SourceCatalog = {
      id: 'x',
      source: 'gutenberg',
      display_name: 'PG',
      description: null,
      api_endpoint: null,
      catalog_url: null,
      documentation_url: null,
      quality_text: 3,
      quality_metadata: 4,
      quality_api: 4,
      quality_learning: 5,
      quality_license: 5,
      quality_volume: 5,
      composite_score: 4.0,
      license_summary: 'PD-US',
      copyright_safe_in_kr: true,
      catalog_size: 74000,
      is_implemented: true,
      is_enabled: true,
      notes: null,
    }
    const _row: LibraryBookAdminRow = {
      id: 'y',
      source: 'gutenberg',
      source_id: '1342',
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      cefr_level: 'C1',
      cefr_confidence: 0.95,
      word_count: 121905,
      chapter_count: 61,
      reading_minutes: 813,
      status: 'published',
      status_message: null,
      llm_cost_usd: '0.123456',
      copyright_safe_in_kr: true,
      published_at: '2026-05-08T00:00:00Z',
      created_at: '2026-05-08T00:00:00Z',
      updated_at: '2026-05-08T00:00:00Z',
      book_v_level: 8,
      v_level_centroid_precise: '4.56',
      cefr_band: 'B2',
      cefrj_level: 'B2.1',
      cefrj_confidence: '0.70',
      flesch_kincaid_grade: '12.44',
      flesch_reading_ease: '54.93',
      lexical_coverage: { '7': 88.2, '8': 93.1, '9': 97.0 },
      extracted_count: 2027,
      lemma_bound: 1958,
      lemma_unbound: 69,
      lemma_coverage_pct: '96.6',
      word_set_count: 12,
    }
    expect(_catalog.composite_score).toBeGreaterThan(0)
    expect(_row.status).toBe('published')
  })
})
