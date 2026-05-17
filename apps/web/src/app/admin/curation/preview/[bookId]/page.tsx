// apps/web/src/app/admin/curation/preview/[bookId]/page.tsx
// LCP v2.0 Phase 12.5 — admin 검수 RSC entry

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listChapters } from '@/lib/library/reader-queries'
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
      'id, title, author, cefr_level, cefr_confidence, word_count, chapter_count, status, copyright_safe_in_kr'
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
  }

  const chapters = await listChapters(client, b.id)

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
    </div>
  )
}
