// apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx
// ACP v1.1 — 글 검수 클라이언트 (본문 정독 + 분석 확인 + 큐레이션 액션)
//
// 책 검수(AdminReviewClient)와 동일한 read → analyze → curate 흐름을 글에 적용:
//   - 좌: 본문 리더 (정독)
//   - 우: 분석 사이드바 (CEFR / 단어 수 / 읽기 시간 / 저작권 / 상위 학습 단어)
//   - 상단: 큐레이션 액션 (지금 처리 / 게시 / 보관 / 재처리)

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { classifyArticleStatus, type ArticleStatus } from '@/lib/articles/types'

export interface ReviewVocab {
  word: string
  firstSentence: string | null
  baseLearningValue: number | null
  frequency: number | null
  meaningKo: string | null
  cefrLevel: string | null
  vLevel: number | null
}

interface ReviewArticle {
  id: string
  source: string
  sourceId: string
  sourceUrl: string | null
  title: string
  author: string | null
  cefrLevel: string | null
  cefrConfidence: number | null
  wordCount: number | null
  readingMinutes: number | null
  status: ArticleStatus
  statusMessage: string | null
  license: string
  copyrightSafeInKr: boolean
  publishedAt: string | null
  llmCostUsd: string | null
  content: string | null
  createdAt: string
}

interface Props {
  article: ReviewArticle
  vocab: ReviewVocab[]
  vocabTotal: number
}

