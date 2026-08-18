// apps/web/src/app/(main)/library/scripts/page.tsx
//
// 스크립트 — ACP(/admin/articles) 게시 짧은 글(아티클) 학습 라이브러리.
// /library 레이아웃의 LibraryTabs(도서 · 스크립트 · 공용 단어장) 하위 페이지.

import { FileText } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { Capsule, Screen } from '@/components/ui/ios'
import { createClient } from '@/lib/supabase/server'
import { ScriptsBrowser } from '@/components/library/browse/ScriptsBrowser'
import { applyArticleCatalogGate } from '@/lib/library/publish-gate'
import type { PublishedArticle } from '@/lib/articles/types'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'

export const metadata = {
  title: '스크립트 — Vocaflow Library',
  description: '큐레이션된 짧은 영어 글',
}

export const revalidate = 60

export default async function LibraryScriptsPage() {
  const client = (await createClient()) as unknown as SupabaseClient

  // published + copyright_safe 아티클 (RLS anyone_read_published_safe_articles 기준 일치)
  // 조건은 lib/library/publish-gate.ts 단일 출처 — 도서/만화 게이트와 함께 관리.
  const { data } = await applyArticleCatalogGate(
    client
      .from('library_articles')
      .select(
        'id, title, author, source, source_url, cefr_level, word_count, reading_minutes, category_tags, published_at, article_v_level, register, audio_url, adapted_from_id',
      ),
  ).order('published_at', { ascending: false, nullsFirst: false })

  const articles = (data ?? []) as unknown as PublishedArticle[]
  const totalWords = articles.reduce((s, a) => s + (a.word_count ?? 0), 0)

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header className="flex flex-col gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-ios-sm bg-[var(--p)] text-white"
            >
              <FileText size={16} />
            </span>
            <h1 className="font-editorial text-[44px] font-[500] tracking-[-0.012em] leading-[1.02] text-[var(--t1)] md:text-[56px]">
              {MATERIAL_LABEL.article}
            </h1>
          </div>
          <p className="font-body text-[15px] text-[var(--t2)]">
            큐레이션된 짧은 영어 글 — 당신 수준에 맞는 추천부터 편하게 시작해요.
          </p>
          {articles.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule label={MATERIAL_LABEL.article} value={`${articles.length}`} />
              {totalWords > 0 && (
                <Capsule label="단어" value={`${(totalWords / 1000).toFixed(1)}k`} />
              )}
            </div>
          )}
        </header>

        <ScriptsBrowser articles={articles} />
      </div>
    </Screen>
  )
}
