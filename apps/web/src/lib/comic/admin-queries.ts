// apps/web/src/lib/comic/admin-queries.ts
//
// CCP admin 데이터 접근 — /admin/comic 콘솔용. RLS admin/curator 정책으로 직접 read/write.
//
// **스키마 부재만 graceful degrade 한다.** 예전에는 `if (err || !data) return []` 로 모든
// 오류를 빈 배열로 삼켰고, 그래서 DB 장애·RLS 거부·타임아웃까지 화면이 "마이그레이션을
// 적용하세요" 라고 말했다 — 완전히 틀린 원인으로 관리자를 보냈다. 지금은 lib/pd-comic/queries.ts
// 와 같은 규약을 쓴다: 테이블/함수가 없을 때만 빈 결과, 나머지는 throw 해서 화면이
// 오류 경계(app/admin/error.tsx)로 진짜 원인을 말하게 한다.

import type { SupabaseClient } from '@supabase/supabase-js'

/** 테이블/함수 부재 = 마이그레이션 미적용. 이것만 "정상 상태"로 취급한다. */
const SCHEMA_MISSING = /relation .* does not exist|function .* does not exist|Could not find the function|Could not find the table|PGRST202|PGRST205|42P01/i

function isSchemaMissing(err: unknown): boolean {
  const e = err as { message?: string; code?: string } | null
  return (
    !!e &&
    (SCHEMA_MISSING.test(e.message ?? '') || e.code === '42P01' || e.code === 'PGRST202' || e.code === 'PGRST205')
  )
}

