// apps/web/src/components/library/LibraryGrid.tsx
//
// v06.32 도서관 v4 — OTT 스타일 3D Coverflow Carousel.
// - 중앙 책 prominent (정면, scale 1, focus)
// - 좌우 책 perspective 3D 회전 + scale + opacity 감쇠
// - iOS native easing (cubic-bezier(0.22, 1, 0.36, 1))
// - 화살표 버튼 + 키보드 ←/→ + 터치 swipe
// - 사이드 책 클릭 시 그 책으로 이동
// - 중앙 책 클릭 시 도서 진입

'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

import { bookCover } from '@/lib/library/book-cover'
import { coverFitFor } from '@/lib/library/cover-fit'
import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import { unenrollBook } from '@/lib/library/enroll'
import { createClient } from '@/lib/supabase/client'
import { NetflixDetailSheet, type DetailVariant } from '@/components/library/shared/NetflixDetailSheet'
import { toBookDetailVariant } from '@/lib/library/book-detail-variant'
import type { EnrollmentState, PublishedBook } from '@/lib/library/published-book'

// 타입 단일 출처 = lib/library/published-book. 기존 import 경로 호환 위해 re-export.
export type { EnrollmentState, PublishedBook }

interface LibraryGridProps {
  books: PublishedBook[]
  /** 학습자 현재 V레벨 — i+1 적합도 배지 판정 (0 = 미진단 → 배지 미표시) */
  userVLevel?: number
}

// iOS native easing — Apple HIG interactive curves.
const IOS_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CAROUSEL_DURATION = 620 // ms

