// apps/web/src/components/textviewer/MyLibraryCarousel.tsx
//
// v06.33 — /text 허브 OTT coverflow.
// 3 탭 (Books · Texts · Decks) — 각 탭 안에서 좌우 토글로 항목 선택.
// LibraryGrid / VocabSetCarousel 와 동일 iOS easing + premium cover.
//
// v08.4 — 탭이 **주소를 갖는다**(`/text?view=`). 이전에는 순수 useState 라 사이드바·북마크·
//   공유 어디서도 특정 면으로 들어올 수 없었고, 탭 이름도 여기서 한국어로 따로 짓고 있었다
//   (프로젝트 규칙: 메뉴·탭 이름은 레지스트리에서 import — 화면에서 짓지 않는다).
//   목록·라벨·강조색은 이제 `lib/library/tabs.ts` 의 `MY_LIBRARY_TABS` 가 소유한다.

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
// 탭 아이콘은 `MY_LIBRARY_TABS` 가 들고 온다 — 여기서 다시 고르지 않는다.
import { ChevronLeft, ChevronRight, FileText, Sparkles } from 'lucide-react'

import { bookCover, cefrToVLevel } from '@/lib/library/book-cover'
import {
  MY_LIBRARY_TABS,
  MY_LIBRARY_VIEW_PARAM,
  type MyLibraryView,
} from '@/lib/library/tabs'
import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { ArticleCover } from '@/components/library/shared/ArticleCover'
import { workspaceHref } from '@/lib/text-viewer/workspace-href'
import type { LibraryText } from '@/types/library'
import type { SubscribedSet } from '@/hooks/useSubscribedSets'
import {
  NetflixDetailSheet,
  type DetailVariant,
} from '@/components/library/shared/NetflixDetailSheet'

const IOS_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURATION = 600

type TabKey = MyLibraryView

interface Props {
  books: LibraryText[]      // texts with bookId (aggregated)
  scripts: LibraryText[]    // texts without bookId
  vocabSets: SubscribedSet[]
  /** 학습자 V레벨 — 도서 상세의 i+1 레벨 권장 (0 = 미진단) */
  userVLevel?: number
  /** `?view=` 로 지정된 면. null 이면 항목이 가장 많은 면으로 착지(기존 동작). */
  view?: MyLibraryView | null
}

/** progressPercent → 학습 상태 */
function deriveStatus(p: number): 'not_started' | 'in_progress' | 'completed' {
  if (p >= 100) return 'completed'
  if (p > 0) return 'in_progress'
  return 'not_started'
}

const VOCAB_COLOR: Record<string, { from: string; to: string; accent: string }> = {
  elementary: { from: '#34D399', to: '#059669', accent: '#059669' },
  middle: { from: '#22D3EE', to: '#0891B2', accent: '#0891B2' },
  high: { from: '#60A5FA', to: '#2563EB', accent: '#2563EB' },
  csat: { from: '#FBBF24', to: '#D97706', accent: '#D97706' },
  eng_test: { from: '#A5B4FC', to: '#6366F1', accent: '#6366F1' },
  civil: { from: '#94A3B8', to: '#475569', accent: '#475569' },
  business: { from: '#F472B6', to: '#DB2777', accent: '#DB2777' },
  themed: { from: '#818CF8', to: '#4F46E5', accent: '#4F46E5' },
}

