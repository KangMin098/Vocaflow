// apps/web/src/components/textviewer/TextCard.tsx
//
// 사용자 입력 스크립트 카드 — TextViewer 허브 그리드용
// /library 의 LibraryCard 보다 컴팩트 + 자기 자산 강조 (정복 배지 + 진행률)

'use client'

import { Bookmark, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { TextStatusBadge } from './TextStatusBadge'

import {
  deleteUserBookGroupAction,
  deleteUserTextAction,
  unenrollBookAction,
} from '@/app/(main)/text/actions'
import { workspaceHref } from '@/lib/text-viewer/workspace-href'
import type { LibraryText } from '@/types/library'

interface TextCardProps {
  text: LibraryText
}

function relativeTimeKo(date: Date | null): string {
  if (!date) return '학습 시작 전'
  const diffMs = Date.now() - date.getTime()
  const diffH = diffMs / (1000 * 60 * 60)
  const diffD = diffH / 24
  if (diffH < 1) return '방금'
  if (diffH < 24) return `${Math.floor(diffH)}시간 전`
  if (diffD < 2) return '어제'
  if (diffD < 7) return `${Math.floor(diffD)}일 전`
  if (diffD < 14) return '1주일 전'
  if (diffD < 30) return `${Math.floor(diffD / 7)}주 전`
  return '오래 전'
}

export function TextCard({ text }: TextCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const lastStudied = relativeTimeKo(text.lastStudiedAt)

  // v06.32 — 도서 단위 카드는 /my/books/[bookId] redirect 우회, nextTextId 로 직진.
  const href = workspaceHref(text)
  // 카드 종류 판정 — 우선순위: 라이브러리 도서 > 사용자 책 그룹 > 단일 텍스트
  const isLibraryBookCard = !!text.bookId
  const isUserBookCard = !isLibraryBookCard && !!text.userBookGroupId
  const chapterN = text.chapterCount ?? 0

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    let confirmMsg: string
    if (isLibraryBookCard) {
      confirmMsg =
        `"${text.title}" 을(를) 내 학습에서 제외할까요?\n` +
        '· 챕터 진도와 챕터 단어장 구독이 해제됩니다.\n' +
        '· 사용자가 직접 추가/수정한 단어는 보존됩니다.'
    } else if (isUserBookCard) {
      confirmMsg =
        `"${text.title}" 책 전체를 삭제할까요?\n` +
        `· ${chapterN}개 챕터 본문과 학습 진도가 모두 영구 삭제됩니다.\n` +
        '· 학습한 단어는 보존됩니다.'
    } else {
      confirmMsg = `"${text.title}" 을(를) 삭제할까요?\n· 본문과 학습 진도가 영구 삭제됩니다.\n· 학습한 단어는 보존됩니다.`
    }
    if (!window.confirm(confirmMsg)) return
    startTransition(async () => {
      let res
      if (isLibraryBookCard) {
        res = await unenrollBookAction(text.bookId!)
      } else if (isUserBookCard) {
        res = await deleteUserBookGroupAction(text.userBookGroupId!)
      } else {
        res = await deleteUserTextAction(text.id)
      }
      if (!res.ok) {
        window.alert(`실패: ${res.message ?? res.reason}`)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="group relative">
    <Link
      href={href}
      aria-label={`${text.title} 학습 (${text.progressPercent}%)`}
      className="group/link flex flex-col rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:-translate-y-1 hover:border-[var(--p)] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
    >
      {/* Cover gradient */}
      <div
        className="relative h-24 rounded-t-[var(--r-lg)]"
        style={{
          background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
        }}
      >
        {/* Bookmark indicator */}
        {text.isBookmarked && (
          <span
            className="absolute right-2 top-2 rounded-full bg-white/20 p-2 backdrop-blur"
            aria-label="즐겨찾기"
          >
            <Bookmark
              size={11}
              strokeWidth={2.5}
              className="fill-white text-white"
              aria-hidden="true"
            />
          </span>
        )}

        {/* CEFR badge */}
        <span
          className="absolute bottom-2 left-2 rounded-[var(--r-sm)] bg-white/20 px-2 py-1 font-display text-[9px] font-[800] uppercase tracking-wider text-white backdrop-blur"
          aria-label={`레벨 ${text.cefrLevel}`}
        >
          {text.cefrLevel}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 font-english text-[14px] font-[600] leading-snug text-[var(--t1)]">
            {text.title}
          </h3>
          <TextStatusBadge text={text} />
        </div>

        {/* Author + category */}
        <p className="line-clamp-1 font-body text-[11px] text-[var(--t2)]">
          {text.author} · {text.category}
        </p>

        {/* Progress bar */}
        <div className="mt-auto pt-2">
          <div
            className="h-1 overflow-hidden rounded-full bg-[var(--bg3)]"
            role="progressbar"
            aria-valuenow={text.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-[var(--dur-normal)]"
              style={{
                width: `${text.progressPercent}%`,
                backgroundColor:
                  text.progressPercent >= 100 ? 'var(--success)' : 'var(--p)',
              }}
            />
          </div>

          {/* Meta */}
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-[var(--t2)]">
            <span>{text.wordCount}단어</span>
            <span>{lastStudied}</span>
          </div>
        </div>
      </div>
    </Link>

    {/* v06.34 — hover 시 우상단 제외/삭제 버튼 (Link 외부 — 이벤트 격리) */}
    <button
      type="button"
      onClick={handleRemove}
      disabled={pending}
      aria-label={isLibraryBookCard ? `${text.title} 내 학습에서 제외` : `${text.title} 삭제`}
      title={isLibraryBookCard ? '내 학습에서 제외' : '삭제'}
      className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[var(--t2)] opacity-0 shadow-[var(--sh-sm)] backdrop-blur transition-all duration-[var(--dur-normal)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] hover:bg-[var(--error-light)] hover:text-[var(--error-ink)] disabled:opacity-50"
    >
      {pending ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : (
        <X size={13} strokeWidth={2.5} aria-hidden />
      )}
    </button>
    </div>
  )
}
