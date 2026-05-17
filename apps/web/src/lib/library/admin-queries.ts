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
        'llm_cost_usd, copyright_safe_in_kr, published_at, created_at, updated_at',
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
  return (data ?? []) as unknown as LibraryBookAdminRow[]
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

/**
 * cefr_confidence 낮아도 강제로 publish.
 * - copyright_safe_in_kr=false 책은 RPC에서 거부 (안전 가드).
 */
export async function forcePublishBook(
  client: AdminClient,
  bookId: string,
): Promise<void> {
  const { error } = await client.rpc('admin_force_publish_book', {
    p_book_id: bookId,
  })
  if (error) {
    throw new Error(`forcePublishBook failed: ${error.message}`)
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
