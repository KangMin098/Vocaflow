// apps/web/src/lib/pd-comic/queries.ts
//
// PDCP 조회 — 퍼블릭도메인 스캔 만화. **CCP(lib/comic)와 완전히 분리된 경로.**
//
// 마이그레이션(scripts/comic/pd/migration.sql)이 아직 적용되지 않았을 수 있다.
// 그 상태에서 화면이 터지면 안 되므로, 테이블/RPC 부재를 **정상 상태로 취급**하고
// 빈 결과 + `ready:false` 를 돌려준다(기존 CCP 리더가 쓰는 graceful degrade 패턴과 동일).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PdComicIssue {
  id: string
  slug: string
  title: string
  seriesTitle: string | null
  issueNo: number | null
  publishedYear: number | null
  coverUrl: string | null
  panelsTotal: number
  vLevel: number | null
  libraryBookId: string | null
}

export interface PdComicPanel {
  panelOrder: number
  sourcePageNo: number
  imageUrl: string
  bubbles: Array<{ text: string; box?: { x: number; y: number; w: number; h: number }; kind?: string }>
  targetVocab: string[]
}

export interface PdComicProvenance {
  title: string
  seriesTitle: string | null
  issueNo: number | null
  publishedYear: number | null
  sourceArchive: string | null
  sourceUrl: string | null
  pdBasis: string | null
}

/** 스키마 미적용을 정상 상태로 구분하기 위한 래퍼. */
export interface PdResult<T> {
  /** 마이그레이션이 적용돼 조회가 실제로 수행됐는가 */
  ready: boolean
  data: T
}

const NOT_READY = /relation .* does not exist|function .* does not exist|Could not find the function|PGRST202|42P01/i

function isSchemaMissing(err: unknown): boolean {
  const m = (err as { message?: string; code?: string } | null)
  return !!m && (NOT_READY.test(m.message ?? '') || m.code === '42P01' || m.code === 'PGRST202')
}

/** 학습자 서가 — 발행본만 (RPC 내부에서 게이트). */
export async function listPdComics(client: SupabaseClient): Promise<PdResult<PdComicIssue[]>> {
  const { data, error } = await client.rpc('list_pd_comics')
  if (error) {
    if (isSchemaMissing(error)) return { ready: false, data: [] }
    throw error
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  return {
    ready: true,
    data: rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title),
      seriesTitle: (r.series_title as string) ?? null,
      issueNo: (r.issue_no as number) ?? null,
      publishedYear: (r.published_year as number) ?? null,
      coverUrl: (r.cover_url as string) ?? null,
      panelsTotal: Number(r.panels_total ?? 0),
      vLevel: (r.v_level as number) ?? null,
      libraryBookId: (r.library_book_id as string) ?? null,
    })),
  }
}

/** 리더 — 호 하나의 전 컷. */
export async function selectPdComic(
  client: SupabaseClient,
  slug: string,
): Promise<PdResult<PdComicPanel[]>> {
  const { data, error } = await client.rpc('select_pd_comic', { p_slug: slug })
  if (error) {
    if (isSchemaMissing(error)) return { ready: false, data: [] }
    throw error
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  return {
    ready: true,
    data: rows.map((r) => ({
      panelOrder: Number(r.panel_order),
      sourcePageNo: Number(r.source_page_no),
      imageUrl: String(r.image_url),
      bubbles: Array.isArray(r.bubbles) ? (r.bubbles as PdComicPanel['bubbles']) : [],
      targetVocab: Array.isArray(r.target_vocab) ? (r.target_vocab as string[]) : [],
    })),
  }
}

/** 출처 표기 — PD 소재는 출처를 밝히는 것이 신뢰의 문제다. */
export async function selectPdProvenance(
  client: SupabaseClient,
  slug: string,
): Promise<PdComicProvenance | null> {
  const { data, error } = await client.rpc('select_pd_comic_provenance', { p_slug: slug })
  if (error) return null
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!r) return null
  return {
    title: String(r.title),
    seriesTitle: (r.series_title as string) ?? null,
    issueNo: (r.issue_no as number) ?? null,
    publishedYear: (r.published_year as number) ?? null,
    sourceArchive: (r.source_archive as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    pdBasis: (r.pd_basis as string) ?? null,
  }
}

// ── Admin (전 상태 조회 — RLS 우회는 하지 않고 admin 세션으로) ──────

export interface PdComicAdminRow extends PdComicIssue {
  status: string
  sourceAdapter: string
  sourceIdentifier: string
  sourceUrl: string | null
  pdBasis: string | null
  pdCheckedAt: string | null
  publishedAt: string | null
  qc: Record<string, unknown> | null
}

export async function listPdComicsAdmin(
  client: SupabaseClient,
): Promise<PdResult<PdComicAdminRow[]>> {
  const { data, error } = await client
    .from('pd_comic_issues')
    .select(
      'id, slug, title, series_title, issue_no, published_year, cover_url, panels_total, v_level, ' +
        'library_book_id, status, source_adapter, source_identifier, source_url, pd_basis, ' +
        'pd_checked_at, published_at, qc',
    )
    .order('created_at', { ascending: false })
  if (error) {
    if (isSchemaMissing(error)) return { ready: false, data: [] }
    throw error
  }
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  return {
    ready: true,
    data: rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title),
      seriesTitle: (r.series_title as string) ?? null,
      issueNo: (r.issue_no as number) ?? null,
      publishedYear: (r.published_year as number) ?? null,
      coverUrl: (r.cover_url as string) ?? null,
      panelsTotal: Number(r.panels_total ?? 0),
      vLevel: (r.v_level as number) ?? null,
      libraryBookId: (r.library_book_id as string) ?? null,
      status: String(r.status),
      sourceAdapter: String(r.source_adapter),
      sourceIdentifier: String(r.source_identifier),
      sourceUrl: (r.source_url as string) ?? null,
      pdBasis: (r.pd_basis as string) ?? null,
      pdCheckedAt: (r.pd_checked_at as string) ?? null,
      publishedAt: (r.published_at as string) ?? null,
      qc: (r.qc as Record<string, unknown>) ?? null,
    })),
  }
}

/** 파이프라인 단계 — Admin stepper 와 CLI 단계명을 한 곳에서 맞춘다. */
export const PD_STAGES = [
  { key: 'acquired', label: '취득' },
  { key: 'restored', label: '복원' },
  { key: 'segmented', label: '컷 분할' },
  { key: 'ocr', label: '대사 추출' },
  { key: 'review', label: '검수' },
  { key: 'published', label: '발행' },
] as const

export function stageIndex(status: string): number {
  const i = PD_STAGES.findIndex((s) => s.key === status)
  return i < 0 ? 0 : i
}
