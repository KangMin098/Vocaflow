// apps/web/src/lib/library/admin-queries.ts
// LCP v2.0 Phase 12 단계 3 — admin/curator 전용 server-side 쿼리 + RPC 래퍼
//
// 사용 패턴 (RSC 또는 API Route에서):
//   import { createClient } from '@/lib/supabase/server';
//   import { listSourceCatalogs } from '@/lib/library/admin-queries';
//
//   export default async function AdminCurationPage() {
//     await requireAdmin();
//     const client = await createClient();
//     const catalogs = await listSourceCatalogs(client);
//     ...
//   }
//
// 권한 모델:
// - 모든 함수는 호출자가 admin/curator role 검증을 마쳤다고 가정.
// - RLS + SECURITY DEFINER RPC가 추가 검증 (이중 안전망).
// - service_role 사용 금지 — anon key + auth.uid() 기반 권한.
//
// 버전 결정: B (untyped) — apps/web/src/types/database.ts 가 minimal hand-written
// 이고 library_books / library_source_catalogs 미포함이라 typed 모드 불가.

import type { SupabaseClient } from '@supabase/supabase-js'

type AdminClient = SupabaseClient

// ─────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────

export interface SourceCatalog {
  id: string
  source: string
  display_name: string
  description: string | null
  api_endpoint: string | null
  catalog_url: string | null
  documentation_url: string | null
  quality_text: number
  quality_metadata: number
  quality_api: number
  quality_learning: number
  quality_license: number
  quality_volume: number
  composite_score: number
  license_summary: string
  copyright_safe_in_kr: boolean
  catalog_size: number | null
  is_implemented: boolean
  is_enabled: boolean
  notes: string | null
}

export interface LibraryBookAdminRow {
  id: string
  source: string
  source_id: string | null
  title: string
  author: string | null
  cefr_level: string | null
  cefr_confidence: number | null
  word_count: number | null
  chapter_count: number | null
  reading_minutes: number | null
  status: BookStatus
  status_message: string | null
  /** NUMERIC(10,6) — supabase-js는 string으로 반환. 호출자가 parseLlmCost 사용. */
  llm_cost_usd: string | null
  copyright_safe_in_kr: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  /** 4축 난이도 지수 (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수") */
  book_v_level: number | null
  /** NUMERIC(4,2) — supabase-js는 string으로 반환. */
  v_level_centroid_precise: string | null
  /** CEFR 6-band (cefr_band generated stored column) */
  cefr_band: string | null
  /** CEFR-J 12-band (internal heuristic) */
  cefrj_level: string | null
  /** NUMERIC(3,2) — supabase-js는 string으로 반환. */
  cefrj_confidence: string | null
  /** NUMERIC(4,2) Flesch-Kincaid Grade Level. */
  flesch_kincaid_grade: string | null
  /** NUMERIC(5,2) Flesch Reading Ease. */
  flesch_reading_ease: string | null
  /** 레벨별 기지어 커버리지 % (토큰 가중) — {"7":84.8} = V7 학습자가 아는 토큰 %. i+1 판정용. */
  lexical_coverage: Record<string, number> | null
  /** v06.34 — 추출 + lemma 매핑 진행도 (v_book_extraction_stats 도출) */
  extracted_count: number | null
  lemma_bound: number | null
  lemma_unbound: number | null
  /** NUMERIC(5,1) — supabase-js 는 string 반환 */
  lemma_coverage_pct: string | null
  /**
   * 발행된 챕터 단어장 수 — `shared_word_sets` 중 category='library_book'
   * AND is_published=true AND curation_query->>'book_id' = books.id.
   * 0/null = admin 검수·발행 작업 안 됨, N = N개 챕터 단어장 발행됨.
   */
  word_set_count: number | null
}

export type BookStatus =
  | 'queued'
  | 'ingesting'
  | 'normalizing'
  | 'segmenting'
  | 'analyzing'
  | 'curating'
  | 'ready'
  | 'published'
  | 'archived'
  | 'failed'

export interface CurationStats {
  total: number
  published: number
  ready: number
  inProgress: number
  failed: number
  archived: number
}

export interface EnqueueBookParams {
  source: string
  source_id: string
  title: string
  author?: string | null
  author_birth_year?: number | null
  author_death_year?: number | null
  /** default 'PD-US' */
  license?: string
}

// ─────────────────────────────────────────────
// 1. Tab 1 — 소스 카탈로그 9개 조회
// ─────────────────────────────────────────────

/**
 * 활성화된 소스 카탈로그를 composite_score 내림차순으로 반환.
 * - Tab 1 (SourceCatalogTab) 에서 사용.
 * - is_enabled=false 카탈로그는 제외 (RLS anyone_read_enabled_catalogs).
 */
export async function listSourceCatalogs(
  client: AdminClient,
): Promise<SourceCatalog[]> {
  const { data, error } = await client
    .from('library_source_catalogs')
    .select('*')
    .eq('is_enabled', true)
    .order('composite_score', { ascending: false })

  if (error) {
    throw new Error(`listSourceCatalogs failed: ${error.message}`)
  }
  return (data ?? []) as unknown as SourceCatalog[]
}

// ─────────────────────────────────────────────
// 2. Tab 4 — 내 라이브러리 (전체 status)
// ─────────────────────────────────────────────

/**
 * admin/curator 가 관리하는 모든 library_books.
 * - status 필터 가능 (default: 모든 status).
 * - updated_at 내림차순 — 최근 처리된 책이 위로.
 */
