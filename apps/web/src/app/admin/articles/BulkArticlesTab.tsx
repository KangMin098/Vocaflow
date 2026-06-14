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
  GraduationCap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

// 배럴(@vocaflow/library-pipeline) 대신 client-safe 서브패스만 import.
//   배럴은 normalize(node:crypto) 까지 끌어와 클라이언트 번들을 깨뜨림(dev 는 tree-shake X).
//   _curation-spec 은 import 0 의 순수 모듈이라 안전.
import {
  SOURCE_SPECS,
  applySourceLevelCap,
  getSourceOrderForLevel,
  type LearnerLevel,
  type SourceKey,
} from '@vocaflow/library-pipeline/curation-spec'

interface ArticleScore {
  total: number
  recency: number
  source: number
  length: number
  level: number
}

interface FeedItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
  /** v06.45 — audio 보유 (VOA 학습 정체성으로 100% true, NASA 일부) */
  has_audio?: boolean
}

interface BulkRow extends FeedItem {
  source: SourceKey
  feed_id: string
  feed_label: string
  isPublished: boolean
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

  // v06.41 — 정렬 / 발행 숨김 토글
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score')
  const [hidePublished, setHidePublished] = useState(true)
  // v06.45 — 듣기(audio) 보유 항목만 보기 (LCP librivox 와 동일 연계)
  const [audioOnly, setAudioOnly] = useState(false)

  // v06.42 — 학습자 수준 (소스 자동 정렬 + 추천 강조)
  const [learnerLevel, setLearnerLevel] = useState<LearnerLevel>('intermediate')

  // 학습자 수준 기반 소스 정렬 + 추천 여부
  const orderedSources = useMemo(() => {
    const order = getSourceOrderForLevel(learnerLevel)
    return order
      .map((entry) => {
        const cfg = SOURCES.find((s) => s.key === entry.source)
        return cfg ? { ...cfg, isRecommended: entry.isRecommended, priority: entry.priority } : null
      })
      .filter((x): x is SourceConfig & { isRecommended: boolean; priority: number } => x !== null)
  }, [learnerLevel])

  // v06.46 — 마운트 시 seed_catalog 자동 로드 (LCP 와 동일하게 새로고침해도 보존됨)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/articles/seed-list?limit=300')
        if (!res.ok) return
        const data = (await res.json()) as {
          items: Array<{
            id: string
            source: SourceKey
            source_id: string
            feed_id: string | null
            feed_label: string | null
            title: string
            source_url: string | null
            published_at: string | null
            description: string | null
            score_total: number | null
            score_recency: number | null
            score_source: number | null
            score_length: number | null
            score_level: number | null
            has_audio: boolean
            imported_to_articles: boolean
            imported_article_id: string | null
          }>
        }
        if (cancelled) return

