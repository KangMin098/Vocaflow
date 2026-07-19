// apps/web/src/app/admin/quality/judge/page.tsx
//
// /admin/quality/judge — 추출 품질 판정 하네스 (Q3/Q5)
// blind in-cap/out-of-cap 판정을 축적해 extraction_judgments 골든 라벨 코퍼스를 구축.
// - get_judgment_sample: in-cap 상위 8 + out-of-cap 경계 8, 서버에서 셔플·출처 은닉
// - save_extraction_judgment: 저장 시점 SSoT 재조회로 스냅샷 서버-권위 기록 (blind 보존)
// 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md §3
// admin 가드는 layout(requireAdmin) + RPC 내부 is_admin_or_curator() 2층.

import type { SupabaseClient } from '@supabase/supabase-js'
import { Scale } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

import { JudgeClient, type BookOption, type ArticleOption } from './JudgeClient'

export const metadata = {
  title: '추출 판정 — Admin',
  description: '추출 품질 blind 판정 하네스 (골든 라벨 코퍼스)',
}

export const dynamic = 'force-dynamic'

export default async function AdminJudgePage() {
  const supabase = (await createClient()) as unknown as SupabaseClient

  const [{ data: bookRows }, { data: articleRows }] = await Promise.all([
    supabase
      .from('library_books')
      .select('id, title, book_v_level, chapter_count')
      .eq('status', 'published')
      .order('title', { ascending: true })
      .returns<BookOption[]>(),
    supabase
      .from('library_articles')
      .select('id, title, register, article_v_level')
      .eq('status', 'published')
      .order('title', { ascending: true })
      .returns<ArticleOption[]>(),
  ])

  const books = (bookRows ?? []).filter((b) => (b.chapter_count ?? 0) > 0)
  const articles = articleRows ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header>
        <h1 className="inline-flex items-center gap-2.5 font-display text-[28px] font-[800] text-[var(--t1)]">
          <Scale size={26} className="text-[#8B5CF6]" aria-hidden="true" /> 추출 판정
        </h1>
        <p className="mt-2 max-w-2xl font-body text-[14px] leading-[1.6] text-[var(--t2)]">
          시스템이 고른 단어 vs 경계 후보를 <strong className="text-[var(--t1)]">출처를 가린 채</strong>{' '}
          섞어서 보여드려요. 이 챕터를 공부하는 학습자에게 가치 있는 단어만 고르시면, 그 판정이
          골든 라벨로 쌓여 추출 순위·게이트 변경의 회귀 기준이 됩니다.
        </p>
      </header>

      {books.length === 0 && articles.length === 0 ? (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-10 text-center">
          <p className="font-body text-[14px] text-[var(--t2)]">
            발행된 도서·아티클이 없어요. admin 권한을 확인해 주세요.
          </p>
        </section>
      ) : (
        <JudgeClient books={books} articles={articles} />
      )}

      <p className="text-center font-body text-[11px] text-[var(--t3)]">
        표본 = in-cap 상위 8 + out-of-cap 경계 8 (셔플) · 판정은 blind — 제출 후에만 시스템 선택이
        공개됩니다 · 저장: extraction_judgments (composite/sort_order 스냅샷 보존)
      </p>
    </div>
  )
}
