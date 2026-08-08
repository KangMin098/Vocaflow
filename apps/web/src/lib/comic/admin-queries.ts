// apps/web/src/lib/comic/admin-queries.ts
//
// CCP admin 데이터 접근 — /admin/comic 콘솔용. RLS admin/curator 정책으로 직접 read/write.
// 마이그레이션 미적용 시(테이블/RPC 부재) 전부 빈 목록/오류 문자열로 graceful degrade.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ComicCatalogRow {
  bookId: string
  title: string
  author: string | null
  bookStatus: string
  vLevel: number | null
  comicStatus: 'none' | 'draft' | 'published' | 'archived'
  panelsTotal: number
  panelsPass: boolean
  jobStatus: string | null
  panelsDone: number | null
  jobError: string | null
}

/** 만화화 대상 도서(ready/published) + 만화 헤더/큐 상태 병합. */
export async function listComicCatalog(client: SupabaseClient): Promise<ComicCatalogRow[]> {
  const [{ data: books, error: bErr }, headers, jobs] = await Promise.all([
    client
      .from('library_books')
      .select('id, title, author, status, book_v_level')
      .in('status', ['ready', 'published'])
      .order('title'),
    client.from('comic_books').select('library_book_id, status, panels_total, panels_pass'),
    client
      .from('book_curation_jobs')
      .select('book_id, status, panels_done, panels_total, error')
      .eq('task_type', 'comic_gen'),
  ])
  if (bErr || !books) return []
  const hMap = new Map(
    ((headers.data as Array<{ library_book_id: string; status: string; panels_total: number; panels_pass: boolean }>) ?? []).map(
      (h) => [h.library_book_id, h],
    ),
  )
  const jMap = new Map(
    ((jobs.data as Array<{ book_id: string; status: string; panels_done: number | null; panels_total: number | null; error: string | null }>) ?? []).map(
      (j) => [j.book_id, j],
    ),
  )
  return (books as Array<{ id: string; title: string; author: string | null; status: string; book_v_level: number | null }>).map(
    (b) => {
      const h = hMap.get(b.id)
      const j = jMap.get(b.id)
      return {
        bookId: b.id,
        title: b.title,
        author: b.author,
        bookStatus: b.status,
        vLevel: b.book_v_level,
        comicStatus: (h?.status as ComicCatalogRow['comicStatus']) ?? 'none',
        panelsTotal: h?.panels_total ?? 0,
        panelsPass: h?.panels_pass ?? false,
        jobStatus: j?.status ?? null,
        panelsDone: j?.panels_done ?? null,
        jobError: j?.error ?? null,
      }
    },
  )
}

export interface ComicStats {
  eligible: number
  drafts: number
  published: number
  queued: number
}

export function summarize(rows: ComicCatalogRow[]): ComicStats {
  return {
    eligible: rows.length,
    drafts: rows.filter((r) => r.comicStatus === 'draft').length,
    published: rows.filter((r) => r.comicStatus === 'published').length,
    queued: rows.filter((r) => r.jobStatus === 'pending' || r.jobStatus === 'running').length,
  }
}

/** 큐 적재 — enqueue_comic_jobs RPC. */
export async function enqueueComicJobs(
  client: SupabaseClient,
  bookIds: string[],
): Promise<{ queued: number; skipped: number }> {
  const { data, error } = await client.rpc('enqueue_comic_jobs', { p_book_ids: bookIds })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return { queued: row?.queued ?? 0, skipped: row?.skipped ?? 0 }
}

/** 발행/회수 — admin_set_comic_published RPC (QC 게이트는 RPC 내부에서 강제). */
export async function setComicPublished(
  client: SupabaseClient,
  bookId: string,
  published: boolean,
): Promise<void> {
  const { error } = await client.rpc('admin_set_comic_published', {
    p_book_id: bookId,
    p_published: published,
  })
  if (error) throw new Error(error.message)
}

/** 보관/복원 — comic_books.status 직접 갱신(RLS admin). 보관 시 comic_gen 잡도 정리
 *  (미완 잡이 deriveStage 를 shadow 해 archived 를 못 보이게 하는 결함 차단). */
export async function archiveComic(
  client: SupabaseClient,
  bookId: string,
  archived: boolean,
): Promise<void> {
  const { error } = await client
    .from('comic_books')
    .update({ status: archived ? 'archived' : 'draft', published_at: null })
    .eq('library_book_id', bookId)
  if (error) throw new Error(error.message)
  if (archived) {
    await client.from('book_curation_jobs').delete().eq('book_id', bookId).eq('task_type', 'comic_gen')
  }
}

