// apps/web/src/app/admin/articles/preview/[id]/page.tsx
// ACP v1.1 — 글 검수 RSC entry (LCP 책 검수 /admin/curation/preview/[bookId] 미러)
//
// 목록(Curated 탭)만으로는 큐레이션 불가 → 본문 정독 + 분석(CEFR/단어) 확인 후
// 게시/보관 결정하는 검수 페이지. 책 검수와 동일한 read → analyze → curate 흐름.

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { ArticleStatus } from '@/lib/articles/types'

import { AdminArticleReviewClient, type ReviewVocab } from './AdminArticleReviewClient'

interface PageProps {
  params: { id: string }
}

export const metadata = {
  title: '글 검수 — Vocaflow Admin',
}

interface ArticleRow {
  id: string
  source: string
  source_id: string
  source_url: string | null
  title: string
  author: string | null
  cefr_level: string | null
  cefr_confidence: number | null
  word_count: number | null
  reading_minutes: number | null
  status: ArticleStatus
  status_message: string | null
  license: string
  copyright_safe_in_kr: boolean
  published_at: string | null
  llm_cost_usd: string | null
  content: string | null
  created_at: string
}

export default async function AdminArticlePreviewPage({ params }: PageProps) {
  await requireAdmin(`/admin/articles/preview/${params.id}`)

  const client = (await createClient()) as unknown as SupabaseClient

  const { data: article, error } = await client
    .from('library_articles')
    .select(
      'id, source, source_id, source_url, title, author, cefr_level, cefr_confidence, word_count, reading_minutes, status, status_message, license, copyright_safe_in_kr, published_at, llm_cost_usd, content, created_at',
    )
    .eq('id', params.id)
    .maybeSingle()

  if (error || !article) {
    notFound()
  }
  const a = article as ArticleRow

  // 상위 학습 단어 (base_learning_value desc) — 검수용 sample
  const { data: vocabRows } = await client
    .from('library_article_vocabularies')
    .select('word, first_sentence, base_learning_value, frequency_in_article')
    .eq('library_article_id', a.id)
    .order('base_learning_value', { ascending: false, nullsFirst: false })
    .limit(40)

  const rows = (vocabRows ?? []) as Array<{
    word: string
    first_sentence: string | null
    base_learning_value: number | null
    frequency_in_article: number | null
  }>

  // 전체 추출 단어 수
  const { count: vocabTotal } = await client
    .from('library_article_vocabularies')
    .select('word', { count: 'exact', head: true })
    .eq('library_article_id', a.id)

  // 뜻 / CEFR / V-Level 조인 (shared_dictionary)
  const wordList = rows.map((r) => r.word)
  const meaningMap = new Map<
    string,
    { meaning_ko: string | null; cefr_level: string | null; v_level: number | null }
  >()
  if (wordList.length > 0) {
    const { data: dict } = await client
      .from('shared_dictionary')
      .select('word, meaning_ko, cefr_level, v_level')
      .in('word', wordList)
    for (const d of (dict ?? []) as Array<{
      word: string
      meaning_ko: string | null
      cefr_level: string | null
      v_level: number | null
    }>) {
      meaningMap.set(d.word, {
        meaning_ko: d.meaning_ko,
        cefr_level: d.cefr_level,
        v_level: d.v_level,
      })
    }
  }

  const vocab: ReviewVocab[] = rows.map((r) => {
    const m = meaningMap.get(r.word)
    return {
      word: r.word,
      firstSentence: r.first_sentence,
      baseLearningValue: r.base_learning_value,
      frequency: r.frequency_in_article,
      meaningKo: m?.meaning_ko ?? null,
      cefrLevel: m?.cefr_level ?? null,
      vLevel: m?.v_level ?? null,
    }
  })

  return (
    <div className="p-6">
      <AdminArticleReviewClient
        article={{
          id: a.id,
          source: a.source,
          sourceId: a.source_id,
          sourceUrl: a.source_url,
          title: a.title,
          author: a.author,
          cefrLevel: a.cefr_level,
          cefrConfidence: a.cefr_confidence,
          wordCount: a.word_count,
          readingMinutes: a.reading_minutes,
          status: a.status,
          statusMessage: a.status_message,
          license: a.license,
          copyrightSafeInKr: a.copyright_safe_in_kr,
          publishedAt: a.published_at,
          llmCostUsd: a.llm_cost_usd,
          content: a.content,
          createdAt: a.created_at,
        }}
        vocab={vocab}
        vocabTotal={vocabTotal ?? vocab.length}
      />
    </div>
  )
}
