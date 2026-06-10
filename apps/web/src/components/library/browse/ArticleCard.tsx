// apps/web/src/components/library/browse/ArticleCard.tsx
//
// 스크립트(아티클) 카드 — /library/books 스크립트 탭.
// 아티클은 표지가 없는 짧은 단일 텍스트라, 도서 코버 대신 소스 액센트 + 메타 중심 카드.
// "학습하기" → startArticleLearning(서버 액션) → /text/[id] 워크스페이스.

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clock, ExternalLink, FileText, Loader2 } from 'lucide-react'

import { startArticleLearning } from '@/lib/articles/start-learning'
import type { PublishedArticle } from '@/lib/articles/types'

const SOURCE_META: Record<string, { label: string; color: string }> = {
  voa: { label: 'VOA Learning', color: '#2563EB' },
  nasa: { label: 'NASA', color: '#7C3AED' },
  nih: { label: 'NIH', color: '#0E7490' },
  arxiv: { label: 'arXiv', color: '#B91C1C' },
  rss: { label: 'RSS', color: '#D97706' },
}

const CEFR_COLOR: Record<string, string> = {
  A1: '#86EFAC',
  A2: '#22C55E',
  B1: '#3B82F6',
  B2: '#1D4ED8',
  C1: '#7C3AED',
  C2: '#581C87',
}

export function ArticleCard({ article }: { article: PublishedArticle }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const src = SOURCE_META[article.source] ?? { label: article.source, color: 'var(--t3)' }
  const cefr = article.cefr_level
  const cefrColor = cefr ? (CEFR_COLOR[cefr] ?? 'var(--t3)') : null
  const tags = (article.category_tags ?? []).slice(0, 3)

  function handleLearn() {
    startTransition(async () => {
      const res = await startArticleLearning(article.id)
      if (res.ok) router.push(`/text/${res.textId}?mode=read`)
      else window.alert(res.error)
    })
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]">
      {/* 소스 액센트 바 */}
      <div aria-hidden className="h-1" style={{ backgroundColor: src.color }} />

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* 소스 + CEFR */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
            style={{ color: src.color, backgroundColor: `color-mix(in srgb, ${src.color} 12%, transparent)` }}
          >
            <FileText size={10} aria-hidden /> {src.label}
          </span>
          {cefr && (
            <span
              className="inline-flex items-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-white"
              style={{ backgroundColor: cefrColor ?? 'var(--t3)' }}
            >
              {cefr}
            </span>
          )}
        </div>

        {/* 제목 (Lora) */}
        <h3 className="line-clamp-2 font-english text-[16px] font-[600] leading-[1.32] text-[var(--t1)]">
          {article.title}
        </h3>

        {article.author && (
          <p className="line-clamp-1 font-body text-[11.5px] text-[var(--t3)]">{article.author}</p>
        )}

        {/* 메타 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-[var(--t3)]">
          {article.word_count != null && (
            <span className="tabular-nums">{article.word_count.toLocaleString()} 단어</span>
          )}
          {article.reading_minutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} aria-hidden /> {article.reading_minutes}분
            </span>
          )}
        </div>

        {/* 카테고리 태그 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[9px] text-[var(--t2)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* 액션 */}
        <div className="mt-auto flex items-center gap-2 pt-1.5">
          <button
            type="button"
            onClick={handleLearn}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-2 font-display text-[12.5px] font-[600] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <>
                학습하기
                <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="원문 보기"
              aria-label="원문 보기"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
