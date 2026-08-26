// apps/web/src/components/library/browse/ArticleCard.tsx
//
// 아티클 타일 (v06.240 에디토리얼 재설계) — SeriesDetail 글 목록/리드 전용.
// 본문 미리보기가 없으므로 "제목(Lora)"이 콘텐츠의 얼굴 → 크고 읽기 좋게 승격,
// 나머지(출처·시간·레벨·적합·음성·태그)는 절제된 한 줄 메타로. 카드 전체가 읽기 진입.
//   · featured: 시리즈에서 먼저 읽어볼 1편을 큰 리드로(잡지 lead 스타일).
//   · normal:   그룹 리스트용 표준 타일.
//
// ── 왜 `<button>` 이 아니라 `<a>` 인가 (2026-08-26) ─────────────────────
// 이 카드는 `<button onClick>` 이었다. 화면에서는 잘 동작했지만 **주소가 없었다.**
// 그래서 `/library/scripts` 를 익명으로 받아 보면 글 제목은 다 들어 있는데
// **상세로 가는 링크가 0개**였다 — sitemap 이 광고하는 글 160개를 사이트 안 어느 페이지도
// 가리키지 않는 고아 상태였다. 크롤러는 sitemap 으로 주소를 알아도 그 페이지가 어디에
// 속하는지 모르고, 비로그인 방문자는 클릭해도 학습 시작이 실패해 `alert` 를 봤다.
//
// 이제 카드는 **진짜 링크**다(`/library/scripts/[id]`). 그 라우트가 서버에서 이미 갈라 준다 —
// 로그인이면 학습 시작으로 리다이렉트, 아니면 공개 미리보기. 링크만으로도 두 경우가 다 맞는다.
//
// 로그인 사용자의 클릭은 그대로 가로채 **한 번에** 학습으로 보낸다(리다이렉트 한 홉을 아낀다).
// 실패하면 `alert` 대신 링크 주소로 보낸다 — 익명 클릭이 막다른 골목이 되지 않는다.

'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clock, ExternalLink, Loader2, Target, Volume2, Sparkles } from 'lucide-react'

