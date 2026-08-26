// apps/web/src/lib/pd-comic/queries.ts
//
// PDCP 조회 — 퍼블릭도메인 스캔 만화. **CCP(lib/comic)와 완전히 분리된 경로.**
//
// 마이그레이션(scripts/comic/pd/migration.sql)이 아직 적용되지 않았을 수 있다.
// 그 상태에서 화면이 터지면 안 되므로, 테이블/RPC 부재를 **정상 상태로 취급**하고
// 빈 결과 + `ready:false` 를 돌려준다(기존 CCP 리더가 쓰는 graceful degrade 패턴과 동일).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

// 순수 타입·상수는 model.ts 가 SSoT (클라이언트도 import 해야 하므로 server-only 밖).
import type {
  PdComicAdminRow,
  PdComicInfo,
  PdComicIssue,
  PdComicPanel,
  PdComicShelfKind,
  PdComicShelfSeries,
  PdPanelAdmin,
  PdResult,
} from './model'

export * from './model'

const NOT_READY = /relation .* does not exist|function .* does not exist|Could not find the function|PGRST202|42P01/i

function isSchemaMissing(err: unknown): boolean {
  const m = (err as { message?: string; code?: string } | null)
  return !!m && (NOT_READY.test(m.message ?? '') || m.code === '42P01' || m.code === 'PGRST202')
}

/**
 * 학습자 호 목록 — 발행본만 (RPC 내부에서 게이트).
 * `seriesKey` 를 주면 그 시리즈 안의 호만. 안 주면 전량.
 */
export async function listPdComics(
  client: SupabaseClient,
  seriesKey?: string,
): Promise<PdResult<PdComicIssue[]>> {
  const { data, error } = await client.rpc('list_pd_comics', {
    p_series_key: seriesKey ?? null,
  })
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
      kind: (r.kind as string) ?? null,
      kindLabel: (r.kind_label as string) ?? null,
      seriesKey: (r.series_key as string) ?? null,
    })),
  }
}

/**
 * 학습자 서가 — **유형 → 시리즈** 2단 묶음.
 *
 * RPC 는 (유형, 시리즈) 평면 행을 주고 여기서 접는다. DB 에서 중첩 JSON 을 만들지 않는 이유는
 * 유형별 집계(issuesPublished)를 화면이 다시 세지 않게 하면서도, RPC 는 평범한 테이블 함수로
 * 두어 admin·테스트가 같은 것을 SQL 로 확인할 수 있게 하기 위해서다.
 */
