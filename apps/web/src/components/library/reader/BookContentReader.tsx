// apps/web/src/components/library/reader/BookContentReader.tsx
// LCP v2.0 Phase 12.5 — 통합 Reader 컴포넌트
//
// admin-review 모드: 모든 chapter + 검수 도구 + 액션
// user-preview 모드: chapter 1만 + enroll CTA

'use client'

import {
  getChapterContent,
  getSampleWords,
  type ChapterContent,
  type ChapterListItem,
  type SampleWord,
} from '@/lib/library/reader-queries'
import { RETURN_PARAM } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, List } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChapterContentView } from './ChapterContent'
import { ChapterSidebar } from './ChapterSidebar'
import { WordLookupPopover } from './WordLookupPopover'
import { ChapterLevelWords } from './ChapterLevelWords'

export type ReaderMode = 'admin-review' | 'user-preview'

interface BookContentReaderProps {
  libraryBookId: string
  bookTitle: string
  bookAuthor: string | null
  cefrLevel: string | null
  totalWordCount: number
  chapters: ChapterListItem[]
  mode: ReaderMode
  /** 좌측 상단 footer slot — 모드별 액션 영역 (admin: 액션 버튼, user: enroll CTA) */
  footerSlot?: React.ReactNode
  /** v06.34 — admin 모드에서 chapter list 옆에 원본 소스 외부링크 표시 */
  source?: string | null
  sourceId?: string | null
  /**
   * 서버가 미리 읽어 둔 **1장 본문**.
   *
   * 왜 필요한가 (2026-08-26 실측): 본문을 전부 클라이언트에서 fetch 했다. 그래서
   * 초기 HTML 에는 `activeContent === null` 의 폴백인 **"본문 없음"** 만 들어갔다.
   * 크롤러는 JS 를 실행하지 않으므로 **검색엔진이 본문을 한 글자도 못 봤다** —
   * 같은 날 sitemap 에 올린 도서 상세 13개가 전부 그 상태였다.
   * 사람에게도 첫 페인트에 "본문 없음" 이 스쳤다.
   *
   * 있으면 캐시의 1장 자리를 채운 채 시작한다(그러면 fetch effect 도 건너뛴다).
   */
  initialContent?: ChapterContent | null
  /**
   * 로그인 여부 — 본문이 안 올 때 **"없다" 와 "로그인이 필요하다" 를 가른다.**
   *
   * `content_chunks` 의 RLS 가 `auth.role() = 'authenticated'` 라, 비로그인에게는
   * 목차만 오고 본문은 0행이다. 그 상태를 "본문 없음" 으로 적으면 거짓말이 된다.
   */
  isLoggedIn?: boolean
}