/** 스키마 부재면 fallback, 그 밖의 오류는 올린다. */
function unwrap<T>(res: { data: T | null; error: unknown }, fallback: T): T {
  if (res.error) {
    if (isSchemaMissing(res.error)) return fallback
    throw res.error instanceof Error ? res.error : new Error(String((res.error as { message?: string }).message ?? res.error))
  }
  return res.data ?? fallback
}

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
  const [bookRes, headerRes, jobRes] = await Promise.all([
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
  type HeaderRow = { library_book_id: string; status: string; panels_total: number; panels_pass: boolean }
  type JobRow = { book_id: string; status: string; panels_done: number | null; panels_total: number | null; error: string | null }
  type BookRow = { id: string; title: string; author: string | null; status: string; book_v_level: number | null }
  const books = unwrap<BookRow[]>(bookRes as { data: BookRow[] | null; error: unknown }, [])
  const headers = unwrap<HeaderRow[]>(headerRes as { data: HeaderRow[] | null; error: unknown }, [])
  const jobs = unwrap<JobRow[]>(jobRes as { data: JobRow[] | null; error: unknown }, [])
  const hMap = new Map(headers.map((h) => [h.library_book_id, h]))
  const jMap = new Map(jobs.map((j) => [j.book_id, j]))
  return books.map(
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
  /** comic_gen 잡이 failed 인 도서 수 — 세지 않으면 실패가 큐 대기에 섞여 영영 안 보인다. */
  failed: number
}

export function summarize(rows: ComicCatalogRow[]): ComicStats {
  return {
    eligible: rows.length,
    drafts: rows.filter((r) => r.comicStatus === 'draft').length,
    published: rows.filter((r) => r.comicStatus === 'published').length,
    queued: rows.filter((r) => r.jobStatus === 'pending' || r.jobStatus === 'running').length,
    failed: rows.filter((r) => r.jobStatus === 'failed').length,
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
export type ComicStage = 'none' | 'queued' | 'generating' | 'review' | 'published' | 'archived' | 'failed'

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
    style_key: string | null
    backend: string | null
    qc_verdict: Record<string, unknown> | null
    published_at: string | null
  } | null
  job: { status: string; panels_done: number | null; panels_total: number | null; error: string | null } | null
  pages: ComicPageRow[]
  stage: ComicStage
}

/**
 * 파이프라인 단계 파생(헤더 status + 잡 status + 컷 존재).
 *
 * ⚠️ `failed` 를 `queued` 로 접지 않는다. 접었을 때 검수 화면은 "큐 대기" 스피너를
 * 영원히 돌리고 5초마다 router.refresh() 를 걸었으며(서버 부하), 관리자에게는
 * 재시도 수단조차 보이지 않았다. 실패는 **끝난 상태**라 스스로 풀리지 않는다.
 *
 * 순서에 의미가 있다: 컷이 이미 들어와 있으면(`panels > 0`) 그 뒤에 잡이 실패했더라도
 * 검수할 것이 남아 있으므로 `review` 가 이긴다. `failed` 는 **보여 줄 컷이 하나도 없는**
 * 실패에만 붙는다 — 그때가 재시도 말고는 할 일이 없는 상태다.
 */
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
  if (jobStatus === 'failed') return 'failed'
  return 'none'
}

// ── 드레인 관측(observability) + 테스트 ─────────────────────────
export interface DrainRun {
  id: string
  backend: string | null; model: string | null; site: string | null; style: string | null
  status: string
  panels_total: number; panels_done: number; panels_pass: number; panels_fail: number
  iterations: number; verbatim_mismatch: number; rule_violations: number
  cost_usd: number | null; note: string | null; error: string | null
  started_at: string; finished_at: string | null
}
export interface PanelEvent {
  chapter_idx: number | null; page_order: number | null; attempt: number
  phase: string | null; status: string | null; score: number | null
  verdict: Record<string, unknown> | null; backend: string | null
  duration_ms: number | null; message: string | null; created_at: string
}
export interface ComicTest {
  id: string; library_book_id: string | null; label: string
  backend: string | null; model: string | null; site: string | null; style: string | null
  params: Record<string, unknown> | null; sample: Record<string, unknown> | null
  status: string; result: Record<string, unknown> | null; cost_usd: number | null
  note: string | null; created_at: string
}

/** 도서 드레인 관측 — 실행 이력 + 최신 실행의 컷 이벤트. */
export async function fetchDrainObservability(
  client: SupabaseClient,
  bookId: string,
): Promise<{ runs: DrainRun[]; events: PanelEvent[] }> {
  const runRes = await client
    .from('comic_gen_runs')
    .select('id, backend, model, site, style, status, panels_total, panels_done, panels_pass, panels_fail, iterations, verbatim_mismatch, rule_violations, cost_usd, note, error, started_at, finished_at')
    .eq('library_book_id', bookId)
    .order('started_at', { ascending: false })
  const runList = unwrap<DrainRun[]>(runRes as { data: DrainRun[] | null; error: unknown }, [])
  let events: PanelEvent[] = []
  if (runList[0]) {
    const evRes = await client
      .from('comic_panel_events')
      .select('chapter_idx, page_order, attempt, phase, status, score, verdict, backend, duration_ms, message, created_at')
      .eq('run_id', runList[0].id)
      .order('chapter_idx')
      .order('page_order')
      .order('attempt')
    events = unwrap<PanelEvent[]>(evRes as { data: PanelEvent[] | null; error: unknown }, [])
  }
  return { runs: runList, events }
}

export interface ComicModel {
  key: string; name: string; provider: string | null; site: string | null; hosting: string | null
  cost_per_image_usd: number | null; cost_note: string | null
  multiref: boolean | null; text_control: string | null; char_consistency: string | null; style_consistency: string | null
  vram_fit_4090: boolean | null; license: string | null
  comic_fit: number | null; strengths: string | null; weaknesses: string | null; source_url: string | null
  status: string; sort: number
  run_envs: string[] | null; min_vram_gb: number | null
}

export interface ComicStyle {
  key: string; name: string; format: string | null; age_band: string | null; genre: string | null
  difficulty_min: number | null; difficulty_max: number | null; palette: string | null
  art_prompt: string | null; negative_prompt: string | null; lettering: string | null
  reference: string | null; source_url: string | null; status: string; is_default: boolean; sort: number
}

/** 만화 스타일 프리셋 카탈로그. */
export async function fetchComicStyles(client: SupabaseClient): Promise<ComicStyle[]> {
  const res = await client
    .from('comic_styles')
    .select('key, name, format, age_band, genre, difficulty_min, difficulty_max, palette, art_prompt, negative_prompt, lettering, reference, source_url, status, is_default, sort')
    .order('sort')
    .order('name')
  return unwrap<ComicStyle[]>(res as { data: ComicStyle[] | null; error: unknown }, [])
}

/** 이미지 생성 모델 레지스트리 — comic_fit 내림차순. */
export async function fetchComicModels(client: SupabaseClient): Promise<ComicModel[]> {
  const res = await client
    .from('comic_gen_models')
    .select('key, name, provider, site, hosting, cost_per_image_usd, cost_note, multiref, text_control, char_consistency, style_consistency, vram_fit_4090, license, comic_fit, strengths, weaknesses, source_url, status, sort, run_envs, min_vram_gb')
    .order('comic_fit', { ascending: false, nullsFirst: false })
  return unwrap<ComicModel[]>(res as { data: ComicModel[] | null; error: unknown }, [])
}

/** 테스트(실험) 목록. */
export async function fetchComicTests(client: SupabaseClient): Promise<ComicTest[]> {
  const res = await client
    .from('comic_gen_tests')
    .select('id, library_book_id, label, backend, model, site, style, params, sample, status, result, cost_usd, note, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  return unwrap<ComicTest[]>(res as { data: ComicTest[] | null; error: unknown }, [])
}

export async function fetchBookComicDetail(
  client: SupabaseClient,
  bookId: string,
): Promise<ComicDetail | null> {
  const [bookRes, headerRes, jobRes, pageRes] = await Promise.all([
    client.from('library_books').select('id, title, author, status, book_v_level').eq('id', bookId).maybeSingle(),
    client
      .from('comic_books')
      .select('status, panels_total, panels_pass, style, style_key, backend, qc_verdict, published_at')
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
  type BookRow = { id: string; title: string; author: string | null; status: string; book_v_level: number | null }
  const b = unwrap<BookRow | null>(bookRes as { data: BookRow | null; error: unknown }, null)
  if (!b) return null
  const h = unwrap<ComicDetail['header']>(headerRes as { data: ComicDetail['header']; error: unknown }, null)
  const j = unwrap<ComicDetail['job']>(jobRes as { data: ComicDetail['job']; error: unknown }, null)
  const pg = unwrap<ComicPageRow[]>(pageRes as { data: ComicPageRow[] | null; error: unknown }, [])
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

// ── 드레인 관측 화면 전용(가벼운 조회) ────────────────────────
//
// 드레인 콘솔은 제목·QC 게이트·단계 넷만 쓴다. 예전에는 `fetchBookComicDetail` 을 그대로
// 불러 컷 전량(image_url · bubbles · target_vocab)을 받아 놓고 한 번도 읽지 않았다.
// 컷은 도서 한 권에 수백 장이고 bubbles 는 jsonb 라, 화면에 안 쓰는 페이로드가 가장 컸다.
// 여기서는 컷을 **개수만** 센다(head 요청) — 단계 파생에 필요한 건 그것뿐이다.

export interface ComicDrainSubject {
  bookId: string
  title: string
  /** comic_books.panels_pass — 헤더가 없으면 null(= 아직 판정 자체가 없다). */
  panelsPass: boolean | null
  stage: ComicStage
}

export async function fetchComicDrainSubject(
  client: SupabaseClient,
  bookId: string,
): Promise<ComicDrainSubject | null> {
  const [bookRes, headerRes, jobRes, pageCountRes] = await Promise.all([
    client.from('library_books').select('id, title').eq('id', bookId).maybeSingle(),
    client.from('comic_books').select('status, panels_pass').eq('library_book_id', bookId).maybeSingle(),
    client
      .from('book_curation_jobs')
      .select('status')
      .eq('book_id', bookId)
      .eq('task_type', 'comic_gen')
      .maybeSingle(),
    // head 요청 — 행을 받지 않고 개수만. 없는 테이블도 오류 대신 count=null 로 오므로
    // 아래에서 `?? 0` 이 아니라 unwrap 을 먼저 태워 진짜 오류를 가린 채 0으로 세지 않는다.
    client.from('comic_pages').select('chapter_idx', { count: 'exact', head: true }).eq('library_book_id', bookId),
  ])
  type BookRow = { id: string; title: string }
  const b = unwrap<BookRow | null>(bookRes as { data: BookRow | null; error: unknown }, null)
  if (!b) return null
  const h = unwrap<{ status: string; panels_pass: boolean } | null>(
    headerRes as { data: { status: string; panels_pass: boolean } | null; error: unknown },
    null,
  )
  const j = unwrap<{ status: string } | null>(jobRes as { data: { status: string } | null; error: unknown }, null)
  const countRes = pageCountRes as { count: number | null; error: unknown }
  if (countRes.error && !isSchemaMissing(countRes.error)) {
    throw countRes.error instanceof Error
      ? countRes.error
      : new Error(String((countRes.error as { message?: string }).message ?? countRes.error))
  }
  const panels = countRes.count ?? 0
  return {
    bookId: b.id,
    title: b.title,
    panelsPass: h ? h.panels_pass : null,
    stage: deriveStage(h?.status, j?.status, panels),
  }
}
