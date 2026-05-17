// apps/web/src/app/admin/curation/preview/[bookId]/AdminReviewClient.tsx

'use client'

import { BookContentReader } from '@/components/library/reader/BookContentReader'
import {
  archiveBook,
  classifyStatus,
  forcePublishBook,
  requeueBook,
  type BookStatus,
} from '@/lib/library/admin-queries'
import type { ChapterListItem } from '@/lib/library/reader-queries'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Archive, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  bookId: string
  title: string
  author: string | null
  cefrLevel: string | null
  cefrConfidence: number | null
  totalWordCount: number
  status: string
  copyrightSafeInKr: boolean
  chapters: ChapterListItem[]
}

export function AdminReviewClient({
  bookId,
  title,
  author,
  cefrLevel,
  cefrConfidence,
  totalWordCount,
  status,
  copyrightSafeInKr,
  chapters,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusInfo = classifyStatus(status as BookStatus)

  async function runAction(label: string, fn: () => Promise<void>) {
    setPending(label)
    setError(null)
    try {
      await fn()
      router.push('/admin/curation')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      {/* Top bar — back + meta */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/curation"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          큐레이션으로
        </Link>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[700]"
            style={{
              backgroundColor: getToneStyle(statusInfo.tone).bg,
              color: getToneStyle(statusInfo.tone).text,
            }}
          >
            {statusInfo.label}
          </span>
          {cefrConfidence != null && (
            <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
              confidence {cefrConfidence.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Reader */}
      <BookContentReader
        libraryBookId={bookId}
        bookTitle={title}
        bookAuthor={author}
        cefrLevel={cefrLevel}
        totalWordCount={totalWordCount}
        chapters={chapters}
        mode="admin-review"
        footerSlot={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? (
              <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-[var(--learn-error)]">
                <AlertCircle size={12} aria-hidden /> {error}
              </span>
            ) : (
              <span className="font-body text-[11px] text-[var(--t3)]">
                ← / → 키로 장 이동 · 토글 메뉴로 검수
              </span>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {status === 'failed' && (
                <ActionButton
                  icon={<RefreshCw size={12} />}
                  label="재처리"
                  pending={pending === 'requeue'}
                  onClick={() => runAction('requeue', () => requeueBook(createClient(), bookId))}
                  tone="primary"
                />
              )}
              {(status === 'ready' || status === 'failed') && copyrightSafeInKr && (
                <ActionButton
                  icon={<CheckCircle2 size={12} />}
                  label="강제 게시"
                  pending={pending === 'publish'}
                  onClick={() =>
                    runAction('publish', () => forcePublishBook(createClient(), bookId))
                  }
                  tone="primary"
                />
              )}
              {status !== 'archived' && (
                <ActionButton
                  icon={<Archive size={12} />}
                  label="보관"
                  pending={pending === 'archive'}
                  onClick={() => runAction('archive', () => archiveBook(createClient(), bookId))}
                  tone="neutral"
                />
              )}
            </div>
          </div>
        }
      />
    </>
  )
}

function ActionButton({
  icon,
  label,
  pending,
  onClick,
  tone,
}: {
  icon: React.ReactNode
  label: string
  pending: boolean
  onClick: () => void
  tone: 'primary' | 'neutral'
}) {
  const cls =
    tone === 'primary'
      ? 'bg-[var(--p)] hover:bg-[var(--p-light)] text-[var(--ti)]'
      : 'border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--bg2)] text-[var(--t2)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  )
}

function getToneStyle(tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral') {
  const map = {
    success: { bg: 'var(--learn-known-light)', text: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', text: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', text: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', text: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', text: 'var(--t3)' },
  }
  return map[tone]
}