export async function listPdComicShelf(
  client: SupabaseClient,
): Promise<PdResult<PdComicShelfKind[]>> {
  const { data, error } = await client.rpc('list_pd_comic_shelf')
  if (error) {
    if (isSchemaMissing(error)) return { ready: false, data: [] }
    throw error
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  return { ready: true, data: foldShelf(rows) }
}

/**
 * 평면 (유형, 시리즈) 행 → 유형 묶음. 순수 함수라 테스트가 DB 없이 검증한다.
 * RPC 가 이미 `kind_sort, 발행수 desc` 로 정렬해 주므로 **여기서 다시 정렬하지 않는다** —
 * 두 곳이 순서를 정하면 언젠가 어긋난다.
 */
export function foldShelf(rows: Array<Record<string, unknown>>): PdComicShelfKind[] {
  const out: PdComicShelfKind[] = []
  const byKind = new Map<string, PdComicShelfKind>()

  for (const r of rows) {
    const kind = String(r.kind)
    const series: PdComicShelfSeries = {
      kind,
      kindLabel: String(r.kind_label ?? kind),
      kindBlurb: (r.kind_blurb as string) ?? null,
      kindLearnerNote: (r.kind_learner_note as string) ?? null,
      kindSort: Number(r.kind_sort ?? 99),
      seriesKey: String(r.series_key),
      seriesTitle: String(r.series_title),
      publisher: (r.publisher as string) ?? null,
      seriesBlurb: (r.series_blurb as string) ?? null,
      yearFrom: (r.year_from as number) ?? null,
      yearTo: (r.year_to as number) ?? null,
      issuesPublished: Number(r.issues_published ?? 0),
      panelsTotal: Number(r.panels_total ?? 0),
      coverUrl: (r.cover_url as string) ?? null,
    }
    let bucket = byKind.get(kind)
    if (!bucket) {
      bucket = {
        kind,
        label: series.kindLabel,
        blurb: series.kindBlurb,
        learnerNote: series.kindLearnerNote,
        sort: series.kindSort,
        series: [],
        issuesPublished: 0,
      }
      byKind.set(kind, bucket)
      out.push(bucket) // 삽입 순서 = RPC 정렬 순서
    }
    bucket.series.push(series)
    bucket.issuesPublished += series.issuesPublished
  }
  return out
}

/** 콘텐츠 정보 팝업 — 한 호의 서지·유형 학습노트·출처·분량. */
export async function selectPdComicInfo(
  client: SupabaseClient,
  slug: string,
): Promise<PdComicInfo | null> {
  const { data, error } = await client.rpc('select_pd_comic_info', { p_slug: slug })
  if (error) return null
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!r) return null
  return {
    slug: String(r.slug),
    title: String(r.title),
    issueNo: (r.issue_no as number) ?? null,
    publishedYear: (r.published_year as number) ?? null,
    coverUrl: (r.cover_url as string) ?? null,
    panelsTotal: Number(r.panels_total ?? 0),
    vLevel: (r.v_level as number) ?? null,
    libraryBookId: (r.library_book_id as string) ?? null,
    seriesKey: (r.series_key as string) ?? null,
    seriesTitle: (r.series_title as string) ?? null,
    seriesBlurb: (r.series_blurb as string) ?? null,
    publisher: (r.publisher as string) ?? null,
    kind: (r.kind as string) ?? null,
    kindLabel: (r.kind_label as string) ?? null,
    kindBlurb: (r.kind_blurb as string) ?? null,
    kindLearnerNote: (r.kind_learner_note as string) ?? null,
    sourceArchive: (r.source_archive as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    pdBasis: (r.pd_basis as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    bubbleCount: Number(r.bubble_count ?? 0),
    seriesIssuesPublished: Number(r.series_issues_published ?? 0),
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

// ── Admin (전 상태 조회 — RLS 우회는 하지 않고 admin 세션으로) ──────

export async function listPdComicsAdmin(
  client: SupabaseClient,
): Promise<PdResult<PdComicAdminRow[]>> {
  const { data, error } = await client
    .from('pd_comic_issues')
    .select(
      'id, slug, title, series_title, issue_no, published_year, cover_url, panels_total, v_level, ' +
        'library_book_id, status, source_adapter, source_identifier, source_url, pd_basis, ' +
        'pd_checked_at, published_at, qc, last_error, attempts, last_run_at, acquire_pages, ' +
        'kind, series_key',
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
      kind: (r.kind as string) ?? null,
      // admin 목록은 유형 라벨을 조인하지 않는다 — 운영 화면은 키로 필터하고,
      // 라벨은 학습자 경로(RPC)에서만 필요하다.
      kindLabel: null,
      seriesKey: (r.series_key as string) ?? null,
      status: String(r.status),
      sourceAdapter: String(r.source_adapter),
      sourceIdentifier: String(r.source_identifier),
      sourceUrl: (r.source_url as string) ?? null,
      pdBasis: (r.pd_basis as string) ?? null,
      pdCheckedAt: (r.pd_checked_at as string) ?? null,
      lastError: (r.last_error as string) ?? null,
      attempts: (r.attempts as number) ?? 0,
      publishedAt: (r.published_at as string) ?? null,
      qc: (r.qc as Record<string, unknown>) ?? null,
      lastRunAt: (r.last_run_at as string) ?? null,
      acquirePages: (r.acquire_pages as number) ?? null,
    })),
  }
}

/**
 * Admin 컷 콘텐츠 조회 — 발행 전 이슈의 대사/OCR 상태 관찰용.
 * pd_comic_panels 는 published-gate RLS 라 학습자 경로로는 못 읽는다 → service-role(admin) 세션 전용.
 * 스키마/이슈 미존재는 정상(ready:false / 빈 배열).
 */
export async function selectPdPanelsAdmin(
  client: SupabaseClient,
  issueId: string,
): Promise<PdResult<PdPanelAdmin[]>> {
  const { data, error } = await client
    .from('pd_comic_panels')
    .select('panel_order, source_page_no, image_url, bubbles, target_vocab')
    .eq('issue_id', issueId)
    .order('panel_order', { ascending: true })
  if (error) {
    if (isSchemaMissing(error)) return { ready: false, data: [] }
    throw error
  }
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  return {
    ready: true,
    data: rows.map((r) => ({
      panelOrder: Number(r.panel_order),
      sourcePageNo: r.source_page_no == null ? null : Number(r.source_page_no),
      imageUrl: (r.image_url as string) ?? null,
      bubbles: Array.isArray(r.bubbles) ? (r.bubbles as PdPanelAdmin['bubbles']) : [],
      targetVocab: Array.isArray(r.target_vocab) ? (r.target_vocab as string[]) : [],
    })),
  }
}