// LibraryGrid 패턴 — 사이드 가독성 우선
function cardTransform(offset: number) {
  const abs = Math.abs(offset)
  if (abs > 3) {
    return {
      transform: `translate3d(${Math.sign(offset) * 660}px, 0, -700px) rotateY(${
        offset * -20
      }deg) scale(0.45)`,
      opacity: 0,
      zIndex: 0,
      pointer: 'none' as const,
    }
  }
  const sign = Math.sign(offset)
  const x = sign * (abs === 0 ? 0 : 200 + (abs - 1) * 160)
  const z = -abs * 60
  const rotY = -offset * 13
  const scale = 1 - abs * 0.07
  const opacity = abs === 0 ? 1 : abs === 1 ? 0.96 : abs === 2 ? 0.8 : 0.6
  return {
    transform: `translate3d(${x}px, 0, ${z}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    zIndex: 30 - abs,
    pointer: 'auto' as const,
  }
}

export function MyLibraryCarousel({
  books,
  scripts,
  vocabSets,
  userVLevel = 0,
  view = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // 첫 진입 탭 — 주소가 말하면 그것, 아니면 가장 많은 항목 기준.
  const initial: TabKey =
    view ?? (books.length > 0 ? 'books' : scripts.length > 0 ? 'scripts' : 'vocab')
  const [tab, setTab] = useState<TabKey>(initial)

  // 주소가 바뀌면 따라간다 — 사이드바에서 **같은 화면의 다른 면**을 누르면 경로가 그대로라
  // 리마운트가 없다. 이 동기화가 없으면 URL 만 바뀌고 화면은 그대로 있는다.
  useEffect(() => {
    if (view && view !== tab) setTab(view)
    // tab 을 의존성에 넣으면 사용자가 탭을 눌러 바꾼 직후 주소가 되돌려 놓는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  /** 탭 전환은 주소도 함께 옮긴다 — 뒤로가기·북마크·공유가 성립하도록. */
  const selectTab = useCallback(
    (key: TabKey) => {
      setTab(key)
      // `replace` — 탭 전환마다 히스토리가 쌓이면 뒤로가기가 탭 순회가 된다.
      // `scroll: false` — 캐러셀이 화면 중간에 있어 위로 튀면 방금 고른 것을 놓친다.
      router.replace(`${pathname}?${MY_LIBRARY_VIEW_PARAM}=${key}`, { scroll: false })
    },
    [router, pathname],
  )
  const [activeMap, setActiveMap] = useState<Record<TabKey, number>>({
    books: 0,
    scripts: 0,
    vocab: 0,
  })
  const [detail, setDetail] = useState<DetailVariant | null>(null)
  const touchStartX = useRef<number | null>(null)

  function openDetail(item: LibraryText | SubscribedSet, type: TabKey) {
    if (type === 'books') {
      const t = item as LibraryText
      setDetail({
        type: 'book',
        id: t.id,
        title: t.title,
        author: t.author,
        cefrLevel: t.cefrLevel,
        bookVLevel: t.bookVLevel ?? null,
        wordCount: t.wordCount,
        chapterCount: t.chapterCount,
        progressPercent: t.progressPercent,
        coverFrom: t.coverGradient.from,
        coverTo: t.coverGradient.to,
        coverImageUrl: t.coverImageUrl ?? null,
        // 개인화 — 진도·상태·레벨 권장
        lexicalCoverage: t.lexicalCoverage ?? null,
        isPictureBook: t.isPictureBook ?? false,
        userVLevel,
        mine: {
          status: deriveStatus(t.progressPercent),
          progressPercent: t.progressPercent,
          completedUnits: t.completedChapters ?? null,
          totalUnits: t.chapterCount ?? null,
          unitLabel: '챕터',
        },
        ctaHref: workspaceHref(t),
        ctaLabel: t.progressPercent > 0 ? '이어 학습' : '학습 시작',
      })
    } else if (type === 'scripts') {
      const t = item as LibraryText
      setDetail({
        type: 'script',
        id: t.id,
        title: t.title,
        author: t.author,
        category: t.category,
        cefrLevel: t.cefrLevel,
        wordCount: t.wordCount,
        progressPercent: t.progressPercent,
        preview: t.preview,
        coverFrom: t.coverGradient.from,
        coverTo: t.coverGradient.to,
        mine: {
          status: deriveStatus(t.progressPercent),
          progressPercent: t.progressPercent,
          completedUnits: t.currentPage,
          totalUnits: t.totalPages,
          unitLabel: '페이지',
        },
        ctaHref: workspaceHref(t),
        ctaLabel: t.progressPercent > 0 ? '이어 학습' : '학습 시작',
      })
    } else {
      const v = item as SubscribedSet
      const accent = VOCAB_COLOR[v.category] ?? VOCAB_COLOR.themed!
      setDetail({
        type: 'vocab',
        id: v.id,
        title: v.title,
        description: v.description,
        category: v.category,
        categoryLabel: v.category,
        categoryColor: accent,
        cefrLevel: v.cefrLevel,
        wordCount: v.wordCount,
        coverEmoji: v.coverEmoji,
        // 구독 = 활성 학습 풀에 포함 (진도 세부는 Phase 2 — Memory Decay 집계)
        mine: { status: 'in_progress' },
        ctaLabel: '단어장 열기',
        secondaryHref: `/wordvault?set=${v.id}`,
        secondaryLabel: '단어장 보기',
        onCtaClick: () => setDetail(null),
      })
    }
  }

  const items: Array<LibraryText | SubscribedSet> =
    tab === 'books' ? books : tab === 'scripts' ? scripts : vocabSets
  const active = activeMap[tab]
  const last = items.length - 1

  const setActive = useCallback(
    (i: number) => setActiveMap((m) => ({ ...m, [tab]: i })),
    [tab],
  )
  const prev = useCallback(
    () => setActiveMap((m) => ({ ...m, [tab]: Math.max(0, m[tab] - 1) })),
    [tab],
  )
  const next = useCallback(
    () => setActiveMap((m) => ({ ...m, [tab]: Math.min(items.length - 1, m[tab] + 1) })),
    [tab, items.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    if (Math.abs(delta) > 50) (delta > 0 ? prev : next)()
    touchStartX.current = null
  }

  // 라벨·아이콘·강조색은 레지스트리에서. 개수만 이 화면이 안다.
  const countOf: Record<TabKey, number> = {
    books: books.length,
    scripts: scripts.length,
    vocab: vocabSets.length,
  }
  const tabs = MY_LIBRARY_TABS.map((t) => ({
    key: t.view,
    label: t.label,
    says: t.says,
    icon: t.icon,
    count: countOf[t.view],
    accent: t.accent,
  }))
  const currentTabAccent = tabs.find((t) => t.key === tab)!.accent

  if (items.length === 0 && tabs.every((t) => t.count === 0)) return null

  return (
    <section className="flex flex-col items-center gap-5">
      {/* 3 탭 */}
      {/* aria-label 이 '라이브러리 탭' 이었다 — `LibraryTabs`(공용 서가)와 **같은 이름**이라
          스크린리더 사용자에게는 두 화면의 다른 탭줄이 같은 것으로 불렸다. */}
      <div role="tablist" aria-label="내 라이브러리 탭" className="flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] p-1">
        {tabs.map((t) => {
          const isActive = t.key === tab
          const Icon = t.icon
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              aria-label={`${t.label} — ${t.says}`}
              onClick={() => selectTab(t.key)}
              disabled={t.count === 0}
              className={`inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-3.5 py-1.5 font-display text-[13px] font-[700] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive
                  ? 'text-white shadow-[var(--sh-sm)]'
                  : 'text-[var(--t2)] hover:bg-[var(--bg)]'
              }`}
              style={isActive ? { backgroundColor: t.accent } : undefined}
            >
              <Icon size={13} aria-hidden />
              {t.label}
              <span
                className={`rounded-[var(--r-full)] px-1.5 text-[10px] tabular-nums ${
                  isActive ? 'bg-white/25' : 'bg-[var(--bg3)] text-[var(--t2)]'
                }`}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Coverflow stage */}
      {items.length > 0 ? (
        <>
          <div className="relative w-full overflow-hidden">
            <div
              className="relative mx-auto flex h-[460px] w-full max-w-[1280px] items-center justify-center"
              style={{ perspective: '1800px', perspectiveOrigin: '50% 55%' }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {items.map((item, idx) => {
                const offset = idx - active
                const tf = cardTransform(offset)
                const isCenter = idx === active
                return (
                  <div
                    key={getKey(item)}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      transform: `translate(-50%, -50%) ${tf.transform}`,
                      opacity: tf.opacity,
                      zIndex: tf.zIndex,
                      pointerEvents: tf.pointer,
                      transition: `transform ${DURATION}ms ${IOS_EASING}, opacity ${DURATION}ms ${IOS_EASING}`,
                      transformStyle: 'preserve-3d',
                      willChange: 'transform, opacity',
                    }}
                  >
                    {tab === 'books' ? (
                      <BookCard
                        item={item as LibraryText}
                        isCenter={isCenter}
                        onClick={() =>
                          isCenter ? openDetail(item, 'books') : setActive(idx)
                        }
                      />
                    ) : tab === 'scripts' ? (
                      <ScriptCard
                        item={item as LibraryText}
                        isCenter={isCenter}
                        onClick={() =>
                          isCenter ? openDetail(item, 'scripts') : setActive(idx)
                        }
                      />
                    ) : (
                      <VocabCard
                        item={item as SubscribedSet}
                        isCenter={isCenter}
                        onClick={() =>
                          isCenter ? openDetail(item, 'vocab') : setActive(idx)
                        }
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={prev}
              disabled={active === 0}
              aria-label="이전"
              className="absolute left-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)]/80 text-[var(--t1)] shadow-[var(--sh-md)] backdrop-blur-md transition-all hover:scale-110 hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-30 md:left-6"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={active === last}
              aria-label="다음"
              className="absolute right-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)]/80 text-[var(--t1)] shadow-[var(--sh-md)] backdrop-blur-md transition-all hover:scale-110 hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-30 md:right-6"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>

          {/* Hero info */}
          {items[active] && (
            <HeroInfo
              tab={tab}
              item={items[active]!}
              accent={currentTabAccent}
            />
          )}

          {items.length > 1 && (
            <div role="tablist" aria-label="항목 선택" className="flex items-center gap-2">
              {items.map((s, idx) => (
                <button
                  key={getKey(s)}
                  type="button"
                  role="tab"
                  aria-selected={idx === active}
                  aria-label={`${idx + 1} / ${items.length}`}
                  onClick={() => setActive(idx)}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: idx === active ? '24px' : '6px',
                    backgroundColor: idx === active ? currentTabAccent : 'var(--t4)',
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-8 py-12 text-center">
          <p className="font-body text-[13px] text-[var(--t2)]">
            {tab === 'books'
              ? '아직 라이브러리에 도서가 없어요'
              : tab === 'scripts'
                ? '아직 직접 추가한 스크립트가 없어요'
                : '아직 구독한 단어장이 없어요'}
          </p>
        </div>
      )}

      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </section>
  )
}

function getKey(item: LibraryText | SubscribedSet): string {
  return 'bookId' in item ? item.id : item.id
}

// ─── Book Card ───────────────────────────────────────────
function BookCard({
  item,
  isCenter,
  onClick,
}: {
  item: LibraryText
  isCenter: boolean
  onClick: () => void
}) {
  const cover = bookCover({
    title: item.title,
    bookVLevel: null,
    coverFrom: item.coverGradient.from,
    coverTo: item.coverGradient.to,
  })
  return (
    <CardWrap
      onClick={onClick}
      ariaLabel={item.title}
    >
      <CoverShell
        from={cover.from}
        to={cover.to}
        isCenter={isCenter}
        imageUrl={item.coverImageUrl ?? null}
        imageAlt={`${item.title} 표지`}
        coverSlot={
          /* 그라디언트 표지 — 클로스바운드 클래식 풍 (실 표지엔 제목 박혀있어 미표시) */
          !item.coverImageUrl ? <GradientBookCover title={item.title} author={item.author} /> : null
        }
      >
        {/* 진행 배지 우상단 */}
        {item.progressPercent > 0 && (
          <span
            aria-hidden
            className="absolute right-3.5 top-3.5 inline-flex items-center rounded-[3px] bg-white/95 px-2 py-0.5 font-mono text-[10.5px] font-[700] text-[var(--t1)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
          >
            {item.progressPercent}%
          </span>
        )}
        {/* CEFR 좌상단 */}
        <span
          aria-hidden
          className="absolute left-3.5 top-3.5 inline-flex items-center rounded-[3px] bg-black/55 px-2 py-0.5 font-mono text-[10.5px] font-[700] text-white backdrop-blur-sm"
        >
          {item.cefrLevel}
        </span>
      </CoverShell>
    </CardWrap>
  )
}

// ─── Script Card ─────────────────────────────────────────
function ScriptCard({
  item,
  isCenter,
  onClick,
}: {
  item: LibraryText
  isCenter: boolean
  onClick: () => void
}) {
  // ⚠️ `coverGradient` 를 반드시 넘긴다. `lib/articles/start-learning.ts` 가 기사를 책과
  //   **시각적으로 구분하려고** 일부러 시안(#38BDF8→#0E7490)을 심는데, 여기서 null 을 넘기면
  //   제목 해시 팔레트로 떨어진다 — 그 팔레트는 도서와 **완전히 같은 8색**이라 구분이 사라진다.
  //   바로 위 `BookCard` 는 제대로 넘기고 있었다.
  return (
    <CardWrap onClick={onClick} ariaLabel={item.title}>
      {/* 기사는 **책 표지도 책 셸도 쓰지 않는다** — 가로 4:3 평면 + 신문 네임플레이트.
          학습자가 카드만 보고 기사인지 책인지 구분할 수 있어야 한다. */}
      <ArticleShell
        isCenter={isCenter}
        coverSlot={
          <ArticleCover
            title={item.title}
            source={item.articleSource}
            level={item.cefrLevel}
          />
        }
      >
        {item.progressPercent > 0 && (
          <span
            aria-hidden
            className="absolute bottom-3 right-4 inline-flex items-center font-editorial text-[10.5px] font-[600] tabular-nums text-white/75"
          >
            {item.progressPercent}%
          </span>
        )}
      </ArticleShell>
    </CardWrap>
  )
}

// ─── Vocab Card ──────────────────────────────────────────
function VocabCard({
  item,
  isCenter,
  onClick,
}: {
  item: SubscribedSet
  isCenter: boolean
  onClick: () => void
}) {
  const cover = bookCover({
    title: item.title,
    bookVLevel: cefrToVLevel(item.cefrLevel),
    coverFrom: null,
    coverTo: null,
  })
  return (
    <CardWrap
      onClick={onClick}
      ariaLabel={item.title}
    >
      <CoverShell
        from={cover.from}
        to={cover.to}
        isCenter={isCenter}
        coverSlot={
          <GradientBookCover
            title={item.title}
            subtitle={`${item.wordCount.toLocaleString()} 단어`}
            ornament={item.coverEmoji}
          />
        }
      >
        <span
          aria-hidden
          className="absolute right-3.5 top-3.5 inline-flex items-center justify-center rounded-full bg-white/95 p-1 text-[var(--success)] shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
        >
          <Sparkles size={11} strokeWidth={2.5} />
        </span>
      </CoverShell>
    </CardWrap>
  )
}

// ─── Shared Cover Shell ──────────────────────────────────
function CoverShell({
  from,
  to,
  isCenter,
  children,
  coverSlot,
  imageUrl,
  imageAlt,
}: {
  from: string
  to: string
  isCenter: boolean
  children: React.ReactNode
  /** 책 표지면 — spine/fore-edge 입체 엣지 *아래*에 깔림 (커버 위로 페이지/책등이 덮음) */
  coverSlot?: React.ReactNode
  /** 원천 표지 이미지 — 있으면 그라디언트 대신 실 표지 (portrait object-cover) */
  imageUrl?: string | null
  imageAlt?: string
}) {
  return (
    <div
      className={`book-cover-premium relative aspect-[3/4] w-[270px] overflow-hidden ${
        isCenter ? 'book-cover-premium--center' : ''
      }`}
      style={{
        background: imageUrl
          ? '#0B0B0F'
          : `
          radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
          linear-gradient(155deg, ${from} 0%, ${to} 78%, rgba(0,0,0,0.18) 100%)
        `,
      }}
    >
      {imageUrl ? (
        <>
          <Image src={imageUrl} alt={imageAlt ?? ''} fill sizes="270px" className="object-cover" />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35"
          />
          {/* 라미네이트 광택 — 양장본 코팅 specular */}
          <div aria-hidden className="book-cover-laminate absolute inset-0" />
        </>
      ) : (
        <>
          {/* 표지면 (그라디언트 위 클로스바운드 제목) — 입체 엣지 아래 */}
          {coverSlot}
          <div aria-hidden className="book-cover-sheen absolute inset-0" />
          <div aria-hidden className="book-cover-grain absolute inset-0" />
        </>
      )}

      {/* 실제 책 입체 — 입체 책등(좌) + 페이지 단면(우). 모든 표지 공통 (커버 위 overlay) */}
      <div aria-hidden className="book-spine3d" />
      <div aria-hidden className="book-foreedge" />
      {children}
    </div>
  )
}

/**
 * 기사 전용 셸 — **가로 4:3 · 평면**.
 *
 * `CoverShell` 을 쓰면 안 되는 이유: 그건 3D 책 오브젝트다(`book-cover-premium` 의
 * `border-radius: 2px 7px 7px 2px` = 책등 날카롭고 페이지 단면 둥근 모서리 · 갈색 캐스트
 * 섀도 · `book-spine3d` · `book-foreedge` · 바닥 반사). 기사에 그걸 씌우면 신문이 양장본이 된다.
 *
 * 편집 레퍼런스 실측(Economist·New Yorker·Monocle): 기사 카드에 **`border-radius`·
 * `box-shadow`·입체 프레임이 전부 0**이고, 구분은 1px 괘선이나 여백이 맡는다.
 * 다만 이 캐러셀은 Coverflow 라 카드가 공중에 떠 있어야 해서, 최소한의 평면 그림자만 남긴다.
 *
 * 탭이 갈려 있어(Books · Texts · Decks) 기사 탭만 다른 비율을 가져도 레이아웃이 어긋나지 않는다.
 */
function ArticleShell({
  isCenter,
  children,
  coverSlot,
}: {
  isCenter: boolean
  children?: React.ReactNode
  coverSlot: React.ReactNode
}) {
  return (
    <div
      className={`relative aspect-[4/3] w-[344px] overflow-hidden rounded-[3px] transition-shadow duration-[var(--dur-slow)] ${
        isCenter
          ? 'shadow-[0_2px_4px_rgba(12,14,20,0.14),0_18px_38px_-12px_rgba(12,14,20,0.34)]'
          : 'shadow-[0_1px_2px_rgba(12,14,20,0.10),0_8px_18px_-8px_rgba(12,14,20,0.22)]'
      }`}
    >
      {coverSlot}
      {children}
    </div>
  )
}

function CardWrap({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block rounded-[10px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-4"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

// ─── Hero info (중앙 항목 메타 + CTA) ─────────────────────
function HeroInfo({
  tab,
  item,
  accent,
}: {
  tab: TabKey
  item: LibraryText | SubscribedSet
  accent: string
}) {
  let title = ''
  let subtitle = ''
  let href = '#'
  let cta = '진입'

  if (tab === 'books' || tab === 'scripts') {
    const t = item as LibraryText
    title = t.title
    const parts: string[] = []
    if (t.author && t.author !== '저자 미상') parts.push(t.author)
    parts.push(t.cefrLevel)
    if (t.progressPercent > 0) parts.push(`진행 ${t.progressPercent}%`)
    if (t.wordCount > 0) parts.push(`${t.wordCount.toLocaleString()}단어`)
    subtitle = parts.join(' · ')
    href = workspaceHref(t)
    cta = t.progressPercent > 0 ? '이어 학습' : '학습 시작'
  } else {
    const v = item as SubscribedSet
    title = v.title
    subtitle = `${v.wordCount.toLocaleString()} 단어${v.description ? ' · ' + v.description : ''}`
    href = `/wordvault?set=${v.id}`
    cta = '단어장 열기'
  }

  return (
    <div
      key={`${tab}-${'id' in item ? item.id : ''}`}
      className="flex max-w-xl flex-col items-center gap-2 px-4 text-center"
      style={{ animation: `fadeInUp 0.5s ${IOS_EASING}` }}
    >
      <h2 className="line-clamp-2 font-display text-[22px] font-[800] leading-tight tracking-[-0.01em] text-[var(--t1)] md:text-[26px]">
        {title}
      </h2>
      <p className="font-body text-[13px] text-[var(--t2)]">{subtitle}</p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-5 py-2.5 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97]"
        style={{ backgroundColor: accent }}
      >
        {cta}
      </Link>
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
