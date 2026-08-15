// apps/web/src/components/library/vocab/VocabSetCard.tsx
//
// 클로스바운드 클래식 책 표지 타일 — /library/books 와 동일한 "책 한 권" 메타포.
// - aspect-[3/4] 책 표지 (그라디언트 + 중앙 serif 제목 + 이모지 장식 + 단어수)
// - 우상단 CEFR 배지 · 좌상단 구독 배지
// - hover/focus 시 + 추가/제외 액션 reveal
// - 그리드라 반사(-webkit-box-reflect)는 끔 (행 간 겹침 방지)

'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Minus, Plus, Users } from 'lucide-react'

import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { bookCover, cefrToVLevel } from '@/lib/library/book-cover'
import { FAMILY_GRAIN } from '@/lib/vcb/covers/design'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { vocabCategoryMeta } from './categories'

interface VocabSetCardProps {
  set: PublishedVocabSet
  isSubscribed: boolean
  isPending: boolean
  errorMessage: string | null
  onToggle: (set: PublishedVocabSet) => void
  onPreview: (set: PublishedVocabSet) => void
}

export function VocabSetCard({
  set,
  isSubscribed,
  isPending,
  errorMessage,
  onToggle,
  onPreview,
}: VocabSetCardProps) {
  const cover = bookCover({
    title: set.title,
    bookVLevel: cefrToVLevel(set.cefrLevel),
    coverFrom: null,
    coverTo: null,
  })
  const cat = vocabCategoryMeta(set.category)

  // 표지 도판 + 계열 듀오톤. 도판이 없으면 종전 그라디언트 표지가 그대로 남는다(공백 아님).
  const coverImage = set.coverImageUrl
  const family = set.coverImageMeta?.family
  const duotone = family ? FAMILY_GRAIN[family] : FAMILY_GRAIN.list

  // 신규(최근 14일) 배지 — 최신성 discovery 신호. SSR 하이드레이션 회피 위해 mount 후 판정.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isNew = mounted && Date.now() - new Date(set.createdAt).getTime() < 14 * 86_400_000

  function handleSubscribeClick(e: React.MouseEvent) {
    e.stopPropagation()
    onToggle(set)
  }

  return (
    <article
      id={`set-${set.id}`}
      // `w-full` — 6열 격자(VocabSetGrid)에 놓이는데 폭 지정이 없으면 칸이 아니라 **내용
      // 너비로 줄어들고**, 안쪽 표지(aspect-[3/4] w-full)가 그 폭을 따라가 카드가 제각각이
      // 된다. BookGridCard 에서 같은 결함을 실측으로 잡았다(같은 행 63px vs 150px).
      className="group relative w-full scroll-mt-24 rounded-[12px] target:ring-2 target:ring-[var(--p)] target:ring-offset-4"
    >
      <button
        type="button"
        onClick={() => onPreview(set)}
        aria-label={`${set.title} 미리보기 열기`}
        className="book-cover-premium relative aspect-[3/4] w-full overflow-hidden transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-2"
        style={{
          // 그리드 카드 — 반사 비활성 (행 간 겹침 방지)
          WebkitBoxReflect: 'none',
          background: `
            radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
            linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)
          `,
        }}
      >
        {/*
          표지 도판 — Openverse 의 퍼블릭도메인 판화.

          그냥 얹으면 29권이 스크랩북이 된다(출처가 제각각이라 채도·시대가 다 다르다).
          계열 색으로 **듀오톤**을 씌워 눌러 두면 서로 다른 그림이 한 시리즈로 읽히고,
          색만 보고 "저건 원서 계열" 이 된다 — 카테고리 칩이 못 하던 일이다.

          구현: 이미지를 흑백으로 만든 뒤(`grayscale`) 계열 잉크색을 곱연산으로 덮는다.
          CSS 만으로 하므로 이미지를 내려받아 가공하지 않는다(원본 링크 그대로 = 라이선스 안전).
        */}
        {coverImage && (
          <div aria-hidden className="absolute inset-0">
            <img
              src={coverImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-90 [filter:grayscale(1)_contrast(1.15)]"
            />
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{ background: duotone.ink }}
            />
            <div
              className="absolute inset-0 mix-blend-screen opacity-[0.22]"
              style={{ background: duotone.paper }}
            />
            {/* 제목이 그림 위에서 읽히도록 아래쪽을 눌러 준다 */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.05) 42%, rgba(0,0,0,0.55) 100%)',
              }}
            />
          </div>
        )}

        {/* 클로스바운드 표지 — 중앙 serif 제목 + 단어수 + 이모지 장식 (그리드라 compact) */}
        <GradientBookCover
          title={set.title}
          subtitle={`${set.wordCount.toLocaleString()} 단어`}
          ornament={coverImage ? null : set.coverEmoji}
          compact
        />
        <div aria-hidden className="book-cover-sheen absolute inset-0" />
        <div aria-hidden className="book-cover-grain absolute inset-0" />
        <div aria-hidden className="book-spine3d" />
        <div aria-hidden className="book-foreedge" />

        {/* 좌상단: 구독 배지 (구독 시) / 신규 배지 (미구독 + 최근 14일 등록) */}
        {isSubscribed ? (
          <span
            aria-label="내 학습에 추가됨"
            title="내 학습에 추가됨"
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-white/95 px-2 py-0.5 font-display text-[10px] font-[700] text-[var(--p)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
          >
            <Check size={10} strokeWidth={3} aria-hidden /> 내 학습
          </span>
        ) : isNew ? (
          <span
            aria-label="신규 단어장"
            className="absolute left-3 top-3 inline-flex items-center rounded-[var(--r-full)] bg-ios-purple px-2 py-0.5 font-display text-[10px] font-[800] tracking-wide text-white shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
          >
            NEW
          </span>
        ) : null}

        {/* 우상단: CEFR 배지 */}
        {set.cefrLevel && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-[3px] bg-white/95 px-2 py-0.5 font-mono text-[10.5px] font-[700] tracking-tight text-[var(--t1)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]">
            {set.cefrLevel}
          </span>
        )}

        {/* 좌하단: 카테고리(중요도) 단서 + 사용빈도(구독수) — 어떤 단계/시험용인지 + 얼마나 쓰는지 */}
        {cat && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-black/40 px-2 py-0.5 font-display text-[10px] font-[700] text-white backdrop-blur-[2px]">
            <span aria-hidden>{cat.emoji}</span>
            {cat.label}
            {set.subscriberCount > 0 && (
              <span
                className="ml-1 inline-flex items-center gap-0.5 border-l border-white/30 pl-1 tabular-nums"
                title={`${set.subscriberCount}명 학습 중`}
              >
                <Users size={9} strokeWidth={2.5} aria-hidden />
                {set.subscriberCount}
              </span>
            )}
          </span>
        )}
      </button>

      {/* 빠른 추가/제외 액션 — hover/focus 시 reveal */}
      <button
        type="button"
        onClick={handleSubscribeClick}
        disabled={isPending}
        aria-label={
          isSubscribed
            ? `${set.title} 내 학습에서 제외`
            : `${set.title} 내 단어장에 추가`
        }
        title={
          isSubscribed
            ? '내 학습에서 제외 (학습한 단어는 보존)'
            : '내 단어장에 추가'
        }
        // 44px 하한 — 실측 32x32. 카드 위 오버레이라 시각적으로는 작아 보여야 하므로
        // **원(시각)은 그대로 두고 버튼 자체를 44px 로** 키운다(내부 아이콘 크기 불변).
        className={`absolute bottom-1.5 right-1.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-[var(--dur-normal)] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${
          isSubscribed
            ? 'bg-[var(--error-light)] text-[var(--error-ink)] ring-1 ring-[var(--error)] hover:scale-110 focus-visible:ring-[var(--error)]/40'
            : 'bg-white text-[var(--t1)] hover:scale-110 focus-visible:ring-white/60'
        }`}
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : isSubscribed ? (
          <Minus size={16} strokeWidth={2.5} aria-hidden />
        ) : (
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        )}
      </button>

      {/*
        표지 아래 한 줄 — **무엇으로 묶은 책인가**.

        표지에는 제목·단어수·단계 배지가 이미 있다. 없던 것은 "왜 이렇게 묶였나" 이고,
        그게 없으면 '테마별' 칸에 나란히 놓인 24권이 서로 구별되지 않는다
        (실측 2026-08-15: 발행 29세트 중 24개가 그 한 칸에 있다).
        제목을 반복하지 않는다 — 제목이 말하지 않는 것만 적는다.
      */}
      {set.kind && (
        <p className="mt-2 flex items-baseline gap-1.5 font-body text-[11px] leading-snug text-[var(--t3)]">
          <span className="shrink-0 rounded-[3px] bg-[var(--bg2)] px-1.5 py-px font-display text-[10px] font-[700] text-[var(--t2)]">
            {set.kind.label}
          </span>
          <span className="line-clamp-2">{set.kind.principle}</span>
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-2 font-body text-[11px] text-[var(--error-ink)]"
        >
          {errorMessage}
        </p>
      )}
    </article>
  )
}
