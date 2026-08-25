// apps/web/src/app/(main)/text/[id]/echo/page.tsx
//
// v06.32 — EchoMatch 따라읽기 메인 페이지.
// library_book chapter → library_chapters_master + content_chunks JOIN (content + sentence_offsets).
// 사용자 직접 입력 텍스트 → texts.content + splitIntoSentences fallback.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { splitIntoSentences } from '@/lib/echo/sentence-splitter'
import type { EchoSentence } from '@/components/echo/EchoMatchPlayer'
import { EchoMatchPlayerDynamic } from '@/components/echo/EchoMatchPlayerDynamic'

interface PageProps {
  params: { id: string }
}

export const metadata = {
  title: '따라읽기 · Vocaflow',
}

export const dynamic = 'force-dynamic'

/** sentence_offsets (cumulative start positions) → content slice 배열. */
function sentencesFromOffsets(content: string, offsets: number[] | null): string[] {
  if (!offsets || offsets.length === 0) return []
  const out: string[] = []
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]!
    const end = i + 1 < offsets.length ? offsets[i + 1]! : content.length
    const text = content.slice(start, end).trim()
    if (text.length >= 4) out.push(text)
  }
  return out
}

export default async function EchoModePage({ params }: PageProps) {
  console.log('[Echo] page start, id:', params.id)
  const client = (await createClient()) as unknown as SupabaseClient

  console.log('[Echo] fetching texts row...')
  const { data: text, error: textErr } = await client
    .from('texts')
    .select('id, title, content, chapter_title, chapter_idx, library_book_id')
    .eq('id', params.id)
    .maybeSingle()

  if (textErr) console.error('[Echo] texts fetch err:', textErr)
  if (!text) {
    console.warn('[Echo] text row not found, 404')
    notFound()
  }

  const t = text as {
    id: string
    title: string | null
    content: string | null
    chapter_title: string | null
    chapter_idx: number | null
    library_book_id: string | null
  }
  console.log('[Echo] text fetched. library_book_id:', t.library_book_id, 'chapter_idx:', t.chapter_idx, 'has_content:', !!t.content)

  let bookTitle: string | null = null
  let chapterContent: string | null = t.content
  let sentenceOffsets: number[] | null = null

  // library_book chapter — library_chapters_master JOIN content_chunks 에서 본문 fetch
  if (t.library_book_id && t.chapter_idx != null) {
    console.log('[Echo] fetching book + chapter master...')
    try {
      const [{ data: book }, { data: chapter, error: chErr }] = await Promise.all([
        client
          .from('library_books')
          .select('title')
          .eq('id', t.library_book_id)
          .maybeSingle(),
        client
          .from('library_chapters_master')
          .select('chapter_title, sentence_offsets, content_hash')
          .eq('library_book_id', t.library_book_id)
          .eq('chapter_idx', t.chapter_idx)
          .maybeSingle(),
      ])
      if (chErr) console.error('[Echo] chapter master err:', chErr)

      bookTitle = (book as { title: string } | null)?.title ?? null

      const c = chapter as {
        chapter_title: string | null
        sentence_offsets: number[] | null
        content_hash: string | null
      } | null
      console.log('[Echo] chapter master:', { hasHash: !!c?.content_hash, sentenceCount: c?.sentence_offsets?.length ?? 0 })

      if (c?.content_hash) {
        console.log('[Echo] fetching content_chunks for hash...')
        const { data: chunk, error: ccErr } = await client
          .from('content_chunks')
          .select('content')
          .eq('hash', c.content_hash)
          .maybeSingle()
        if (ccErr) console.error('[Echo] content_chunks err:', ccErr)
        const chunkRow = chunk as { content: string } | null
        if (chunkRow?.content) chapterContent = chunkRow.content
        sentenceOffsets = c.sentence_offsets ?? null
        console.log('[Echo] content_chunks fetched. len:', chunkRow?.content?.length ?? 0)
      }
    } catch (e) {
      console.error('[Echo] library fetch chain failed:', e)
    }
  }

  // sentence 추출 — sentence_offsets 우선, fallback splitIntoSentences
  let rawSentences: string[] = []
  if (chapterContent) {
    if (sentenceOffsets && sentenceOffsets.length > 0) {
      rawSentences = sentencesFromOffsets(chapterContent, sentenceOffsets)
    } else {
      rawSentences = splitIntoSentences(chapterContent)
    }
  }

  const sentences: EchoSentence[] = rawSentences.map((s, idx) => ({
    id: `${t.id}-${idx}`,
    text: s,
    chapterIdx: t.chapter_idx ?? undefined,
  }))
  console.log('[Echo] sentences ready, count:', sentences.length)

  const chapterTitle =
    t.chapter_title ?? (t.chapter_idx != null ? `Chapter ${t.chapter_idx}` : null)

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <Link
          href={`/text/${params.id}?mode=read`}
          className="inline-flex items-center gap-2 font-body text-[12px] font-[500] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          본문으로
        </Link>
      </div>
      <EchoMatchPlayerDynamic
        textId={t.id}
        libraryBookId={t.library_book_id}
        bookTitle={bookTitle ?? t.title ?? undefined}
        chapterTitle={chapterTitle ?? undefined}
        sentences={sentences}
      />
    </div>
  )
}
