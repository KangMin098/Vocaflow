// apps/web/src/app/(main)/text/[id]/comic/page.tsx
//
// CCP 학습자 리더 라우트 — /text/[id]/comic (ModePills '만화' 진입).
// echo/page.tsx 패턴: texts 직접 fetch → library_book 분기 → 발행 만화 로드 → 리더.
// 검토 반영: RPC(select_book_comic) 미적용(PGRST202)/미발행/사용자글 = notFound 아님,
//   전부 차분한 EmptyState 로 degrade(마이그레이션 미적용 상태에서 크래시 방지).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, BookImage } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { ComicReader, type ComicPage } from '@/components/comic/ComicReader'

interface PageProps {
  params: { id: string }
}

// ⚠️ `/comics/adapted`(각색 만화 카탈로그)가 이미 '만화' 다 — 여기는 **내 글을 만화로 읽는**
//    자리라 이름이 달라야 한다. 브랜드 접미(`· Vocaflow`)가 붙어 있던 동안 두 제목이
//    우연히 갈라져 있었고, 그걸 걷어내자 같은 이름이 됐다(실측 2026-08-30).
export const metadata = { title: '만화로 읽기' }
export const dynamic = 'force-dynamic'

function ComicEmpty({ textId, message }: { textId: string; message: string }) {
  return (
    <div className="mx-auto max-w-[860px] px-4">
      <div className="py-3">
        <Link
          href={`/text/${textId}?mode=read`}
          className="inline-flex items-center gap-2 font-body text-[12px] font-[500] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden /> 본문으로
        </Link>
      </div>
      <div className="mt-6 flex flex-col items-center gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-6 py-16 text-center">
        <BookImage size={26} className="text-[var(--t2)]" aria-hidden />
        <div>
          <p className="font-display text-[16px] font-[800] text-[var(--t1)]">{message}</p>
          <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
            준비되면 이 자리에서 이야기를 만화로 만나 볼 수 있어요.
          </p>
        </div>
        <Link
          href={`/text/${textId}?mode=read`}
          className="inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)]"
        >
          본문 읽기
        </Link>
      </div>
    </div>
  )
}

export default async function ComicModePage({ params }: PageProps) {
  const client = (await createClient()) as unknown as SupabaseClient

  const { data: text } = await client
    .from('texts')
    .select('id, title, chapter_title, chapter_idx, library_book_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!text) notFound()

  const t = text as {
    id: string
    title: string | null
    chapter_title: string | null
    chapter_idx: number | null
    library_book_id: string | null
  }

  // 사용자 직접 입력 글 = 만화 미지원(라이브러리 도서만 큐레이션 대상)
  if (!t.library_book_id || t.chapter_idx == null) {
    return <ComicEmpty textId={t.id} message="이 글은 아직 만화를 지원하지 않아요" />
  }

  // 발행 만화 로드 — 도서 전권(전 챕터/컷)을 한 번에(레일=stave 다중 dot + 챕터 연속).
  // RPC 미적용/미발행 전부 graceful degrade.
  let pages: ComicPage[] = []
  let bookTitle = t.title ?? '이야기'
  let comicFormat: string | null = null // 구성 방식(포맷) → 리더 읽는 방식 자동 결정. RPC 미적용 시 null(page)
  try {
    const [{ data: book }, allRes, fmtRes] = await Promise.all([
      client.from('library_books').select('title').eq('id', t.library_book_id).maybeSingle(),
      client.rpc('select_book_comic_all', { p_book_id: t.library_book_id }),
      client.rpc('get_comic_format', { p_book_id: t.library_book_id }),
    ])
    if (book) bookTitle = (book as { title: string }).title ?? bookTitle
    if (typeof fmtRes?.data === 'string') comicFormat = fmtRes.data
    let rows = allRes.data
    let error = allRes.error
    // 폴백: 전권 RPC 미적용/미발행 시 챕터 단위(구 RPC)로 — 마이그레이션 전에도 리더 유지
    if (error || !Array.isArray(rows) || rows.length === 0) {
      const per = await client.rpc('select_book_comic', {
        p_book_id: t.library_book_id,
        p_chapter_idx: t.chapter_idx,
      })
      if (!per.error && Array.isArray(per.data) && per.data.length > 0) {
        rows = per.data
        error = null
      }
    }
    if (!error && Array.isArray(rows)) {
      pages = (rows as Array<{
        page_order: number
        chapter_idx: number
        image_url: string
        bubbles: ComicPage['bubbles']
        target_vocab: string[]
        stave_label: string | null
        book_v_level: number | null
      }>).map((r) => ({
        pageOrder: r.page_order,
        chapterIdx: r.chapter_idx,
        imageUrl: r.image_url,
        bubbles: Array.isArray(r.bubbles) ? r.bubbles : [],
        targetVocab: Array.isArray(r.target_vocab) ? r.target_vocab : [],
        staveLabel: r.stave_label,
        bookVLevel: r.book_v_level,
      }))
    }
  } catch {
    pages = []
  }

  if (pages.length === 0) {
    return <ComicEmpty textId={t.id} message="이 책의 만화는 준비 중이에요" />
  }

  // 진도 로드(기기 간 이어보기) — RLS user-owns · 미적용/미로그인 시 0
  let initialIndex = 0
  try {
    const { data: prog } = await client
      .from('comic_read_progress')
      .select('last_index')
      .eq('library_book_id', t.library_book_id)
      .maybeSingle()
    const li = (prog as { last_index: number } | null)?.last_index
    if (typeof li === 'number') initialIndex = Math.max(0, Math.min(pages.length, li))
  } catch {
    initialIndex = 0
  }

  return (
    <ComicReader
      textId={t.id}
      bookTitle={bookTitle}
      pages={pages}
      libraryBookId={t.library_book_id}
      initialIndex={initialIndex}
      format={comicFormat}
    />
  )
}
