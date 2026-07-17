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
  ingestFromSimpleWikipedia,
  ingestFromLit2Go,
  ingestFromStoryWeaver,
  ingestFromPressbooks,
  normalizeBook,
  segmentBook,
  analyzeBook,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'
import { resolveCoverImageUrl } from '@/lib/library/cover-image'
import { autoMapLibriVoxForBook } from '@/lib/library/librivox-automap'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface DevProcessBody {
  book_id: string
  /** Pressbooks 전용 — 챕터 상한(데모 footprint 제한). 0/미지정=전체. */
  max_chapters?: number
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
    } else if (book.source === 'simple_wikipedia') {
      raw = await ingestFromSimpleWikipedia(book.source_id as string)
    } else if (book.source === 'lit2go') {
      raw = await ingestFromLit2Go(book.source_id as string)
    } else if (book.source === 'storyweaver') {
      raw = await ingestFromStoryWeaver(book.source_id as string)
    } else if (book.source === 'pressbooks') {
      raw = await ingestFromPressbooks(book.source_id as string, body.max_chapters ?? 0)
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

    // 그림책 자산 persist (StoryWeaver 등) — 삽화(링크) + 표지 + 낭독 오디오.
    //   삽화 idx 는 본문 문단 인덱스와 정합 (ingester 가 페이지 순서로 생성).
    if (raw.source === 'storyweaver' || raw.illustrations || raw.cover_image_url || raw.audio_url) {
      const assets: Record<string, unknown> = {}
      if (raw.illustrations && raw.illustrations.length > 0) assets.illustrations = raw.illustrations
      if (raw.cover_image_url) assets.cover_image_url = raw.cover_image_url
      if (raw.audio_url) assets.audio_url = raw.audio_url
      if (Object.keys(assets).length > 0) {
        await client.from('library_books').update(assets).eq('id', book_id)
      }
    }

    // lemma backfill (best-effort) — direct-bind/추출/percentile 정상화 게이트.
    // collect 보다 먼저 실행: 바인딩된 단어는 lemma 채워져 collect 대상에서 제외됨.
    // INSERT 시점 트리거(lbv_fill_lemma_after_insert, v06.120)가 1차 보장 — 여기는 잔여 스윕.
    // 주의: supabase-js rpc() 는 throw 하지 않고 { error } 를 반환 — 반드시 error 필드 검사.
    {
      const { error } = await client.rpc('backfill_book_lemmas', { p_book_id: book_id })
      if (error) console.warn(`[lcp/dev-process] backfill_book_lemmas skipped: ${error.message}`)
    }

    // 도서 난이도 지수 산정 (best-effort) — book_v_level/CEFR/CEFR-J.
    //   backfill 직후(bound lemma 필요). LibraryCard + publish 게이트(book_v_level NULL 이면 강제게시 실패) 의존.
    //   rpc 는 무-throw({error} 반환) → per-call {error} 검사로 침묵실패 관측(#93 0679a2d + main 확장 RPC 결합).
    //   compute_book_difficulty(v2.4 앙상블)는 위 신호 완료 후 재산정 — Claude 검토 도서는 v3 권위(함수 내 가드).
    for (const fn of [
      'compute_book_vrl',
      'compute_book_chapter_v_levels', // 챕터별 V-level(v06.174 — 단일 라벨 편차 노출)
      'compute_book_cefrj',
      'compute_book_coverage', // 레벨별 기지어 커버리지(i+1)
      'compute_book_syntax', // CTP ① 구문 난이도(챕터 집계)
      'compute_book_difficulty', // 도서 난이도 v2.4 앙상블(마지막)
    ] as const) {
      const { error } = await client.rpc(fn, { p_book_id: book_id })
      if (error) console.warn(`[lcp/dev-process] ${fn} skipped: ${error.message}`)
    }

    // 원천 표지 이미지 URL 해결 (best-effort) — Gutenberg pg{id}.cover / SE og:image.
    //   StoryWeaver 는 ingester 가 표지를 직접 제공(위 자산 persist) → 우회.
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
        console.warn(`[lcp/dev-process] resolveCoverImageUrl skipped: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // LibriVox 보이스 자동 매핑 (best-effort) — 로직 단계로 흡수 (v06.35).
    //   count-gate 통과 → library_books.librivox_audio 저장 (chapter_parts/flat).
    //   녹음은 있으나 정합 실패 → 사람 판단 필요 → book_curation_jobs 큐에 자동 등록.
    //   녹음 자체 없음 → 정상(브라우저 TTS) → 큐 등록 안 함.
    //   (실패해도 도서 파이프라인은 'ready' 로 정상 완료 — 매핑은 부가 자산.)
    //   StoryWeaver 는 자체 readalong 오디오(audio_url) 사용 → LibriVox 매핑 우회.
    let librivox: 'mapped' | 'queued' | 'no_recording' | 'skipped' = 'skipped'
    if (book.source !== 'storyweaver') try {
      const map = await autoMapLibriVoxForBook(client, book_id, { savedBy: null })
      if (map.ok) {
        librivox = 'mapped'
        // 자동 매핑 성공 → Claude 수동 매핑 불필요. 이전 큐 잡 정리.
        //   진행 중인 수동 매핑(running/awaiting_mapping/done)은 보존 — pending/failed 만 삭제.
        await client
          .from('book_curation_jobs')
          .delete()
          .eq('book_id', book_id)
          .eq('task_type', 'voice_map')
          .in('status', ['pending', 'failed'])
      } else if (map.recording_found) {
        // 정합 실패 → 매핑 큐 자동 등록. dev-process 는 service-role(auth.uid 없음)이라
        // enqueue_curation_jobs RPC(admin 가드) 대신 직접 upsert (RLS 우회 + 동일 reset 시맨틱).
        // mode 는 원본(처리 전) status 로 판정 — 첫 처리=dev_process / 재처리(ready)=dev_reprocess.
        const jobMode = book.status === 'ready' ? 'dev_reprocess' : 'dev_process'
        const { data: snap } = await client
          .from('library_chapters_master')
          .select('chapter_idx, chapter_title, group_label, word_count')
          .eq('library_book_id', book_id)
          .order('chapter_idx', { ascending: true })
        const sourceChapters = ((snap ?? []) as Array<{
          chapter_idx: number
          chapter_title: string | null
          group_label: string | null
          word_count: number
        }>).map((m) => ({
          chapter_idx: m.chapter_idx,
          title: m.chapter_title,
          group: m.group_label,
          word_count: m.word_count,
        }))
        await client.from('book_curation_jobs').upsert(
          {
            book_id,
            task_type: 'voice_map',
            mode: jobMode,
            status: 'pending',
            source_chapters: sourceChapters,
            librivox_chapters: null,
            chapter_definition: null,
            librivox_mapping: null,
            error: null,
            note: `auto: LibriVox 정합 실패 — ${map.reason ?? ''} (실챕터 ${map.real_chapter_count} / LV ${map.lv_chapter_count}, ${map.volume_count}권)`,
            claimed_at: null,
          },
          { onConflict: 'book_id,task_type' },
        )
        librivox = 'queued'
      } else {
        librivox = 'no_recording'
        // 낭독 자체 없음 → 매핑 큐 불필요. 이전 큐 잡 정리 (진행 중 수동 매핑은 보존).
        await client
          .from('book_curation_jobs')
          .delete()
          .eq('book_id', book_id)
          .eq('task_type', 'voice_map')
          .in('status', ['pending', 'failed'])
      }
    } catch (e) {
      console.warn(
        `[lcp/dev-process] LibriVox autoMap skipped: ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    // 미바인딩 단어를 archaic_candidates 로 수집 (best-effort — 실패해도 파이프라인 성공 유지)
    //   supabase-js rpc() 는 throw 하지 않고 { error } 반환 — error 필드 검사로 실패를 관측.
    {
      const { error } = await client.rpc('collect_archaic_candidates', { p_book_id: book_id })
      if (error) console.warn(`[lcp/dev-process] collect_archaic_candidates skipped: ${error.message}`)
    }

    // pgmq:library_pipeline 큐의 동일 book_id 메시지 archive (dev 환경에서 pg_cron worker 부재 — 직접 정리).
    // best-effort — 실패해도 파이프라인 성공 유지.
    {
      const { error } = await client.rpc('archive_book_pipeline_messages', { p_book_id: book_id })
      if (error) console.warn(`[lcp/dev-process] archive_book_pipeline_messages skipped: ${error.message}`)
    }

    return NextResponse.json({
      ok: true,
      book_id,
      decision: 'ready_for_review',
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      vocab_count: result.words.length,
      llm_cost: result.llm_cost_usd,
      librivox, // 'mapped' | 'queued' | 'no_recording' | 'skipped'
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
    {
      const { error: archiveError } = await client.rpc('archive_book_pipeline_messages', { p_book_id: book_id })
      if (archiveError)
        console.warn(
          `[lcp/dev-process] archive_book_pipeline_messages (failure path) skipped: ${archiveError.message}`,
        )
    }

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
