// apps/web/src/components/library/vocab/VocabSetCard.tsx
//
// 클로스바운드 클래식 책 표지 타일 — /library/books 와 동일한 "책 한 권" 메타포.
// - aspect-[3/4] 책 표지 (그라디언트 + 중앙 serif 제목 + 이모지 장식 + 단어수)
// - 우상단 사다리 배지(계단·학령 — 계단을 못 정한 권만 CEFR) · 좌상단 구독 배지
// - hover/focus 시 + 추가/제외 액션 reveal
// - 그리드라 반사(-webkit-box-reflect)는 끔 (행 간 겹침 방지)

'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Minus, Plus, Users } from 'lucide-react'

import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { VocabCoverPlate } from './VocabCoverPlate'
import { bookCover, cefrToVLevel } from '@/lib/library/book-cover'
import { rungForSet } from '@/lib/library/vocab/rung'
import { VOCAB_SERIES_BRAND } from '@vocaflow/library-pipeline/vocab-brand'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { vocabCategoryMeta } from './categories'

interface VocabSetCardProps {
  set: PublishedVocabSet
  isSubscribed: boolean
  isPending: boolean
  errorMessage: string | null
  onToggle: (set: PublishedVocabSet) => void
  onPreview: (set: PublishedVocabSet) => void
  /**
   * "무엇으로 묶었나" 줄을 감춘다 — **추천 행 전용**.
   *
   * 추천 행은 카드 아래에 이미 "왜 추천인가"(티어 배지 + 사유)를 붙인다. 카드가 자기
   * 묶음 원리까지 그리면 한 카드에 설명 블록이 둘이 되고, `set.kind` 가 있는 카드만
   * 그러니 **행의 기준선이 카드마다 갈린다**(실측 2026-08-16: 5장 중 2장만 두 줄).
   * 같은 자리에서 두 가지 이유를 대는 것이라 읽는 부담도 는다.
   */
  hideKind?: boolean
}

