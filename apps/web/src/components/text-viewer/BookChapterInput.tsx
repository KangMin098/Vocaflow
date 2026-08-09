// apps/web/src/components/text-viewer/BookChapterInput.tsx
//
// /text/new 책 모드 — 책 메타(제목/저자) + "챕터 워크벤치".
// v06.35 재설계: 세로 누적 → 가로 네비게이션.
//   · 상단 챕터 레일(좌우 스크롤) 에서 챕터 선택 · 우측 끝 [+] 로 오른쪽에 추가
//   · 한 번에 한 챕터만 집중 편집(원고 페이지) · ←/→ 로 이전·다음 챕터 이동
//   · Alt+←/→ 단축키 · 챕터별 작성 상태(완료/작성중/빈) 시각화
// 입력 순서 = chapter_idx 1..N. 좌우 이동으로 순서 변경.
//
// 색상: Tailwind 테마에 semantic 색(p-light/ti/success/warning/error)이 없어
//       arbitrary value `[var(--...)]` 로 직접 참조 (globals.css CSS 변수).

'use client'

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { UserBookChapter } from '@/lib/text-viewer/save-user-book'

const CONTENT_MIN = 50
const TITLE_MAX = 200
const CHAPTER_TITLE_MAX = 200
const MAX_CHAPTERS = 50

interface BookChapterInputProps {
  bookTitle: string
  onBookTitleChange: (v: string) => void
  author: string
  onAuthorChange: (v: string) => void
  chapters: UserBookChapter[]
  onChaptersChange: (chapters: UserBookChapter[]) => void
}

type ChapterStatus = 'complete' | 'partial' | 'empty'

function statusOf(c: UserBookChapter): ChapterStatus {
  const t = c.title.trim()
  const len = c.content.trim().length
  if (t && len >= CONTENT_MIN) return 'complete'
  if (t || len > 0) return 'partial'
  return 'empty'
}

const INPUT_FOCUS =
  'focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p-light)]'

