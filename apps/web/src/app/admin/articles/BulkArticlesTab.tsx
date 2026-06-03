// apps/web/src/app/admin/articles/BulkArticlesTab.tsx
//
// v06.34 — LCP 대량 GET 탭 (Article 버전).
// 도서 BulkFetchTab 의 article 변형 — 여러 source × feed 자동 순회 +
// 결과 통합 list + checkbox 일괄 enqueue.
//
// 사용 흐름:
//   1. 소스 선택 (VOA / NASA / NIH / arXiv — multi 체크박스)
//   2. 각 소스의 모든 feed 를 Promise.allSettled 순회
//   3. 결과 통합 list (소스/카테고리/제목/발행일/설명)
//   4. 체크박스 선택 → 일괄 enqueue
//
// 외부 API 실패 처리: 실패한 feed 는 표시만 (전체 중단 X).

'use client'

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FlaskConical,
  Loader2,
  Plus,
  Radio,
  Rocket,
  Beaker,
} from 'lucide-react'
import { useState } from 'react'

interface FeedItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
}

interface BulkRow extends FeedItem {
  source: SourceKey
  feed_id: string
  feed_label: string
}

interface FeedConfig {
  id: string
  label: string
}

interface SourceConfig {
  key: SourceKey
  label: string
  Icon: typeof Radio
  color: string
  feeds: FeedConfig[]
}

type SourceKey = 'voa' | 'nasa' | 'nih' | 'arxiv'

const SOURCES: SourceConfig[] = [
  {
    key: 'voa',
    label: 'VOA',
    Icon: Radio,
    color: 'var(--p)',
    feeds: [
      { id: 'as-it-is', label: 'As It Is (L2)' },
      { id: 'words-and-their-stories', label: 'Words & Stories (L3)' },
      { id: 'science-technology', label: 'Science & Tech (L2)' },
      { id: 'lets-learn-english', label: "Let's Learn English (L1)" },
    ],
  },
  {
    key: 'nasa',
    label: 'NASA',
    Icon: Rocket,
    color: 'var(--learn-known)',
    feeds: [
      { id: 'news', label: 'News Releases' },
      { id: 'apod', label: 'APOD' },
      { id: 'iotd', label: 'Image of the Day' },
    ],
  },
  {
    key: 'nih',
    label: 'NIH',
    Icon: FlaskConical,
    color: 'var(--info)',
    feeds: [
      { id: 'news', label: 'News Releases' },
      { id: 'medlineplus', label: 'MedlinePlus' },
      { id: 'directors-blog', label: "Director's Blog" },
    ],
  },
  {
    key: 'arxiv',
    label: 'arXiv',
    Icon: Beaker,
    color: 'var(--active)',
    feeds: [
      { id: 'cs-AI', label: 'CS — AI' },
      { id: 'cs-CL', label: 'CS — NLP' },
      { id: 'cs-LG', label: 'CS — ML' },
      { id: 'q-bio', label: 'Quantitative Biology' },
      { id: 'math-HO', label: 'Math History' },
      { id: 'physics-gen-ph', label: 'Physics General' },
    ],
  },
]

interface Props {
  onEnqueued: () => void
}

