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
import { pagedSelect } from '@/lib/supabase/paged-select'
import type { PublishedArticle } from '@/lib/articles/types'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'

export const metadata = {
  title: 'Dispatches',
  description: '큐레이션된 짧은 영어 글',
}

// `?series=` 를 읽으므로 요청마다 렌더한다(만화 서가 `/comics/restored` 와 같은 방식).
// 이전에는 `revalidate = 60` 이었으나, 그때는 시리즈 선택이 **주소가 아니라 상태**였다 —
// 그래서 익명 HTML 에 글로 가는 링크가 하나도 없었다. 주소를 갖는 편이 훨씬 값지다.
export const dynamic = 'force-dynamic'

export default async function LibraryScriptsPage({
  searchParams,
}: {
  searchParams: { series?: string }
}) {
  const client = (await createClient()) as unknown as SupabaseClient

  // published + copyright_safe 아티클 (RLS anyone_read_published_safe_articles 기준 일치)
  // 조건은 lib/library/publish-gate.ts 단일 출처 — 도서/만화 게이트와 함께 관리.
  //
  // ⚠️ 두 가지를 예전에는 안 하고 있었다(실측 2026-09-05) — 도서 카탈로그와 같은 결로 맞춘다:
  //   ① `error` 를 아예 꺼내지 않았다. RLS 변경·컬럼 누락·타임아웃 어느 것이든 조회가
  //      실패하면 `data` 가 `null` 이라 화면이 「아직 게시된 글이 없어요」를 말했다.
  //      재고는 293편 그대로인데 0을 말하는 것이고, 오류 로그도 화면 신호도 없어
  //      **아무도 못 잡는다.** `ScriptsBrowser` 는 이미 `loadError` 를 받을 줄 안다.
  //   ② 상한이 없었다. PostgREST 는 한 응답에 1,000행까지만 주고 **오류 없이** 자른다
  //      (`lib/supabase/paged-select.ts`). `library_articles` 는 ready 19,050 ·
  //      queued 50,262 가 대기 중이라, 발행이 1,000을 넘는 순간 카탈로그가 조용히 잘린다.
  let loadError = false;
  let articles: PublishedArticle[] = [];
  try {
    articles = await pagedSelect<PublishedArticle>(
      (from, to) =>
        applyArticleCatalogGate(
          client
            .from('library_articles')
            .select(
              'id, title, author, source, source_url, cefr_level, word_count, reading_minutes, category_tags, published_at, article_v_level, register, audio_url, adapted_from_id',
            ),
        )
          .order('published_at', { ascending: false, nullsFirst: false })
          .range(from, to),
      '스크립트 카탈로그',
    );
  } catch {
    // 실패를 빈 목록으로 뭉개지 않는다 — 화면이 「아직 없어요」 대신 「못 불러왔어요」를 말한다.
    loadError = true;
    articles = [];
  }

  const totalWords = articles.reduce((s, a) => s + (a.word_count ?? 0), 0)

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header className="flex flex-col gap-3 px-1">
          <div className="flex items-center gap-3">
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

        <ScriptsBrowser articles={articles} series={searchParams.series ?? null} loadError={loadError} />
      </div>
    </Screen>
  )
}
