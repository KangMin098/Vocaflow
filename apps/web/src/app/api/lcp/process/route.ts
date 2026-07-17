// apps/web/src/app/api/lcp/process/route.ts
// LCP v2.0 Phase 7 — Library pipeline worker endpoint
// pg_cron이 net.http_post로 호출. X-LCP-Token 헤더 인증.
// 1 메시지 처리: ingest → normalize → segment → analyze → auto_curate

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ingestFromGutenberg,
  ingestFromStandardEbooks,
  ingestFromWikibooks,
  ingestFromWikisource,
  ingestFromLibriVox,
  ingestFromOpenStax,
  ingestFromSimpleWikipedia,
  ingestFromLit2Go,
  ingestFromStoryWeaver,
  normalizeBook,
  segmentBook,
  analyzeBook,
} from '@vocaflow/library-pipeline'

import { resolveCoverImageUrl } from '@/lib/library/cover-image'

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
    } else if (book.source === 'simple_wikipedia') {
      raw = await ingestFromSimpleWikipedia(book.source_id as string)
    } else if (book.source === 'lit2go') {
      raw = await ingestFromLit2Go(book.source_id as string)
    } else if (book.source === 'storyweaver') {
      raw = await ingestFromStoryWeaver(book.source_id as string)
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

    // 4-3.35 그림책 자산 persist (StoryWeaver 등) — 삽화(링크) + 표지 + 낭독 오디오.
    if (raw.illustrations || raw.cover_image_url || raw.audio_url) {
      const assets: Record<string, unknown> = {}
      if (raw.illustrations && raw.illustrations.length > 0) assets.illustrations = raw.illustrations
      if (raw.cover_image_url) assets.cover_image_url = raw.cover_image_url
      if (raw.audio_url) assets.audio_url = raw.audio_url
      if (Object.keys(assets).length > 0) {
        await client.from('library_books').update(assets).eq('id', book_id)
      }
    }

    // 4-3.4 lemma backfill (best-effort) — direct-bind/추출/percentile 정상화 게이트.
    //   collect 보다 먼저: 바인딩된 단어는 lemma 채워져 collect 대상에서 제외됨.
    //   INSERT 시점 트리거(lbv_fill_lemma_after_insert, v06.120)가 1차 보장 — 여기는 잔여 스윕.
    //   주의: supabase-js rpc() 는 throw 하지 않고 { error } 를 반환 — 반드시 error 필드 검사.
    {
      const { error } = await client.rpc('backfill_book_lemmas', { p_book_id: book_id })
      if (error) console.warn(`[lcp/process] backfill_book_lemmas skipped: ${error.message}`)
    }

    // 4-3.45 도서 난이도 지수 산정 (best-effort) — book_v_level/CEFR/CEFR-J.
    //   backfill 직후(bound lemma 필요). LibraryCard 표시 + publish 게이트(publish_book_word_sets
    //   가 v_level >= book_v_level 필터 → book_v_level NULL 이면 강제게시 실패) 의존.
    //   rpc 는 무-throw({error} 반환) → per-call {error} 검사로 침묵실패 관측(#93 0679a2d + main 확장 RPC 결합).
    for (const fn of [
      'compute_book_vrl',
      'compute_book_chapter_v_levels', // 챕터별 V-level(v06.174 — 단일 라벨 편차 노출)
      'compute_book_cefrj',
      'compute_book_coverage', // 레벨별 기지어 커버리지(i+1)
    ] as const) {
      const { error } = await client.rpc(fn, { p_book_id: book_id })
      if (error) console.warn(`[lcp/process] ${fn} skipped: ${error.message}`)
    }

    // 4-3.47 원천 표지 이미지 URL 해결 (best-effort) — Gutenberg pg{id}.cover / SE og:image.
    //   StoryWeaver 는 ingester 가 표지 직접 제공(위 자산 persist) → 우회.
    if (book.source !== 'storyweaver') {
      try {
        const coverUrl = await resolveCoverImageUrl({
          source: book.source as string,
          sourceId: book.source_id as string,
        })
        if (coverUrl) {
          await client.from('library_books').update({ cover_image_url: coverUrl }).eq('id', book_id)
        }
      } catch (e) {
        console.warn(`[lcp/process] resolveCoverImageUrl skipped: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 4-3.5 미바인딩 단어를 archaic_candidates 로 수집 (best-effort)
    {
      const { error } = await client.rpc('collect_archaic_candidates', { p_book_id: book_id })
      if (error) console.warn(`[lcp/process] collect_archaic_candidates skipped: ${error.message}`)
    }

    // 4-4. auto_curate
    const { data: decision, error: curateError } = await client.rpc(
      'auto_curate_book',
      { p_book_id: book_id },
    )

    if (curateError) {
      throw new Error(`auto_curate_book failed: ${curateError.message}`)
    }

    // 4-5. 메시지 archive (성공)
    {
      const { error } = await client.rpc('pgmq_archive', {
        p_queue_name: 'library_pipeline',
        p_msg_id: msg_id,
      })
      if (error) console.warn(`[lcp/process] pgmq_archive(success path) failed: ${error.message}`)
    }

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
    {
      const { error: archiveError } = await client.rpc('pgmq_archive', {
        p_queue_name: 'library_pipeline',
        p_msg_id: msg_id,
      })
      if (archiveError) console.warn(`[lcp/process] pgmq_archive(failure path) failed: ${archiveError.message}`)
    }

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
