// apps/web/src/app/api/lcp/process/route.ts
// LCP v2.0 Phase 7 — Library pipeline worker endpoint
// pg_cron이 net.http_post로 호출. X-LCP-Token 헤더 인증.
// 1 메시지 처리: ingest → normalize → segment → analyze → auto_curate

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ingestFromGutenberg,
  normalizeBook,
  segmentBook,
  analyzeBook,
} from '@vocaflow/library-pipeline'

export const runtime = 'nodejs'
export const maxDuration = 300 //                Vercel Pro 5분
export const dynamic = 'force-dynamic'

interface ProcessBody {
  msg_id: number
  book_id: string
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── 1. 환경 변수
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  const token = process.env['LCP_INTERNAL_TOKEN']

  if (!supabaseUrl || !serviceKey || !token) {
    return NextResponse.json(
      {
        error:
          'Server config missing (SUPABASE_URL / SERVICE_ROLE_KEY / LCP_INTERNAL_TOKEN)',
      },
      { status: 500 },
    )
  }

  // ── 2. 인증
  const reqToken = request.headers.get('X-LCP-Token')
  if (reqToken !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 3. 요청 파싱
  let body: ProcessBody
  try {
    body = (await request.json()) as ProcessBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { msg_id, book_id } = body
  if (!book_id || typeof msg_id !== 'number') {
    return NextResponse.json(
      { error: 'msg_id (number) and book_id (string) required' },
      { status: 400 },
    )
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── 4. 파이프라인 실행
  try {
    // 4-1. library_books row 조회
    const { data: book, error: fetchError } = await client
      .from('library_books')
      .select('source, source_id')
      .eq('id', book_id)
      .single()

    if (fetchError || !book) {
      throw new Error(
        `Book not found: ${book_id} (${fetchError?.message ?? 'no row'})`,
      )
    }

    if (!book.source_id) {
      throw new Error(`Book has no source_id: ${book_id}`)
    }

    // 4-2. status 업데이트 (각 단계별)
    const updateStatus = async (status: string): Promise<void> => {
      await client.from('library_books').update({ status }).eq('id', book_id)
    }

    await updateStatus('ingesting')
    let raw
    if (book.source === 'gutenberg') {
      raw = await ingestFromGutenberg(book.source_id as string)
    } else {
      throw new Error(`Source not implemented: ${book.source}`)
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

    // 4-3. library_books 메타 업데이트
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
        status: 'curating',
      })
      .eq('id', book_id)

    // 4-4. auto_curate
    const { data: decision, error: curateError } = await client.rpc(
      'auto_curate_book',
      { p_book_id: book_id },
    )

    if (curateError) {
      throw new Error(`auto_curate_book failed: ${curateError.message}`)
    }

    // 4-5. 메시지 archive (성공)
    await client.rpc('pgmq_archive', {
      p_queue_name: 'library_pipeline',
      p_msg_id: msg_id,
    })

    return NextResponse.json({
      ok: true,
      book_id,
      decision,
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      vocab_count: result.words.length,
      llm_cost: result.llm_cost_usd,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[lcp/process] book_id=${book_id} failed:`, err)

    // 실패 status 기록
    await client
      .from('library_books')
      .update({
        status: 'failed',
        status_message: errMsg.slice(0, 500),
      })
      .eq('id', book_id)

    // 메시지는 archive (재시도 무한루프 방지 — admin 이 status='failed' row 수동 검토)
    await client.rpc('pgmq_archive', {
      p_queue_name: 'library_pipeline',
      p_msg_id: msg_id,
    })

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
