// apps/web/src/app/admin/curation/preview/[bookId]/AdminReviewClient.tsx

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
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
import { AlertCircle, Archive, ArrowLeft, Ban, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
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
  /** v06.34 — chapter list 옆 원본 소스 외부링크 */
  source?: string | null
  sourceId?: string | null
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
  source,
  sourceId,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusInfo = classifyStatus(status as BookStatus)
  const publishGate = computePublishGate(status, copyrightSafeInKr)

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

        <div className="flex flex-wrap items-center gap-2">
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
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
              confidence {cefrConfidence.toFixed(2)}
            </span>
          )}
          <PublishControl
            gate={publishGate}
            pending={pending === 'publish'}
            onPublish={() => runAction('publish', () => forcePublishBook(createClient(), bookId))}
          />
        </div>
      </div>

      {/* 화면 도움말 — 검수 순서·게시 게이트·경고 임계값 */}
      <AdminScreenHelp screen="curation-preview" />

      {/* Reader */}
      <BookContentReader
        libraryBookId={bookId}
        bookTitle={title}
        bookAuthor={author}
        cefrLevel={cefrLevel}
        totalWordCount={totalWordCount}
        chapters={chapters}
        mode="admin-review"
        source={source}
        sourceId={sourceId}
        footerSlot={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? (
              <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-[var(--learn-error)]">
                <AlertCircle size={12} aria-hidden /> {error}
              </span>
            ) : (
              <span className="font-body text-[11px] text-[var(--t2)]">
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

// 게시 가능 여부 + 차단 사유 — 무음 숨김 대신 명시적 사유 표시.
type PublishGateKind = 'publishable' | 'published' | 'archived' | 'copyright' | 'processing'

function computePublishGate(status: string, copyrightSafe: boolean): PublishGateKind {
  if (status === 'published') return 'published'
  if (status === 'archived') return 'archived'
  if (!copyrightSafe) return 'copyright'
  if (status === 'ready' || status === 'failed') return 'publishable'
  return 'processing'
}

const GATE_REASON: Record<Exclude<PublishGateKind, 'publishable' | 'published'>, string> = {
  archived: '보관됨 — 게시 불가',
  copyright: '저작권 미확인 — 게시 불가',
  processing: '처리 중 — 게시 불가',
}

function PublishControl({
  gate,
  pending,
  onPublish,
}: {
  gate: PublishGateKind
  pending: boolean
  onPublish: () => void
}) {
  if (gate === 'publishable') {
    return (
      <button
        type="button"
        onClick={onPublish}
        disabled={pending}
        title="신뢰도 임계값과 무관하게 즉시 게시 (admin_force_publish_book). 게시하면 챕터 단어장이 자동 생성됩니다."
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] ease-[var(--ease)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 size={13} aria-hidden />
        )}
        게시
      </button>
    )
  }
  if (gate === 'published') {
    return (
      <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--learn-known)]/40 bg-[var(--learn-known-light)] px-3 font-display text-[12px] font-[700] text-[var(--learn-known)]">
        <CheckCircle2 size={13} aria-hidden />
        게시됨
      </span>
    )
  }
  return (
    <span
      title={GATE_REASON[gate]}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[12px] font-[600] text-[var(--t2)]"
    >
      <Ban size={12} aria-hidden />
      {GATE_REASON[gate]}
    </span>
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
