// apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx
// ACP v1.1 — 글 검수 클라이언트 (책 AdminReviewClient 미러).
//
// 구성(책 검수 페이지와 동일 골격):
//   1) 상단바: 뒤로 + 상태 + 신뢰도 + 게시 게이트(PublishControl)
//   2) 본문 리더(단일 섹션) + 푸터 액션(지금 처리·재분석 / 재처리 / 보관)
//   3) 보이스 연결 패널 (책 LibriVoxAudioPanel ↔ ArticleAudioPanel)
//   4) 학습 단어 추출 패널 + 검수 팝업 (책 BookExtractionPanel + ChapterWordSetPreviewModal)

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { classifyArticleStatus } from '@/lib/articles/types'
import type { ReviewArticle, ReviewVocab } from '@/lib/articles/review-types'
import { ArticleAudioPanel } from '@/components/admin/articles/ArticleAudioPanel'
import { ArticleExtractionPanel } from '@/components/admin/articles/ArticleExtractionPanel'

interface Props {
  article: ReviewArticle
  vocab: ReviewVocab[]
}

export function AdminArticleReviewClient({ article, vocab }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusInfo = classifyArticleStatus(article.status)
  const gate = computePublishGate(article.status, article.copyrightSafeInKr)
  const isProcessable = ['queued', 'ready', 'failed'].includes(article.status)
  const isFailed = article.status === 'failed'
  const isReady = article.status === 'ready'

  const paragraphs = useMemo(() => {
    const raw = (article.content ?? '').trim()
    if (!raw) return []
    const byBlank = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    if (byBlank.length > 1) return byBlank
    return raw.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  }, [article.content])

  async function runAction(key: string, fn: () => Promise<void>, after: 'refresh' | 'back') {
    setPending(key)
    setError(null)
    try {
      await fn()
      if (after === 'back') {
        router.push('/admin/articles')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(null)
    }
  }

  function devProcess() {
    void runAction(
      'process',
      async () => {
        const res = await fetch('/api/acp/dev-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: article.id }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      },
      'refresh',
    )
  }

  function rpcAction(name: string, key: string, after: 'refresh' | 'back') {
    void runAction(
      key,
      async () => {
        const client = createClient() as unknown as {
          rpc: (
            n: string,
            p: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>
        }
        const { error: rpcErr } = await client.rpc(name, { p_article_id: article.id })
        if (rpcErr) throw new Error(rpcErr.message)
      },
      after,
    )
  }

  return (
    <>
      {/* ── 1) 상단바 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/articles"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          글 목록으로
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
          {article.cefrConfidence != null && (
            <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
              confidence {article.cefrConfidence.toFixed(2)}
            </span>
          )}
          <PublishControl
            gate={gate}
            pending={pending === 'publish'}
            onPublish={() => rpcAction('admin_force_publish_article', 'publish', 'back')}
          />
        </div>
      </div>

      {/* ── 2) 본문 리더 (단일 섹션) ── */}
      <article className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <header className="flex flex-col gap-2 border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-[20px] font-[700] leading-tight text-[var(--t1)]">
              {article.title}
            </h1>
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-[var(--p)] hover:underline"
              >
                원본 <ExternalLink size={11} aria-hidden />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-[var(--t3)]">
            <span className="font-mono uppercase">{article.source}</span>
            {article.author && <span>· {article.author}</span>}
            <span>· CEFR {article.cefrLevel ?? '—'}</span>
            <span>· {article.wordCount?.toLocaleString() ?? '—'}단어</span>
            {article.readingMinutes ? <span>· 약 {article.readingMinutes}분</span> : null}
            <span>· {article.license}</span>
            <span className={article.copyrightSafeInKr ? 'text-[var(--learn-known)]' : 'text-[var(--learn-review)]'}>
              · {article.copyrightSafeInKr ? '저작권 게시 가능' : '저작권 확인 필요'}
            </span>
          </div>
        </header>

        <div className="px-5 py-6 md:px-8">
          {paragraphs.length === 0 ? (
            <p className="py-10 text-center font-body text-[13px] text-[var(--t3)]">
              본문이 비어 있어요. {isProcessable && '“지금 처리”로 수집/분석을 실행하세요.'}
            </p>
          ) : (
            <div className="mx-auto flex max-w-[680px] flex-col gap-4">
              {paragraphs.map((p, i) => (
                <p key={i} className="font-english text-[16px] leading-[1.85] text-[var(--t1)]">
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 액션 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
          {error ? (
            <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-[var(--learn-error)]">
              <AlertCircle size={12} aria-hidden /> {error}
            </span>
          ) : article.statusMessage ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--learn-error)]">
              <AlertCircle size={12} aria-hidden /> {article.statusMessage}
            </span>
          ) : (
            <span className="font-body text-[11px] text-[var(--t3)]">
              본문·분석을 확인한 뒤 상단에서 게시하세요.
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isProcessable && (
              <ActionButton
                icon={<Play size={12} />}
                label={isFailed ? '다시 처리' : isReady ? '재분석' : '지금 처리'}
                pending={pending === 'process'}
                onClick={devProcess}
                tone="primary"
              />
            )}
            {isFailed && (
              <ActionButton
                icon={<RefreshCw size={12} />}
                label="재처리"
                pending={pending === 'requeue'}
                onClick={() => rpcAction('admin_requeue_article', 'requeue', 'refresh')}
                tone="primary"
              />
            )}
            {article.status !== 'archived' && (
              <ActionButton
                icon={<Archive size={12} />}
                label="보관"
                pending={pending === 'archive'}
                onClick={() => rpcAction('admin_archive_article', 'archive', 'back')}
                tone="neutral"
              />
            )}
          </div>
        </div>
      </article>

      {/* ── 3) 보이스 연결 ── */}
      <ArticleAudioPanel
        articleId={article.id}
        audioUrl={article.audioUrl}
        source={article.source}
      />

      {/* ── 4) 학습 단어 추출 + 검수 팝업 ── */}
      <ArticleExtractionPanel
        title={article.title}
        cefrLevel={article.cefrLevel}
        wordCount={article.wordCount}
        readingMinutes={article.readingMinutes}
        vocab={vocab}
      />
    </>
  )
}

// ── Sub-components ───────────────────────────────

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
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  )
}

// 게시 게이트 — admin_force_publish_article 가 copyright_safe_in_kr=true 강제.
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
        title="copyright_safe 확인 후 즉시 게시 (admin_force_publish_article). 게시하면 학습자 스크립트 탭에 노출됩니다."
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[700] text-[var(--ti)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[12px] font-[600] text-[var(--t3)]"
    >
      <Ban size={12} aria-hidden />
      {GATE_REASON[gate]}
    </span>
  )
}

function StatusPill({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
  label: string
}) {
  const colorMap: Record<typeof tone, { bg: string; fg: string }> = {
    success: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', fg: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', fg: 'var(--t3)' },
  }
  const c = colorMap[tone]
  return (
    <span
      className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[700]"
      style={{ background: c.bg, color: c.fg }}
    >
      {label}
    </span>
  )
}
