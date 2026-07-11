// apps/web/src/app/admin/articles/RssFeedTab.tsx
// ACP v1.0 — 범용 RSS feed 탭 (NASA / NIH / Simple Wikipedia / Wikinews / The Conversation 공유).
// v06.69 arxiv 제거 (사용자 명시 플랫폼 전체 삭제).
//
// VoaFeedTab 의 UX 패턴을 일반화 — 소스별 라벨/아이콘/feed 목록만 prop 으로 다름.
// URL 직접 입력 박스 + RSS 자동 목록 + 큐에 추가.

'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Calendar, CheckCircle2, ExternalLink, Link2, Loader2, Plus } from 'lucide-react'

export interface RssFeedOption {
  id: string
  label: string
}

interface FeedItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
}

interface RssFeedTabProps {
  /** enqueue source 식별자. feeds=[] 이면 URL 직접 입력 전용(예: simple_wikipedia = RSS 없음). */
  source: 'nasa' | 'nih' | 'simple_wikipedia' | 'the_conversation' | 'wikinews' | 'owid' | 'factbook' | 'elife' | 'wikipedia' | 'plos' | 'wikivoyage'
  /** 탭 헤더 라벨 (예: "🚀 NASA · Public Domain") */
  heading: string
  /** 부제 (예: "U.S. federal government · Public Domain") */
  subtitle: string
  /** feed 목록 (id + label) */
  feeds: RssFeedOption[]
  /** 우상단 아이콘 (빈 상태에서도 사용) */
  emptyIcon: LucideIcon
  /** URL 입력 검증 정규식 (예: /^https:\/\/(?:www\.)?nasa\.gov\// ) */
  urlPattern: RegExp
  /** URL 입력 안내 (예: "nasa.gov 도메인") */
  urlHostHint: string
  /** placeholder 예시 URL */
  urlPlaceholder: string
  /** 큐 추가 성공 후 콜백 (탭 전환용) */
  onEnqueued: () => void
}

