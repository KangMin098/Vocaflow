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
      'id, title, author, cefr_level, cefr_confidence, word_count, chapter_count, status, copyright_safe_in_kr, book_v_level, source, source_id, librivox_audio'
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
    librivox_audio: {
      mode?: string | null
      mapped_chapters?: number | null
      section_count?: number | null
      aligned?: boolean | null
      chapter_map?: Record<string, { roman: number; parts: { url: string; title: string | null }[] }> | null
      sections?: Array<{ n?: number | null; title?: string | null; url?: string | null }> | null
    } | null
  }

  // LibriVox 저장본 → 두 모드 인식 (panel 이 'chapter_parts' 외 'flat' 도 connected 로 판정).
  //   - chapter_parts: 다권 Roman 매핑 (chapter_map).
  //   - flat: 1섹션=1챕터 — section_count == chapter_count 인 단권 (sections[i] 1:1).
  //   레거시 mode==null + aligned=true 도 flat 로 간주 (구버전 저장본 호환).
  const lv = b.librivox_audio
  let savedMode: 'chapter_parts' | 'flat' | null = null
  if (lv?.mode === 'chapter_parts' && lv.chapter_map) {
    savedMode = 'chapter_parts'
  } else if (
    lv &&
    Array.isArray(lv.sections) &&
    lv.sections.length > 0 &&
    (lv.aligned === true ||
      (typeof lv.section_count === 'number' &&
        lv.section_count === lv.sections.length &&
        lv.section_count === (b.chapter_count ?? -1)))
  ) {
    savedMode = 'flat'
  }

  // 매핑 리스트 빌드 (정렬)
  let savedChapters: Array<{ idx: number; roman: number; title: string; parts: number; url: string }> = []
  let savedMappedChapters: number | null = null
  if (savedMode === 'chapter_parts' && lv?.chapter_map) {
    savedChapters = Object.entries(lv.chapter_map)
      .map(([idx, v]) => ({
        idx: Number(idx),
        roman: v.roman,
        title: v.parts?.[0]?.title ?? '',
        parts: v.parts?.length ?? 0,
        url: v.parts?.[0]?.url ?? '',
      }))
      .sort((x, y) => x.idx - y.idx)
    savedMappedChapters = lv.mapped_chapters ?? savedChapters.length
  } else if (savedMode === 'flat' && lv?.sections) {
    savedChapters = lv.sections.map((s, i) => ({
      idx: i + 1,
      roman: typeof s.n === 'number' ? s.n : i + 1,
      title: s.title ?? '',
      parts: 1,
      url: s.url ?? '',
    }))
    savedMappedChapters = savedChapters.length
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
        source={b.source}
        sourceId={b.source_id}
      />

      {/* LibriVox 보이스 — 도서 챕터 ↔ 보이스 챕터 직관 매핑 (섹션 제목의 챕터 번호로 자동).
          archive.org 스트리밍 · 리더에서 챕터별 재생. */}
      {(b.source === 'gutenberg' || b.source === 'standard_ebooks' || b.source === 'librivox') && (
        <LibriVoxAudioPanel
          bookId={b.id}
          chapterCount={chapters.length}
          savedMode={savedMode}
          savedMappedChapters={savedMappedChapters}
          savedChapters={savedChapters}
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
