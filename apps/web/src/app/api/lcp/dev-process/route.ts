// apps/web/src/app/api/lcp/dev-process/route.ts
//
// LCP dev-only worker — Admin UI 의 "Process Now" 버튼이 호출.
// pg_cron / Vault 우회. Supabase Cloud 가 localhost 에 접근 못 하는 dev 환경 전용.
//
// 차이 (vs /api/lcp/process):
//   - 인증: admin/curator role (requireAdmin) — X-LCP-Token 토큰 불필요
//   - 트리거: 사용자 UI 클릭, msg_id 없음 (pgmq 큐 우회)
//   - 환경 가드: NODE_ENV='production' 차단 (배포 환경에선 pg_cron 정상 경로 사용)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ingestFromGutenberg,
  ingestFromStandardEbooks,
  ingestFromWikibooks,
  ingestFromWikisource,
  ingestFromLibriVox,
  ingestFromOpenStax,
  normalizeBook,
  segmentBook,
  analyzeBook,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface DevProcessBody {
  book_id: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-process disabled in production — use pg_cron worker' },
      { status: 403 },
    )
  }

  // 인증 — X-LCP-Token (스크립트/일괄 재처리) 우선, 없으면 admin 쿠키(브라우저 버튼).
  const lcpToken = process.env['LCP_INTERNAL_TOKEN']
  const reqToken = request.headers.get('X-LCP-Token')
  if (!(lcpToken && reqToken === lcpToken)) {
    await requireAdmin('/admin/curation')
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  let body: DevProcessBody
  try {
    body = (await request.json()) as DevProcessBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { book_id } = body
  if (!book_id) {
    return NextResponse.json({ error: 'book_id (string) required' }, { status: 400 })
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: book, error: fetchError } = await client
      .from('library_books')
      .select('source, source_id, status')
      .eq('id', book_id)
      .single()

    if (fetchError || !book) {
      throw new Error(`Book not found: ${book_id} (${fetchError?.message ?? 'no row'})`)
    }
    if (!book.source_id) {
      throw new Error(`Book has no source_id: ${book_id}`)
    }

    const updateStatus = async (status: string): Promise<void> => {
      await client.from('library_books').update({ status }).eq('id', book_id)
    }

    await updateStatus('ingesting')
    let raw
    if (book.source === 'gutenberg') {
      raw = await ingestFromGutenberg(book.source_id as string)
    } else if (book.source === 'standard_ebooks') {
      raw = await ingestFromStandardEbooks(book.source_id as string)
    } else if (book.source === 'wikibooks') {
      raw = await ingestFromWikibooks(book.source_id as string)
    } else if (book.source === 'wikisource') {
      raw = await ingestFromWikisource(book.source_id as string)
    } else if (book.source === 'librivox') {
      raw = await ingestFromLibriVox(book.source_id as string)
    } else if (book.source === 'openstax') {
      raw = await ingestFromOpenStax(book.source_id as string)
    } else {
      throw new Error(`Source not implemented in dev-process: ${book.source}`)
    }

    await updateStatus('normalizing')
    const norm = normalizeBook(raw)

    await updateStatus('segmenting')
    const chapters = segmentBook(norm)
    if (chapters.length === 0) {
      throw new Error('Segment failed: 0 chapters')
    }

    await updateStatus('analyzing')
    const result = await analyzeBook(book_id, norm, chapters)

    // dev-process 는 auto_curate 우회 — 항상 'ready' 에서 정지.
    // 이유: admin 이 본문 검수 후 명시적으로 '강제 게시' 또는 '보관' 결정하도록.
    // (프로덕션 /api/lcp/process 는 auto_curate_book 호출하여 조건 충족 시 자동 publish)
    await client
      .from('library_books')
      .update({
        title: raw.title,
        author: raw.author ?? null,
        author_birth_year: raw.author_birth_year ?? null,
        author_death_year: raw.author_death_year ?? null,
        language: raw.language,
        license: raw.license,
        source_url: raw.source_url,
        source_fetched_at: raw.fetched_at.toISOString(),
        cefr_level: result.cefr_level,
        cefr_confidence: result.cefr_confidence,
        word_count: result.word_count,
        chapter_count: result.chapter_count,
        reading_minutes: result.reading_minutes,
        llm_cost_usd: result.llm_cost_usd,
        status: 'ready',
        status_message: null,
      })
      .eq('id', book_id)

    // lemma backfill (best-effort) — direct-bind/추출/percentile 정상화 게이트.
    // collect 보다 먼저 실행: 바인딩된 단어는 lemma 채워져 collect 대상에서 제외됨.
    try {
      await client.rpc('backfill_book_lemmas', { p_book_id: book_id })
    } catch (e) {
      console.warn(`[lcp/dev-process] backfill_book_lemmas skipped: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 도서 난이도 지수 산정 (best-effort) — book_v_level/CEFR/CEFR-J.
    //   backfill 직후(bound lemma 필요). LibraryCard + publish 게이트(book_v_level NULL 이면 강제게시 실패) 의존.
    try {
      await client.rpc('compute_book_vrl', { p_book_id: book_id })
      await client.rpc('compute_book_cefrj', { p_book_id: book_id })
    } catch (e) {
      console.warn(`[lcp/dev-process] compute_book_vrl/cefrj skipped: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 미바인딩 단어를 archaic_candidates 로 수집 (best-effort — 실패해도 파이프라인 성공 유지)
    await client.rpc('collect_archaic_candidates', { p_book_id: book_id })

    // pgmq:library_pipeline 큐의 동일 book_id 메시지 archive (dev 환경에서 pg_cron worker 부재 — 직접 정리).
    // best-effort — 실패해도 파이프라인 성공 유지.
    try {
      await client.rpc('archive_book_pipeline_messages', { p_book_id: book_id })
    } catch (e) {
      console.warn(
        `[lcp/dev-process] archive_book_pipeline_messages skipped: ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    return NextResponse.json({
      ok: true,
      book_id,
      decision: 'ready_for_review',
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      vocab_count: result.words.length,
      llm_cost: result.llm_cost_usd,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[lcp/dev-process] book_id=${book_id} failed:`, err)

    await client
      .from('library_books')
      .update({
        status: 'failed',
        status_message: errMsg.slice(0, 500),
      })
      .eq('id', book_id)

    // 실패 경로에서도 큐 메시지 archive — dev 환경에선 재시도 worker 부재라 큐에 남겨봐야 무의미.
    try {
      await client.rpc('archive_book_pipeline_messages', { p_book_id: book_id })
    } catch (e) {
      console.warn(
        `[lcp/dev-process] archive_book_pipeline_messages (failure path) skipped: ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