export function VocabSetCard({
  set,
  isSubscribed,
  isPending,
  errorMessage,
  onToggle,
  onPreview,
  hideKind = false,
}: VocabSetCardProps) {
  const cover = bookCover({
    title: set.title,
    bookVLevel: cefrToVLevel(set.cefrLevel),
    coverFrom: null,
    coverTo: null,
  })
  const cat = vocabCategoryMeta(set.category)

  // 표지 도판 + 계열. 도판이 없으면 종전 그라디언트 표지가 그대로 남는다(공백 아님).
  const coverImage = set.coverImageUrl
  const family = set.coverImageMeta?.family

  // 사다리에서의 자리. 컴포저가 정한 값이 DB 에 있으면 그것을 쓰는 것이 맞지만, 카드는
  // 아직 그 컬럼을 받지 않는다 — 여기서는 카테고리·CEFR 로 **추정**한다(`rungForSet`).
  // 근거가 없으면 null 이고, 그때는 종전대로 CEFR 을 보인다.
  const { rung } = rungForSet(set)

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
        className="book-cover-premium focus-visible:ring-[var(--p)]/40 relative aspect-[3/4] w-full overflow-hidden transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          // 그리드 카드 — 반사 비활성 (행 간 겹침 방지)
          WebkitBoxReflect: 'none',
          background: `
            radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
            linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)
          `,
        }}
      >
        {/* 표지 도판 — 캐러셀과 **같은 컴포넌트**를 쓴다(왜 듀오톤인지는 그쪽 머리 주석). */}
        <VocabCoverPlate url={coverImage} family={family} scrim="card" />

        {/* 클로스바운드 표지 — 중앙 serif 제목 + 단어수 + 이모지 장식 (그리드라 compact) */}
        <GradientBookCover
          title={set.title}
          subtitle={`${set.wordCount.toLocaleString()} 단어`}
          ornament={coverImage ? null : set.coverEmoji}
          // 시리즈 줄 — 계단이 있으면 그 권 이름(`Vocaflow 3`), 학령 밖이면 시리즈명만.
          //   값을 여기서 짓지 않는다: 정본 사다리에서 읽는다.
          series={rung?.volumeTitle ?? VOCAB_SERIES_BRAND}
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
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--chip-cover-bg)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--chip-cover-brand)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
          >
            <Check size={10} strokeWidth={3} aria-hidden /> 내 학습
          </span>
        ) : isNew ? (
          <span
            aria-label="신규 단어장"
            className="absolute left-3 top-3 inline-flex items-center rounded-[var(--r-full)] bg-[var(--ios-purple-tint)] px-2 py-1 font-display text-[10px] font-[800] tracking-wide text-[var(--ios-purple-ink)] shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
          >
            NEW
          </span>
        ) : null}

        {/*
          우상단: **사다리에서의 자리**.

          여기 있던 것은 CEFR(A1·B2·C2)이었다. 그런데 시중 단어장은 표지에 CEFR 을 적지 않고
          **자기 사다리**를 적는다(능률VOCA: 중학 → 고등 기본 → 수능 필수). 남의 눈금을 쓰면
          그 눈금의 브랜드가 되기 때문이고, 한국 고등학생에게 'B2' 는 자기 학년을 말해 주지도
          않는다. 그래서 계단을 앞에 세우고 CEFR 은 툴팁으로 내린다 — 버리지는 않는다.

          계단을 못 정한 권(학령 밖 성인 수준 등)은 종전대로 CEFR 을 보인다.
          **빈칸으로 두지 않는다** — 자리가 비면 표지가 미완성으로 읽힌다.
        */}
        {(rung || set.cefrLevel) && (
          <span
            title={
              rung
                ? `${rung.schoolBand}${set.cefrLevel ? ` · CEFR ${set.cefrLevel}` : ''}`
                : `CEFR ${set.cefrLevel}`
            }
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-[3px] bg-[var(--chip-cover-bg)] px-2 py-1 font-mono text-[10.5px] font-[700] tracking-tight text-[var(--chip-cover-ink)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]">
            {rung ? (
              <>
                <span className="tabular-nums">{rung.step}단</span>
                <span className="font-body font-[600] opacity-80">{rung.schoolBand}</span>
              </>
            ) : (
              set.cefrLevel
            )}
          </span>
        )}

        {/* 좌하단: 카테고리(중요도) 단서 + 사용빈도(구독수) — 어떤 단계/시험용인지 + 얼마나 쓰는지 */}
        {cat && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-[var(--r-full)] bg-black/55 px-2 py-1 font-display text-[10px] font-[700] text-white backdrop-blur-[2px]">
            <span aria-hidden>{cat.emoji}</span>
            {cat.label}
            {set.subscriberCount > 0 && (
              <span
                className="ml-1 inline-flex items-center gap-1 border-l border-white/30 pl-1 tabular-nums"
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
          isSubscribed ? `${set.title} 내 학습에서 제외` : `${set.title} 내 단어장에 추가`
        }
        title={isSubscribed ? '내 학습에서 제외 (학습한 단어는 보존)' : '내 단어장에 추가'}
        // 44px 하한 — 실측 32x32. 카드 위 오버레이라 시각적으로는 작아 보여야 하므로
        // **원(시각)은 그대로 두고 버튼 자체를 44px 로** 키운다(내부 아이콘 크기 불변).
        className={`absolute bottom-1.5 right-1.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-[var(--dur-normal)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 group-focus-within:opacity-100 group-hover:opacity-100 ${
          isSubscribed
            ? 'focus-visible:ring-[var(--error)]/40 bg-[var(--error-light)] text-[var(--error-ink)] ring-1 ring-[var(--error)] hover:scale-110'
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
      {set.kind && !hideKind && (
        <p className="mt-2 flex items-baseline gap-2 font-body text-[11px] leading-snug text-[var(--t3)]">
          <span className="shrink-0 rounded-[3px] bg-[var(--bg2)] px-2 py-px font-display text-[10px] font-[700] text-[var(--t2)]">
            {set.kind.label}
          </span>
          <span className="line-clamp-2">{set.kind.principle}</span>
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="mt-2 font-body text-[11px] text-[var(--error-ink)]">
          {errorMessage}
        </p>
      )}
    </article>
  )
}
