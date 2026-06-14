// apps/web/src/app/admin/articles/CuratedArticlesTab.tsx
// ACP v1.0 Phase 18 — Curated Articles 목록 + dev-process / publish / archive 액션

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, SearchCheck } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { ArticleAdminRow, ArticleStatus } from '@/lib/articles/types'
import { classifyArticleStatus } from '@/lib/articles/types'

interface Props {
  articles: ArticleAdminRow[]
  onChanged: () => void
}

type StatusFilter = 'all' | 'in_progress' | 'ready' | 'published' | 'failed' | 'archived'

const IN_PROGRESS: ArticleStatus[] = ['queued', 'ingesting', 'normalizing', 'analyzing', 'curating']

export function CuratedArticlesTab({ articles, onChanged }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [pending, setPending] = useState<string | null>(null)

  const visible = useMemo(() => {
    if (filter === 'all') return articles
    if (filter === 'in_progress') return articles.filter((a) => IN_PROGRESS.includes(a.status))
    return articles.filter((a) => a.status === filter)
  }, [articles, filter])

  async function runAction(actionLabel: string, fn: () => Promise<void>) {
    setPending(actionLabel)
    try {
      await fn()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(null)
    }
  }

  async function devProcess(id: string) {
    await runAction(`dev:${id}`, async () => {
      const res = await fetch('/api/acp/dev-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    })
  }

  // v06.56 — admin_force_publish_article 등 SECURITY DEFINER RPC 는 DEV_ADMIN_BYPASS=1
  //   환경에서 auth.uid()=NULL → is_admin_or_curator()=false → "Forbidden". 서버 API
  //   route 경유로 전환 (requireAdmin + service_role 패턴). 다른 RPC (보관/되돌리기 등)
  //   는 같은 함정 잠재하나 호출 시점에 별도 라우트 신설.
  const RPC_ROUTE: Record<string, string> = {
    admin_force_publish_article: '/api/admin/articles/force-publish',
  }
  async function rpcAction(name: string, id: string, actionLabel: string) {
    await runAction(actionLabel, async () => {
      const route = RPC_ROUTE[name]
      if (route) {
        const res = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          message?: string
          ok?: boolean
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
        }
        return
      }
      // 그 외 액션은 기존 browser RPC 유지 (향후 같은 패턴 적용 가능).
      const client = createClient() as unknown as {
        rpc: (
          n: string,
          p: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>
      }
      const { error } = await client.rpc(name, { p_article_id: id })
      if (error) throw new Error(error.message)
    })
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Curated Articles">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            📂 Curated Articles
          </h2>
          <span className="font-mono text-[12px] text-[var(--t3)]">
            {visible.length === articles.length
              ? `${articles.length}건`
              : `${visible.length} / ${articles.length}건`}
          </span>
        </div>
        <FilterChips filter={filter} setFilter={setFilter} articles={articles} />
      </div>

      {visible.length === 0 ? (
        <EmptyBox onReset={() => setFilter('all')} hasAny={articles.length > 0} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-[var(--bd)] bg-[var(--bg2)]">
              <tr>
                <Th>제목</Th>
                <Th align="center">소스</Th>
                <Th align="center">상태</Th>
                <Th align="center">CEFR</Th>
                <Th align="right">단어</Th>
                <Th align="right">발행</Th>
                <Th align="right" srOnly>액션</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const info = classifyArticleStatus(a.status)
                const isProcessable = ['queued', 'ready', 'failed'].includes(a.status)
                const isFailed = a.status === 'failed'
                const isReady = a.status === 'ready'
                const devKey = `dev:${a.id}`
                const requeueKey = `requeue:${a.id}`
                const publishKey = `publish:${a.id}`
                const archiveKey = `archive:${a.id}`

                return (
                  <tr
                    key={a.id}
                    className="border-t border-[var(--bd)] transition-colors hover:bg-[var(--bg2)]"
                  >
                    <Td>
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/admin/articles/preview/${a.id}`}
                          className="line-clamp-1 font-display text-[13px] font-[600] text-[var(--t1)] hover:text-[var(--p)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                        >
                          {a.title}
                        </Link>
                        {a.author && (
                          <span className="line-clamp-1 font-body text-[11px] text-[var(--t3)]">
                            {a.author}
                          </span>
                        )}
                        {a.status_message && (
                          <span className="line-clamp-1 font-mono text-[10px] text-[var(--learn-error)]">
                            {a.status_message}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td align="center">
                      <span className="font-mono text-[10px] uppercase text-[var(--t2)]">
                        {a.source}
                      </span>
                    </Td>
                    <Td align="center">
                      <StatusPill tone={info.tone} label={info.label} />
                    </Td>
                    <Td align="center">
                      <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                        {a.cefr_level ?? '—'}
                        {a.cefr_confidence != null && (
                          <span className="ml-1 text-[var(--t5)]">
                            ({a.cefr_confidence.toFixed(2)})
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                        {a.word_count?.toLocaleString() ?? '—'}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[10px] text-[var(--t3)]">
                        {a.published_at ? a.published_at.slice(0, 10) : '—'}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/articles/preview/${a.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--p)] px-2 font-display text-[10px] font-[600] text-[var(--p)] transition-colors hover:bg-[var(--p)] hover:text-[var(--ti)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                          aria-label="글 검수 페이지 열기"
                        >
                          <SearchCheck size={11} aria-hidden />
                          검수
                        </Link>
                        {a.source_url && (
                          <a
                            href={a.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 items-center gap-0.5 rounded-[var(--r-sm)] border border-[var(--bd)] px-2 font-mono text-[10px] text-[var(--t2)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                            aria-label="원본 새 탭에서 열기"
                          >
                            <ExternalLink size={10} aria-hidden />
                          </a>
                        )}
                        {isProcessable && (
                          <ActionBtn
                            label="지금 처리"
                            icon={<Play size={11} />}
                            pending={pending === devKey}
                            onClick={() => devProcess(a.id)}
                            tone="primary"
                          />
                        )}
                        {isReady && (
                          <ActionBtn
                            label="게시"
                            icon={<CheckCircle2 size={11} />}
                            pending={pending === publishKey}
                            onClick={() =>
                              rpcAction('admin_force_publish_article', a.id, publishKey)
                            }
                            tone="success"
                          />
                        )}
                        {isFailed && (
                          <ActionBtn
                            label="재처리"
                            icon={<RefreshCw size={11} />}
                            pending={pending === requeueKey}
                            onClick={() => rpcAction('admin_requeue_article', a.id, requeueKey)}
                            tone="primary"
                          />
                        )}
                        {a.status !== 'archived' && (
                          <ActionBtn
                            label="보관"
                            icon={<Archive size={11} />}
                            pending={pending === archiveKey}
                            onClick={() => rpcAction('admin_archive_article', a.id, archiveKey)}
                            tone="neutral"
                          />
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Sub-components ───────────────────────────────

function FilterChips({
  filter,
  setFilter,
  articles,
}: {
  filter: StatusFilter
  setFilter: (f: StatusFilter) => void
  articles: ArticleAdminRow[]
}) {
  const options: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'in_progress', label: '처리 중' },
    { value: 'ready', label: '검토 대기' },
    { value: 'published', label: '게시됨' },
    { value: 'failed', label: '실패' },
    { value: 'archived', label: '보관됨' },
  ]
  return (
    <div
      role="radiogroup"
      className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-0.5"
    >
      {options.map((opt) => {
        const active = filter === opt.value
        const count =
          opt.value === 'all'
            ? articles.length
            : opt.value === 'in_progress'
              ? articles.filter((a) => IN_PROGRESS.includes(a.status)).length
              : articles.filter((a) => a.status === opt.value).length
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setFilter(opt.value)}
            className={[
              'rounded-[var(--r-sm)] px-3 py-1 font-display text-[11px] font-[600] transition-colors duration-[var(--dur-normal)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
                : 'text-[var(--t3)] hover:text-[var(--t2)]',
            ].join(' ')}
          >
            {opt.label}
            {count > 0 && <span className="ml-1 font-mono text-[10px] text-[var(--t3)]">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

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
      className={`inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[10px] font-[600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 size={11} className="animate-spin" aria-hidden /> : icon}
      {label}
    </button>
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

function Th({
  children,
  align = 'left',
  srOnly,
}: {
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
  srOnly?: boolean
}) {
  return (
    <th
      scope="col"
      className={[
        'px-3 py-2',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        'font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]',
      ].join(' ')}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <td
      className={[
        'px-3 py-2.5',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </td>
  )
}

function EmptyBox({ onReset, hasAny }: { onReset: () => void; hasAny: boolean }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
    >
      <div className="select-none text-2xl" aria-hidden>
        {hasAny ? '🔍' : '📭'}
      </div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
        {hasAny ? '필터에 해당하는 글이 없어요' : '아직 추가된 글이 없어요'}
      </h3>
      {hasAny ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-1.5 font-display text-[11px] font-[600] text-[var(--ti)] hover:bg-[var(--p-hover)]"
        >
          필터 초기화
        </button>
      ) : (
        <p className="font-body text-[12px] text-[var(--t3)]">
          VOA RSS 탭에서 기사를 골라 큐에 추가하세요.
        </p>
      )}
    </div>
  )
}
