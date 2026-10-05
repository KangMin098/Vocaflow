// apps/web/src/components/hub/portal/PortalArticleCards.tsx
//
// 새로 발행된 글 — 참조 웨비나 목록(/webinars)의 카드 골격: 옅은 색 면 + 같은 계열 1px 테두리,
// 위에 진한 칩 · 옅은 칩 한 쌍, 세리프 제목, 아래에 「사람 줄」(우리는 원문 출처).
// 글은 URL 이 바로 없다: `startArticleLearning` 이 `texts` 행을 만든 뒤에야 `/text/[id]` 가 생긴다
// (PortalArticles · TodayReading 과 같은 계약). 실패는 삼키지 않고 그 카드 안에 말한다.

'use client'

import { ArrowUpRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { startArticleLearning } from '@/lib/articles/start-learning'
import { TINT_CLASS, type Tint } from '@/lib/design/tone'
import type { PortalArticle } from '@/lib/learner/hub-portal-query'

/** 참조 목록의 색 순서(라벤더 · 분홍 · 라벤더 · 초록 …)를 우리 틴트로 — 이웃 카드가 같은 색이 되지 않게. */
const CARD_TINTS: readonly Tint[] = ['lavender', 'pink', 'green', 'peach', 'teal', 'yellow']

/** 「제목 - 출처」 꼴이면 출처를 떼어 사람 줄 자리에 둔다. 없으면 사람 줄을 그리지 않는다(지어내지 않는다). */
export function splitSource(title: string): { headline: string; source: string | null } {
  const i = title.lastIndexOf(' - ')
  if (i <= 0) return { headline: title, source: null }
  const source = title.slice(i + 3).trim()
  if (!source || source.length > 40) return { headline: title, source: null }
  return { headline: title.slice(0, i).trim(), source }
}

export function PortalArticleCards({ articles }: { articles: PortalArticle[] }) {
  if (articles.length === 0) return null
  return (
    <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {articles.map((a, i) => (
        <li key={a.id}>
          <ArticleCard article={a} index={i} tint={CARD_TINTS[i % CARD_TINTS.length]} />
        </li>
      ))}
    </ul>
  )
}

function ArticleCard({ article, index, tint }: { article: PortalArticle; index: number; tint: Tint }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { headline, source } = splitSource(article.title)

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

  return (
    <div className={`${TINT_CLASS[tint]} flex h-full flex-col rounded-[10px] border border-[color-mix(in_srgb,var(--t1)_30%,transparent)]`}>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="group flex min-h-[260px] w-full flex-1 flex-col p-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-progress lg:min-h-[280px]"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          {article.cefr && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-[var(--t1)] px-2.5 font-mono text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--bg)]">
              {article.cefr}
            </span>
          )}
          {article.minutes ? (
            <span className="inline-flex h-[22px] items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_14%,transparent)] px-2.5 md:bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] font-mono text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]">
              {article.minutes} min read
            </span>
          ) : null}
        </span>
        <span className="mt-5 line-clamp-4 break-keep font-serif text-[22px] font-[400] leading-[1.18] tracking-[-0.01em] text-[var(--t1)] group-hover:underline lg:text-[24px]">
          {headline}
        </span>
        <span className="mt-auto flex items-center gap-3 pt-8">
          {source ? (
            <>
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_18%,transparent)] font-display text-[13px] font-[700] text-[var(--t1)]">
                {source.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[13px] font-[600] text-[var(--t1)]">{source}</span>
                <span className="block font-body text-[11px] text-[var(--t1)] opacity-80 md:opacity-100">원문 출처</span>
              </span>
            </>
          ) : (
            <span className="flex-1" />
          )}
          {busy ? (
            <Loader2 size={16} aria-hidden className="shrink-0 animate-spin text-[var(--t1)]" />
          ) : (
            <ArrowUpRight size={16} aria-hidden className="shrink-0 text-[var(--t1)] transition-transform duration-[var(--dur-quick)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
          )}
        </span>
      </button>
      {error && (
        <p role="alert" className="px-6 pb-5 font-body text-[13px] text-[var(--error-ink)]">
          {error}
        </p>
      )}
    </div>
  )
}
