// apps/web/src/app/admin/curation/preview/[bookId]/page.tsx
// LCP v2.0 Phase 12.5 — admin 검수 RSC entry

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listChapters } from '@/lib/library/reader-queries'
import {
  ChapterWordSetsAdminSection,
  type AdminChapterSetRow,
} from '@/components/admin/curation/ChapterWordSetsAdminSection'
import { BookExtractionPanel } from '@/components/admin/curation/BookExtractionPanel'
import { LibriVoxAudioPanel } from '@/components/admin/curation/LibriVoxAudioPanel'
import { fetchBookChapterSets } from '@/lib/library/books/queries'
import { AdminReviewClient } from './AdminReviewClient'

interface PageProps {
  params: { bookId: string }
}

export const metadata = {
  title: '책 검수 — Vocaflow Admin',
}

export default async function AdminPreviewPage({ params }: PageProps) {
  await requireAdmin(`/admin/curation/preview/${params.bookId}`)

  const client = (await createClient()) as unknown as SupabaseClient

  const { data: book, error } = await client
    .from('library_books')
    .select(
      'id, title, author, cefr_level, cefr_confidence, word_count, chapter_count, status, copyright_safe_in_kr, book_v_level, source, source_id'
    )
    .eq('id', params.bookId)
    .maybeSingle()

  if (error || !book) {
    notFound()
  }

  const b = book as {
    id: string
    title: string
    author: string | null
    cefr_level: string | null
    cefr_confidence: number | null
    word_count: number | null
    chapter_count: number | null
    status: string
    copyright_safe_in_kr: boolean
    book_v_level: number | null
    source: string
    source_id: string | null
  }

  const chapters = await listChapters(client, b.id)
  const chapterSets: AdminChapterSetRow[] = await fetchBookChapterSets(
    client as unknown as Parameters<typeof fetchBookChapterSets>[0],
    b.id,
  )

  return (
    <div className="flex flex-col gap-4 p-6">
      <AdminReviewClient
        bookId={b.id}
        title={b.title}
        author={b.author}
        cefrLevel={b.cefr_level}
        cefrConfidence={b.cefr_confidence}
        totalWordCount={b.word_count ?? 0}
        status={b.status}
        copyrightSafeInKr={b.copyright_safe_in_kr}
        chapters={chapters}
      />

      {/* LibriVox 보이스 연결 — Gutenberg/SE 도서에 낭독 매칭 (독립 소스 GET 아님).
          gutenberg id EXACT 매칭(신뢰) · SE 제목·저자 best-effort · 솔로 우선. archive.org 스트리밍. */}
      {(b.source === 'gutenberg' || b.source === 'standard_ebooks' || b.source === 'librivox') && (
        <LibriVoxAudioPanel
          gutenbergId={b.source === 'gutenberg' ? b.source_id : null}
          seSlug={b.source === 'standard_ebooks' ? b.source_id : null}
          title={b.title}
          author={b.author}
          chapterCount={chapters.length}
        />
      )}

      {/* 도서 단어 재추출 — composite scoring preview (P70/75/80) */}
      <BookExtractionPanel bookId={b.id} bookVLevel={b.book_v_level} />

      {/* 챕터 단어장 검수 — 행 클릭으로 단어/추출 메타 모달 */}
      <ChapterWordSetsAdminSection
        sets={chapterSets}
        bookId={b.id}
        bookVLevel={b.book_v_level}
      />
    </div>
  )
}