// 거리별 책 변형 — OTT Coverflow 3D + 사이드 가독성 우선.
function cardTransform(offset: number) {
  const abs = Math.abs(offset)
  if (abs > 3) {
    return {
      transform: `translate3d(${Math.sign(offset) * 660}px, 0, -700px) rotateY(${
        offset * -20
      }deg) scale(0.45)`,
      opacity: 0,
      zIndex: 0,
      pointerEvents: 'none' as const,
    }
  }
  const sign = Math.sign(offset)
  // ±1: 200px, ±2: 360px, ±3: 510px
  const x = sign * (abs === 0 ? 0 : 200 + (abs - 1) * 160)
  const z = -abs * 60
  // 회전 최소화 — 사이드 표지 텍스트 정면감 유지
  const rotY = -offset * 13
  // scale 덜 감소 — 사이드도 충분히 큼
  const scale = 1 - abs * 0.07
  // 사이드 opacity 강화 — 색·텍스트 진하게
  const opacity = abs === 0 ? 1 : abs === 1 ? 0.96 : abs === 2 ? 0.8 : 0.6
  return {
    transform: `translate3d(${x}px, 0, ${z}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    zIndex: 30 - abs,
    pointerEvents: 'auto' as const,
  }
}

export function LibraryGrid({ books, userVLevel = 0 }: LibraryGridProps) {
  const router = useRouter()
  const [active, setActive] = useState(0)
  const [detail, setDetail] = useState<DetailVariant | null>(null)
  const [unenrollPending, startUnenrollTransition] = useTransition()
  const touchStartX = useRef<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  function handleUnenroll(book: PublishedBook) {
    if (
      !window.confirm(
        `"${book.title}" 을(를) 내 학습에서 제외할까요?\n` +
          '· 챕터 진도와 챕터 단어장 구독이 해제됩니다.\n' +
          '· 사용자가 직접 추가/수정한 단어는 보존됩니다.\n' +
          '· 언제든 다시 추가할 수 있어요.',
      )
    ) {
      return
    }
    startUnenrollTransition(async () => {
      try {
        const client = createClient()
        await unenrollBook(client, book.id)
        setDetail(null)
        router.refresh()
      } catch (e) {
        window.alert(`제외 실패: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    })
  }

  function openDetail(book: PublishedBook) {
    setDetail(
      toBookDetailVariant(book, userVLevel, {
        onUnenroll: () => handleUnenroll(book),
        unenrollPending,
      }),
    )
  }

  const last = books.length - 1
  const prev = useCallback(() => {
    setActive((i) => Math.max(0, i - 1))
  }, [])
  const next = useCallback(
    () => {
      setActive((i) => Math.min(last, i + 1))
    },
    [last],
  )
  const goTo = useCallback(
    (idx: number) => {
      setActive(Math.max(0, Math.min(last, idx)))
    },
    [last],
  )

  // 키보드 네비
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

  // 터치 swipe (50px 임계값)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current
    if (Math.abs(delta) > 50) {
      if (delta > 0) prev()
      else next()
    }
    touchStartX.current = null
  }

  if (books.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-20 text-center"
      >
        <div className="select-none text-4xl" aria-hidden>
          📚
        </div>
        <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
          아직 게시된 도서가 없어요
        </h3>
      </div>
    )
  }

  const activeBook = books[active]!

  return (
    // role="list" 였으나 자식이 listitem 이 아니라 무대·탭리스트·버튼이라
    // aria-required-children(critical) 위반이었다(2026-08-09 axe). 목록이 아니므로 role 제거.
    <div className="flex flex-col items-center gap-6">
      {/* Stage — 3D perspective + 좌우 화살표 */}
      <div className="relative w-full">
        {/* Soft floor gradient (책 아래 ambient) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black/10"
        />

        <div
          ref={stageRef}
          // role="list" 는 listitem 의 **직접 부모**여야 한다. 예전엔 바깥 래퍼에 붙어 있어
          // 사이에 무대·탭리스트가 끼면서 aria-required-children/parent 가 동시에 깨졌다(2026-08-09 axe).
          role="list"
          // overflow-clip: 3D 무대의 옆 카드들은 absolute + transform 이라 컨테이너를
          //   벗어난다. 클립이 없으면 **문서가 통째로 옆으로 밀린다** — 390px 모바일에서
          //   scrollWidth 773px(넘침 383px) 실측(2026-08-13 a11y 스윕).
          //
          //   ⚠️ x축만 클립하던 동안 **세로로는 계속 새어 나왔다.** 옆 카드(opacity 0.6~0.96)가
          //   무대 아래 격자 위에 겹쳐 **유령 카드**로 보였다(실측 2026-08-15 화면 캡처).
          //   서가가 어수선해 보이던 주범이다. 두 축 모두 클립하되, 세로 그림자가 잘리지
          //   않도록 `overflow-clip-margin` 으로 여유를 준다 — 스크롤 컨테이너는 만들지 않는다.
          //   (clip-margin 은 주지 않는다 — 24px 를 줬더니 모바일에서 가로 넘침 8px 이 다시 생겼다.)
          className="relative mx-auto flex h-[460px] w-full max-w-[1280px] items-center justify-center overflow-clip"
          style={{ perspective: '1800px', perspectiveOrigin: '50% 55%' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {books.map((book, idx) => {
            const offset = idx - active
            const transform = cardTransform(offset)
            const isActive = idx === active
            return (
              <div
                key={book.id}
                role="listitem"
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, -50%) ${transform.transform}`,
                  opacity: transform.opacity,
                  zIndex: transform.zIndex,
                  pointerEvents: transform.pointerEvents,
                  transition: `transform ${CAROUSEL_DURATION}ms ${IOS_EASING}, opacity ${CAROUSEL_DURATION}ms ${IOS_EASING}`,
                  transformStyle: 'preserve-3d',
                  willChange: 'transform, opacity',
                }}
              >
                <CarouselBook
                  book={book}
                  isActive={isActive}
                  onSideClick={() => goTo(idx)}
                  onCenterClick={() => openDetail(book)}
                />
              </div>
            )
          })}
        </div>

        {/* 좌우 화살표 — 큰 circular */}
        <button
          type="button"
          onClick={prev}
          disabled={active === 0}
          aria-label="이전 도서"
          className="absolute left-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)]/80 text-[var(--t1)] shadow-[var(--sh-md)] backdrop-blur-md transition-all hover:scale-110 hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:left-6"
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={next}
          disabled={active === last}
          aria-label="다음 도서"
          className="absolute right-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)]/80 text-[var(--t1)] shadow-[var(--sh-md)] backdrop-blur-md transition-all hover:scale-110 hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:right-6"
        >
          <ChevronRight size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* 활성 책 메타 (Hero info under carousel) */}
      <div
        key={activeBook.id} // 책 바뀔 때 fade
        className="flex max-w-xl flex-col items-center gap-2 px-4 text-center"
        style={{ animation: `fadeInUp 0.5s ${IOS_EASING}` }}
      >
        <h2 className="font-english text-[22px] font-[700] leading-tight text-[var(--t1)] md:text-[26px]">
          {activeBook.title}
        </h2>
        {activeBook.author && (
          <p className="font-body text-[13px] text-[var(--t2)]">{activeBook.author}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-[var(--t2)]">
          {(activeBook.cefr_band ?? activeBook.cefr_level) && (
            <span className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]">
              {activeBook.cefr_band ?? activeBook.cefr_level}
            </span>
          )}
          {activeBook.book_v_level != null && (
            // 하드코딩 앰버(#92400E on #FBBF24/15)는 다크에서 1.87:1 이었다(2026-08-09 axe).
            // 면=tint 토큰 · 글자=ink 토큰으로 분리하면 양 테마 모두 AA.
            <span
              className="rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[700]"
              style={{ background: 'var(--ios-yellow-tint)', color: 'var(--ios-yellow-ink)' }}
            >
              V{activeBook.book_v_level}
            </span>
          )}
          {activeBook.chapter_count != null && <span>{activeBook.chapter_count}장</span>}
          {activeBook.reading_minutes != null && activeBook.reading_minutes > 0 && (
            <span>·  {Math.round(activeBook.reading_minutes / 60)}h</span>
          )}
          {activeBook.word_set_count != null && activeBook.word_set_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--p-dark)]">
              ·  <Sparkles size={9} aria-hidden />
              {activeBook.word_set_count}개 단어장
            </span>
          )}
        </div>

        {/* i+1 적합도 — 학습자 V레벨 기준 기지어 커버리지 */}
        {(() => {
          const fit = judgeIPlusOne(activeBook.lexical_coverage, userVLevel, activeBook.is_picture_book)
          if (!fit) return null
          return (
            <span
              className="mt-1.5 inline-flex items-center gap-2 rounded-[var(--r-full)] border px-3 py-1 font-display text-[11px] font-[700]"
              style={{ color: fit.color, borderColor: fit.color }}
              title={`V${userVLevel} 학습자가 이 책 단어의 ${fit.coverage}% 를 이미 알아요`}
              aria-label={`나에게 ${fit.label}, 아는 단어 ${fit.coverage}퍼센트`}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: fit.color }}
              />
              나에게 {fit.label}
              <span className="font-mono font-[600]">{fit.coverage}%</span>
            </span>
          )
        })()}

        {/* v06.34 — Hero CTA: enrolled 일 때 상태별 라벨 + 색 차등 */}
        {(() => {
          const state = activeBook.enrollment_state ?? 'not_enrolled'
          const label =
            state === 'in_progress'
              ? '이어서 학습 · 상세'
              : state === 'completed'
                ? '다시 학습 · 상세'
                : state === 'enrolled'
                  ? '학습 시작 · 상세'
                  : '미리보기 · 상세'
          const bg =
            state === 'in_progress'
              ? 'bg-[var(--p)] text-[var(--on-p)]'
              : state === 'completed'
                ? 'bg-[var(--success)] text-white'
                : state === 'enrolled'
                  ? 'bg-[var(--p)] text-[var(--on-p)]'
                  : 'bg-[var(--t1)] text-[var(--bg)]'
          return (
            <button
              type="button"
              onClick={() => openDetail(activeBook)}
              className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] px-5 py-3 font-display text-[13px] font-[700] shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97] ${bg}`}
            >
              {label}
            </button>
          )
        })()}
      </div>

      {/* Dot indicator
          점 하나가 44px 히트영역(아래 주석)이라 **권수만큼 폭이 자란다** — 20권이면 512px 이고
          390px 화면에서 가운데 정렬이라 양옆으로 61px 씩 삐져나가 문서를 넓혔다
          (실측: `/library`·`/library/books` 모바일 가로 넘침 61px 의 원인. 3D 무대가 아니었다 —
           무대는 이미 `overflow-x-clip` 으로 잘리고 있었고, 잘린 요소는 문서를 넓히지 못한다).
          가로 스크롤로 가둔다: 점은 다 살리고(권수를 숨기지 않는다) 화면만 안 밀린다. */}
      <div
        role="tablist"
        aria-label="도서 선택"
        className="flex max-w-full items-center gap-2 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {books.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={idx === active}
            aria-label={`${idx + 1} / ${books.length}: ${b.title}`}
            onClick={() => goTo(idx)}
            // 점은 시각적으로 작아야 하지만 손가락 타겟은 44px 이어야 한다(CLAUDE.md 절대 금지 항목).
            // 버튼을 44px 히트영역으로 두고 안쪽 span 만 점으로 그린다.
            // `shrink-0` 는 필수다 — 줄을 `overflow-x-auto` 로 가둔 뒤 flex 기본 축소(shrink:1)가
            // 점 버튼을 44px 아래로 눌렀다(실측 13종 위반 · a11y 스윕이 잡았다). 줄이 줄어드는
            // 대신 **스크롤되어야** 44px 하한과 가로 넘침 0 을 동시에 지킨다.
            className="group flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <span
              aria-hidden
              className={`h-1.5 rounded-full transition-all duration-[${CAROUSEL_DURATION}ms] ${
                idx === active
                  ? 'w-6 bg-[var(--t1)]'
                  : 'w-1.5 bg-[var(--t3)]/40 group-hover:bg-[var(--t3)]'
              }`}
            />
          </button>
        ))}
      </div>

      {/* fadeInUp keyframes — inline */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

// ─── Carousel Book Card ─────────────────────────────────
function CarouselBook({
  book,
  isActive,
  onSideClick,
  onCenterClick,
}: {
  book: PublishedBook
  isActive: boolean
  onSideClick: () => void
  onCenterClick: () => void
}) {
  const cover = bookCover({
    title: book.title,
    bookVLevel: book.book_v_level,
    coverFrom: book.cover_from,
    coverTo: book.cover_to,
  })
  const coverImageUrl = book.cover_image_url ?? null
  const coverFit = coverFitFor(book)

  const inner = (
    <div
      className={`book-cover-premium relative aspect-[3/4] w-[270px] overflow-hidden ${
        isActive ? 'book-cover-premium--center' : ''
      }`}
      style={{
        background: coverImageUrl
          ? '#0B0B0F'
          : `
          radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
          linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)
        `,
      }}
    >
      {coverImageUrl ? (
        <>
          {/* 실 표지 — 세로 표지는 object-cover. 그림책 표지는 가로 삽화 크롭이라
              cover 로 채우면 좌우 64% 가 잘려(실측) contain + 블러 배경으로 간다.
              판정은 `cover-fit.ts` 가 소유 — 카드마다 다시 정하면 두 화면이 갈린다. */}
          {coverFit.blurBackdrop && (
            <Image
              src={coverImageUrl}
              alt=""
              aria-hidden
              fill
              sizes="270px"
              className="scale-110 object-cover blur-xl saturate-150"
            />
          )}
          <Image
            src={coverImageUrl}
            alt={`${book.title} 표지`}
            fill
            sizes="270px"
            className={`relative ${coverFit.objectFit}`}
          />
          {/* 상하 엣지 vignette — 칩/진행바 가독성 (중앙 표지는 선명 유지) */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35"
          />
          {/* 라미네이트 광택 — 실제 양장본이 스튜디오 조명을 받는 specular */}
          <div aria-hidden className="book-cover-laminate absolute inset-0" />
        </>
      ) : (
        <>
          {/* 그라디언트 표지 — 클로스바운드 클래식 풍 (실 표지엔 제목 박혀있어 미표시) */}
          <GradientBookCover title={book.title} author={book.author} textTone={cover.textTone} />
          {/* 상단 sheen + grain (그라디언트 표지) */}
          <div aria-hidden className="book-cover-sheen absolute inset-0" />
          <div aria-hidden className="book-cover-grain absolute inset-0" />
        </>
      )}

      {/* 실제 책 입체 — 입체 책등(좌) + 페이지 단면(우). 모든 표지 공통 (커버 위 overlay) */}
      <div aria-hidden className="book-spine3d" />
      <div aria-hidden className="book-foreedge" />

      {/* CEFR + V-Level 상단 우측 */}
      <div className="absolute right-3.5 top-3.5 flex flex-col items-end gap-1">
        {(book.cefr_band ?? book.cefr_level) && (
          <span className="inline-flex items-center rounded-[3px] bg-[var(--chip-cover-bg)] px-2 py-1 font-mono text-[10.5px] font-[700] tracking-tight text-[var(--chip-cover-ink)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]">
            {book.cefr_band ?? book.cefr_level}
          </span>
        )}
        {book.book_v_level != null && (
          <span className="inline-flex items-center rounded-[3px] bg-black/60 px-2 py-1 font-mono text-[10.5px] font-[700] tracking-tight text-white backdrop-blur-sm">
            V{book.book_v_level}
          </span>
        )}
      </div>

      {/* v06.34 — 좌상단: enrollment + 단어장 indicator 스택 (위→아래) */}
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        {/* 학습 상태 배지 — 가장 가시성 높은 위치 */}
        {book.enrollment_state === 'completed' && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--success)] px-2 py-1 font-display text-[10px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
            title="완독한 도서"
            aria-label="완독한 도서"
          >
            <Check size={10} strokeWidth={2.5} aria-hidden /> 완독
          </span>
        )}
        {book.enrollment_state === 'in_progress' && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p)] px-2 py-1 font-display text-[10px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
            title={`학습 중 · ${book.progress_pct ?? 0}% 진행`}
            aria-label={`학습 중 ${book.progress_pct ?? 0}퍼센트 진행`}
          >
            ● 학습 중 {book.progress_pct != null && <span className="font-mono opacity-80">{book.progress_pct}%</span>}
          </span>
        )}
        {book.enrollment_state === 'enrolled' && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--chip-cover-bg)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--chip-cover-brand)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
            title="라이브러리에 추가됨 — 학습 시작 대기"
            aria-label="라이브러리에 추가됨"
          >
            <Check size={10} strokeWidth={2.5} aria-hidden /> 내 학습
          </span>
        )}
        {/* 챕터 단어장 indicator (기존) */}
        {book.word_set_count != null && book.word_set_count > 0 && (
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-full bg-white/20 p-1 text-white/95 backdrop-blur-sm"
            title="챕터 단어장 포함"
          >
            <Sparkles size={10} />
          </span>
        )}
      </div>

      {/* v06.34 — in_progress 책 하단 진행 바 (1.5px slim) */}
      {book.enrollment_state === 'in_progress' && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[2px] bg-black/30"
        >
          <div
            className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
            style={{ width: `${book.progress_pct ?? 0}%` }}
          />
        </div>
      )}
    </div>
  )

  // 활성 책 클릭 → Netflix sheet · 사이드 책 클릭 → 해당 책으로 이동
  return (
    <button
      type="button"
      onClick={isActive ? onCenterClick : onSideClick}
      className={`block rounded-[10px] focus-visible:outline-none ${
        isActive
          ? 'focus-visible:ring-4 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-4'
          : 'focus-visible:ring-2 focus-visible:ring-[var(--p)]/40'
      }`}
      aria-label={isActive ? `${book.title} 상세 보기` : `${book.title} 으로 이동`}
    >
      {inner}
    </button>
  )
}