export function AdminArticleReviewClient({ article, vocab, vocabTotal }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  const statusInfo = classifyArticleStatus(article.status)
  const isProcessable = ['queued', 'ready', 'failed'].includes(article.status)
  const isReady = article.status === 'ready'
  const isFailed = article.status === 'failed'
  const isPublished = article.status === 'published'
  const isAnalyzed = ['ready', 'published'].includes(article.status)

  // 본문 → 문단 분할 (정규화 전 raw content — 빈 줄/단일 줄 모두 대응)
  const paragraphs = useMemo(() => {
    const raw = (article.content ?? '').trim()
    if (!raw) return []
    const byBlank = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    if (byBlank.length > 1) return byBlank
    return raw.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  }, [article.content])

  async function runAction(key: string, fn: () => Promise<void>, after: 'refresh' | 'back') {
    setPending(key)
    try {
      await fn()
      if (after === 'back') {
        router.push('/admin/articles')
        router.refresh()
      } else {
        router.refresh()
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
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
        const { error } = await client.rpc(name, { p_article_id: article.id })
        if (error) throw new Error(error.message)
      },
      after,
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      {/* ── 헤더: 뒤로 + 제목 + 상태 + 액션 ── */}
      <header className="flex flex-col gap-3 border-b border-[var(--bd)] pb-4">
        <Link
          href="/admin/articles"
          className="inline-flex w-fit items-center gap-1.5 font-display text-[12px] font-[600] text-[var(--t3)] transition-colors hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          글 목록으로
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[22px] font-[700] leading-tight text-[var(--t1)]">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
              <span className="font-mono uppercase text-[var(--t3)]">{article.source}</span>
              {article.author && (
                <span className="font-body text-[var(--t2)]">· {article.author}</span>
              )}
              {article.sourceUrl && (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[var(--p)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                >
                  원본 <ExternalLink size={11} aria-hidden />
                </a>
              )}
            </div>
          </div>

          {/* ── 큐레이션 액션 ── */}
          <div className="flex flex-wrap items-center gap-2">
            {isProcessable && (
              <ActionBtn
                label={isFailed ? '다시 처리' : isReady ? '재분석' : '지금 처리'}
                icon={<Play size={13} aria-hidden />}
                pending={pending === 'process'}
                onClick={devProcess}
                tone="primary"
              />
            )}
            {isReady && (
              <ActionBtn
                label="게시"
                icon={<CheckCircle2 size={13} aria-hidden />}
                pending={pending === 'publish'}
                onClick={() => rpcAction('admin_force_publish_article', 'publish', 'back')}
                tone="success"
              />
            )}
            {isFailed && (
              <ActionBtn
                label="재처리"
                icon={<RefreshCw size={13} aria-hidden />}
                pending={pending === 'requeue'}
                onClick={() => rpcAction('admin_requeue_article', 'requeue', 'refresh')}
                tone="primary"
              />
            )}
            {article.status !== 'archived' && (
              <ActionBtn
                label="보관"
                icon={<Archive size={13} aria-hidden />}
                pending={pending === 'archive'}
                onClick={() => rpcAction('admin_archive_article', 'archive', 'back')}
                tone="neutral"
              />
            )}
          </div>
        </div>

        {article.statusMessage && (
          <p className="rounded-[var(--r-sm)] border border-[var(--learn-error-light)] bg-[var(--learn-error-light)] px-3 py-2 font-mono text-[11px] text-[var(--learn-error)]">
            {article.statusMessage}
          </p>
        )}
      </header>

      {/* ── 본문(좌) + 분석(우) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* 본문 리더 */}
        <article className="order-2 lg:order-1">
          {paragraphs.length === 0 ? (
            <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center">
              <p className="font-body text-[13px] text-[var(--t3)]">
                본문이 비어 있어요. {isProcessable && '“지금 처리”로 수집/분석을 실행하세요.'}
              </p>
            </div>
          ) : (
            <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-8">
              <div className="mx-auto flex max-w-[680px] flex-col gap-4">
                {paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="font-english text-[16px] leading-[1.85] text-[var(--t1)]"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* 분석 사이드바 */}
        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          {/* CEFR 카드 */}
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
            <h2 className="mb-3 font-display text-[12px] font-[700] uppercase tracking-wider text-[var(--t3)]">
              분석
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="CEFR"
                value={article.cefrLevel ?? '—'}
                sub={
                  article.cefrConfidence != null
                    ? `신뢰 ${(article.cefrConfidence * 100).toFixed(0)}%`
                    : undefined
                }
                big
              />
              <Metric
                label="단어 수"
                value={article.wordCount?.toLocaleString() ?? '—'}
                sub={article.readingMinutes ? `약 ${article.readingMinutes}분` : undefined}
                big
              />
              <Metric label="추출 단어" value={vocabTotal.toLocaleString()} />
              <Metric
                label="분석 비용"
                value={
                  article.llmCostUsd && Number(article.llmCostUsd) > 0
                    ? `$${Number(article.llmCostUsd).toFixed(4)}`
                    : '$0'
                }
              />
            </div>
            {!isAnalyzed && (
              <p className="mt-3 rounded-[var(--r-sm)] bg-[var(--bg)] px-2.5 py-2 font-body text-[11px] text-[var(--t3)]">
                아직 분석 전이에요. “지금 처리”를 실행하면 CEFR·단어가 채워져요.
              </p>
            )}
          </div>

          {/* 저작권 / 라이선스 */}
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
            <h2 className="mb-2.5 font-display text-[12px] font-[700] uppercase tracking-wider text-[var(--t3)]">
              메타
            </h2>
            <dl className="flex flex-col gap-2 text-[12px]">
              <MetaRow label="라이선스" value={article.license} mono />
              <div className="flex items-center justify-between">
                <dt className="font-body text-[var(--t3)]">저작권</dt>
                <dd>
                  {article.copyrightSafeInKr ? (
                    <span className="inline-flex items-center gap-1 font-display text-[11px] font-[600] text-[var(--learn-known)]">
                      <ShieldCheck size={13} aria-hidden /> 게시 가능
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-display text-[11px] font-[600] text-[var(--learn-review)]">
                      <ShieldAlert size={13} aria-hidden /> 확인 필요
                    </span>
                  )}
                </dd>
              </div>
              <MetaRow
                label="게시일"
                value={article.publishedAt ? article.publishedAt.slice(0, 10) : '—'}
                mono
              />
              <MetaRow label="수집일" value={article.createdAt.slice(0, 10)} mono />
              <MetaRow label="source id" value={article.sourceId} mono truncate />
            </dl>
          </div>

          {/* 게시 게이트 안내 */}
          {!isPublished && (
            <div
              className={[
                'rounded-[var(--r-md)] border p-3 text-[11px] font-body leading-relaxed',
                isReady
                  ? 'border-[var(--learn-known)] bg-[var(--learn-known-light)] text-[var(--learn-known)]'
                  : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t3)]',
              ].join(' ')}
            >
              {isReady
                ? '✓ 검토 대기 — 본문·분석 확인 후 “게시”를 누르면 학습자에게 공개돼요.'
                : '본문/분석을 확인하려면 먼저 “지금 처리”로 파이프라인을 실행하세요.'}
            </div>
          )}
        </aside>
      </div>

      {/* ── 상위 학습 단어 (검수) ── */}
      {vocab.length > 0 && (
        <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[12px] font-[700] uppercase tracking-wider text-[var(--t3)]">
              상위 학습 단어
            </h2>
            <span className="font-mono text-[11px] text-[var(--t3)]">
              상위 {vocab.length} / 전체 {vocabTotal.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-[var(--bd)]">
                <tr>
                  <VTh>단어</VTh>
                  <VTh>뜻</VTh>
                  <VTh align="center">CEFR</VTh>
                  <VTh align="center">V</VTh>
                  <VTh align="right">빈도</VTh>
                  <VTh align="right">LV</VTh>
                </tr>
              </thead>
              <tbody>
                {vocab.map((v) => (
                  <tr key={v.word} className="border-t border-[var(--bd)]">
                    <td className="px-3 py-2 font-english text-[13px] font-[600] text-[var(--t1)]">
                      {v.word}
                    </td>
                    <td className="px-3 py-2 font-body text-[12px] text-[var(--t2)]">
                      <span className="line-clamp-1">{v.meaningKo ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--t2)]">
                      {v.cefrLevel ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--t2)]">
                      {v.vLevel != null ? `V${v.vLevel}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-[var(--t3)]">
                      {v.frequency ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-[var(--t3)]">
                      {v.baseLearningValue != null ? v.baseLearningValue.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────

function ActionBtn({
  label,
  icon,
  pending,
  onClick,
  tone,
}: {
  label: string
  icon: React.ReactNode
  pending: boolean
  onClick: () => void
  tone: 'primary' | 'success' | 'neutral'
}) {
  const cls =
    tone === 'primary'
      ? 'bg-[var(--p)] hover:bg-[var(--p-hover)] text-[var(--ti)]'
      : tone === 'success'
        ? 'bg-[var(--learn-known)] hover:opacity-90 text-white'
        : 'border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--bg2)] text-[var(--t2)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--r-sm)] px-3.5 font-display text-[12px] font-[600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  )
}

function Metric({
  label,
  value,
  sub,
  big,
}: {
  label: string
  value: string
  sub?: string
  big?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--r-sm)] bg-[var(--bg)] px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
        {label}
      </span>
      <span
        className={[
          'font-display font-[700] tabular-nums text-[var(--t1)]',
          big ? 'text-[18px]' : 'text-[14px]',
        ].join(' ')}
      >
        {value}
      </span>
      {sub && <span className="font-mono text-[10px] text-[var(--t3)]">{sub}</span>}
    </div>
  )
}

function MetaRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string
  value: string
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 font-body text-[var(--t3)]">{label}</dt>
      <dd
        className={[
          mono ? 'font-mono text-[11px]' : 'font-body',
          truncate ? 'truncate' : '',
          'text-[var(--t2)]',
        ].join(' ')}
        title={truncate ? value : undefined}
      >
        {value}
      </dd>
    </div>
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

function VTh({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <th
      scope="col"
      className={[
        'px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  )
}
