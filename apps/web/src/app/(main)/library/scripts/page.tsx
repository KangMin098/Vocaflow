// apps/web/src/app/(main)/library/scripts/page.tsx
//
// 스크립트 — ACP(/admin/articles) 게시 짧은 글(아티클) 학습 라이브러리.
// /library 레이아웃의 LibraryTabs(도서 · 스크립트 · 공용 단어장) 하위 페이지.

import { FileText } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { ArticlesExplorer } from '@/components/library/browse/ArticlesExplorer'
import type { PublishedArticle } from '@/lib/articles/types'

export const metadata = {
  title: '스크립트 — Vocaflow Library',
  description: '큐레이션된 짧은 영어 글',
}

export const revalidate = 60

export default async function LibraryScriptsPage() {
  const client = (await createClient()) as unknown as SupabaseClient

  // published + copyright_safe 아티클 (RLS anyone_read_published_safe_articles 기준 일치)
  const { data } = await client
    .from('library_articles')
    .select(
      'id, title, author, source, source_url, cefr_level, word_count, reading_minutes, category_tags, published_at',
    )
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  const articles = (data ?? []) as unknown as PublishedArticle[]
  const totalWords = articles.reduce((s, a) => s + (a.word_count ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Slim header */}
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--bd)] pb-3">
        <div className="flex items-baseline gap-2.5">
          <FileText size={16} className="self-center text-[#8B5CF6]" aria-hidden />
          <h1 className="font-display text-[18px] font-[700] text-[var(--t1)]">스크립트</h1>
          <span className="font-body text-[12px] text-[var(--t3)]">큐레이션된 짧은 영어 글</span>
        </div>
        {articles.length > 0 && (
          <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--t3)]">
            <span>
              <strong className="font-display font-[700] text-[var(--t1)]">{articles.length}</strong>편
            </span>
            {totalWords > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  <strong className="font-display font-[700] text-[var(--t1)]">
                    {(totalWords / 1000).toFixed(1)}k
                  </strong>
                  단어
                </span>
              </>
            )}
          </div>
        )}
      </header>

      <ArticlesExplorer articles={articles} />
    </div>
  )
}
