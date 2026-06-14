// apps/web/src/app/admin/articles/preview/[id]/page.tsx
// ACP v1.1 — 글 검수 RSC entry (LCP 책 검수 /admin/curation/preview/[bookId] 미러)
//
// 목록(Curated 탭)만으로는 큐레이션 불가 → 본문 정독 + 단어추출 + 보이스 연결 + 검수 팝업.
// 책 검수와 동일한 read → analyze → curate 흐름. 단, 글은 단일 섹션(챕터 없음).
//
// vocab(library_article_vocabularies)는 admin RLS 정책이 없어(=published+safe 또는 service_role
// 만 SELECT) service-role 로 읽는다 — ready 상태 글도 추출 단어를 검수해야 하므로.

import { notFound } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'
import type { ArticleStatus } from '@/lib/articles/types'
import type { ReviewVocab } from '@/lib/articles/review-types'

import { AdminArticleReviewClient } from './AdminArticleReviewClient'

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
  audio_url: string | null
  created_at: string
}

export default async function AdminArticlePreviewPage({ params }: PageProps) {
  await requireAdmin(`/admin/articles/preview/${params.id}`)

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  }
  const client = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: article, error } = await client
    .from('library_articles')
    .select(
      'id, source, source_id, source_url, title, author, cefr_level, cefr_confidence, word_count, reading_minutes, status, status_message, license, copyright_safe_in_kr, published_at, llm_cost_usd, content, audio_url, created_at',
    )
    .eq('id', params.id)
    .maybeSingle()

  if (error || !article) {
    notFound()
  }
  const a = article as ArticleRow

  // 추출 단어 전량 (base_learning_value desc) — 발행 결과 = 학습 단어
  const { data: vocabRows } = await client
    .from('library_article_vocabularies')
    .select('word, lemma, first_sentence, base_learning_value, frequency_in_article')
    .eq('library_article_id', a.id)
    .order('base_learning_value', { ascending: false, nullsFirst: false })

  const rows = (vocabRows ?? []) as Array<{
    word: string
    lemma: string | null
    first_sentence: string | null
    base_learning_value: number | null
    frequency_in_article: number | null
  }>

  // 뜻 / pos / CEFR / V-Level / register / frequency_rank 조인 (shared_dictionary)
  const lemmaList = [...new Set(rows.map((r) => r.lemma ?? r.word))]
  const dictMap = new Map<
    string,
    {
      meaning_ko: string | null
      pos: string | null
      cefr_level: string | null
      v_level: number | null
      word_register: string | null
      frequency_rank: number | null
    }
  >()
  if (lemmaList.length > 0) {
    // .in() 청크 (대용량 article 대비)
    const CHUNK = 500
    for (let i = 0; i < lemmaList.length; i += CHUNK) {
      const slice = lemmaList.slice(i, i + CHUNK)
      const { data: dict } = await client
        .from('shared_dictionary')
        .select('word, meaning_ko, pos, cefr_level, v_level, word_register, frequency_rank')
        .in('word', slice)
      for (const d of (dict ?? []) as Array<{
        word: string
        meaning_ko: string | null
        pos: string | null
        cefr_level: string | null
        v_level: number | null
        word_register: string | null
        frequency_rank: number | null
      }>) {
        dictMap.set(d.word, {
          meaning_ko: d.meaning_ko,
          pos: d.pos,
          cefr_level: d.cefr_level,
          v_level: d.v_level,
          word_register: d.word_register,
          frequency_rank: d.frequency_rank,
        })
      }
    }
  }

  const vocab: ReviewVocab[] = rows.map((r, i) => {
    const key = r.lemma ?? r.word
    const m = dictMap.get(key)
    return {
      rank: i + 1,
      word: r.word,
      lemma: r.lemma,
      firstSentence: r.first_sentence,
      baseLearningValue: r.base_learning_value,
      frequencyInArticle: r.frequency_in_article,
      meaningKo: m?.meaning_ko ?? null,
      pos: m?.pos ?? null,
      cefrLevel: m?.cefr_level ?? null,
      vLevel: m?.v_level ?? null,
      wordRegister: m?.word_register ?? null,
      frequencyRank: m?.frequency_rank ?? null,
    }
  })

  return (
    <div className="flex flex-col gap-4 p-6">
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
          audioUrl: a.audio_url,
          createdAt: a.created_at,
        }}
        vocab={vocab}
      />
    </div>
  )
}
