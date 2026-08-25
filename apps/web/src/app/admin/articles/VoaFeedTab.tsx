// apps/web/src/app/admin/articles/VoaFeedTab.tsx
// ACP v1.0 Phase 18 — VOA RSS 카테고리 선택 + 최근 기사 목록 + 큐 추가

'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Calendar, CheckCircle2, ExternalLink, Link2, Loader2, Plus, Radio } from 'lucide-react'

interface FeedOption {
  id: string
  label: string
  level: 1 | 2 | 3
}

const FEEDS: FeedOption[] = [
  { id: 'lets-learn-english', label: "Let's Learn English (Level 1)", level: 1 },
  { id: 'as-it-is', label: 'As It Is (Level 2)', level: 2 },
  { id: 'science-technology', label: 'Science & Technology (Level 2)', level: 2 },
  { id: 'words-and-their-stories', label: 'Words and Their Stories (Level 3)', level: 3 },
  // P2 — register gap 보강 (서사 + 설명문)
  { id: 'american-stories', label: 'American Stories (Level 3)', level: 3 },
  { id: 'health-lifestyle', label: 'Health & Lifestyle (Level 2)', level: 2 },
]

interface FeedItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
}

interface VoaFeedTabProps {
  onEnqueued: () => void
}

export function VoaFeedTab({ onEnqueued }: VoaFeedTabProps) {
  const [feedId, setFeedId] = useState<string>(FEEDS[1]!.id)
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enqueuing, setEnqueuing] = useState<string | null>(null)
  const [enqueued, setEnqueued] = useState<Set<string>>(new Set())

  // 직접 URL 입력 모드 (RSS 차단 시 fallback)
  const [urlInput, setUrlInput] = useState('')
  const [urlEnqueuing, setUrlEnqueuing] = useState(false)
  const [urlMessage, setUrlMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function loadFeed(id: string) {
    setLoading(true)
    setError(null)
    setItems([])
    try {
      const res = await fetch(`/api/admin/articles/voa-feed?feed=${encodeURIComponent(id)}`)
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
    loadFeed(feedId)
  }, [feedId])

  async function handleEnqueue(item: FeedItem) {
    setEnqueuing(item.source_id)
    try {
      const res = await fetch('/api/acp/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: feedId, item_url: item.url }),
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
    if (!/^https:\/\/learningenglish\.voanews\.com\//.test(url)) {
      setUrlMessage({
        ok: false,
        text: 'learningenglish.voanews.com 도메인 URL 만 허용됩니다.',
      })
      return
    }
    setUrlEnqueuing(true)
    setUrlMessage(null)
    try {
      const res = await fetch('/api/acp/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: feedId, item_url: url }),
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
    <section className="flex flex-col gap-4" aria-label="VOA RSS 카테고리 & 항목">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            📻 VOA Learning English
          </h2>
          <span className="font-mono text-[12px] text-[var(--t2)]">
            U.S. federal government · Public Domain
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="voa-feed-select" className="font-mono text-[11px] text-[var(--t2)]">
            카테고리
          </label>
          <select
            id="voa-feed-select"
            value={feedId}
            onChange={(e) => setFeedId(e.target.value)}
            className="min-h-[36px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 pr-7 font-display text-[12px] font-[600] text-[var(--t1)] hover:border-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {FEEDS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 직접 URL 입력 — RSS 차단 또는 특정 기사 빠른 추가용 */}
      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
        <label
          htmlFor="voa-url-input"
          className="flex items-center gap-2 font-display text-[12px] font-[600] text-[var(--t2)]"
        >
          <Link2 size={12} aria-hidden />
          URL 직접 입력 (RSS 와 별개로 즉시 큐 추가)
        </label>
        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id="voa-url-input"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleUrlEnqueue()
              }
            }}
            placeholder="https://learningenglish.voanews.com/a/.../<id>.html"
            className="min-h-[36px] flex-1 min-w-[260px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-mono text-[12px] text-[var(--t1)] placeholder:text-[var(--t5)] hover:border-[var(--t3)] focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
          <button
            type="button"
            onClick={handleUrlEnqueue}
            disabled={urlEnqueuing || !urlInput.trim()}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex items-center gap-2 rounded-[var(--r-sm)] px-3 py-2 font-body text-[11px]"
            style={{
              background: urlMessage.ok ? 'var(--learn-known-light)' : 'var(--learn-error-light)',
              color: urlMessage.ok ? 'var(--learn-known)' : 'var(--learn-error)',
            }}
          >
            {urlMessage.ok ? (
              <CheckCircle2 size={12} aria-hidden />
            ) : (
              <AlertCircle size={12} aria-hidden />
            )}
            {urlMessage.text}
          </div>
        )}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
        RSS 카테고리 (자동 목록)
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <ErrorBox message={error} />
      ) : items.length === 0 ? (
        <EmptyBox />
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {items.map((item) => {
            const isEnqueued = enqueued.has(item.source_id)
            const isEnqueuing = enqueuing === item.source_id
            return (
              <li
                key={item.source_id}
                className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-display text-[14px] font-[600] text-[var(--t1)]">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 font-body text-[12px] text-[var(--t2)]">
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
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] bg-[var(--p)] px-3 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <span className="inline-flex items-center gap-1">
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
        <div
          key={i}
          className="h-20 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
        />
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

function EmptyBox() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
      <Radio size={28} className="text-[var(--t2)]" aria-hidden />
      <p className="font-body text-[12px] text-[var(--t2)]">
        이 카테고리에서 가져올 기사가 없어요.
      </p>
    </div>
  )
}