export function BulkArticlesTab({ onEnqueued }: Props) {
  // 선택된 소스
  const [selectedSources, setSelectedSources] = useState<Set<SourceKey>>(
    new Set(['voa', 'nasa', 'nih', 'arxiv']),
  )
  // 결과
  const [rows, setRows] = useState<BulkRow[]>([])
  const [failedFeeds, setFailedFeeds] = useState<
    Array<{ source: SourceKey; feed_id: string; feed_label: string; error: string }>
  >([])
  const [fetching, setFetching] = useState(false)
  // 선택된 항목
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // 큐 추가 진행
  const [enqueuing, setEnqueuing] = useState(false)
  const [enqueueResult, setEnqueueResult] = useState<{
    ok: number
    fail: number
    failedReasons: string[]
  } | null>(null)
  const [enqueuedKeys, setEnqueuedKeys] = useState<Set<string>>(new Set())

  // 소스 토글
  const toggleSource = (key: SourceKey) => {
    setSelected(new Set())
    setEnqueueResult(null)
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 모든 feed 순회
  async function handleBulkFetch() {
    setFetching(true)
    setEnqueueResult(null)
    setRows([])
    setFailedFeeds([])
    setSelected(new Set())

    const feedsToFetch: Array<{ source: SourceKey; feed: FeedConfig }> = []
    for (const s of SOURCES) {
      if (!selectedSources.has(s.key)) continue
      for (const f of s.feeds) feedsToFetch.push({ source: s.key, feed: f })
    }

    const results = await Promise.allSettled(
      feedsToFetch.map(async ({ source, feed }) => {
        const res = await fetch(
          `/api/admin/articles/${source}-feed?feed=${encodeURIComponent(feed.id)}`,
        )
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message ?? `HTTP ${res.status}`)
        }
        return { source, feed_id: feed.id, feed_label: feed.label, items: (data.items ?? []) as FeedItem[] }
      }),
    )

    const accRows: BulkRow[] = []
    const accFail: typeof failedFeeds = []

    results.forEach((r, idx) => {
      const { source, feed } = feedsToFetch[idx]!
      if (r.status === 'fulfilled') {
        for (const item of r.value.items) {
          accRows.push({
            ...item,
            source,
            feed_id: feed.id,
            feed_label: feed.label,
          })
        }
      } else {
        accFail.push({
          source,
          feed_id: feed.id,
          feed_label: feed.label,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        })
      }
    })

    // 최신순 정렬 (published_at 내림차순)
    accRows.sort((a, b) => {
      const pa = a.published_at ?? ''
      const pb = b.published_at ?? ''
      return pb.localeCompare(pa)
    })

    setRows(accRows)
    setFailedFeeds(accFail)
    setFetching(false)
  }

  // row 선택 토글
  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 전체 선택 / 해제
  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map(rowKey)))
    }
  }

  // 일괄 큐 추가
  async function handleBulkEnqueue() {
    setEnqueuing(true)
    setEnqueueResult(null)

    const toEnqueue = rows.filter((r) => selected.has(rowKey(r)) && !enqueuedKeys.has(rowKey(r)))

    let ok = 0
    let fail = 0
    const failedReasons: string[] = []
    const newEnqueued = new Set(enqueuedKeys)

    for (const r of toEnqueue) {
      try {
        const res = await fetch('/api/acp/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feed_id: r.feed_id, item_url: r.url }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          fail++
          failedReasons.push(`${r.title.slice(0, 30)}: ${data.error ?? res.statusText}`)
        } else {
          ok++
          newEnqueued.add(rowKey(r))
        }
      } catch (e) {
        fail++
        failedReasons.push(`${r.title.slice(0, 30)}: ${e instanceof Error ? e.message : 'network'}`)
      }
    }

    setEnqueuedKeys(newEnqueued)
    setEnqueueResult({ ok, fail, failedReasons: failedReasons.slice(0, 5) })
    setEnqueuing(false)
    if (ok > 0) onEnqueued()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--bd)] pb-3">
        <div className="flex items-baseline gap-2.5">
          <Download size={14} className="self-center text-[var(--p)]" aria-hidden />
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            LCP 대량 GET
          </h2>
          <span className="font-body text-[12px] text-[var(--t3)]">
            여러 소스 · 모든 카테고리 한 번에
          </span>
        </div>
      </header>

      {/* 소스 선택 */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-3 font-display text-[13px] font-[700] text-[var(--t1)]">
          소스 선택 (multi)
        </h3>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => {
            const active = selectedSources.has(s.key)
            const Icon = s.Icon
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSource(s.key)}
                disabled={fetching}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 font-display text-[12px] font-[600] transition-all"
                style={{
                  background: active ? `color-mix(in srgb, ${s.color} 14%, transparent)` : 'var(--bg)',
                  borderColor: active ? s.color : 'var(--bd)',
                  color: active ? s.color : 'var(--t3)',
                }}
              >
                <Icon size={12} />
                {s.label}
                <span className="font-mono text-[10px] opacity-70">({s.feeds.length})</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleBulkFetch}
          disabled={fetching || selectedSources.size === 0}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
        >
          {fetching ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          {fetching
            ? '가져오는 중…'
            : `${[...selectedSources].length} 소스 · ${countFeeds(selectedSources)} 카테고리 일괄 가져오기`}
        </button>
      </section>

      {/* 실패한 feed 안내 */}
      {failedFeeds.length > 0 && (
        <section className="rounded-[var(--r-sm)] border border-[var(--learn-review)] bg-[var(--learn-review-light)] p-3">
          <h3 className="mb-1.5 inline-flex items-center gap-1.5 font-display text-[12px] font-[700] text-[var(--learn-review)]">
            <AlertCircle size={12} />
            가져오지 못한 카테고리 {failedFeeds.length}개
          </h3>
          <ul className="space-y-0.5 font-mono text-[10.5px] text-[var(--learn-review)]">
            {failedFeeds.slice(0, 6).map((f, i) => (
              <li key={i}>
                {SOURCES.find((s) => s.key === f.source)?.label} · {f.feed_label} —{' '}
                <span className="opacity-80">{f.error.slice(0, 80)}</span>
              </li>
            ))}
            {failedFeeds.length > 6 && (
              <li className="opacity-60">… 외 {failedFeeds.length - 6}건</li>
            )}
          </ul>
        </section>
      )}

      {/* enqueue 결과 */}
      {enqueueResult && (
        <section
          className="rounded-[var(--r-sm)] border p-3"
          style={{
            background: enqueueResult.fail > 0 ? 'var(--learn-review-light)' : 'var(--learn-known-light)',
            borderColor: enqueueResult.fail > 0 ? 'var(--learn-review)' : 'var(--learn-known)',
          }}
        >
          <div className="flex items-center gap-2 font-mono text-[11.5px]">
            <CheckCircle2 size={13} className="text-[var(--learn-known)]" />
            큐 추가{' '}
            <strong className="text-[var(--learn-known)]">{enqueueResult.ok}</strong>건 ·
            실패 <strong className="text-[var(--learn-review)]">{enqueueResult.fail}</strong>건
          </div>
          {enqueueResult.failedReasons.length > 0 && (
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-[var(--learn-review)]">
              {enqueueResult.failedReasons.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 결과 list */}
      {rows.length > 0 && (
        <section className="overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
          {/* 헤더 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] bg-[var(--bg2)] p-2.5 font-mono text-[11px]">
            <label className="inline-flex items-center gap-1.5 text-[var(--t2)]">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === rows.length}
                onChange={toggleAll}
                className="h-3 w-3"
              />
              전체
            </label>
            <span className="text-[var(--t3)]">
              <strong className="text-[var(--t1)]">{rows.length}</strong>건 ·{' '}
              선택{' '}
              <strong className="text-[var(--p)]">{selected.size}</strong>건
            </span>

            <div className="ml-auto">
              <button
                type="button"
                onClick={handleBulkEnqueue}
                disabled={enqueuing || selected.size === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-3 font-display text-[11px] font-[700] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
              >
                {enqueuing ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Plus size={11} />
                )}
                선택 {selected.size}건 큐에 추가
              </button>
            </div>
          </div>

          <ul className="divide-y divide-[var(--bd)]">
            {rows.map((r) => {
              const key = rowKey(r)
              const isSelected = selected.has(key)
              const isEnqueued = enqueuedKeys.has(key)
              const sourceCfg = SOURCES.find((s) => s.key === r.source)
              return (
                <li
                  key={key}
                  className={`flex items-start gap-3 p-3 transition-colors ${
                    isEnqueued ? 'opacity-60' : 'hover:bg-[var(--bg2)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(key)}
                    disabled={isEnqueued}
                    className="mt-1 h-3.5 w-3.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                      {sourceCfg && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9px] font-[700]"
                          style={{
                            color: sourceCfg.color,
                            background: `color-mix(in srgb, ${sourceCfg.color} 12%, transparent)`,
                          }}
                        >
                          <sourceCfg.Icon size={9} />
                          {sourceCfg.label}
                        </span>
                      )}
                      <span className="font-mono text-[9.5px] text-[var(--t3)]">
                        {r.feed_label}
                      </span>
                      {r.published_at && (
                        <span className="inline-flex items-center gap-0.5 font-mono text-[9.5px] text-[var(--t3)]">
                          <Calendar size={9} />
                          {new Date(r.published_at).toISOString().slice(0, 10)}
                        </span>
                      )}
                      {isEnqueued && (
                        <span className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] border border-[var(--learn-known)] bg-[var(--learn-known-light)] px-1.5 py-0.5 font-mono text-[9px] font-[700] text-[var(--learn-known)]">
                          <CheckCircle2 size={9} /> 큐
                        </span>
                      )}
                    </div>
                    <div className="font-display text-[13px] font-[600] text-[var(--t1)] line-clamp-1">
                      {r.title}
                    </div>
                    {r.description && (
                      <p className="mt-0.5 font-body text-[11px] leading-relaxed text-[var(--t3)] line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="원문"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
                  >
                    <ExternalLink size={11} />
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* 빈 상태 */}
      {rows.length === 0 && !fetching && failedFeeds.length === 0 && (
        <div className="rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] p-8 text-center font-body text-[12px] text-[var(--t3)]">
          소스를 선택하고 <strong className="text-[var(--t1)]">"일괄 가져오기"</strong> 를 누르세요.
          <br />
          여러 소스의 모든 카테고리를 한 번에 가져온 후 체크박스로 선택해 큐에 추가합니다.
        </div>
      )}
    </div>
  )
}

// ── helpers ───────────────────────────
function rowKey(r: { source: string; source_id: string }): string {
  return `${r.source}:${r.source_id}`
}

function countFeeds(selectedSources: Set<SourceKey>): number {
  let n = 0
  for (const s of SOURCES) if (selectedSources.has(s.key)) n += s.feeds.length
  return n
}