        const rows: BulkRow[] = data.items.map((s) => ({
          source: s.source,
          source_id: s.source_id,
          title: s.title,
          url: s.source_url ?? '',
          published_at: s.published_at,
          description: s.description ?? '',
          score:
            s.score_total !== null
              ? {
                  total: s.score_total,
                  recency: s.score_recency ?? 0,
                  source: s.score_source ?? 0,
                  length: s.score_length ?? 0,
                  level: s.score_level ?? 0,
                }
              : undefined,
          has_audio: s.has_audio,
          feed_id: s.feed_id ?? '',
          feed_label: s.feed_label ?? '',
          isPublished: s.imported_to_articles,
        }))
        // 이미 enqueue 된 seed 도 화면에 표시 — 사용자 정책 (이미 발행 가시화)
        if (rows.length > 0) {
          setRows(rows.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)))
        }
      } catch {
        // seed_catalog 없거나 빈 상태 — silent
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
        return {
          source,
          feed_id: feed.id,
          feed_label: feed.label,
          items: (data.items ?? []) as FeedItem[],
          publishedSourceIds: (data.publishedSourceIds ?? []) as string[],
        }
      }),
    )

    const accRows: BulkRow[] = []
    const accFail: typeof failedFeeds = []

    results.forEach((r, idx) => {
      const { source, feed } = feedsToFetch[idx]!
      if (r.status === 'fulfilled') {
        const publishedSet = new Set(r.value.publishedSourceIds)
        for (const item of r.value.items) {
          accRows.push({
            ...item,
            source,
            feed_id: feed.id,
            feed_label: feed.label,
            isPublished: publishedSet.has(item.source_id),
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

    // v06.42 — 소스 레벨 cap 적용 (소스당 maxItemsPerBatch + minScore + feed mix quota)
    const byCappedSource: BulkRow[] = []
    for (const key of (['voa', 'nasa', 'nih', 'arxiv'] as SourceKey[])) {
      const ofSource = accRows.filter((r) => r.source === key)
      if (ofSource.length === 0) continue
      const capped = applySourceLevelCap(ofSource, key)
      byCappedSource.push(...capped)
    }

    // 학습 친화도순 정렬 (sortBy state 따라 client에서 다시 정렬)
    byCappedSource.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))

    setRows(byCappedSource)
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

      {/* v06.42 — 학습자 수준 선택기 + 소스 자동 정렬 + 소스 명세 카드 */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        {/* 학습자 수준 — 소스 자동 정렬 기준 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GraduationCap size={13} className="text-[var(--t3)]" />
          <span className="font-display text-[11.5px] font-[600] text-[var(--t2)]">
            학습자 수준 (소스 정렬 기준):
          </span>
          <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] p-0.5">
            {(['beginner', 'intermediate', 'advanced'] as LearnerLevel[]).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLearnerLevel(lv)}
                className={`rounded-[var(--r-sm)] px-2.5 py-0.5 font-display text-[11px] font-[600] transition-all ${
                  learnerLevel === lv
                    ? 'bg-[var(--p)] text-[var(--ti)]'
                    : 'text-[var(--t3)] hover:text-[var(--t1)]'
                }`}
              >
                {lv === 'beginner' ? '입문 (A1-A2)' : lv === 'intermediate' ? '중급 (B1-B2)' : '고급 (C1+)'}
              </button>
            ))}
          </div>
        </div>

        <h3 className="mb-2 font-display text-[13px] font-[700] text-[var(--t1)]">
          소스 명세 (multi · 학습자 수준 기반 순위)
        </h3>

        {/* 소스 카드 list — 학습자 수준에 맞춰 자동 정렬, 각 소스의 spec 가시화 */}
        <div className="grid gap-2 sm:grid-cols-2">
          {orderedSources.map((s) => {
            const active = selectedSources.has(s.key)
            const Icon = s.Icon
            const spec = SOURCE_SPECS[s.key]
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSource(s.key)}
                disabled={fetching}
                className="group relative flex flex-col gap-1.5 rounded-[var(--r-sm)] border p-2.5 text-left transition-all"
                style={{
                  background: active ? `color-mix(in srgb, ${s.color} 8%, transparent)` : 'var(--bg)',
                  borderColor: active ? s.color : 'var(--bd)',
                }}
              >
                {/* 1행 — 우선순위 · 라벨 · feed 수 · 추천 배지 */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-[700]"
                    style={{
                      background: active ? s.color : 'var(--bg2)',
                      color: active ? 'white' : 'var(--t3)',
                    }}
                  >
                    {s.priority}
                  </span>
                  <Icon size={12} style={{ color: active ? s.color : 'var(--t3)' }} />
                  <span
                    className="font-display text-[12.5px] font-[700]"
                    style={{ color: active ? s.color : 'var(--t1)' }}
                  >
                    {s.label}
                  </span>
                  <span className="font-mono text-[9.5px] text-[var(--t3)]">
                    {s.feeds.length} feed · cap {spec.maxItemsPerBatch}
                  </span>
                  {s.isRecommended && (
                    <span
                      className="ml-auto rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[8.5px] font-[700]"
                      style={{
                        background: 'color-mix(in srgb, var(--memory-stable) 14%, transparent)',
                        color: 'var(--memory-stable)',
                      }}
                      title="이 학습자 수준에 적합한 소스"
                    >
                      추천
                    </span>
                  )}
                </div>
                {/* 2행 — target CEFR + 라이선스 */}
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9.5px] text-[var(--t3)]">
                  <span>CEFR {spec.targetCefr.min}–{spec.targetCefr.max}</span>
                  <span aria-hidden>·</span>
                  <span>{spec.license}</span>
                  {spec.attributionRequired && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-[var(--memory-shaky)]">인용 의무</span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span>min ★{Math.round(spec.minScore * 100)}</span>
                </div>
                {/* 3행 — 문체 */}
                <div className="line-clamp-1 font-body text-[10.5px] text-[var(--t3)]">
                  {spec.styleGuide}
                </div>
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
      {rows.length > 0 && (() => {
        // v06.41 + v06.45 — 정렬 + 숨김 토글 + audioOnly 필터 적용
        const visibleRows = rows
          .filter((r) => (hidePublished ? !r.isPublished : true))
          .filter((r) => (audioOnly ? r.has_audio === true : true))
        const displayRows = [...visibleRows].sort((a, b) => {
          if (sortBy === 'score') return (b.score?.total ?? 0) - (a.score?.total ?? 0)
          return (b.published_at ?? '').localeCompare(a.published_at ?? '')
        })
        const visibleKeys = new Set(displayRows.map(rowKey))
        const visibleSelected = new Set([...selected].filter((k) => visibleKeys.has(k)))

      return (
        <section className="overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
          {/* 헤더 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] bg-[var(--bg2)] p-2.5 font-mono text-[11px]">
            <label className="inline-flex items-center gap-1.5 text-[var(--t2)]">
              <input
                type="checkbox"
                checked={visibleSelected.size > 0 && visibleSelected.size === displayRows.length}
                onChange={() => {
                  if (visibleSelected.size === displayRows.length) {
                    setSelected(new Set())
                  } else {
                    setSelected(new Set(displayRows.map(rowKey)))
                  }
                }}
                className="h-3 w-3"
              />
              전체
            </label>
            <span className="text-[var(--t3)]">
              <strong className="text-[var(--t1)]">{displayRows.length}</strong>건
              {hidePublished && rows.length > displayRows.length && (
                <span className="text-[var(--t3)]"> (발행 {rows.length - displayRows.length} 숨김)</span>
              )}
              {' · 선택 '}
              <strong className="text-[var(--p)]">{visibleSelected.size}</strong>건
            </span>

            {/* v06.41 — 정렬 토글 */}
            <div className="ml-2 inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] p-0.5">
              <button
                type="button"
                onClick={() => setSortBy('score')}
                className={`rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[600] transition-all ${
                  sortBy === 'score'
                    ? 'bg-[var(--p)] text-[var(--ti)]'
                    : 'text-[var(--t3)] hover:text-[var(--t1)]'
                }`}
                title="학습 친화도 순 (recency + source + length + level)"
              >
                적합도
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                className={`rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[600] transition-all ${
                  sortBy === 'date'
                    ? 'bg-[var(--p)] text-[var(--ti)]'
                    : 'text-[var(--t3)] hover:text-[var(--t1)]'
                }`}
                title="발행일 내림차순"
              >
                최신순
              </button>
            </div>

            {/* v06.41 — 발행 숨김 토글 */}
            <label className="inline-flex items-center gap-1.5 text-[var(--t2)]">
              <input
                type="checkbox"
                checked={hidePublished}
                onChange={(e) => setHidePublished(e.target.checked)}
                className="h-3 w-3"
              />
              <span title="library_articles 에 이미 등재된 항목 숨김">발행 숨김</span>
            </label>

            {/* v06.45 — 듣기 보유만 (LCP librivox 와 동일 연계) */}
            <label className="inline-flex items-center gap-1.5 text-[var(--t2)]">
              <input
                type="checkbox"
                checked={audioOnly}
                onChange={(e) => setAudioOnly(e.target.checked)}
                className="h-3 w-3"
              />
              <span title="audio (mp3) 가 있는 항목만 — VOA Learning English 는 학습용 mp3 100% / NASA news 일부 / Lit2Go 일부">
                🎧 듣기만
              </span>
            </label>

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
            {displayRows.map((r) => {
              const key = rowKey(r)
              const isSelected = selected.has(key)
              const isEnqueued = enqueuedKeys.has(key)
              const sourceCfg = SOURCES.find((s) => s.key === r.source)
              const scorePct = r.score ? Math.round(r.score.total * 100) : null
              return (
                <li
                  key={key}
                  className={`flex items-start gap-3 p-3 transition-colors ${
                    isEnqueued || r.isPublished ? 'opacity-60' : 'hover:bg-[var(--bg2)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(key)}
                    disabled={isEnqueued || r.isPublished}
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
                      {scorePct !== null && (
                        <span
                          className="inline-flex items-center rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9px] font-[700] tabular-nums"
                          style={{
                            color:
                              scorePct >= 75 ? 'var(--memory-stable)' :
                              scorePct >= 55 ? 'var(--p)' :
                              scorePct >= 35 ? 'var(--memory-shaky)' :
                              'var(--memory-risk)',
                            background:
                              scorePct >= 75 ? 'color-mix(in srgb, var(--memory-stable) 12%, transparent)' :
                              scorePct >= 55 ? 'var(--p-light)' :
                              scorePct >= 35 ? 'color-mix(in srgb, var(--memory-shaky) 12%, transparent)' :
                              'color-mix(in srgb, var(--memory-risk) 12%, transparent)',
                          }}
                          title={`적합도 ${scorePct} — recency ${Math.round((r.score?.recency ?? 0) * 100)} · source ${Math.round((r.score?.source ?? 0) * 100)} · length ${Math.round((r.score?.length ?? 0) * 100)} · level ${((r.score?.level ?? 0) * 100).toFixed(0)}`}
                        >
                          ★ {scorePct}
                        </span>
                      )}
                      {(() => {
                        // Invalid Date 방어 — toISOString() throw 차단 (잘못된 published_at)
                        const d = r.published_at ? new Date(r.published_at) : null
                        if (!d || Number.isNaN(d.getTime())) return null
                        return (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[9.5px] text-[var(--t3)]">
                            <Calendar size={9} />
                            {d.toISOString().slice(0, 10)}
                          </span>
                        )
                      })()}
                      {r.has_audio && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9px] font-[700]"
                          style={{ color: 'var(--active)', background: 'color-mix(in srgb, var(--active) 14%, transparent)' }}
                          title="audio (mp3) 포함 — LCP librivox_audio 와 동일 연계로 reader 에서 player 자동 노출"
                        >
                          🎧 듣기
                        </span>
                      )}
                      {r.isPublished && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9px] font-[700]"
                          style={{ color: 'var(--memory-new)', background: 'color-mix(in srgb, var(--memory-new) 12%, transparent)' }}
                        >
                          <CheckCircle2 size={9} /> 발행됨
                        </span>
                      )}
                      {isEnqueued && (
                        <span className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] border border-[var(--memory-stable)] bg-[var(--success-light)] px-1.5 py-0.5 font-mono text-[9px] font-[700] text-[var(--memory-stable)]">
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
      )
      })()}

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