export function BookContentReader({
  libraryBookId,
  bookTitle,
  bookAuthor,
  cefrLevel,
  totalWordCount,
  chapters,
  mode,
  footerSlot,
  source,
  sourceId,
  initialContent,
  isLoggedIn,
}: BookContentReaderProps) {
  const [activeIdx, setActiveIdx] = useState(1)
  // 서버가 준 1장이 있으면 그것으로 시작한다 — 초기 HTML 에 본문이 들어가고 fetch 도 한 번 준다.
  const [contentCache, setContentCache] = useState<Record<number, ChapterContent>>(() =>
    initialContent ? ({ 1: initialContent } as Record<number, ChapterContent>) : {},
  )
  const [sampleCache, setSampleCache] = useState<Record<number, SampleWord[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 본문 단어 클릭 조회 팝오버 (자체 dict+lemma)
  const [lookup, setLookup] = useState<{ word: string; rect: DOMRect } | null>(null)

  /**
   * 좁은 화면에서 목차를 폈는가 (`md` 미만에서만 의미가 있다).
   *
   * ── 왜 (실측 2026-09-05 · 390px) ──────────────────────────────────────
   * 목차가 `w-[200px]` 고정에 브레이크포인트가 없었다. 이 화면의 바깥에는 패딩이 없어
   * `<article>` 이 뷰포트 폭 그대로 390px 인데, 거기서 200px 을 목차가 가져가면 본문 열은
   * 190px 이고 좌우 `px-5` 40px 을 빼면 **약 150px** 이 남는다 — 영어 한 줄에 낱말
   * 두세 개다. 그 위 툴바(`이전 · N / M · 다음`)도 같은 폭에서 겹쳤다.
   * 하필 이 화면이 **비로그인 검색 착지점**이라(아래 `initialContent` 주석의 2026-08-26
   * 실측) 첫 방문자가 그 상태를 봤다.
   *
   * 그래서 좁은 화면에서는 목차를 본문 **위로 접어 둔다** — 지우지 않는다.
   * 장을 고르는 것은 이 화면의 유일한 이동 수단이라 없애면 기능 삭제다.
   * 같은 셸의 다른 곳이 이미 이 규칙을 쓴다(`components/layout/Sidebar` = `hidden md:flex`).
   */
  const [tocOpen, setTocOpen] = useState(false)

  // 장을 고르면 좁은 화면의 목차는 닫는다 — 고른 뒤에도 덮여 있으면 본문이 안 보인다.
  const selectChapter = useCallback((idx: number) => {
    setActiveIdx(idx)
    setTocOpen(false)
  }, [])

  // chapter 전환 시 팝오버 닫기 (stale rect 방지)
  useEffect(() => {
    setLookup(null)
  }, [activeIdx])

  // admin-review 토글
  const [showParagraphMarkers, setShowParagraphMarkers] = useState(false)
  const [showSampleWords, setShowSampleWords] = useState(false)
  // 내 레벨 맞춤 단어(Krashen i+1) 패널 토글 — 양 모드 공통
  const [showLevelWords, setShowLevelWords] = useState(false)

  const isLockedChapter = mode === 'user-preview' && activeIdx > 1

  // chapter 변경 시 fetch (캐시된 것은 skip)
  useEffect(() => {
    if (isLockedChapter) return
    if (contentCache[activeIdx]) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const client = createClient()
    getChapterContent(client, libraryBookId, activeIdx)
      .then((content) => {
        if (cancelled || !content) return
        setContentCache((prev) => ({ ...prev, [activeIdx]: content }))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'unknown')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeIdx, libraryBookId, contentCache, isLockedChapter])

  // sample words lazy fetch (admin-review + 토글 ON 시)
  useEffect(() => {
    if (mode !== 'admin-review' || !showSampleWords) return
    if (sampleCache[activeIdx]) return

    const client = createClient()
    getSampleWords(client, libraryBookId, activeIdx, 10)
      .then((words) => setSampleCache((prev) => ({ ...prev, [activeIdx]: words })))
      .catch(() => {})
  }, [activeIdx, libraryBookId, mode, showSampleWords, sampleCache])

  // 키보드 ← / → 네비
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && activeIdx > 1) {
        setActiveIdx((i) => i - 1)
      } else if (e.key === 'ArrowRight' && activeIdx < chapters.length) {
        if (mode === 'user-preview' && activeIdx >= 1) return
        setActiveIdx((i) => i + 1)
      }
    },
    [activeIdx, chapters.length, mode]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const Heading = mode === 'user-preview' ? 'h1' : 'h2'

  const activeContent = contentCache[activeIdx] ?? null
  const activeSamples = sampleCache[activeIdx] ?? []

  return (
    <>
    <article
      // ⚠️ `h-[calc(100vh-180px)]` 은 **데스크톱 기준 값**이다. 폰에서는 셸(리본·탭바)과
      //    이 위의 난이도 카드·단어장 그리드가 이미 자리를 먹어, 고정 높이를 걸면 화면 안에
      //    또 하나의 스크롤 통이 생겨 본문이 손바닥만 해진다. 좁은 화면에서는 높이를
      //    강제하지 않고 문서 스크롤에 맡긴다(min-h 로 최소 지면만 보장).
      className="flex min-h-[60vh] flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] md:h-[calc(100vh-180px)] md:min-h-0"
      aria-label={`${bookTitle} 본문 reader`}
    >
      {/* Header */}
      {/* 390px 에서 제목과 토글이 같은 줄을 다투면 둘 다 뭉개진다 — 좁으면 쌓는다. */}
      <header className="flex flex-col items-start gap-2 border-b border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="min-w-0 flex-1">
          {/*
            미리보기(비로그인 착지점)에서는 이 제목이 **그 페이지의 h1** 이다.
            도서 상세에는 다른 h1 이 없어서, 그대로 두면 검색엔진과 스크린리더가
            "무엇에 관한 페이지인가" 를 알 방법이 없다(2026-08-26 실측 — h1 0개).
            admin-review 는 검수 도구 안의 한 구획이라 h2 가 맞다.
          */}
          <Heading className="line-clamp-1 font-display text-[16px] font-[700] text-[var(--t1)]">
            {bookTitle}
          </Heading>
          <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t2)]">
            {bookAuthor ?? '저자 미상'}
            {cefrLevel && (
              <>
                <span className="mx-1.5 text-[var(--t5)]">·</span>
                <span className="font-mono text-[11px] text-[var(--t2)]">{cefrLevel}</span>
              </>
            )}
            <span className="mx-1.5 text-[var(--t5)]">·</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
              {totalWordCount.toLocaleString()} 단어
            </span>
            <span className="mx-1.5 text-[var(--t5)]">·</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
              {chapters.length}장
            </span>
          </p>
        </div>

        {/* 토글 — 내 레벨(양 모드) + admin 검수 토글 */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ToggleButton
            active={showLevelWords}
            onToggle={() => setShowLevelWords((v) => !v)}
            label="🎯 익힐 단어"
            ariaLabel="이 챕터에서 익힐 단어 보기"
          />
          {mode === 'admin-review' && (
            <>
              <ToggleButton
                active={showParagraphMarkers}
                onToggle={() => setShowParagraphMarkers((v) => !v)}
                label="¶ 문단"
                ariaLabel="문단 마커 표시 토글"
              />
              <ToggleButton
                active={showSampleWords}
                onToggle={() => setShowSampleWords((v) => !v)}
                label="✦ 어휘"
                ariaLabel="LV 상위 어휘 하이라이트 토글"
              />
            </>
          )}
        </div>
      </header>

      {/* Body — 좁으면 세로(목차가 본문 위로 접힘) · md 이상은 레일 + 본문 */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <ChapterSidebar
          chapters={chapters}
          activeIdx={activeIdx}
          mode={mode}
          onSelect={selectChapter}
          source={source}
          sourceId={sourceId}
          // 인스턴스는 하나다(ChapterSidebar 의 className 주석 참조).
          // 좁을 때: 접힘 기본 · 펴면 본문 위 최대 45vh 패널.
          // md 이상: 언제나 보이는 200px 레일 — 데스크톱 동작은 그대로다.
          className={[
            tocOpen ? 'flex' : 'hidden',
            'max-h-[45vh] w-full shrink-0 flex-col overflow-y-auto border-b border-[var(--bd)] bg-[var(--bg2)]',
            'md:flex md:max-h-none md:w-[200px] md:border-b-0 md:border-r',
          ].join(' ')}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top toolbar — 목차(좁은 화면) + 이전/다음 */}
          <div className="flex items-center justify-between gap-1 border-b border-[var(--bd)] bg-[var(--bg)] px-2 py-2 sm:px-5">
            {/* 좁은 화면의 유일한 목차 진입점. md 이상은 레일이 늘 보이므로 숨긴다. */}
            <button
              type="button"
              onClick={() => setTocOpen((v) => !v)}
              aria-expanded={tocOpen}
              aria-label={tocOpen ? '목차 접기' : `목차 열기 — 전체 ${chapters.length}장`}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:bg-[var(--bg3)] md:hidden"
            >
              <List size={14} aria-hidden />
              목차
              {tocOpen ? (
                <ChevronUp size={13} aria-hidden />
              ) : (
                <ChevronDown size={13} aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => Math.max(1, i - 1))}
              disabled={activeIdx === 1}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="이전 장"
            >
              <ChevronLeft size={14} aria-hidden />
              이전
            </button>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--t2)]">
              {activeIdx} / {chapters.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => Math.min(chapters.length, i + 1))}
              disabled={
                activeIdx === chapters.length || (mode === 'user-preview' && activeIdx >= 1)
              }
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="다음 장"
            >
              다음
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLockedChapter ? (
              <LockedChapterPanel />
            ) : loading ? (
              <ContentLoading />
            ) : error ? (
              <ContentError message={error} />
            ) : activeContent ? (
              <>
                <ChapterContentView
                  content={activeContent}
                  showParagraphMarkers={showParagraphMarkers}
                  sampleWords={showSampleWords ? activeSamples : []}
                  onWordClick={(word, rect) => setLookup({ word, rect })}
                />
                {showLevelWords && (
                  <ChapterLevelWords libraryBookId={libraryBookId} chapterIdx={activeIdx} />
                )}
              </>
            ) : isLoggedIn === false ? (
              <SignInToReadPanel />
            ) : (
              <div className="flex h-full items-center justify-center font-body text-[12px] text-[var(--t2)]">
                본문 없음
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer slot — 모드별 액션 */}
      {footerSlot && (
        <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
          {footerSlot}
        </footer>
      )}
    </article>

    {lookup && (
      <WordLookupPopover
        surface={lookup.word}
        anchorRect={lookup.rect}
        onClose={() => setLookup(null)}
      />
    )}
    </>
  )
}

