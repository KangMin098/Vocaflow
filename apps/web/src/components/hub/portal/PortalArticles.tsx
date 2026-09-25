// apps/web/src/components/hub/portal/PortalArticles.tsx
//
// 새로 발행된 글 — 번호 붙은 목록(신문 1면의 「많이 본 기사」 자리).
// 글은 URL 이 바로 없다: `startArticleLearning` 이 `texts` 행을 만든 뒤에야 `/text/[id]` 가 생긴다
// (TodayReading 과 같은 계약). 실패는 삼키지 않고 그 행 아래에 말한다.

'use client'

import { ArrowUpRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { startArticleLearning } from '@/lib/articles/start-learning'
import type { PortalArticle } from '@/lib/learner/hub-portal-query'

export function PortalArticles({ articles }: { articles: PortalArticle[] }) {
  if (articles.length === 0) return null
  return (
    <ol className="divide-y divide-[var(--bd)]">
      {articles.map((a, i) => (
        <li key={a.id}>
          <ArticleRow article={a} index={i} />
        </li>
      ))}
    </ol>
  )
}

function ArticleRow({ article, index }: { article: PortalArticle; index: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    if (busy) return
    track({ name: 'hub_promo_clicked', props: { slot: 'reading', index } })
    setBusy(true)
    setError(null)
    const res = await startArticleLearning(article.id)
    if (res.ok) {
      router.push(`/text/${res.textId}?mode=read`)
      return
    }
    setError(res.error)
    setBusy(false)
  }

  const meta = [article.cefr, article.minutes ? `${article.minutes}분` : null].filter(Boolean).join(' · ')

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="group flex min-h-[64px] w-full items-center gap-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-progress"
      >
        <span className="w-8 shrink-0 font-display text-[26px] font-[500] tabular-nums leading-none tracking-[-0.02em] text-[var(--ju)]">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-keep font-serif text-[17px] font-[600] leading-snug text-[var(--t1)] group-hover:underline">
            {article.title}
          </span>
          {meta && <span className="mt-1 block font-mono text-[12px] tabular-nums text-[var(--t2)]">{meta}</span>}
        </span>
        {busy ? (
          <Loader2 size={16} aria-hidden className="shrink-0 animate-spin text-[var(--t2)]" />
        ) : (
          <ArrowUpRight size={16} aria-hidden className="shrink-0 text-[var(--t2)] transition-transform duration-[var(--dur-quick)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
        )}
      </button>
      {error && (
        <p role="alert" className="pb-3 pl-12 font-body text-[13px] text-[var(--error-ink)]">
          {error}
        </p>
      )}
    </>
  )
}
