// apps/web/src/app/admin/articles/page.tsx
// ACP v1.0 Phase 18 — Article Curation Pipeline 관리 콘솔
//
// LCP (책) 과 분리된 짧은 글 도메인 — RSS 어댑터 (VOA 등) → analyze → ready/published.

import { Suspense } from 'react'

import { requireAdmin } from '@/lib/auth/require-admin'
import { listAdminArticles, listSourceFeedHealth, articleStats } from '@/lib/articles/admin-queries'
import { CurationConsole } from './CurationConsole'

export const metadata = {
  title: 'ACP Pipeline — Vocaflow Admin',
  description: 'Article Curation Pipeline v1.0 — VOA · NASA · NIH · Simple Wikipedia · Wikinews · The Conversation 짧은 글 큐레이션',
}

export const revalidate = 60

export default async function AdminArticlesPage() {
  await requireAdmin('/admin/articles')

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader />
      <Suspense fallback={<Fallback />}>
        <Content />
      </Suspense>
    </div>
  )
}

async function Content() {
  const [articles, feedHealth] = await Promise.all([listAdminArticles(), listSourceFeedHealth()])
  const stats = articleStats(articles)
  return <CurationConsole articles={articles} stats={stats} feedHealth={feedHealth} />
}

function PageHeader() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[24px] font-[700] text-[var(--t1)]">
        📰 Article Curation Pipeline
      </h1>
      <p className="font-body text-[13px] text-[var(--t3)]">
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
