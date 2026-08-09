// apps/web/src/components/library/browse/ArticleCard.tsx
//
// 아티클 타일 (v06.240 에디토리얼 재설계) — SeriesDetail 글 목록/리드 전용.
// 본문 미리보기가 없으므로 "제목(Lora)"이 콘텐츠의 얼굴 → 크고 읽기 좋게 승격,
// 나머지(출처·시간·레벨·적합·음성·태그)는 절제된 한 줄 메타로. 카드 전체가 읽기 진입.
//   · featured: 시리즈에서 먼저 읽어볼 1편을 큰 리드로(잡지 lead 스타일).
//   · normal:   그룹 리스트용 표준 타일.

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clock, ExternalLink, Loader2, Target, Volume2 } from 'lucide-react'

import { sourceMeta } from '@/lib/articles/source-meta'
import { startArticleLearning } from '@/lib/articles/start-learning'
import type { PublishedArticle } from '@/lib/articles/types'
import { judgeArticleIPlusOne } from '@/lib/library/i-plus-one'

const CEFR_COLOR: Record<string, string> = {
  A1: '#15803D',
  A2: 'var(--ios-green)',
  B1: 'var(--p)',
  B2: '#1D4ED8',
  C1: '#7C3AED',
  C2: '#581C87',
}

/** 대략적 읽기 시간(분) — reading_minutes 우선, 없으면 word_count/200 추정. */
function readMinutes(a: PublishedArticle): number | null {
  if (a.reading_minutes != null) return a.reading_minutes
  if (a.word_count != null) return Math.max(1, Math.round(a.word_count / 200))
  return null
}

export function ArticleCard({
  article,
  userVLevel,
  featured = false,
}: {
  article: PublishedArticle
  userVLevel: number
  featured?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const src = sourceMeta(article.source)
  const cefr = article.cefr_level
  const cefrColor = cefr ? CEFR_COLOR[cefr] ?? 'var(--t3)' : null
  const fit = judgeArticleIPlusOne(article.article_v_level, userVLevel)
  const hasAudio = !!(article.audio_url && article.audio_url.trim())
  const mins = readMinutes(article)
  const tags = (article.category_tags ?? []).slice(0, featured ? 3 : 2)

  function handleLearn() {
    startTransition(async () => {
      const res = await startArticleLearning(article.id)
      if (res.ok) router.push(`/text/${res.textId}?mode=read`)
      else window.alert(res.error)
    })
  }

  const SourceBadge = (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-[700]" style={{ color: src.color }}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: src.color }} />
      {src.label}
    </span>
  )

  const Meta = (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] font-[600] text-[var(--t2)]">
      {mins != null && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock size={11} aria-hidden /> {mins}분
        </span>
      )}
      {cefr && (
        <span className="tabular-nums" style={{ color: cefrColor ?? 'var(--t3)' }}>
          {cefr}
        </span>
      )}
      {fit && (
        <span className="inline-flex items-center gap-1" style={{ color: fit.color }}>
          <Target size={11} aria-hidden /> {fit.label}
        </span>
      )}
      {hasAudio && (
        <span className="inline-flex items-center gap-1" title="원어민 음성 포함">
          <Volume2 size={11} aria-hidden /> 음성
        </span>
      )}
    </div>
  )

  const Tags = tags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[9.5px] text-[var(--t2)]"
        >
          {t}
        </span>
      ))}
    </div>
  )

  // ── Featured lead (잡지 lead) ──
  if (featured) {
    return (
      <article className="relative">
        <button
          type="button"
          onClick={handleLearn}
          disabled={pending}
          className="group flex w-full flex-col gap-3 rounded-[var(--r-lg)] border p-5 text-left shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-60"
          style={{ borderColor: `color-mix(in srgb, ${src.color} 28%, var(--bd))`, backgroundColor: `color-mix(in srgb, ${src.color} 4%, var(--bg))` }}
        >
          <div className="flex items-center justify-between gap-2">
            {SourceBadge}
            <span className="inline-flex items-center gap-1 font-display text-[10px] font-[800] uppercase tracking-[0.08em] text-[var(--p)]">
              먼저 읽어볼 글
            </span>
          </div>
          <h3 className="font-english text-[21px] font-[600] leading-[1.25] text-[var(--t1)] md:text-[23px]">
            {article.title}
          </h3>
          {article.author && (
            <p className="line-clamp-1 font-body text-[12px] text-[var(--t2)]">{article.author}</p>
          )}
          {Meta}
          {Tags}
          <span className="mt-1 inline-flex items-center gap-1.5 font-display text-[13px] font-[700] text-[var(--p)]">
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            읽기 시작
            <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
        {article.source_url && <OriginalLink href={article.source_url} />}
      </article>
    )
  }

  // ── Normal tile ──
  return (
    <article className="relative h-full">
      <button
        type="button"
        onClick={handleLearn}
        disabled={pending}
        className="group flex h-full w-full flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 pr-9 text-left shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--p)_50%,var(--bd))] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {SourceBadge}
        <h3 className="line-clamp-3 font-english text-[15.5px] font-[600] leading-[1.32] text-[var(--t1)]">
          {article.title}
        </h3>
        <div className="mt-auto flex flex-col gap-2 pt-0.5">
          {Meta}
          {Tags}
        </div>
        {pending && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center rounded-[var(--r-lg)] bg-[var(--bg)]/60">
            <Loader2 size={16} className="animate-spin text-[var(--p)]" />
          </span>
        )}
      </button>
      {article.source_url && <OriginalLink href={article.source_url} />}
    </article>
  )
}

// 원문 링크 — 카드 버튼과 겹치지 않게 우상단 별도 (button 안에 a 중첩 불가).
function OriginalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="원문 보기"
      aria-label="원문 보기"
      className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <ExternalLink size={13} aria-hidden />
    </a>
  )
}