import { sourceMeta } from '@/lib/articles/source-meta'
import { startArticleLearning } from '@/lib/articles/start-learning'
import type { PublishedArticle } from '@/lib/articles/types'
import { judgeArticleIPlusOne } from '@/lib/library/i-plus-one'
import { mediaFormSpec, resolveMediaForm } from '@/lib/library/media-form'
import { MediaCover, MediaCoverSrLabel } from '@/components/library/MediaCover'

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
  // ACP §20 — 쉬운 판은 출처를 원본 그대로 쓰므로 카탈로그에서 원본 옆에 선다.
  //   표시가 없으면 학습자에게는 같은 글이 두 개로 보인다.
  const isEasier = !!article.adapted_from_id
  const mins = readMinutes(article)
  const tags = (article.category_tags ?? []).slice(0, featured ? 3 : 2)

  // 매체 형식 — 이 글이 "어떤 종류의 인쇄물" 인지. 도서만 표지를 갖고 나머지는 이모지 하나였던
  // 자리를 조판 문법 표지로 채운다(근거·형식 목록은 lib/library/media-form.ts).
  // register 를 source 보다 먼저 보는 판정이라 VOA 단신이 어학 강의 표지를 달지 않는다.
  const form = resolveMediaForm({
    kind: 'article',
    source: article.source,
    register: article.register ?? null,
    hasAudio,
  })
  const formSpec = mediaFormSpec(form)
  /** 형식 칩 — 색만으로 구분하지 않는다(형태 + 라벨 + 아래 SR 텍스트 3중). */
  const FormChip = (
    <span
      className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[9.5px] font-[800] tracking-[0.04em]"
      style={{ color: formSpec.accent, background: `color-mix(in srgb, ${formSpec.accent} 12%, transparent)` }}
    >
      {formSpec.label}
    </span>
  )

  /** 카드의 주소. 크롤러가 보는 것도, 클릭이 실패했을 때 가는 곳도 이것이다. */
  const href = `/library/scripts/${article.id}`

  /**
   * 로그인 사용자의 지름길 — 상세 라우트가 할 리다이렉트를 여기서 미리 한다.
   *
   * 실패해도 막다른 골목이 되지 않는다: 예전에는 `alert` 였고, 익명 방문자는 그 자리에서 끝났다.
   * 이제는 링크가 원래 가려던 곳(공개 미리보기)으로 보낸다.
   */
  function handleLearn(e: React.MouseEvent<HTMLAnchorElement>) {
    // 새 탭·다운로드 등 브라우저 고유 동작은 가로채지 않는다.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    startTransition(async () => {
      const res = await startArticleLearning(article.id)
      router.push(res.ok ? `/text/${res.textId}?mode=read` : href)
    })
  }

  const SourceBadge = (
    <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-[700]" style={{ color: src.color }}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: src.color }} />
      {src.label}
    </span>
  )

  const Meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-[600] text-[var(--t2)]">
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
      {isEasier && (
        <span
          className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg2)] px-2 text-[var(--p)]"
          title="같은 글을 쉬운 영어로 다시 쓴 판이에요"
        >
          <Sparkles size={11} aria-hidden /> 쉬운 판
        </span>
      )}
    </div>
  )

  const Tags = tags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-mono text-[9.5px] text-[var(--t2)]"
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
        <Link
          href={href}
          onClick={handleLearn}
          // `<a>` 에는 disabled 가 없다 — 진행 중임을 보조기술에 알리고 재클릭만 막는다.
          aria-disabled={pending || undefined}
          className="group flex w-full flex-col gap-3 rounded-[var(--r-lg)] border p-5 text-left shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-60"
          style={{ borderColor: `color-mix(in srgb, ${src.color} 28%, var(--bd))`, backgroundColor: `color-mix(in srgb, ${src.color} 4%, var(--bg))` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              {SourceBadge}
              {FormChip}
            </span>
            <span className="inline-flex items-center gap-1 font-display text-[10px] font-[800] uppercase tracking-[0.08em] text-[var(--p)]">
              먼저 읽어볼 글
            </span>
          </div>
          {/* lead 는 지면이 넓으니 표지를 띠로 눕혀 넣는다 — 유형이 제목보다 먼저 눈에 든다 */}
          <span className="block h-[104px] w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)]">
            <MediaCover form={form} title={article.title} />
          </span>
          <h3 className="font-english text-[21px] font-[600] leading-[1.25] text-[var(--t1)] md:text-[23px]">
            {article.title}
            <MediaCoverSrLabel form={form} readingMinutes={mins} />
          </h3>
          {article.author && (
            <p className="line-clamp-1 font-body text-[12px] text-[var(--t2)]">{article.author}</p>
          )}
          {Meta}
          {Tags}
          <span className="mt-1 inline-flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--p)]">
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            읽기 시작
            <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        {article.source_url && <OriginalLink href={article.source_url} />}
      </article>
    )
  }

  // ── Normal tile ──
  return (
    <article className="relative h-full">
      <Link
        href={href}
        onClick={handleLearn}
        aria-disabled={pending || undefined}
        className="group flex h-full w-full flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 pr-9 text-left shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--p)_50%,var(--bd))] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          {SourceBadge}
          {FormChip}
        </span>
        {/* 타일은 좁아서 표지를 제목 옆 작은 판으로 — 60px 이하에서도 조판 표식이 읽힌다 */}
        <span className="flex items-start gap-3">
          <span className="block h-[56px] w-[42px] shrink-0 overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)]">
            <MediaCover form={form} title={article.title} />
          </span>
          <h3 className="line-clamp-3 font-english text-[15.5px] font-[600] leading-[1.32] text-[var(--t1)]">
            {article.title}
            <MediaCoverSrLabel form={form} readingMinutes={mins} />
          </h3>
        </span>
        <div className="mt-auto flex flex-col gap-2 pt-1">
          {Meta}
          {Tags}
        </div>
        {pending && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center rounded-[var(--r-lg)] bg-[var(--bg)]/60">
            <Loader2 size={16} className="animate-spin text-[var(--p)]" />
          </span>
        )}
      </Link>
      {article.source_url && <OriginalLink href={article.source_url} />}
    </article>
  )
}

// 원문 링크 — 카드 링크와 겹치지 않게 우상단 **별도 형제**로 둔다.
// (카드가 `<a>` 가 된 뒤로는 중첩이 더 엄격하다 — `<a>` 안의 `<a>` 는 무효 HTML 이고
//  브라우저가 조용히 밖으로 끌어내 레이아웃이 깨진다.)
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