export function BookChapterInput({
  bookTitle,
  onBookTitleChange,
  author,
  onAuthorChange,
  chapters,
  onChaptersChange,
}: BookChapterInputProps) {
  const [active, setActive] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)

  // chapters 가 줄어들면 active 보정
  useEffect(() => {
    setActive((a) => Math.max(0, Math.min(a, chapters.length - 1)))
  }, [chapters.length])

  // active 칩을 레일 중앙으로 스크롤
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  const current = chapters[active] ?? { title: '', content: '' }
  const currentLen = current.content.trim().length
  const currentTooShort = currentLen > 0 && currentLen < CONTENT_MIN
  const completeCount = chapters.filter((c) => statusOf(c) === 'complete').length
  const totalChars = chapters.reduce((s, c) => s + c.content.trim().length, 0)

  const setChapter = useCallback(
    (i: number, patch: Partial<UserBookChapter>) => {
      onChaptersChange(chapters.map((c, j) => (j === i ? { ...c, ...patch } : c)))
    },
    [chapters, onChaptersChange],
  )

  const go = useCallback(
    (i: number) => setActive(Math.max(0, Math.min(chapters.length - 1, i))),
    [chapters.length],
  )

  const addChapter = useCallback(() => {
    if (chapters.length >= MAX_CHAPTERS) return
    const next = [...chapters, { title: '', content: '' }]
    onChaptersChange(next)
    setActive(next.length - 1)
  }, [chapters, onChaptersChange])

  const removeChapter = useCallback(
    (i: number) => {
      if (chapters.length <= 1) return
      const next = chapters.filter((_, j) => j !== i)
      onChaptersChange(next)
      setActive((a) => {
        const t = i < a ? a - 1 : a
        return Math.max(0, Math.min(next.length - 1, t))
      })
    },
    [chapters, onChaptersChange],
  )

  // 현재 챕터를 좌/우로 이동(순서 변경) — active 가 따라감
  const move = useCallback(
    (dir: -1 | 1) => {
      const j = active + dir
      if (j < 0 || j >= chapters.length) return
      const next = [...chapters]
      ;[next[active], next[j]] = [next[j]!, next[active]!]
      onChaptersChange(next)
      setActive(j)
    },
    [active, chapters, onChaptersChange],
  )

  // Alt+←/→ 챕터 이동 (텍스트 캐럿 이동과 충돌 안 함)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!e.altKey) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(active - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(active + 1)
    }
  }

  const atFirst = active === 0
  const atLast = active === chapters.length - 1

  return (
    <div className="flex flex-col gap-s-5" onKeyDown={onKeyDown}>
      {/* ── 책 정보 카드 ── */}
      <div className="relative overflow-hidden rounded-2xl border border-bd bg-bg shadow-sm">
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[var(--p)] to-[var(--p-dark)]"
        />
        <div className="flex flex-col gap-s-4 p-s-5 pl-s-6">
          <div className="flex items-center gap-s-2">
            <BookOpen size={15} className="text-[var(--p)]" aria-hidden />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
              책 정보
            </span>
          </div>
          <div className="grid gap-s-4 sm:grid-cols-[1fr_minmax(0,220px)]">
            <div>
              <label
                htmlFor="book-title"
                className="mb-s-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-t3"
              >
                책 제목 <span className="text-[var(--error-ink)]">*</span>
              </label>
              <input
                id="book-title"
                type="text"
                value={bookTitle}
                onChange={(e) => onBookTitleChange(e.target.value)}
                maxLength={TITLE_MAX + 20}
                placeholder="예: The Great Gatsby"
                className={`w-full rounded-lg border border-bd bg-bg px-s-4 py-s-3 font-english text-lg font-[600] text-t1 placeholder:font-body placeholder:text-base placeholder:text-t3 transition-all duration-normal ${INPUT_FOCUS}`}
              />
            </div>
            <div>
              <label
                htmlFor="book-author"
                className="mb-s-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-t3"
              >
                저자 <span className="text-t4">(선택)</span>
              </label>
              <input
                id="book-author"
                type="text"
                value={author}
                onChange={(e) => onAuthorChange(e.target.value)}
                maxLength={120}
                placeholder="F. Scott Fitzgerald"
                className={`w-full rounded-lg border border-bd bg-bg px-s-4 py-s-3 font-body text-sm text-t1 placeholder:text-t3 transition-all duration-normal ${INPUT_FOCUS}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 챕터 워크벤치 ── */}
      <div className="flex flex-col gap-s-3">
        <div className="flex items-end justify-between gap-s-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-display text-sm font-bold text-t1">챕터 작성</h3>
            <p className="font-body text-xs text-t3">
              레일에서 챕터를 고르거나{' '}
              <kbd className="rounded bg-bg3 px-1 font-mono text-[10px] text-t2">Alt</kbd>+
              <kbd className="rounded bg-bg3 px-1 font-mono text-[10px] text-t2">←/→</kbd> 로 이동해요.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-s-2 font-mono text-[10px] text-t3">
            <span className="inline-flex items-center gap-1">
              <Check size={11} className="text-[var(--success)]" aria-hidden />
              {completeCount}/{chapters.length} 완료
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{totalChars.toLocaleString()}자</span>
          </div>
        </div>

        {/* 챕터 레일 (가로) */}
        <div className="flex items-center gap-s-2">
          <RailArrow dir="left" disabled={atFirst} onClick={() => go(active - 1)} label="이전 챕터" />
          <div
            ref={railRef}
            role="tablist"
            aria-label="챕터 목록"
            className="flex flex-1 snap-x items-center gap-s-2 overflow-x-auto rounded-xl border border-bd bg-bg2 p-s-2 [scrollbar-width:thin]"
          >
            {chapters.map((c, i) => (
              <ChapterChip
                key={i}
                index={i}
                title={c.title}
                status={statusOf(c)}
                active={i === active}
                onClick={() => go(i)}
              />
            ))}
            <button
              type="button"
              onClick={addChapter}
              disabled={chapters.length >= MAX_CHAPTERS}
              aria-label="오른쪽에 챕터 추가"
              title={chapters.length >= MAX_CHAPTERS ? `최대 ${MAX_CHAPTERS}개` : '오른쪽에 챕터 추가'}
              className="flex h-9 shrink-0 snap-start items-center gap-1 rounded-lg border-2 border-dashed border-bd px-s-3 font-display text-[12px] font-[700] text-t3 transition-all duration-normal hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} aria-hidden />
              추가
            </button>
          </div>
          <RailArrow dir="right" disabled={atLast} onClick={() => go(active + 1)} label="다음 챕터" />
        </div>

        {/* 활성 챕터 — 원고 페이지 */}
        <div
          key={active}
          className="overflow-hidden rounded-2xl border border-bd bg-bg shadow-md"
        >
          {/* 페이지 헤더 */}
          <div className="flex items-center gap-s-3 border-b border-bd bg-bg2 px-s-4 py-s-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--p)] font-display text-[13px] font-[800] text-[var(--on-p)] shadow-sm">
              {active + 1}
            </span>
            <input
              type="text"
              value={current.title}
              onChange={(e) => setChapter(active, { title: e.target.value })}
              maxLength={CHAPTER_TITLE_MAX + 20}
              placeholder={`Chapter ${active + 1} 제목 (예: Down the Rabbit-Hole)`}
              className="min-w-0 flex-1 bg-transparent font-display text-base font-[700] text-t1 placeholder:font-[500] placeholder:text-t3 focus:outline-none"
            />
            {/* 순서 이동 */}
            <div className="flex shrink-0 items-center rounded-lg border border-bd bg-bg">
              <IconBtn label="왼쪽으로 이동" disabled={atFirst} onClick={() => move(-1)}>
                <ChevronLeft size={14} />
              </IconBtn>
              <span aria-hidden className="h-4 w-px bg-bd" />
              <IconBtn label="오른쪽으로 이동" disabled={atLast} onClick={() => move(1)}>
                <ChevronRight size={14} />
              </IconBtn>
            </div>
            {/* 삭제 */}
            <IconBtn label="이 챕터 삭제" disabled={chapters.length <= 1} danger onClick={() => removeChapter(active)}>
              <Trash2 size={14} />
            </IconBtn>
          </div>

          {/* 본문 */}
          <div className="p-s-4">
            <textarea
              value={current.content}
              onChange={(e) => setChapter(active, { content: e.target.value })}
              placeholder={`Chapter ${active + 1} 본문을 입력하세요.\n\n영어 원문을 붙여넣으면 다축 VRL 기반 AI 단어 추출이 챕터별로 작동합니다.`}
              rows={14}
              className={`w-full resize-y rounded-xl border border-bd bg-bg px-s-4 py-s-3 font-english text-[16px] leading-[1.85] text-t1 placeholder:font-body placeholder:text-[14px] placeholder:leading-relaxed placeholder:text-t3 transition-all duration-normal ${INPUT_FOCUS}`}
            />

            {/* 푸터: 상태 + 이전/다음 */}
            <div className="mt-s-3 flex flex-wrap items-center justify-between gap-s-3">
              <div className="flex items-center gap-s-2 font-mono text-[11px]">
                {currentLen === 0 ? (
                  <span className="text-t3">최소 {CONTENT_MIN}자</span>
                ) : currentTooShort ? (
                  <span className="text-[var(--error-ink)]">
                    {currentLen}자 · {CONTENT_MIN - currentLen}자 더 필요
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[var(--success)]">
                    <Check size={12} aria-hidden /> {currentLen.toLocaleString()}자 · 충분
                  </span>
                )}
              </div>

              <div className="flex items-center gap-s-2">
                <NavBtn disabled={atFirst} onClick={() => go(active - 1)}>
                  <ArrowLeft size={14} aria-hidden /> 이전
                </NavBtn>
                {atLast ? (
                  <NavBtn primary disabled={chapters.length >= MAX_CHAPTERS} onClick={addChapter}>
                    <Plus size={14} aria-hidden /> 새 챕터
                  </NavBtn>
                ) : (
                  <NavBtn onClick={() => go(active + 1)}>
                    다음 <ArrowRight size={14} aria-hidden />
                  </NavBtn>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function ChapterChip({
  index,
  title,
  status,
  active,
  onClick,
}: {
  index: number
  title: string
  status: ChapterStatus
  active: boolean
  onClick: () => void
}) {
  const label = title.trim() || `Chapter ${index + 1}`
  const tone = active
    ? 'bg-[var(--p)] text-[var(--ti)] shadow-sm'
    : status === 'complete'
      ? 'bg-[var(--success-light)] text-[var(--success)] ring-1 ring-bd hover:ring-[var(--success)]'
      : status === 'partial'
        ? 'bg-[var(--warning-light)] text-[var(--warning)] ring-1 ring-bd'
        : 'bg-bg text-t3 ring-1 ring-bd hover:text-t1'
  return (
    <button
      type="button"
      data-chip={index}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={label}
      className={`flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-lg px-s-3 font-display text-[12px] font-[700] transition-all duration-normal ${tone}`}
    >
      <span className="tabular-nums">{index + 1}</span>
      {status === 'complete' && !active && <Check size={12} aria-hidden />}
      {active && (
        <span className="max-w-[110px] truncate font-[600] opacity-90">{label}</span>
      )}
    </button>
  )
}

function RailArrow({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: 'left' | 'right'
  disabled: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bd bg-bg text-t2 shadow-xs transition-colors duration-normal hover:border-[var(--p)] hover:text-[var(--p)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-bd disabled:hover:text-t2"
    >
      {dir === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-t3 transition-colors duration-normal disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'hover:bg-[var(--error-light)] hover:text-[var(--error-ink)]'
          : 'hover:bg-bg3 hover:text-t1'
      }`}
    >
      {children}
    </button>
  )
}

function NavBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-lg px-s-3 py-s-2 font-display text-[12.5px] font-[600] transition-all duration-normal disabled:cursor-not-allowed disabled:opacity-30 ${
        primary
          ? 'bg-[var(--p)] text-[var(--on-p)] shadow-sm hover:bg-[var(--p-hover)]'
          : 'border border-bd bg-bg text-t2 hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {children}
    </button>
  )
}
