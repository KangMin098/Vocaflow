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