export async function listAllAdminBooks(
  client: AdminClient,
  options: { status?: BookStatus[]; limit?: number } = {},
): Promise<LibraryBookAdminRow[]> {
  let query = client
    .from('library_books')
    .select(
      'id, source, source_id, title, author, cefr_level, cefr_confidence, ' +
        'word_count, chapter_count, reading_minutes, status, status_message, ' +
        'llm_cost_usd, copyright_safe_in_kr, published_at, created_at, updated_at, ' +
        'book_v_level, v_level_centroid_precise, cefr_band, cefrj_level, cefrj_confidence, ' +
        'flesch_kincaid_grade, flesch_reading_ease, lexical_coverage',
    )
    .order('updated_at', { ascending: false })

  if (options.status && options.status.length > 0) {
    query = query.in('status', options.status)
  }
  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`listAllAdminBooks failed: ${error.message}`)
  }
  const books = (data ?? []) as unknown as LibraryBookAdminRow[]
  if (books.length === 0) return books

  // v06.34 — 추출/매핑 stats 머지 (v_book_extraction_stats)
  const ids = books.map((b) => b.id)
  const { data: statsRows } = await client
    .from('v_book_extraction_stats')
    .select('book_id, extracted_count, lemma_bound, lemma_unbound, lemma_coverage_pct')
    .in('book_id', ids)

  const statsMap = new Map<
    string,
    Pick<LibraryBookAdminRow, 'extracted_count' | 'lemma_bound' | 'lemma_unbound' | 'lemma_coverage_pct'>
  >()
  for (const r of (statsRows ?? []) as Array<{
    book_id: string
    extracted_count: number | null
    lemma_bound: number | null
    lemma_unbound: number | null
    lemma_coverage_pct: string | null
  }>) {
    statsMap.set(r.book_id, {
      extracted_count: r.extracted_count,
      lemma_bound: r.lemma_bound,
      lemma_unbound: r.lemma_unbound,
      lemma_coverage_pct: r.lemma_coverage_pct,
    })
  }

  for (const b of books) {
    const s = statsMap.get(b.id)
    b.extracted_count = s?.extracted_count ?? null
    b.lemma_bound = s?.lemma_bound ?? null
    b.lemma_unbound = s?.lemma_unbound ?? null
    b.lemma_coverage_pct = s?.lemma_coverage_pct ?? null
  }

  // 발행된 챕터 단어장 카운트 머지 — shared_word_sets.curation_query->>'book_id' 별 count.
  // category='library_book' + is_published=true 한정.
  // (마이그레이션 회피 — view 대신 client-side aggregation. 발행된 library_book 단어장
  //  ~수백 개 수준이라 traffic 무시 가능.)
  const { data: setRows } = await client
    .from('shared_word_sets')
    .select('curation_query')
    .eq('category', 'library_book')
    .eq('is_published', true)

  const wsCounts = new Map<string, number>()
  for (const r of (setRows ?? []) as Array<{ curation_query: { book_id?: string } | null }>) {
    const bid = r.curation_query?.book_id
    if (!bid) continue
    wsCounts.set(bid, (wsCounts.get(bid) ?? 0) + 1)
  }
  for (const b of books) {
    b.word_set_count = wsCounts.get(b.id) ?? 0
  }

  return books
}

// ─────────────────────────────────────────────
// 3. 상단 stats bar
// ─────────────────────────────────────────────

/**
 * library_books status별 카운트.
 * - inProgress = queued/ingesting/normalizing/segmenting/analyzing/curating 합계.
 */
export async function getCurationStats(
  client: AdminClient,
): Promise<CurationStats> {
  const { data, error } = await client.from('library_books').select('status')

  if (error) {
    throw new Error(`getCurationStats failed: ${error.message}`)
  }

  const stats: CurationStats = {
    total: 0,
    published: 0,
    ready: 0,
    inProgress: 0,
    failed: 0,
    archived: 0,
  }

  for (const row of data ?? []) {
    stats.total++
    const s = (row as { status: string }).status
    if (s === 'published') stats.published++
    else if (s === 'ready') stats.ready++
    else if (s === 'failed') stats.failed++
    else if (s === 'archived') stats.archived++
    else stats.inProgress++ // queued/ingesting/normalizing/segmenting/analyzing/curating
  }
  return stats
}

// ─────────────────────────────────────────────
// 4. Tab 2/3 — 책 enqueue (멱등)
// ─────────────────────────────────────────────

/**
 * library_books에 INSERT (status='queued') + 트리거 자동 enqueue.
 * - 같은 (source, source_id) 책이 이미 있으면 그 ID 반환 (멱등).
 * - SECURITY DEFINER 함수가 권한 검증 + 멱등 처리.
 *
 * @returns 새로 생성된 또는 기존 book id
 */
export async function enqueueBookViaRpc(
  client: AdminClient,
  params: EnqueueBookParams,
): Promise<string> {
  const { data, error } = await client.rpc('admin_enqueue_book', {
    p_source: params.source,
    p_source_id: params.source_id,
    p_title: params.title,
    p_author: params.author ?? null,
    p_author_birth_year: params.author_birth_year ?? null,
    p_author_death_year: params.author_death_year ?? null,
    p_license: params.license ?? 'PD-US',
  })

  if (error) {
    throw new Error(`enqueueBook failed: ${error.message}`)
  }
  if (!data) {
    throw new Error('enqueueBook returned null')
  }
  return data as string
}