/** 삭제 — admin_delete_comic RPC(pages+header+job 단일 트랜잭션). 버킷 정리는 action 에서. */
export async function deleteComic(client: SupabaseClient, bookId: string): Promise<void> {
  const { error } = await client.rpc('admin_delete_comic', { p_book_id: bookId })
  if (error) throw new Error(error.message)
}

/** 삭제 전 버킷 오브젝트 경로 수집(고아 스토리지 방지). image_url 에서 버킷/경로 파싱. */
export async function collectComicStoragePaths(
  client: SupabaseClient,
  bookId: string,
): Promise<{ bucket: string; paths: string[] } | null> {
  const { data } = await client.from('comic_pages').select('image_url').eq('library_book_id', bookId)
  const rows = (data as Array<{ image_url: string }> | null) ?? []
  const paths: string[] = []
  let bucket = ''
  for (const r of rows) {
    const m = r.image_url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
    if (m) { bucket = m[1]; paths.push(decodeURIComponent(m[2])) }
  }
  return bucket ? { bucket, paths } : null
}

// ── 검수 상세 ─────────────────────────────────────────────────
export type ComicStage = 'none' | 'queued' | 'generating' | 'review' | 'published' | 'archived'

export interface ComicBubbleRow {
  speaker?: string | null
  text: string
  kind?: string | null
  pos?: string | null
  verbatim?: boolean
  by?: string | null
}
export interface ComicPageRow {
  chapter_idx: number
  page_order: number
  image_url: string
  bubbles: ComicBubbleRow[]
  target_vocab: string[]
  stave_label: string | null
}
export interface ComicDetail {
  bookId: string
  title: string
  author: string | null
  bookStatus: string
  vLevel: number | null
  header: {
    status: string
    panels_total: number
    panels_pass: boolean
    style: string | null
    backend: string | null
    qc_verdict: Record<string, unknown> | null
    published_at: string | null
  } | null
  job: { status: string; panels_done: number | null; panels_total: number | null; error: string | null } | null
  pages: ComicPageRow[]
  stage: ComicStage
}

/** 파이프라인 단계 파생(헤더 status + 잡 status + 컷 존재). */
export function deriveStage(
  comicStatus: string | null | undefined,
  jobStatus: string | null | undefined,
  panels: number,
): ComicStage {
  if (comicStatus === 'archived') return 'archived' // 관리자 종결 결정 — 잡보다 우선
  if (jobStatus === 'running') return 'generating'
  if (jobStatus === 'pending') return 'queued'
  if (comicStatus === 'published') return 'published'
  if (panels > 0) return 'review'
  if (jobStatus === 'failed') return 'queued'
  return 'none'
}

export async function fetchBookComicDetail(
  client: SupabaseClient,
  bookId: string,
): Promise<ComicDetail | null> {
  const [{ data: book }, { data: header }, { data: job }, { data: pages }] = await Promise.all([
    client.from('library_books').select('id, title, author, status, book_v_level').eq('id', bookId).maybeSingle(),
    client
      .from('comic_books')
      .select('status, panels_total, panels_pass, style, backend, qc_verdict, published_at')
      .eq('library_book_id', bookId)
      .maybeSingle(),
    client
      .from('book_curation_jobs')
      .select('status, panels_done, panels_total, error')
      .eq('book_id', bookId)
      .eq('task_type', 'comic_gen')
      .maybeSingle(),
    client
      .from('comic_pages')
      .select('chapter_idx, page_order, image_url, bubbles, target_vocab, stave_label')
      .eq('library_book_id', bookId)
      .order('chapter_idx')
      .order('page_order'),
  ])
  if (!book) return null
  const b = book as { id: string; title: string; author: string | null; status: string; book_v_level: number | null }
  const h = header as ComicDetail['header']
  const j = job as ComicDetail['job']
  const pg = (pages as ComicPageRow[]) ?? []
  return {
    bookId: b.id,
    title: b.title,
    author: b.author,
    bookStatus: b.status,
    vLevel: b.book_v_level,
    header: h,
    job: j,
    pages: pg,
    stage: deriveStage(h?.status, j?.status, pg.length),
  }
}
