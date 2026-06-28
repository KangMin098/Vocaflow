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
  register: string | null
  lexical_noise: number | null
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
      'id, source, source_id, source_url, title, author, cefr_level, cefr_confidence, word_count, reading_minutes, status, status_message, license, copyright_safe_in_kr, published_at, llm_cost_usd, content, audio_url, register, lexical_noise, created_at',
    )
    .eq('id', params.id)
    .maybeSingle()

  if (error || !article) {
    notFound()
  }
  const a = article as ArticleRow

  // v06.51 — select_article_vocab RPC (LCP SSoT 동일 패턴):
  //   • V-Level >= article_v_level 게이트 (없으면 V4 fallback)
  //   • skill penalty (skill=4 AND avl<6 → -0.10)
  //   • register filter (archaic_literary/period_cultural/phrase_unit 제외)
  //   • composite_score 정렬 — preview == publish 100% 동일
  //   shared_dictionary 조인은 RPC 내부에서 완료 → page 단계 JOIN 불필요.
  const sb = client as unknown as {
    rpc: (
      n: string,
      p: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }
  const { data: vocabRows } = await sb.rpc('select_article_vocab', { p_article_id: a.id })

  type SelectedRow = {
    word: string
    lemma: string | null
    meaning_ko: string | null
    v_level: number | null
    cefr_level: string | null
    pos: string | null
    example_en: string | null
    word_register: string | null
    frequency_rank: number | null
    frequency_in_article: number | null
    skill_level: number | null
    composite_score: number | null
    sort_order: number | null
    first_sentence: string | null
  }
  const rows = (vocabRows ?? []) as SelectedRow[]

  // article_v_level (UI 헤더 baseline 칩에 사용) — RPC 가 게이트로 이미 사용한 값.
  const { data: vlRow } = await client
    .from('library_articles')
    .select('article_v_level')
    .eq('id', a.id)
    .maybeSingle()
  const articleVLevel =
    (vlRow as { article_v_level: number | null } | null)?.article_v_level ?? null

  const vocab: ReviewVocab[] = rows.map((r) => ({
    rank: r.sort_order ?? 0,
    word: r.word,
    lemma: r.lemma,
    firstSentence: r.first_sentence,
    // baseLearningValue 자리에 composite_score 매핑 — UI "LV" 컬럼이 SSoT score 표시.
    baseLearningValue: r.composite_score,
    frequencyInArticle: r.frequency_in_article,
    meaningKo: r.meaning_ko,
    pos: r.pos,
    cefrLevel: r.cefr_level,
    vLevel: r.v_level,
    wordRegister: r.word_register,
    frequencyRank: r.frequency_rank,
  }))

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
          articleVLevel: articleVLevel,
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
          register: a.register,
          lexicalNoise: a.lexical_noise,
          createdAt: a.created_at,
        }}
        vocab={vocab}
      />
    </div>
  )
}