// ─────────────────────────────────────────────
// 5~7. Tab 4 — 책별 액션 RPC 래퍼
// ─────────────────────────────────────────────

/**
 * status='failed' 책을 'queued'로 되돌리고 pgmq에 재전송.
 */
export async function requeueBook(
  client: AdminClient,
  bookId: string,
): Promise<void> {
  const { error } = await client.rpc('admin_requeue_book', {
    p_book_id: bookId,
  })
  if (error) {
    throw new Error(`requeueBook failed: ${error.message}`)
  }
}

export interface BulkRollbackToCuratingResult {
  updatedCount: number
  skippedCount: number
  wordSetsDeleted: number
  blockedByUsers: number
  blockedByPublished: number
}

export interface BulkRollbackToQueuedResult {
  deletedCount: number
  skippedCount: number
  wordSetsDeleted: number
  seedUnlocked: number
  blockedByUsers: number
  blockedByPublished: number
}

/**
 * Bulk rollback: status='ready' → 'curating' + draft 챕터 단어장 DELETE.
 * library_book_vocabularies / library_chapters_master 는 보존 (재검수만 의도).
 * 안전 가드: published 단어장 1개라도 존재 / texts 가 이 도서 참조 시 row 스킵.
 */
export async function bulkSetBooksCurating(
  client: AdminClient,
  bookIds: string[],
): Promise<BulkRollbackToCuratingResult> {
  const { data, error } = await client.rpc('admin_bulk_set_books_curating', {
    p_book_ids: bookIds,
  })
  if (error) throw new Error(`bulkSetBooksCurating failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as {
    updated_count: number
    skipped_count: number
    word_sets_deleted: number
    blocked_by_users: number
    blocked_by_published: number
  } | null
  return {
    updatedCount: row?.updated_count ?? 0,
    skippedCount: row?.skipped_count ?? 0,
    wordSetsDeleted: row?.word_sets_deleted ?? 0,
    blockedByUsers: row?.blocked_by_users ?? 0,
    blockedByPublished: row?.blocked_by_published ?? 0,
  }
}

/**
 * Bulk return to source: (ready ∪ in_progress ∪ failed) library_books DELETE.
 * cascade 효과: library_book_vocabularies + library_chapters_master 자동 삭제,
 * library_seed_catalog.imported_book_id 자동 NULL → BulkFetchTab 에서 재 fetch 가능.
 * 명시 삭제: shared_word_sets drafts (FK 없음).
 * 안전 가드: published 단어장 / texts 참조 시 row 스킵.
 */
export async function bulkRequeueBooks(
  client: AdminClient,
  bookIds: string[],
): Promise<BulkRollbackToQueuedResult> {
  const { data, error } = await client.rpc('admin_bulk_requeue_books', {
    p_book_ids: bookIds,
  })
  if (error) throw new Error(`bulkRequeueBooks failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as {
    deleted_count: number
    skipped_count: number
    word_sets_deleted: number
    seed_unlocked: number
    blocked_by_users: number
    blocked_by_published: number
  } | null
  return {
    deletedCount: row?.deleted_count ?? 0,
    skippedCount: row?.skipped_count ?? 0,
    wordSetsDeleted: row?.word_sets_deleted ?? 0,
    seedUnlocked: row?.seed_unlocked ?? 0,
    blockedByUsers: row?.blocked_by_users ?? 0,
    blockedByPublished: row?.blocked_by_published ?? 0,
  }
}

// ─────────────────────────────────────────────
// 큐레이션 도서 일괄 dev 처리 큐 (book_curation_jobs)
//   enqueue: 처리중→dev_process · 검토대기→dev_reprocess. 드레인은 Claude Code 배치(MCP).
// ─────────────────────────────────────────────

export type CurationJobStatus = 'pending' | 'running' | 'awaiting_mapping' | 'done' | 'failed'
export type CurationJobMode = 'dev_process' | 'dev_reprocess'

export interface CurationJobRow {
  id: string
  bookId: string
  bookTitle: string
  bookStatus: BookStatus
  mode: CurationJobMode
  status: CurationJobStatus
  error: string | null
  note: string | null
  updatedAt: string
}

/** 큐 상태 뷰용 — 최근 작업 N건 + book 제목/현재 status (2 쿼리 merge, embed 의존 X). */
export async function fetchCurationJobs(
  client: AdminClient,
  limit = 100,
): Promise<CurationJobRow[]> {
  const { data, error } = await client
    .from('book_curation_jobs')
    .select('id, book_id, mode, status, error, note, updated_at')
    .eq('task_type', 'voice_map') // 퀴즈 통합(v06.x) — 매핑 잡만
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`fetchCurationJobs failed: ${error.message}`)
  const jobs = (data ?? []) as Array<{
    id: string
    book_id: string
    mode: CurationJobMode
    status: CurationJobStatus
    error: string | null
    note: string | null
    updated_at: string
  }>
  if (jobs.length === 0) return []

  const bookIds = Array.from(new Set(jobs.map((j) => j.book_id)))
  const { data: books, error: bErr } = await client
    .from('library_books')
    .select('id, title, status')
    .in('id', bookIds)
  if (bErr) throw new Error(`fetchCurationJobs (books) failed: ${bErr.message}`)
  const byId = new Map(
    ((books ?? []) as Array<{ id: string; title: string; status: string }>).map((b) => [b.id, b]),
  )

  return jobs.map((j) => {
    const b = byId.get(j.book_id)
    return {
      id: j.id,
      bookId: j.book_id,
      bookTitle: b?.title ?? '(삭제됨)',
      bookStatus: (b?.status ?? 'failed') as BookStatus,
      mode: j.mode,
      status: j.status,
      error: j.error,
      note: j.note,
      updatedAt: j.updated_at,
    }
  })
}

