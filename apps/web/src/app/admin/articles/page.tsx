// apps/web/src/app/admin/articles/page.tsx
// ACP v1.0 Phase 18 — Article Curation Pipeline 관리 콘솔
//
// LCP (책) 과 분리된 짧은 글 도메인 — RSS 어댑터 (VOA 등) → analyze → ready/published.
//
// 이 화면이 읽는 것은 세 가지고, 전부 **서버에서 잘라 온다**:
//   ① 상태별 카운트(타일·칩·페이지 분모) — count exact/head
//   ② 발행 커버리지 30칸 — 칸마다 count exact/head
//   ③ 목록 한 페이지 — 상태·소스 필터 + .range()
// 87,968행을 통째로 내려보내던 예전 방식은 PostgREST 1,000행 절단에 걸려 발행 293건을
// 화면에서 통째로 지웠다(admin-queries.ts 머리말 참조).

import { Suspense } from 'react'

import { requireAdmin } from '@/lib/auth/require-admin'
import {
  countAdminArticles,
  getArticleStatusCounts,
  getPublishedCoverage,
  listAdminArticles,
  listSourceFeedHealth,
  statsFromCounts,
} from '@/lib/articles/admin-queries'
import {
  ARTICLE_LIST_PAGE_SIZE,
  parseArticleConsoleView,
  stageNeedsList,
  statusesForFilter,
  type ArticleConsoleView,
} from '@/lib/articles/console-view'
import { CurationConsole } from './CurationConsole'

export const metadata = {
  title: 'ACP Pipeline — Vocaflow Admin',
  description: 'Article Curation Pipeline v1.0 — VOA · NASA · NIH · Simple Wikipedia · Wikinews · The Conversation 짧은 글 큐레이션',
}

// 상태·페이지가 URL 에 있으므로 요청마다 다른 화면이다 — 캐시하면 필터를 눌러도 안 바뀐다.
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function AdminArticlesPage({ searchParams }: PageProps) {
  await requireAdmin('/admin/articles')
  const view = parseArticleConsoleView(searchParams)

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader />
      {/* key: 뷰가 바뀌면 새 Suspense 경계 → 필터를 눌렀을 때 낡은 표가 남지 않는다. */}
      <Suspense key={`${view.stage}|${view.status}|${view.source ?? ''}|${view.page}`} fallback={<Fallback />}>
        <Content view={view} />
      </Suspense>
    </div>
  )
}

async function Content({ view }: { view: ArticleConsoleView }) {
  const needsList = stageNeedsList(view.stage)
  const listFilter = {
    statuses: statusesForFilter(view.status) ?? undefined,
    source: view.source,
  }

  const [counts, coverage, feedHealth, articles, listTotal] = await Promise.all([
    getArticleStatusCounts(),
    getPublishedCoverage(),
    listSourceFeedHealth(),
    needsList
      ? listAdminArticles({ ...listFilter, page: view.page, pageSize: ARTICLE_LIST_PAGE_SIZE })
      : Promise.resolve([]),
    needsList ? countAdminArticles(listFilter) : Promise.resolve(0),
  ])

  return (
    <CurationConsole
      view={view}
      articles={articles}
      listTotal={listTotal}
      counts={counts}
      stats={statsFromCounts(counts)}
      coverage={coverage}
      feedHealth={feedHealth}
    />
  )
}

function PageHeader() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[24px] font-[700] text-[var(--t1)]">
        📰 Article Curation Pipeline
      </h1>
      <p className="font-body text-[13px] text-[var(--t2)]">
        ACP v1.0 — 짧은 글 (VOA · NASA · NIH · Simple Wikipedia · Wikinews · The Conversation) 큐레이션. 책(LCP) 과 별개 파이프라인.
      </p>
    </header>
  )
}

function Fallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]" />
    </div>
  )
}