// ─────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────

function ToggleButton({
  active,
  onToggle,
  label,
  ariaLabel,
}: {
  active: boolean
  onToggle: () => void
  label: string
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={[
        'inline-flex min-h-[32px] items-center rounded-[var(--r-sm)] border px-3',
        'font-display text-[11px] font-[600]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function ContentLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--bg2)]" />
        <span className="font-mono text-[11px] text-[var(--t2)]">불러오는 중…</span>
      </div>
    </div>
  )
}

function ContentError({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-5">
      <div className="rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-4 py-3" role="alert">
        <p className="font-body text-[12px] text-[var(--learn-error)]">{message}</p>
      </div>
    </div>
  )
}

/**
 * 로그인해야 본문이 열리는 경우.
 *
 * **"본문 없음" 이 아니다.** `content_chunks` 의 RLS 는 `auth.role() = 'authenticated'` 라
 * 비로그인에게 0행을 준다 — 목차는 보이는데(`library_chapters_master` 는 발행 도서면 공개)
 * 본문만 안 온다. 그 상태를 "본문 없음" 으로 적어 두면 **거짓말**이고, 하필 이 화면이
 * 검색으로 들어온 사람의 착지점이라 그 한 줄에서 떠난다(2026-08-26 실측).
 */
function SignInToReadPanel() {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="select-none text-4xl" aria-hidden>
        📖
      </div>
      <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
        로그인하면 1장을 읽을 수 있어요
      </h3>
      <p className="max-w-md font-body text-[13px] leading-relaxed text-[var(--t2)]">
        난이도와 어휘는 지금 그대로 보실 수 있어요. 본문은 계정이 있어야 열립니다.
      </p>
      <Link
        href={`/login?${RETURN_PARAM}=${encodeURIComponent(pathname)}`}
        className="mt-1 inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        로그인하고 읽기
      </Link>
    </div>
  )
}

function LockedChapterPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="select-none text-4xl" aria-hidden>
        🔒
      </div>
      <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
        이 장은 학습 추가 후 열람 가능합니다
      </h3>
      <p className="max-w-md font-body text-[13px] leading-relaxed text-[var(--t2)]">
        지금은 1장만 미리 볼 수 있습니다. 내 학습에 추가하면 모든 장을 chapter 단위로 학습할 수
        있어요.
      </p>
    </div>
  )
}