// ─────────────────────────────────────────────
// 스크립트 퀴즈 생성 큐 (book_curation_jobs · task_type='quiz_gen' — v06.x 통합)
//   enqueue: ready/published + 챕터 존재 도서. 드레인은 Claude Code 배치(MCP)가
//   챕터 본문을 읽어 library_chapter_quiz 를 채우고 진행률(chapters_done/questions_created) 갱신.
// ─────────────────────────────────────────────

export type QuizJobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface QuizJobRow {
  id: string
  bookId: string
  bookTitle: string
  status: QuizJobStatus
  bookVLevel: number | null
  targetPerChapter: number | null
  chaptersTotal: number
  chaptersDone: number
  questionsCreated: number
  error: string | null
  note: string | null
  updatedAt: string
}

/** 선택 도서를 퀴즈 생성 큐에 upsert(pending). 자격 외(status/챕터 없음)는 skipped. */
export async function enqueueQuizJobs(
  client: AdminClient,
  bookIds: string[],
): Promise<{ queued: number; skipped: number }> {
  const { data, error } = await client.rpc('enqueue_quiz_jobs', { p_book_ids: bookIds })
  if (error) throw new Error(`enqueueQuizJobs failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as {
    queued: number
    skipped: number
  } | null
  return { queued: row?.queued ?? 0, skipped: row?.skipped ?? 0 }
}

/** 퀴즈 큐 상태 뷰용 — 최근 작업 N건 + book 제목 (2 쿼리 merge). */
export async function fetchQuizJobs(client: AdminClient, limit = 100): Promise<QuizJobRow[]> {
  const { data, error } = await client
    .from('book_curation_jobs')
    .select(
      'id, book_id, status, book_v_level, target_per_chapter, chapters_total, chapters_done, questions_created, error, note, updated_at',
    )
    .eq('task_type', 'quiz_gen') // 퀴즈 통합(v06.x) — book_curation_jobs 로 흡수
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`fetchQuizJobs failed: ${error.message}`)
  const jobs = (data ?? []) as Array<{
    id: string
    book_id: string
    status: QuizJobStatus
    book_v_level: number | null
    target_per_chapter: number | null
    chapters_total: number
    chapters_done: number
    questions_created: number
    error: string | null
    note: string | null
    updated_at: string
  }>
  if (jobs.length === 0) return []

  const bookIds = Array.from(new Set(jobs.map((j) => j.book_id)))
  const { data: books, error: bErr } = await client
    .from('library_books')
    .select('id, title')
    .in('id', bookIds)
  if (bErr) throw new Error(`fetchQuizJobs (books) failed: ${bErr.message}`)
  const byId = new Map(
    ((books ?? []) as Array<{ id: string; title: string }>).map((b) => [b.id, b]),
  )

  return jobs.map((j) => ({
    id: j.id,
    bookId: j.book_id,
    bookTitle: byId.get(j.book_id)?.title ?? '(삭제됨)',
    status: j.status,
    bookVLevel: j.book_v_level,
    targetPerChapter: j.target_per_chapter,
    chaptersTotal: j.chapters_total,
    chaptersDone: j.chapters_done,
    questionsCreated: j.questions_created,
    error: j.error,
    note: j.note,
    updatedAt: j.updated_at,
  }))
}

/**
 * cefr_confidence 낮아도 강제로 publish.
 * - copyright_safe_in_kr=false 책은 서버에서 거부 (안전 가드).
 *
 * v06.55 — 브라우저 RPC 직접 호출 (admin_force_publish_book) 은 DEV_ADMIN_BYPASS=1
 *   환경에서 auth.uid()=NULL → is_admin_or_curator()=false → "Forbidden" throw.
 *   서버 API route (/api/admin/library/force-publish-book) 경유로 통일.
 *   client 인자는 호출부 시그니처 보존용 (실제 미사용 — fetch 만 호출).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function forcePublishBook(
  _client: AdminClient,
  bookId: string,
): Promise<void> {
  const res = await fetch('/api/admin/library/force-publish-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId }),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = (await res.json()) as { message?: string; error?: string }
      msg = j.message ?? j.error ?? msg
    } catch {
      /* non-JSON body */
    }
    throw new Error(`forcePublishBook failed: ${msg}`)
  }
}

/**
 * published 책을 'ready'로 되돌리고, 게시 트리거가 생성한 챕터 단어장 삭제.
 * - shared_words / user_word_set_subscriptions 는 FK CASCADE.
 * - published 상태가 아니면 RPC가 예외.
 * @returns 삭제된 shared_word_sets 개수
 */
export async function revertPublishedBook(
  client: AdminClient,
  bookId: string,
): Promise<number> {
  const { data, error } = await client.rpc('admin_revert_published_book', {
    p_book_id: bookId,
  })
  if (error) {
    throw new Error(`revertPublishedBook failed: ${error.message}`)
  }
  const row = Array.isArray(data) ? data[0] : data
  const n = (row as { deleted_word_sets?: number } | null)?.deleted_word_sets
  return typeof n === 'number' ? n : 0
}

/**
 * ready / archived 상태 도서 영구 삭제.
 * - 게시 트리거가 만든 챕터 단어장 함께 정리
 * - library_seed_catalog imported_to_books 해제 → 재enqueue 가능
 * - published / 처리 중 도서는 RPC에서 거부
 * @returns 삭제 통계 (word_sets/texts/seed unlinked 개수)
 */
export async function deleteBook(
  client: AdminClient,
  bookId: string,
): Promise<{ status_was: string; word_sets_deleted: number; texts_unlinked: number; seed_unlocked: number }> {
  const { data, error } = await client.rpc('admin_delete_book', { p_book_id: bookId })
  if (error) {
    throw new Error(`deleteBook failed: ${error.message}`)
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    status_was: (row as { status_was?: string } | null)?.status_was ?? '',
    word_sets_deleted: (row as { word_sets_deleted?: number } | null)?.word_sets_deleted ?? 0,
    texts_unlinked: (row as { texts_unlinked?: number } | null)?.texts_unlinked ?? 0,
    seed_unlocked: (row as { seed_unlocked?: number } | null)?.seed_unlocked ?? 0,
  }
}

/**
 * 책을 archived 상태로. published 책에서 호출하면 사용자에게 더 이상 노출 안 됨.
 */
export async function archiveBook(
  client: AdminClient,
  bookId: string,
): Promise<void> {
  const { error } = await client.rpc('admin_archive_book', {
    p_book_id: bookId,
  })
  if (error) {
    throw new Error(`archiveBook failed: ${error.message}`)
  }
}

// ─────────────────────────────────────────────
// 7.5 library_seed_catalog — bulk-fetch 결과 조회
// ─────────────────────────────────────────────

export interface SeedCatalogRow {
  id: string
  source: 'gutenberg' | 'standard_ebooks' | 'wikibooks' | 'librivox' | 'openstax' | 'simple_wikipedia'
  source_id: string
  title: string
  author: string | null
  language: string
  genre: string | null
  subjects: string[]
  popularity_rank: number | null
  cover_url: string | null
  source_url: string | null
  published_year: number | null
  word_count: number | null
  imported_to_books: boolean
  imported_book_id: string | null
  fetched_at: string
  /** true = Standard Ebooks 가 같은 책을 가진 Gutenberg 행 (view에서 계산) */
  shadowed_by_se?: boolean
  /** D + C 에서 채워지는 enriched 필드 */
  description: string | null
  reading_time_minutes: number | null
  enriched_at: string | null
  /** 큐레이션 메타 (Claude Code 배치 생성) */
  est_v_level: number | null
  curation_meta: {
    est_cefr?: string
    est_basis?: string
    age_band?: string
    learning_value?: string
    synopsis_ko?: string
    genre_norm?: string
    themes?: string[]
  } | null
  curation_status: 'pending' | 'queued' | 'done'
}

export interface ListCatalogOptions {
  source?: string | null
  /** @deprecated raw genre 정확 일치 — 신규 UI 는 genreKeyword(genre_norm) 사용 */
  genre?: string | null
  /** 유형 키워드 — 정규화 장르(curation_meta->>genre_norm) ilike. 현행화 v06.x */
  genreKeyword?: string | null
  search?: string | null
  importedOnly?: boolean
  notImportedOnly?: boolean
  /** 난이도 하한 — est_v_level >= (포함). 사용자 정책: 난이도 = V-Level 기준 */
  vLevelMin?: number | null
  /** 난이도 상한 — est_v_level <= (포함) */
  vLevelMax?: number | null
  /** 연령 버킷 — 'child'(≤9세) | 'teen'(10–14세) | 'adult'(≥15세) (curation_meta->>age_band) */
  ageBucket?: 'child' | 'teen' | 'adult' | null
  /** 큐레이션 상태 (pending/queued/done) */
  curationStatus?: 'pending' | 'queued' | 'done' | null
  limit?: number
  offset?: number
  sort?: 'popularity' | 'recent' | 'title'
  /** true (default) — Standard Ebooks 가 같은 책을 가진 Gutenberg 행 숨김 */
  preferStandardEbooks?: boolean
  /**
   * SE 중복 정리 상태 필터 (preferStandardEbooks 보다 우선):
   *   'shadowed'       — 삭제 대상 (SE 가 대체한 Gutenberg 중복) 만
   *   'gutenberg_only' — Gutenberg 단독 (SE 변환 후보) 만
   *   'all'/undefined  — 적용 안 함 (preferStandardEbooks 정책 그대로)
   */
  dupState?: 'all' | 'shadowed' | 'gutenberg_only'
}

/** 연령 버킷 → age_band 값 목록 (curation_meta->>age_band 는 '6+'…'18+' 텍스트) */
const AGE_BUCKET_BANDS: Record<'child' | 'teen' | 'adult', string[]> = {
  child: ['6+', '7+', '8+', '9+'],
  teen: ['10+', '11+', '12+', '13+', '14+'],
  adult: ['15+', '16+', '17+', '18+'],
}

export async function listSeedCatalog(
  client: AdminClient,
  options: ListCatalogOptions = {},
): Promise<{ rows: SeedCatalogRow[]; total: number }> {
  let query = client
    .from('library_seed_catalog_view')
    .select('*', { count: 'exact' })

  // SE 중복 정리 상태 필터 — preferStandardEbooks 보다 우선
  if (options.dupState === 'shadowed') {
    // 삭제 대상 (SE 가 대체한 Gutenberg 중복)
    query = query.eq('shadowed_by_se', true)
  } else if (options.dupState === 'gutenberg_only') {
    // Gutenberg 단독 (SE 변환 후보) — SE 중복 없음
    query = query.eq('source', 'gutenberg').eq('shadowed_by_se', false)
  } else if (options.preferStandardEbooks !== false) {
    // Std Ebooks 가 같은 책을 가진 Gutenberg 행 숨김 (default true)
    query = query.eq('shadowed_by_se', false)
  }

  if (options.source) query = query.eq('source', options.source)
  if (options.genre) query = query.eq('genre', options.genre)
  // 유형 키워드 — 정규화 장르(genre_norm) ilike (현행화: raw genre 대신 큐레이션 유형 사용)
  if (options.genreKeyword) {
    query = query.ilike('curation_meta->>genre_norm', `%${options.genreKeyword}%`)
  }
  if (options.search) {
    const s = `%${options.search}%`
    query = query.or(`title.ilike.${s},author.ilike.${s}`)
  }
  if (options.importedOnly) query = query.eq('imported_to_books', true)
  if (options.notImportedOnly) query = query.eq('imported_to_books', false)
  // 난이도 — est_v_level 밴드 (사용자 정책: 난이도 = V-Level 기준)
  if (options.vLevelMin != null) query = query.gte('est_v_level', options.vLevelMin)
  if (options.vLevelMax != null) query = query.lte('est_v_level', options.vLevelMax)
  // 연령 버킷 — age_band 텍스트 목록 매칭
  if (options.ageBucket) {
    query = query.in('curation_meta->>age_band', AGE_BUCKET_BANDS[options.ageBucket])
  }
  if (options.curationStatus) query = query.eq('curation_status', options.curationStatus)

  const sortCol =
    options.sort === 'title'
      ? 'title'
      : options.sort === 'recent'
        ? 'fetched_at'
        : 'popularity_rank'
  query = query.order(sortCol, { ascending: options.sort === 'title', nullsFirst: false })
  query = query.range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) throw new Error(`listSeedCatalog failed: ${error.message}`)
  return { rows: (data ?? []) as unknown as SeedCatalogRow[], total: count ?? 0 }
}

export interface QueueCurationResult {
  queued: number
  total_pending: number
  total_queued: number
}

/**
 * 소스 후보(library_seed_catalog) 중 큐레이션 메타가 없는 도서를 인기순 우선 "큐"에 추가.
 * 실제 메타(유형·연령·인기도·학습도움·추정 V-Level·줄거리) 생성은 Claude Code 배치가
 * curation_status='queued' 행을 drain (런타임 LLM 키 불요).
 */
export async function queueSeedCatalogForCuration(
  client: AdminClient,
  opts: { limit?: number; source?: string | null; notImportedOnly?: boolean } = {},
): Promise<QueueCurationResult> {
  const { data, error } = await client.rpc('queue_seed_catalog_for_curation', {
    p_limit: opts.limit ?? 100,
    p_source: opts.source ?? null,
    p_not_imported_only: opts.notImportedOnly ?? true,
  })
  if (error) throw new Error(`queueSeedCatalogForCuration failed: ${error.message}`)
  const row = (data ?? [])[0] as QueueCurationResult | undefined
  return row ?? { queued: 0, total_pending: 0, total_queued: 0 }
}

/** library_seed_catalog 소스 (실제 seed fetcher 5종 — bySource 카운트 대상).
 *  openstax/wikisource 는 bulk fetcher 가 없어 catalog 에 안 들어옴. simple_wikipedia 가 기본 소스. */
const CATALOG_SOURCES = [
  'gutenberg',
  'standard_ebooks',
  'wikibooks',
  'librivox',
  'simple_wikipedia',
  'lit2go',
] as const

export async function getCatalogStats(
  client: AdminClient,
): Promise<{ total: number; bySource: Record<string, number>; imported: number; shadowed: number }> {
  // ⚠️ 이전 구현은 모든 row 를 fetch 해 JS 에서 count → PostgREST 기본 1,000행 제한에
  //    걸려 total/bySource 가 1,000 에서 잘림. count:'exact', head:true 로 정확 집계 (행 전송 0).
  const headCount = () =>
    client.from('library_seed_catalog_view').select('*', { count: 'exact', head: true })

  const [totalRes, importedRes, shadowedRes, ...sourceRes] = await Promise.all([
    headCount(),
    headCount().eq('imported_to_books', true),
    headCount().eq('shadowed_by_se', true),
    ...CATALOG_SOURCES.map((s) => headCount().eq('source', s)),
  ])

  const firstErr =
    totalRes.error ?? importedRes.error ?? shadowedRes.error ?? sourceRes.find((r) => r.error)?.error
  if (firstErr) throw new Error(`getCatalogStats failed: ${firstErr.message}`)

  const bySource: Record<string, number> = {}
  CATALOG_SOURCES.forEach((s, i) => {
    const c = sourceRes[i]?.count ?? 0
    if (c > 0) bySource[s] = c
  })

  return {
    total: totalRes.count ?? 0,
    bySource,
    imported: importedRes.count ?? 0,
    shadowed: shadowedRes.count ?? 0,
  }
}

/** library_seed_catalog 1건을 library_books 큐에 enqueue + imported 플래그 갱신 */
export async function enqueueSeedRow(
  client: AdminClient,
  row: SeedCatalogRow,
): Promise<string> {
  const bookId = await enqueueBookViaRpc(client, {
    source: row.source,
    source_id: row.source_id,
    title: row.title,
    author: row.author,
  })
  // imported 플래그 갱신 — 실패 시 throw (안 그러면 큐엔 들어갔는데 catalog 가 미반영 →
  //   UI 가 enqueue 재허용 → 중복 등록). RPC 가 idempotent 라 에러 surface 는 안전.
  const { error: flagErr } = await client
    .from('library_seed_catalog')
    .update({ imported_to_books: true, imported_book_id: bookId })
    .eq('id', row.id)
  if (flagErr) {
    throw new Error(`enqueueSeedRow: imported 플래그 갱신 실패 (book ${bookId}): ${flagErr.message}`)
  }
  return bookId
}

// ─────────────────────────────────────────────
// 8. Tab 4 — 책 학습 단어 추출 preview
//    v06.35 — select_book_chapter_vocab(SSoT) 그대로. preview == 실제 발행.
//    threshold = book_v_level (percentile deprecated). 고어/시대어 제외(→ 본문 툴팁).
// ─────────────────────────────────────────────

export type ExtractPercentile = 70 | 75 | 80

export interface ExtractedBookWord {
  book_v_level: number
  /** = book_v_level (발행 기준). v06.35 부터 percentile 과 무관 */
  v_threshold: number
  /** echo only — deprecated (preview==publish, threshold 는 항상 book_v_level) */
  percentile_used: number
  total_candidates: number
  /** v06.35 — 챕터 단위 (단어가 여러 챕터면 챕터별 행) */
  chapter_idx: number
  word: string
  meaning_ko: string | null
  v_level: number
  cefr_level: string | null
  pos: string | null
  example_en: string | null
  /** V11 register (standard|modern_advanced) — 고어/시대어/구단위는 추출에서 제외됨 */
  word_register: string | null
  frequency_rank: number | null
  skill_level: number | null
  /** 해당 챕터 내 출현 빈도 */
  frequency_in_chapter: number | null
  composite_score: string
  score_breakdown: Record<string, unknown>
  rank: number
  /** (예약) 철자/굴절 회수 — 현재 SSoT 는 lemma||word 매칭. 미구현 시 undefined */
  match_via?: 'lemma' | 'spelling_variant' | 'inflection'
  matched_from?: string | null
}

/**
 * 책 자체 V-Level(P70/75/80) 을 baseline 으로 책 vocab 풀에서 점수화 + 정렬.
 * /text/new ExtractionPanel 과 동일 composite (track_boost=0).
 * read-only — 영구 저장 없음. preview/검수 전용.
 */
export async function extractBookVocabularyAdmin(
  client: AdminClient,
  bookId: string,
  percentile: ExtractPercentile = 75,
): Promise<ExtractedBookWord[]> {
  // range 페이지네이션 — PostgREST 행 상한(기본/서비스 1000)을 우회해 후보 전량 수신.
  // 각 .range 요청은 상한 이하라 항상 안전. 짧은 페이지가 나오면 종료. (추출 1회당 1~수 회 호출)
  const PAGE = 1000
  const MAX = 20000 // 안전 상한 (어떤 책도 초과 안 함)
  const all: ExtractedBookWord[] = []
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await client
      .rpc('extract_book_vocabulary_admin', {
        p_book_id: bookId,
        p_percentile: percentile,
      })
      .range(from, from + PAGE - 1)
    if (error) {
      throw new Error(`extractBookVocabularyAdmin failed: ${error.message}`)
    }
    const batch = (data ?? []) as unknown as ExtractedBookWord[]
    all.push(...batch)
    if (batch.length < PAGE) break // 마지막 페이지
  }
  return all
}

// ─────────────────────────────────────────────
// 9. 책 lemma 사전 바인딩 실패 진단 (원인별)
// ─────────────────────────────────────────────

export type UnboundReason =
  | 'spelling_variant'  // US/UK 철자 변형 시 사전 히트 (variant_hit 에 canonical)
  | 'genuine_miss'      // 영단어로 보이나 사전 미등재 — seed 후보
  | 'noise'             // 고유명사·로마숫자·단편 (학습 대상 아님)
  | 'no_v_level'        // dict row 있으나 v_level NULL
  | 'not_classified'    // classified_by NULL (자동 분류 미완료)
  | 'no_meaning'        // meaning_ko 비어있음

export interface UnboundLemma {
  lemma: string
  reason: UnboundReason
  dict_v_level: number | null
  dict_meaning_ko: string | null
  dict_classified_by: string | null
  book_occurrences: number
  /** spelling_variant 인 경우 사전에 실재하는 canonical 철자 (예: 'ardour') */
  variant_hit: string | null
  /**
   * 추출기(extract_*)가 freq_external_a inflections 클러스터로 회수하는 base 표제어.
   * non-null 이면 이 lemma 는 reason 과 무관하게 추출 시 base 단어로 이미 surface 됨
   * (예: 'abundance' → 'abundant'). seed 우선순위 판단용 — null 이면 클러스터 미회수.
   */
  cluster_base: string | null
  /**
   * en_inflection_bases 규칙으로 나온 굴절 base 중 사전에 실재하는 표제어(meta 무관).
   * 미바인딩 row 에서 non-null 이면 "굴절형인데 base 가 사전엔 있으나 미완성" — dict_v_level/뜻과 함께 점검.
   */
  inflection_base: string | null
  /**
   * en_derivational_bases 규칙으로 나온 파생 base 중 완전한 표제어(v_level+classified_by+meaning_ko).
   * "이 lemma 는 X 의 파생형" — seed 후보 판단용.
   */
  deriv_base: string | null
  /**
   * archaic_candidates.classification — classify 파이프라인 위치
   * (processed/addable_modern/person_noise/geo_noise/spelling_variant/pending). 미수집 시 null.
   */
  archaic_class: string | null
}

export async function findUnboundBookLemmas(
  client: AdminClient,
  bookId: string,
  limit = 500,
): Promise<UnboundLemma[]> {
  const { data, error } = await client.rpc('find_unbound_book_lemmas', {
    p_book_id: bookId,
    p_limit: limit,
  })
  if (error) {
    throw new Error(`findUnboundBookLemmas failed: ${error.message}`)
  }
  return (data ?? []) as unknown as UnboundLemma[]
}

export interface StageDictResult {
  /** 이번에 pending → addable_modern 으로 올린 건수 */
  staged: number
  /** 이 책에서 addable_modern(등재 대기) 총건수 */
  already_addable: number
  /** 아직 분류되지 않은(pending) 잔여 */
  book_pending_remaining: number
}

/**
 * 본문검수 중인 도서의 미등재 실단어를 "사전 등재 큐"(archaic_candidates.addable_modern)로 즉시 올림.
 * 재출현 게이트(cron)를 우회 — admin 이 적극 검수하는 책은 바로 등재 대상으로 큐잉.
 * 실제 뜻 생성·사전 등재는 Claude Code 배치가 addable_modern 을 drain (런타임 LLM 키 불요).
 */
export async function stageBookDictCandidates(
  client: AdminClient,
  bookId: string,
): Promise<StageDictResult> {
  const { data, error } = await client.rpc('stage_book_dict_candidates', { p_book_id: bookId })
  if (error) {
    throw new Error(`stageBookDictCandidates failed: ${error.message}`)
  }
  const row = (data ?? [])[0] as StageDictResult | undefined
  return row ?? { staged: 0, already_addable: 0, book_pending_remaining: 0 }
}

/**
 * Dev-only — Admin UI "Process Now" 버튼.
 * /api/lcp/dev-process 호출 (pg_cron 우회, in-process 파이프라인 실행).
 * 프로덕션에서는 라우트가 403 반환.
 */
export async function devProcessBook(bookId: string): Promise<void> {
  const res = await fetch('/api/lcp/dev-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId }),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `dev-process failed: ${res.status}`)
  }
}

export interface DevValidateResult {
  ok: boolean
  chapter_count?: number
  word_count?: number
  avg_chapter_words?: number
  length_cv?: number
  warnings: string[]
  verdict: 'OK' | 'REVIEW' | 'FAIL'
  error?: string
}

/**
 * 재처리 '커밋 전' dry-run 검증 — ingest→normalize→segment 만 (쓰기 X · LLM X).
 * 예상 챕터 수 + 경고(under/over-split·fragment) 반환. 실제 재처리(devProcessBook) 전 확인용.
 */
export async function devValidateBook(bookId: string): Promise<DevValidateResult> {
  const res = await fetch('/api/lcp/dev-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId }),
  })
  const payload = (await res.json().catch(() => ({}))) as DevValidateResult
  // dev-validate 는 ingest 실패도 200 + verdict='FAIL' 로 반환 — 비-200 은 auth/config 오류
  if (!res.ok) {
    throw new Error(payload.error ?? `dev-validate failed: ${res.status}`)
  }
  return { ...payload, warnings: payload.warnings ?? [] }
}

// ─────────────────────────────────────────────
// 헬퍼 — UI에서 자주 쓰이는 변환
// ─────────────────────────────────────────────

/**
 * llm_cost_usd (NUMERIC string) → number 변환.
 * supabase-js는 NUMERIC을 string으로 반환하므로 UI 표시 전 parseFloat 필요.
 */
export function parseLlmCost(cost: string | null): number {
  if (!cost) return 0
  const n = parseFloat(cost)
  return Number.isFinite(n) ? n : 0
}

/**
 * status → UI 라벨 + 색 분류.
 */
export function classifyStatus(status: BookStatus): {
  label: string
  tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
} {
  switch (status) {
    case 'published':
      return { label: '게시됨', tone: 'success' }
    case 'ready':
      return { label: '검토 대기', tone: 'warning' }
    case 'failed':
      return { label: '실패', tone: 'danger' }
    case 'archived':
      return { label: '보관됨', tone: 'neutral' }
    case 'queued':
      return { label: '대기 중', tone: 'info' }
    case 'ingesting':
      return { label: '수집 중', tone: 'info' }
    case 'normalizing':
      return { label: '정제 중', tone: 'info' }
    case 'segmenting':
      return { label: '분할 중', tone: 'info' }
    case 'analyzing':
      return { label: '분석 중', tone: 'info' }
    case 'curating':
      return { label: '큐레이션 중', tone: 'info' }
    default:
      return { label: status, tone: 'neutral' }
  }
}
