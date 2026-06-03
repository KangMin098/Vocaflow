// apps/web/src/app/api/lcp/dev-validate/route.ts
//
// LCP dry-run 검증 — 재처리 '커밋 전' 안전 점검.
//   ingest → normalize → segment 만 실행 (analyze X · DB 쓰기 X · status 변경 X · LLM X).
//   → chapter_count / word_count / avg_chapter_words / 첫 제목 / 경고[] 반환.
//   목적: 'Segment failed' · under/over-split · fragment(짧은 텍스트) · ingest 오류를
//        실제 재처리(쓰기) 전에 미리 잡아 dev 오류·불량 데이터·LLM 비용을 예방.
//
// 인증: X-LCP-Token (스크립트 일괄) OR admin/curator 쿠키 (브라우저). 쓰기가 없어 안전.
// 환경: production 차단 (dev 전용 — 실 배포는 pg_cron 정상 경로).

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
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface Body {
  book_id?: string
  // book_id 없이 직접 검증 (시드 등 — 미import 도서)
  source?: string
  source_id?: string
}

// 경고 임계 — dev 오류/불량 데이터 사전 탐지
const MIN_WORDS = 3000 // 이하 = ingest 실패/redirect fragment 의심
const FALLBACK_LO = 4300 // avg_chapter_words 가 이 band 면 단어수 fallback(챕터 검출 실패)
const FALLBACK_HI = 5200
const OVER_SPLIT = 80 // 초과 = 중첩 섹션 오탐(모음집 등)
const TOO_FEW = 2 // 미만 = 분할 실패

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev-validate disabled in production' }, { status: 403 })
  }

  // 인증 — 토큰(스크립트) 우선, 없으면 admin 쿠키(브라우저)
  const token = process.env['LCP_INTERNAL_TOKEN']
  const reqToken = request.headers.get('X-LCP-Token')
  if (!(token && reqToken === token)) {
    await requireAdmin('/admin/curation')
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let source = body.source
  let source_id = body.source_id

  // book_id 주면 source/source_id 조회 (read-only)
  if (body.book_id) {
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 })
    }
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: book, error } = await client
      .from('library_books')
      .select('source, source_id')
      .eq('id', body.book_id)
      .single()
    if (error || !book) {
      return NextResponse.json({ error: `Book not found: ${body.book_id}` }, { status: 404 })
    }
    source = book.source as string
    source_id = book.source_id as string
  }

  if (!source || !source_id) {
    return NextResponse.json(
      { error: 'book_id 또는 (source, source_id) 가 필요합니다.' },
      { status: 400 },
    )
  }

  try {
    // ── ingest → normalize → segment (쓰기 없음) ──
    let raw
    if (source === 'gutenberg') raw = await ingestFromGutenberg(source_id)
    else if (source === 'standard_ebooks') raw = await ingestFromStandardEbooks(source_id)
    else if (source === 'wikibooks') raw = await ingestFromWikibooks(source_id)
    else if (source === 'wikisource') raw = await ingestFromWikisource(source_id)
    else if (source === 'librivox') raw = await ingestFromLibriVox(source_id)
    else if (source === 'openstax') raw = await ingestFromOpenStax(source_id)
    else return NextResponse.json({ error: `Source not supported: ${source}` }, { status: 400 })

    const norm = normalizeBook(raw)
    const chapters = segmentBook(norm)

    const chapterCount = chapters.length
    const wordCount = chapters.reduce((s, c) => s + c.word_count, 0)
    const avg = chapterCount > 0 ? Math.round(wordCount / chapterCount) : 0
    const titledCount = chapters.filter((c) => c.chapter_title).length

    // 챕터 길이 변동계수(CV) — fallback 청크는 균등(낮은 CV), 실제 챕터는 들쭉날쭉(높은 CV).
    // avg 만으로는 '~5000단어 챕터 소설'(Jane Eyre)과 '단어수 fallback 청크'를 구분 못 해 오탐.
    let cv = 0
    if (chapterCount >= 2) {
      const variance = chapters.reduce((s, c) => s + (c.word_count - avg) ** 2, 0) / chapterCount
      cv = avg > 0 ? Math.sqrt(variance) / avg : 0
    }

    // fragment 챕터(<120단어) 비율 — 진짜 over-split(중첩 wrapper/빈 섹션 카운트)의 신호.
    // 단순히 챕터가 많은 것(Les Misérables 364 = 5 Volume→Book→364 Chapter 실제 구조)은 정상.
    const tinyCount = chapters.filter((c) => c.word_count < 120).length
    const tinyFrac = chapterCount > 0 ? tinyCount / chapterCount : 0

    // ── 경고 탐지 ──
    const warnings: string[] = []
    if (chapterCount === 0) warnings.push('TOO_FEW: 0 chapters (분할 실패 — 실제 재처리 시 throw)')
    else if (chapterCount < TOO_FEW) warnings.push(`TOO_FEW: ${chapterCount} chapter`)
    if (wordCount < MIN_WORDS) warnings.push(`TEXT_TOO_SHORT: ${wordCount} words (ingest 실패/fragment 의심)`)
    // 단어수 fallback: 제목 없음 + avg ~5000 band + 균등(CV<0.18) — 실제 챕터 소설 오탐 회피
    if (chapterCount >= TOO_FEW && titledCount === 0 && cv < 0.18 && avg >= FALLBACK_LO && avg <= FALLBACK_HI)
      warnings.push(`WORD_FALLBACK: avg ${avg}w 균등(CV ${cv.toFixed(2)}) — 챕터 검출 실패 → 단어수 청크`)
    // over-split: 많은 챕터 + fragment(<120단어) 다수 → 중첩 wrapper/빈 섹션 카운트 의심.
    // 길이 다양한 진짜 다(多)챕터 책(Les Mis)은 fragment 비율 낮아 통과.
    if (chapterCount > OVER_SPLIT && tinyFrac > 0.25)
      warnings.push(`OVER_SPLIT: ${chapterCount} chapters 중 ${tinyCount}개 <120단어 (중첩/빈 섹션 오탐 의심)`)

    return NextResponse.json({
      ok: true,
      source,
      source_id,
      title: raw.title,
      chapter_count: chapterCount,
      word_count: wordCount,
      avg_chapter_words: avg,
      length_cv: Number(cv.toFixed(2)),
      tiny_chapters: tinyCount,
      titled_chapters: titledCount,
      first_titles: chapters.slice(0, 5).map((c) => c.chapter_title ?? '(untitled)'),
      first_groups: chapters.slice(0, 5).map((c) => c.group_label ?? null),
      grouped_chapters: chapters.filter((c) => c.group_label).length,
      warnings,
      verdict: warnings.length === 0 ? 'OK' : 'REVIEW',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // dry-run 은 status 변경 안 함 — 오류를 결과로만 보고 (실 재처리 전 차단)
    return NextResponse.json(
      { ok: false, source, source_id, error: msg, warnings: [`INGEST_FAIL: ${msg}`], verdict: 'FAIL' },
      { status: 200 },
    )
  }
}