export function RssFeedTab({
  source,
  heading,
  subtitle,
  feeds,
  emptyIcon: EmptyIcon,
  urlPattern,
  urlHostHint,
  urlPlaceholder,
  onEnqueued,
}: RssFeedTabProps) {
  const [feedId, setFeedId] = useState<string>(feeds[0]?.id ?? '')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enqueuing, setEnqueuing] = useState<string | null>(null)
  const [enqueued, setEnqueued] = useState<Set<string>>(new Set())

  const [urlInput, setUrlInput] = useState('')
  const [urlEnqueuing, setUrlEnqueuing] = useState(false)
  const [urlMessage, setUrlMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function loadFeed(id: string) {
    setLoading(true)
    setError(null)
    setItems([])
    try {
      const res = await fetch(`/api/admin/articles/${source}-feed?feed=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'feed 를 불러오지 못했습니다.')
        return
      }
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (feedId) loadFeed(feedId)
  }, [feedId])

  async function handleEnqueue(item: FeedItem) {
    setEnqueuing(item.source_id)
    try {
      const res = await fetch('/api/acp/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, feed_id: feedId, item_url: item.url }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(`큐 추가 실패: ${data.error ?? res.statusText}`)
        return
      }
      setEnqueued((s) => new Set(s).add(item.source_id))
      onEnqueued()
    } catch (e) {
      alert(`큐 추가 실패: ${e instanceof Error ? e.message : 'network'}`)
    } finally {
      setEnqueuing(null)
    }
  }

  async function handleUrlEnqueue() {
    const url = urlInput.trim()
    if (!url) {
      setUrlMessage({ ok: false, text: 'URL 을 입력해 주세요.' })
      return
    }
    if (!urlPattern.test(url)) {
      setUrlMessage({ ok: false, text: `${urlHostHint} URL 만 허용됩니다.` })
      return
    }
    setUrlEnqueuing(true)
    setUrlMessage(null)
    try {
      const res = await fetch('/api/acp/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, feed_id: feedId, item_url: url }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setUrlMessage({ ok: false, text: data.error ?? `HTTP ${res.status}` })
        return
      }
      setUrlMessage({ ok: true, text: `추가됨: ${data.title}` })
      setUrlInput('')
      onEnqueued()
    } catch (e) {
      setUrlMessage({ ok: false, text: e instanceof Error ? e.message : 'network' })
    } finally {
      setUrlEnqueuing(false)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label={`${source} RSS 피드`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">{heading}</h2>
          <span className="font-mono text-[12px] text-[var(--t3)]">{subtitle}</span>
        </div>
        {feeds.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${source}-feed-select`} className="font-mono text-[11px] text-[var(--t3)]">
              카테고리
            </label>
            <select
              id={`${source}-feed-select`}
              value={feedId}
              onChange={(e) => setFeedId(e.target.value)}
              className="min-h-[36px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 pr-7 font-display text-[12px] font-[600] text-[var(--t1)] hover:border-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              {feeds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
        <label
          htmlFor={`${source}-url-input`}
          className="flex items-center gap-1.5 font-display text-[12px] font-[600] text-[var(--t2)]"
        >
          <Link2 size={12} aria-hidden />
          URL 직접 입력 ({urlHostHint})
        </label>
        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id={`${source}-url-input`}
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleUrlEnqueue()
              }
            }}
            placeholder={urlPlaceholder}
            className="min-h-[36px] flex-1 min-w-[260px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-mono text-[12px] text-[var(--t1)] placeholder:text-[var(--t5)] hover:border-[var(--t3)] focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
          <button
            type="button"
            onClick={handleUrlEnqueue}
            disabled={urlEnqueuing || !urlInput.trim()}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {urlEnqueuing ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              <Plus size={12} aria-hidden />
            )}
            {urlEnqueuing ? '추가 중…' : '큐에 추가'}
          </button>
        </div>
        {urlMessage && (
          <div
            role={urlMessage.ok ? 'status' : 'alert'}
            className="flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-2 font-body text-[11px]"
            style={{
              background: urlMessage.ok ? 'var(--learn-known-light)' : 'var(--learn-error-light)',
              color: urlMessage.ok ? 'var(--learn-known)' : 'var(--learn-error)',
            }}
          >
            {urlMessage.ok ? <CheckCircle2 size={12} aria-hidden /> : <AlertCircle size={12} aria-hidden />}
            {urlMessage.text}
          </div>
        )}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
        RSS 카테고리 (자동 목록)
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <ErrorBox message={error} />
      ) : items.length === 0 ? (
        <EmptyBox Icon={EmptyIcon} />
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {items.map((item) => {
            const isEnqueued = enqueued.has(item.source_id)
            const isEnqueuing = enqueuing === item.source_id
            return (
              <li
                key={item.source_id}
                className="flex flex-col gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-display text-[14px] font-[600] text-[var(--t1)]">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 font-body text-[12px] text-[var(--t3)]">
                      {item.description || '(설명 없음)'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-mono text-[10px] text-[var(--t2)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                      aria-label="원본 새 탭에서 열기"
                    >
                      원본
                      <ExternalLink size={10} aria-hidden />
                    </a>
                    {isEnqueued ? (
                      <span className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 font-display text-[11px] font-[600] text-[var(--learn-known)]">
                        <CheckCircle2 size={12} aria-hidden /> 추가됨
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEnqueue(item)}
                        disabled={isEnqueuing}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] bg-[var(--p)] px-3 font-display text-[11px] font-[600] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isEnqueuing ? (
                          <Loader2 size={12} className="animate-spin" aria-hidden />
                        ) : (
                          <Plus size={12} aria-hidden />
                        )}
                        {isEnqueuing ? '추가 중…' : '큐에 추가'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--t5)]">
                  {item.published_at && (
                    <span className="inline-flex items-center gap-0.5">
                      <Calendar size={9} aria-hidden />
                      {item.published_at.slice(0, 10)}
                    </span>
                  )}
                  <span className="truncate">{item.source_id}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]" />
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--learn-error)]/30 bg-[var(--learn-error-light)] p-3"
    >
      <AlertCircle size={14} className="shrink-0 text-[var(--learn-error)]" aria-hidden />
      <span className="font-body text-[12px] text-[var(--learn-error)]">{message}</span>
    </div>
  )
}

function EmptyBox({ Icon }: { Icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
      <Icon size={28} className="text-[var(--t3)]" aria-hidden />
      <p className="font-body text-[12px] text-[var(--t3)]">이 카테고리에서 가져올 기사가 없어요.</p>
    </div>
  )
}
