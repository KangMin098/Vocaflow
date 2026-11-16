// apps/web/tests/fixtures/lcp-story/original-curation.ts
//
// SYNTHETIC — 격리 하네스 전용 합성 데이터. 실제 DB 행·실제 도서·실제 수치가 아니다.
// /admin/curation 원본 줄(도서 목록 · 수집 · 검토 대기)을 실제 AdminCurationClient 로 그리기 위한 props 를 만든다.
// 통계는 상수가 아니라 아래 행에서 즉석 계산한다(I5 — 화면 수치는 같은 입력에서 계산).
//
// URL 복원 검증에 쓰는 묶음: 제목에 "Harbor" 가 든 published 30권(페이지 크기 25 → 2쪽 5권) · ready 12권 · 처리 중/실패 섞음.
import type { CurationStats, LibraryBookAdminRow, SourceCatalog } from '../../../src/lib/library/admin-queries'

export const SYNTHETIC_LABEL = 'synthetic-for-harness' as const
/** 합성 시각 — 시계를 읽지 않는다. 행 순서는 updated_at 내림차순 + id 로 결정적이다. */
const BASE = Date.UTC(2026, 9, 20, 9, 0, 0)

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

const SOURCES = ['gutenberg', 'standard_ebooks', 'wikibooks', 'wikisource'] as const

function row(n: number, status: LibraryBookAdminRow['status'], title: string, source: (typeof SOURCES)[number]): LibraryBookAdminRow {
  const at = new Date(BASE - n * 3_600_000).toISOString()
  const level = 4 + (n % 5)
  return {
    id: uuid(0xb00 + n),
    source,
    source_id: source === 'standard_ebooks' ? `synthetic-author/synthetic-${n}` : `synthetic-${n}`,
    title,
    author: `Synthetic Author ${String.fromCharCode(65 + (n % 7))}`,
    cefr_level: 'B1',
    cefr_confidence: 0.7,
    word_count: 12_000 + n * 137,
    chapter_count: 6 + (n % 9),
    reading_minutes: 60 + n,
    status,
    status_message: status === 'failed' ? '합성 실패 메시지(하네스)' : null,
    llm_cost_usd: null,
    copyright_safe_in_kr: true,
    published_at: status === 'published' ? at : null,
    created_at: at,
    updated_at: at,
    book_v_level: level,
    v_level_centroid_precise: `${level}.20`,
    cefr_band: 'B1',
    cefrj_level: 'B1.1',
    cefrj_confidence: '0.60',
    flesch_kincaid_grade: '6.10',
    flesch_reading_ease: '72.00',
    lexical_coverage: { [String(level)]: 91.5 },
    extracted_count: 1200 + n,
    lemma_bound: 1100 + n,
    lemma_unbound: 100,
    lemma_coverage_pct: '91.7',
    noise_count: 20,
    resolved_other_count: 30,
    unresolved_count: 50,
    resolved_pct: '95.8',
    learnable_coverage_pct: '93.1',
    word_set_count: status === 'published' ? 3 : 0,
  }
}

function buildBooks(): LibraryBookAdminRow[] {
  const books: LibraryBookAdminRow[] = []
  let n = 1
  for (let i = 0; i < 30; i += 1, n += 1) books.push(row(n, 'published', `Synthetic Harbor Tale ${String(i + 1).padStart(2, '0')}`, SOURCES[i % 4]!))
  for (let i = 0; i < 12; i += 1, n += 1) books.push(row(n, 'ready', `Synthetic Meadow Review ${String(i + 1).padStart(2, '0')}`, SOURCES[(i + 1) % 4]!))
  for (let i = 0; i < 4; i += 1, n += 1) books.push(row(n, i % 2 ? 'analyzing' : 'queued', `Synthetic River Queue ${i + 1}`, SOURCES[(i + 2) % 4]!))
  for (let i = 0; i < 2; i += 1, n += 1) books.push(row(n, 'failed', `Synthetic Broken Draft ${i + 1}`, SOURCES[(i + 3) % 4]!))
  books.push(row(n, 'archived', 'Synthetic Archived Note', 'gutenberg'))
  return books
}

export const BOOKS: LibraryBookAdminRow[] = buildBooks()

/** 하네스가 `selected=` 복원을 확인할 도서 — published Harbor 묶음의 2쪽 첫 행이 되도록 정렬 순서로 고른다 */
export const HARBOR_PAGE2_FIRST = [...BOOKS]
  .filter((b) => b.status === 'published' && b.title.includes('Harbor'))
  .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))[25]!

export function statsOf(books: readonly LibraryBookAdminRow[]): CurationStats {
  const inProgress = new Set(['queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing', 'curating'])
  return {
    total: books.length,
    published: books.filter((b) => b.status === 'published').length,
    ready: books.filter((b) => b.status === 'ready').length,
    inProgress: books.filter((b) => inProgress.has(b.status)).length,
    failed: books.filter((b) => b.status === 'failed').length,
    archived: books.filter((b) => b.status === 'archived').length,
  }
}

/** 품질 축은 0–5 척도(QualityBars 와 같은 범위) */
function catalog(source: string, display: string, score: number, implemented: boolean): SourceCatalog {
  return {
    id: `synthetic-catalog-${source}`,
    source,
    display_name: display,
    description: `합성 하네스 카탈로그 설명 — ${display}(실제 품질 점수 아님)`,
    api_endpoint: null,
    catalog_url: null,
    documentation_url: null,
    quality_text: score,
    quality_metadata: Math.max(0, score - 0.5),
    quality_api: Math.max(0, score - 1),
    quality_learning: score,
    quality_license: 5,
    quality_volume: Math.max(0, score - 0.5),
    composite_score: score,
    license_summary: 'Public Domain (합성)',
    copyright_safe_in_kr: true,
    catalog_size: Math.round(1000 * score),
    is_implemented: implemented,
    is_enabled: implemented,
    notes: null,
  }
}

export const CATALOGS: SourceCatalog[] = [
  catalog('gutenberg', 'Project Gutenberg', 4.6, true),
  catalog('wikibooks', 'Wikibooks', 4.1, true),
  catalog('wikisource', 'Wikisource', 3.9, true),
  catalog('storyweaver', 'StoryWeaver', 3.5, true),
  catalog('open_library', 'Open Library', 2.2, false),
]

export const ORIGINAL_PROPS = { catalogs: CATALOGS, books: BOOKS, stats: statsOf(BOOKS) }
