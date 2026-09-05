// apps/web/src/app/admin/articles/BulkArticlesTab.tsx
//
// v06.34 — LCP 대량 GET 탭 (Article 버전).
// 도서 BulkFetchTab 의 article 변형 — 여러 source × feed 자동 순회 +
// 결과 통합 list + checkbox 일괄 enqueue.
//
// 사용 흐름:
//   1. 소스 선택 (VOA / NASA / NIH / Simple Wikipedia / Wikinews / The Conversation — multi 체크박스)
//   2. 각 소스의 모든 feed 를 Promise.allSettled 순회
//   3. 결과 통합 list (소스/카테고리/제목/발행일/설명)
//   4. 체크박스 선택 → 일괄 enqueue
//
// 외부 API 실패 처리: 실패한 feed 는 표시만 (전체 중단 X).

'use client'

import {
  AlertCircle,
  BarChart3,
  BookText,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CloudSun,
  Dna,
  Download,
  ExternalLink,
  FlaskConical,
  Globe,
  Library,
  Loader2,
  MapPin,
  MessageSquareText,
  Microscope,
  Mountain,
  Newspaper,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Square,
  Trash2,
  GraduationCap,
  Info,
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

// v06.74 — article 단계 상태 (큐레이터가 list 에서 한눈에 진행 단계 확인)
type ArticleStatusValue =
  | 'queued'
  | 'normalizing'
  | 'analyzing'
  | 'curating'
  | 'ready'
  | 'published'
  | 'failed'
  | 'archived'

interface BulkRow extends FeedItem {
  source: SourceKey
  feed_id: string
  feed_label: string
  isPublished: boolean
  // v06.74 — seed_catalog row id (삭제 액션용)
  seedId?: string
  // v06.74 — library_articles.status (imported_article_id 가 있을 때)
  articleStatus?: ArticleStatusValue | null
  // v06.74 — article.status_message (failed 시 원인)
  articleStatusMessage?: string | null
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
  /** v06.71 — health: 외부 사이트 활성 상태. 'unstable' = 가져오기 0건 빈번. */
  health?: 'ok' | 'unstable' | 'inactive'
  healthNote?: string
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
    // v06.246 — 전수 테스트 실측(2026-07-13): News RSS 403 차단 · Director's Blog 연결불가 ·
    //   MedlinePlus whatsnew 원본 1건뿐 → 3 feed 모두 후보 0. URL 직접 입력 권장.
    health: 'unstable',
    healthNote: 'News RSS 403 차단 · Director\'s Blog 연결 불가 · MedlinePlus 항목 희소 — URL 직접 입력 권장',
  },
  // v06.69 — arXiv 제거 (사용자 명시: "플랫폼 전체에서 삭제").
  // v06.66 — Simple English Wikipedia (A2-B1 통제 어휘, MediaWiki API categorymembers)
  {
    key: 'simple_wikipedia',
    label: 'Simple Wikipedia',
    Icon: BookText,
    color: 'var(--learn-fresh)',
    feeds: [
      { id: 'very-good', label: 'Very Good Articles' },
      { id: 'good', label: 'Good Articles' },
    ],
  },
  // v06.66 — Wikinews (B1-B2 시사 뉴스, CC-BY-2.5)
  // v06.71 — 영문 사이트가 30일 ns=0 article 0건 (사실상 비활성) → health=inactive
  {
    key: 'wikinews',
    label: 'Wikinews',
    Icon: Newspaper,
    color: 'var(--learn-review)',
    feeds: [
      { id: 'latest', label: 'Latest news' },
    ],
    health: 'inactive',
    healthNote: '영문 사이트가 현재 거의 비활성 (30일 새 article 0건)',
  },
  // v06.66 — The Conversation (B2-C1 학자 논증문, CC-BY-ND → display_only)
  {
    key: 'the_conversation',
    label: 'The Conversation',
    Icon: MessageSquareText,
    color: 'var(--memory-stable)',
    feeds: [
      { id: 'all', label: 'All articles' },
      { id: 'science', label: 'Science + Tech' },
      { id: 'health', label: 'Health + Medicine' },
      { id: 'politics', label: 'Politics + Society' },
    ],
  },
  // v06.163~ 신규 소스 — 대량 GET 배선
  {
    key: 'owid',
    label: 'Our World in Data',
    Icon: BarChart3,
    color: 'var(--info)',
    feeds: [{ id: 'all', label: 'All articles (논증·데이터)' }],
  },
  {
    key: 'factbook',
    label: 'CIA World Factbook',
    Icon: Globe,
    color: 'var(--memory-stable)',
    feeds: [{ id: 'all', label: 'Countries (35 · reference)' }],
  },
  {
    key: 'elife',
    label: 'eLife',
    Icon: Microscope,
    color: 'var(--learn-fresh)',
    feeds: [{ id: 'all', label: 'Recent digests (과학)' }],
  },
  {
    key: 'wikipedia',
    label: 'Wikipedia',
    Icon: Library,
    color: 'var(--learn-known)',
    feeds: [
      { id: 'featured', label: 'Featured Articles' },
      { id: 'good', label: 'Good Articles' },
    ],
  },
  {
    key: 'plos',
    label: 'PLOS',
    Icon: Dna,
    color: 'var(--info)',
    feeds: [{ id: 'recent', label: 'Recent (오픈 학술 · C2)' }],
  },
  {
    key: 'wikivoyage',
    label: 'Wikivoyage',
    Icon: MapPin,
    color: 'var(--memory-stable)',
    feeds: [
      { id: 'star', label: 'Star Articles (여행)' },
      { id: 'guide', label: 'Guide Articles (여행)' },
    ],
  },
  {
    key: 'usgs',
    label: 'USGS',
    Icon: Mountain,
    color: 'var(--learn-known)',
    feeds: [
      { id: 'featured', label: 'Featured Stories (지구과학)' },
      { id: 'snippets', label: 'Science Snippets (지구과학)' },
    ],
  },
  {
    key: 'noaa',
    label: 'NOAA Climate.gov',
    Icon: CloudSun,
    color: 'var(--info)',
    feeds: [
      { id: 'understanding-climate', label: 'Understanding Climate (기후)' },
      { id: 'features', label: 'Features (기후)' },
    ],
  },
]

interface Props {
  onEnqueued: () => void
}

// v06.72 — 소스별 설정 (feed 개별 선택 + maxItems override)
interface PerSourceConfig {
  selectedFeeds: Set<string>
  maxItems: number
}

// v06.72 — 글로벌 필터 (null = spec 기본값 사용)
interface GlobalFilters {
  minScoreOverride: number | null // 0.0 ~ 1.0
  recencyDaysOverride: number | null // 1 ~ 9999
}

// v06.72 — 빠른 선택 preset
type Preset = 'basic' | 'all' | 'advanced'
const PRESET_SOURCES: Record<Preset, SourceKey[]> = {
  basic: ['voa', 'nasa', 'nih'],
  all: ['voa', 'nasa', 'nih', 'simple_wikipedia', 'wikinews', 'the_conversation', 'owid', 'factbook', 'elife', 'wikipedia', 'plos', 'wikivoyage', 'usgs', 'noaa'],
  advanced: ['the_conversation', 'owid', 'elife', 'plos', 'wikipedia', 'simple_wikipedia', 'usgs', 'noaa'],
}
const PRESET_LABEL: Record<Preset, string> = {
  basic: '기본 (VOA + NASA + NIH)',
  all: '전체 (14 소스)',
  advanced: '고급 (논증 · 과학 · 백과)',
}

// v06.74 — article 단계 → badge 표시 메타
const STATUS_BADGE: Record<
  ArticleStatusValue | 'none',
  { label: string; bg: string; fg: string; title?: string }
> = {
  none: { label: '후보', bg: 'var(--bg2)', fg: 'var(--t3)', title: 'enqueue 안 한 후보' },
  queued: { label: '대기', bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  normalizing: { label: '정규화', bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  analyzing: { label: '분석중', bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
  curating: { label: '큐레이션', bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
  ready: { label: '검토대기', bg: 'var(--success-light)', fg: 'var(--memory-stable-ink)' },
  published: { label: '발행됨', bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
  failed: { label: '실패', bg: 'var(--learn-error-light)', fg: 'var(--learn-error)' },
  archived: { label: '보관', bg: 'var(--bg2)', fg: 'var(--t3)' },
}
const STATUS_OPTIONS: Array<ArticleStatusValue | 'none'> = [
  'none',
  'queued',
  'normalizing',
  'analyzing',
  'curating',
  'ready',
  'published',
  'failed',
  'archived',
]

function defaultSourceConfig(): Map<SourceKey, PerSourceConfig> {
  const m = new Map<SourceKey, PerSourceConfig>()
  for (const s of SOURCES) {
    m.set(s.key, {
      selectedFeeds: new Set(s.feeds.map((f) => f.id)),
      maxItems: SOURCE_SPECS[s.key].maxItemsPerBatch,
    })
  }
  return m
}

export function BulkArticlesTab({ onEnqueued }: Props) {
  // 선택된 소스
  const [selectedSources, setSelectedSources] = useState<Set<SourceKey>>(
    new Set(['voa', 'nasa', 'nih']),
  )
  // v06.72 — 소스별 세부 (feed 선택 + maxItems)
  const [sourceConfig, setSourceConfig] = useState<Map<SourceKey, PerSourceConfig>>(
    defaultSourceConfig(),
  )
  // v06.72 — 어떤 소스 카드가 펼쳐졌는지
  const [expandedSources, setExpandedSources] = useState<Set<SourceKey>>(new Set())
  // v06.72 — 글로벌 필터 (모두 null = spec 기본)
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    minScoreOverride: null,
    recencyDaysOverride: null,
  })
  // v06.72 — 글로벌 필터 패널 펼침 상태
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  // v06.72 — fetch 진행 상태 (current/total feeds)
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(
    null,
  )

  // 결과
  const [rows, setRows] = useState<BulkRow[]>([])
  const [failedFeeds, setFailedFeeds] = useState<
    Array<{ source: SourceKey; feed_id: string; feed_label: string; error: string }>
  >([])
  // v06.71 — 소스별 결과 통계 (fetched=원본 / passed=spec 통과 / capped=cap 적용 후)
  const [sourceStats, setSourceStats] = useState<
    Record<string, { fetched: number; passed: number; capped: number; feeds: number }>
  >({})
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

  // v06.41 — 정렬
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score')
  // v06.73 — list 필터 7축 통합 (검색/소스/점수/CEFR/발행/audio/기간)
  // v06.74 — articleStatus 8축 추가 (큐 단계별 필터)
  const [listFilters, setListFilters] = useState<{
    search: string
    sources: Set<SourceKey>
    minScore: number // 0~100 (0 = 모두)
    cefrLevels: Set<string>
    publishStatus: 'all' | 'unpublished' | 'published'
    audioStatus: 'all' | 'with' | 'without'
    recencyDays: number | null
    articleStatuses: Set<ArticleStatusValue | 'none'> // 'none' = enqueue 안 한 후보
  }>({
    search: '',
    sources: new Set(),
    minScore: 0,
    cefrLevels: new Set(),
    publishStatus: 'all',
    audioStatus: 'all',
    recencyDays: null,
    articleStatuses: new Set(),
  })
  const [listFiltersExpanded, setListFiltersExpanded] = useState(false)
  // v06.74 — bulk 삭제 진행
  const [deleting, setDeleting] = useState(false)

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
        // v06.74 — includeImported=true 로 enqueue 한 seed 도 가져와 article 단계 상태 표시
        const res = await fetch('/api/admin/articles/seed-list?limit=300&includeImported=true')
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
            article_status: ArticleStatusValue | null
            article_status_message: string | null
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
          seedId: s.id,
          articleStatus: s.article_status,
          articleStatusMessage: s.article_status_message,
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

  // v06.63 — 전체 선택/해제 (소스 카드 일일이 클릭 번거로움 해소)
  const allSelected = selectedSources.size === SOURCES.length
  const toggleAllSources = () => {
    setSelected(new Set())
    setEnqueueResult(null)
    setSelectedSources(allSelected ? new Set() : new Set(SOURCES.map((s) => s.key)))
  }

  // v06.72 — preset 적용 (빠른 선택 칩)
  const applyPreset = (preset: Preset) => {
    setSelected(new Set())
    setEnqueueResult(null)
    setSelectedSources(new Set(PRESET_SOURCES[preset]))
  }

  // v06.72 — 카드 펼침 토글
  const toggleExpand = (key: SourceKey) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // v06.72 — 카드 안 feed 개별 토글
  const toggleFeed = (sourceKey: SourceKey, feedId: string) => {
    setSourceConfig((prev) => {
      const next = new Map(prev)
      const cur = next.get(sourceKey) ?? {
        selectedFeeds: new Set<string>(),
        maxItems: SOURCE_SPECS[sourceKey].maxItemsPerBatch,
      }
      const feeds = new Set(cur.selectedFeeds)
      if (feeds.has(feedId)) feeds.delete(feedId)
      else feeds.add(feedId)
      next.set(sourceKey, { ...cur, selectedFeeds: feeds })
      return next
    })
  }

  // v06.72 — 소스별 maxItems 변경
  const setSourceMaxItems = (sourceKey: SourceKey, value: number) => {
    const clamped = Math.max(1, Math.min(50, Math.round(value || 1)))
    setSourceConfig((prev) => {
      const next = new Map(prev)
      const cur = next.get(sourceKey) ?? {
        selectedFeeds: new Set<string>(),
        maxItems: SOURCE_SPECS[sourceKey].maxItemsPerBatch,
      }
      next.set(sourceKey, { ...cur, maxItems: clamped })
      return next
    })
  }

  // v06.74 — row 삭제 (seed_catalog.curation_status='hidden' + article.delete 분기)
  //   selectedRowKeys 의 row 들 (selected state + rowKey) 또는 명시 ids.
  async function handleDeleteRows(specificRows?: BulkRow[]) {
    const target = specificRows ?? rows.filter((r) => selected.has(rowKey(r)))
    if (target.length === 0) return
    const withArticles = target.filter((r) => r.articleStatus != null).length
    const confirmMsg =
      `${target.length}건 삭제할까요?\n\n` +
      `· 미발행 후보 (${target.length - withArticles}건): seed_catalog 에서 '숨김' 처리 — 다시 GET 시 재노출 안 됨.\n` +
      `· 발행/큐 진행 (${withArticles}건): library_articles 영구 삭제 (CASCADE 로 vocabularies/word_sets 정리).\n` +
      `· published 상태는 먼저 검토대기로 되돌려야 합니다.`
    if (!window.confirm(confirmMsg)) return

    const seedIds = target.map((r) => r.seedId).filter((id): id is string => !!id)
    if (seedIds.length === 0) {
      alert('삭제 가능한 seed_id 가 없습니다 (이전 세션 row 일 수 있음 — 새로고침 후 다시 시도).')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/articles/seed/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed_ids: seedIds }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        hidden?: number
        articleDeleted?: number
        errors?: string[]
      }
      if (!res.ok) {
        alert(`삭제 실패: HTTP ${res.status}`)
        return
      }
      // 결과 row 에서 제거 (낙관적 갱신)
      const seedIdSet = new Set(seedIds)
      setRows((prev) => prev.filter((r) => !r.seedId || !seedIdSet.has(r.seedId)))
      setSelected(new Set())
      const errLine = data.errors && data.errors.length > 0 ? `\n오류:\n${data.errors.join('\n')}` : ''
      alert(
        `완료\n· seed 숨김: ${data.hidden ?? 0}건\n· article 삭제: ${data.articleDeleted ?? 0}건${errLine}`,
      )
    } catch (e) {
      alert(`삭제 네트워크 오류: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setDeleting(false)
    }
  }

  // 모든 feed 순회
  async function handleBulkFetch() {
    setFetching(true)
    setEnqueueResult(null)
    setRows([])
    setFailedFeeds([])
    setSourceStats({})
    setSelected(new Set())

    const feedsToFetch: Array<{ source: SourceKey; feed: FeedConfig }> = []
    // v06.72 — sourceConfig.selectedFeeds 만 fetch (이전: 모든 feeds 일괄)
    for (const s of SOURCES) {
      if (!selectedSources.has(s.key)) continue
      const cfg = sourceConfig.get(s.key)
      const allowed = cfg?.selectedFeeds ?? new Set(s.feeds.map((f) => f.id))
      for (const f of s.feeds) {
        if (allowed.has(f.id)) feedsToFetch.push({ source: s.key, feed: f })
      }
    }

    // v06.72 — fetch 진행 추적 (current/total). 완료마다 +1.
    setFetchProgress({ current: 0, total: feedsToFetch.length })
    let done = 0
    const results = await Promise.allSettled(
      feedsToFetch.map(async ({ source, feed }) => {
        try {
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
        } finally {
          done += 1
          setFetchProgress({ current: done, total: feedsToFetch.length })
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

    // v06.42 소스 레벨 cap 적용. v06.71 SOURCES 전수 순회.
    // v06.72 — sourceConfig.maxItems override (각 소스별 사용자 지정 cap).
    //   globalFilters.minScoreOverride 추가 가드 적용 (spec minScore 위로만 덮어쓰기).
    const byCappedSource: BulkRow[] = []
    const stats: Record<string, { fetched: number; passed: number; capped: number; feeds: number }> = {}
    const feedsPerSource = new Map<string, Set<string>>()
    for (const ff of feedsToFetch) {
      if (!feedsPerSource.has(ff.source)) feedsPerSource.set(ff.source, new Set())
      feedsPerSource.get(ff.source)!.add(ff.feed.id)
    }
    const globalMinScore = globalFilters.minScoreOverride
    for (const sourceCfg of SOURCES) {
      const ofSource = accRows.filter((r) => r.source === sourceCfg.key)
      const fetched = ofSource.length
      const specMinScore = SOURCE_SPECS[sourceCfg.key].minScore
      const effMinScore = globalMinScore != null ? Math.max(specMinScore, globalMinScore) : specMinScore
      // v06.72 — global minScore override 후 추가 필터링
      const passedItems = ofSource.filter((r) => (r.score?.total ?? 0) >= effMinScore)
      const capped = passedItems.length > 0 ? applySourceLevelCap(passedItems, sourceCfg.key) : []
      // v06.72 — 사용자 지정 maxItems 추가 cap (slice).
      const userMax = sourceConfig.get(sourceCfg.key)?.maxItems
      const finalCapped = userMax != null && userMax < capped.length ? capped.slice(0, userMax) : capped
      byCappedSource.push(...finalCapped)
      const feedsCount = feedsPerSource.get(sourceCfg.key)?.size ?? 0
      if (fetched > 0 || feedsCount > 0) {
        stats[sourceCfg.key] = {
          fetched,
          passed: passedItems.length,
          capped: finalCapped.length,
          feeds: feedsCount,
        }
      }
    }

    // 학습 친화도순 정렬 (sortBy state 따라 client에서 다시 정렬)
    byCappedSource.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))

    setRows(byCappedSource)
    setFailedFeeds(accFail)
    setSourceStats(stats)
    setFetching(false)
    setFetchProgress(null)
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
        <div className="flex items-baseline gap-3">
          <Download size={14} className="self-center text-[var(--p)]" aria-hidden />
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            LCP 대량 GET
          </h2>
          <span className="font-body text-[12px] text-[var(--t2)]">
            여러 소스 · 모든 카테고리 한 번에
          </span>
        </div>
      </header>

      {/* v06.42 — 학습자 수준 선택기 + 소스 자동 정렬 + 소스 명세 카드 */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        {/* v06.72 — 빠른 선택 preset (한 번에 합리적 묶음) */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-[11.5px] font-[600] text-[var(--t2)]">빠른 선택:</span>
          {(['basic', 'all', 'advanced'] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={fetching}
              className="inline-flex h-7 items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[10.5px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {PRESET_LABEL[p]}
            </button>
          ))}
        </div>

        {/* 학습자 수준 — 소스 자동 정렬 기준 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GraduationCap size={13} className="text-[var(--t2)]" />
          <span className="font-display text-[11.5px] font-[600] text-[var(--t2)]">
            학습자 수준 (소스 정렬 기준):
          </span>
          <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] p-1">
            {(['beginner', 'intermediate', 'advanced'] as LearnerLevel[]).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLearnerLevel(lv)}
                className={`rounded-[var(--r-sm)] px-3 py-1 font-display text-[11px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                  learnerLevel === lv
                    ? 'bg-[var(--p)] text-[var(--on-p)]'
                    : 'text-[var(--t2)] hover:text-[var(--t1)]'
                }`}
              >
                {lv === 'beginner' ? '입문 (A1-A2)' : lv === 'intermediate' ? '중급 (B1-B2)' : '고급 (C1+)'}
              </button>
            ))}
          </div>
        </div>

        {/* v06.72 — 글로벌 필터 패널 (펼치기) */}
        <div className="mb-4 rounded-[var(--r-sm)] border border-[var(--bd)]">
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-[var(--r-sm)] px-3 py-2 text-left font-display text-[12px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <span>🎚 결과 조건 (글로벌 필터 override)</span>
            <span className="font-mono text-[10px] text-[var(--t2)]">
              {globalFilters.minScoreOverride != null
                ? `min★${Math.round(globalFilters.minScoreOverride * 100)}`
                : 'spec'}
              {' · '}
              {globalFilters.recencyDaysOverride != null
                ? `${globalFilters.recencyDaysOverride}d`
                : 'spec'}
            </span>
          </button>
          {filtersExpanded && (
            <div className="grid gap-3 border-t border-[var(--bd)] p-3 sm:grid-cols-2">
              {/* minScore override */}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--t2)]">
                  최소 점수 (★ override · 비우면 spec 기본)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={globalFilters.minScoreOverride ?? 0}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setGlobalFilters((g) => ({
                        ...g,
                        minScoreOverride: v === 0 ? null : v / 100,
                      }))
                    }}
                    className="h-1.5 flex-1 cursor-pointer accent-[var(--p)]"
                  />
                  <span className="w-12 text-right font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {globalFilters.minScoreOverride != null
                      ? `★${Math.round(globalFilters.minScoreOverride * 100)}`
                      : 'spec'}
                  </span>
                </div>
              </label>

              {/* recencyDays override */}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--t2)]">
                  신선도 cutoff (일 · 비우면 spec 기본)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={365}
                    step={1}
                    value={globalFilters.recencyDaysOverride ?? 0}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setGlobalFilters((g) => ({
                        ...g,
                        recencyDaysOverride: v === 0 ? null : v,
                      }))
                    }}
                    className="h-1.5 flex-1 cursor-pointer accent-[var(--p)]"
                  />
                  <span className="w-12 text-right font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {globalFilters.recencyDaysOverride != null
                      ? `${globalFilters.recencyDaysOverride}d`
                      : 'spec'}
                  </span>
                </div>
              </label>
              <button
                type="button"
                onClick={() =>
                  setGlobalFilters({ minScoreOverride: null, recencyDaysOverride: null })
                }
                className="font-display text-[11px] font-[600] text-[var(--t2)] hover:text-[var(--p)] sm:col-span-2"
              >
                spec 기본값으로 초기화
              </button>
            </div>
          )}
        </div>

        {/* v06.47 — 수준 선택의 실제 의미를 화면에서 명시 (오해 방지) */}
        <p className="mb-3 flex items-start gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] px-3 py-2 font-body text-[10.5px] leading-relaxed text-[var(--t2)]">
          <Info size={12} className="mt-0.5 shrink-0 text-[var(--t2)]" aria-hidden />
          <span>
            <strong className="text-[var(--t2)]">수준 선택은 소스 우선순위·추천만 바꿉니다</strong> — 기사 내용을 레벨로 골라오지는
            않아요. 각 소스는 아래의 <strong className="text-[var(--t2)]">고정 CEFR 밴드</strong>로 묶이고,{' '}
            <strong className="text-[var(--t2)]">VOA 피드만 실제 등급제</strong>(A2/B1/B2)예요. 기사별 실제 난이도(V-Level)는{' '}
            <strong className="text-[var(--t2)]">등재(ingest) 후</strong> 측정됩니다.
          </span>
        </p>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
            소스 명세 (multi · 학습자 수준 기반 순위)
            <span className="ml-2 font-mono text-[10.5px] font-[500] text-[var(--t2)]">
              {selectedSources.size}/{SOURCES.length} 선택
            </span>
          </h3>
          <button
            type="button"
            onClick={toggleAllSources}
            disabled={fetching}
            className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[11px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
            title={allSelected ? '전체 소스 해제' : '전체 소스 선택 (한 번에 모두 가져오기 준비)'}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        {/* 소스 카드 list — 학습자 수준에 맞춰 자동 정렬, 각 소스의 spec 가시화 */}
        {/* v06.72 — 카드 expand: feed 개별 토글 + maxItems input */}
        <div className="grid gap-2 sm:grid-cols-2">
          {orderedSources.map((s) => {
            const active = selectedSources.has(s.key)
            const expanded = expandedSources.has(s.key)
            const Icon = s.Icon
            const spec = SOURCE_SPECS[s.key]
            const cfg = sourceConfig.get(s.key)
            const selectedFeedCount = cfg?.selectedFeeds.size ?? s.feeds.length
            const userMaxItems = cfg?.maxItems ?? spec.maxItemsPerBatch
            return (
              <div
                key={s.key}
                className="group relative flex flex-col gap-2 rounded-[var(--r-sm)] border p-3 text-left transition-all"
                style={{
                  background: active ? `color-mix(in srgb, ${s.color} 8%, transparent)` : 'var(--bg)',
                  borderColor: active ? s.color : 'var(--bd)',
                }}
              >
                {/* clickable header — 소스 토글 */}
                <button
                  type="button"
                  onClick={() => toggleSource(s.key)}
                  disabled={fetching}
                  className="flex items-center gap-2 text-left disabled:cursor-not-allowed"
                >
                  {active ? (
                    <CheckSquare size={14} aria-hidden style={{ color: s.color }} />
                  ) : (
                    <Square size={14} aria-hidden className="text-[var(--t2)]" />
                  )}
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-[700]"
                    style={{
                      background: active ? s.color : 'var(--bg2)',
                      color: active ? 'var(--ti)' : 'var(--t3)',
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
                  <span className="font-mono text-[9.5px] text-[var(--t2)]">
                    {selectedFeedCount}/{s.feeds.length} feed · 최대 {userMaxItems}
                  </span>
                  {(() => {
                    const fit = fitForLevel(spec, learnerLevel)
                    const c =
                      fit === 'fit'
                        ? { label: '이 수준에 적합', color: 'var(--memory-stable)' }
                        : fit === 'easy'
                          ? { label: '이 수준엔 쉬움', color: 'var(--info)' }
                          : { label: '이 수준엔 어려움', color: 'var(--memory-shaky)' }
                    return (
                      <span
                        className="ml-auto rounded-[var(--r-full)] px-2 py-1 font-mono text-[8.5px] font-[700]"
                        style={{
                          background: `color-mix(in srgb, ${c.color} 14%, transparent)`,
                          color: c.color,
                        }}
                      >
                        {c.label}
                      </span>
                    )
                  })()}
                </button>

                {/* 2행 — target CEFR + 라이선스 */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-[9.5px] text-[var(--t2)]">
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
                <div className="line-clamp-1 font-body text-[10.5px] text-[var(--t2)]">
                  {spec.styleGuide}
                </div>

                {/* v06.71 — health 상태 표시 */}
                {s.health && s.health !== 'ok' && (
                  <div
                    className="flex items-start gap-1 rounded-[var(--r-sm)] px-2 py-1 font-body text-[9.5px]"
                    style={{
                      background:
                        s.health === 'inactive'
                          ? 'color-mix(in srgb, var(--memory-shaky) 12%, transparent)'
                          : 'color-mix(in srgb, var(--warning) 12%, transparent)',
                      color: s.health === 'inactive' ? 'var(--memory-shaky)' : 'var(--warning)',
                    }}
                  >
                    <AlertCircle size={10} aria-hidden className="mt-0.5 shrink-0" />
                    <span>
                      {s.health === 'inactive' ? '⚠️ 외부 소스 비활성' : '⚠️ 불안정'}
                      {s.healthNote ? ` — ${s.healthNote}` : ''}
                    </span>
                  </div>
                )}

                {/* v06.72 — expand toggle (feed 선택 + maxItems) */}
                <button
                  type="button"
                  onClick={() => toggleExpand(s.key)}
                  disabled={fetching}
                  className="inline-flex items-center gap-1 self-start rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed"
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  {expanded ? '세부 닫기' : '세부 설정 (feed · 개수)'}
                </button>

                {expanded && (
                  <div className="mt-1 flex flex-col gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-2">
                    {/* maxItems */}
                    <label className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--t2)]">
                        가져올 최대 개수
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        step={1}
                        value={userMaxItems}
                        onChange={(e) => setSourceMaxItems(s.key, parseInt(e.target.value, 10))}
                        disabled={fetching}
                        className="h-1.5 flex-1 cursor-pointer accent-[var(--p)]"
                      />
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={userMaxItems}
                        onChange={(e) => setSourceMaxItems(s.key, parseInt(e.target.value, 10) || 1)}
                        disabled={fetching}
                        className="h-6 w-14 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-mono text-[11px] tabular-nums text-[var(--t1)]"
                      />
                    </label>
                    {/* feed checkboxes */}
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--t2)]">
                        Feed 선택 ({selectedFeedCount}/{s.feeds.length})
                      </span>
                      {s.feeds.map((f) => {
                        const fSelected = cfg?.selectedFeeds.has(f.id) ?? true
                        return (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] px-2 py-1 text-[10.5px] hover:bg-[var(--bg2)]"
                          >
                            <input
                              type="checkbox"
                              checked={fSelected}
                              onChange={() => toggleFeed(s.key, f.id)}
                              disabled={fetching}
                              className="h-3 w-3 accent-[var(--p)]"
                            />
                            <span
                              className="font-body text-[var(--t2)]"
                              style={fSelected ? undefined : { color: 'var(--t4)' }}
                            >
                              {f.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* v06.72 — fetch 버튼 + 진행 bar */}
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleBulkFetch}
            disabled={fetching || selectedSources.size === 0}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {fetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            {fetching
              ? fetchProgress
                ? `가져오는 중… ${fetchProgress.current}/${fetchProgress.total} feed`
                : '가져오는 중…'
              : (() => {
                  // v06.72 — 실제 fetch 대상 feed 수 (sourceConfig.selectedFeeds)
                  let feeds = 0
                  for (const s of SOURCES) {
                    if (!selectedSources.has(s.key)) continue
                    const cfg = sourceConfig.get(s.key)
                    feeds += cfg?.selectedFeeds.size ?? s.feeds.length
                  }
                  return `${[...selectedSources].length} 소스 · ${feeds} 카테고리 일괄 가져오기`
                })()}
          </button>
          {fetching && fetchProgress && fetchProgress.total > 0 && (
            <div
              className="h-1.5 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={fetchProgress.total}
              aria-valuenow={fetchProgress.current}
            >
              <div
                className="h-full rounded-[var(--r-full)] bg-[var(--p)] transition-[width] duration-200"
                style={{
                  width: `${Math.round((fetchProgress.current / fetchProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* v06.71 — 소스별 결과 분포 (fetched/passed/capped) */}
      {Object.keys(sourceStats).length > 0 && (
        <section className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <h3 className="mb-1.5 inline-flex items-center gap-2 font-display text-[12px] font-[700] text-[var(--t1)]">
            📊 소스별 결과
          </h3>
          <ul className="grid gap-1 font-mono text-[10.5px] sm:grid-cols-2">
            {SOURCES.filter((s) => sourceStats[s.key]).map((s) => {
              const st = sourceStats[s.key]!
              const dropped = st.fetched - st.passed
              const isZero = st.capped === 0
              return (
                <li
                  key={s.key}
                  className="flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--bg)] px-2 py-1"
                  style={{ color: isZero ? 'var(--t3)' : 'var(--t1)' }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: isZero ? 'var(--bd)' : s.color }}
                    aria-hidden
                  />
                  <span className="font-display font-[700]">{s.label}</span>
                  <span className="ml-auto">
                    <strong className="text-[var(--t1)]">{st.capped}</strong>
                    <span className="text-[var(--t2)]"> / {st.fetched}</span>
                    {dropped > 0 && (
                      <span
                        className="ml-1 text-[var(--memory-shaky)]"
                        title={`${dropped}건 가드 미통과 (minScore/minDescriptionLen/recencyDays 등)`}
                      >
                        −{dropped}
                      </span>
                    )}
                    <span className="ml-1 text-[var(--t2)]">({st.feeds} feed)</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 font-body text-[9.5px] text-[var(--t2)]">
            형식: <strong>최종/원본</strong> (−드롭). 드롭은 spec 가드(점수·길이·기간) 미통과. 소스
            카드 클릭으로 spec 확인 가능.
          </p>
        </section>
      )}

      {/* 실패한 feed 안내 */}
      {failedFeeds.length > 0 && (
        <section className="rounded-[var(--r-sm)] border border-[var(--learn-review)] bg-[var(--learn-review-light)] p-3">
          <h3 className="mb-1.5 inline-flex items-center gap-2 font-display text-[12px] font-[700] text-[var(--learn-review)]">
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
        // v06.73 — list 필터 7축 통합 적용
        const lfSearch = listFilters.search.trim().toLowerCase()
        const lfRecencyMs =
          listFilters.recencyDays != null ? listFilters.recencyDays * 86_400_000 : null
        const now = Date.now()
        const visibleRows = rows.filter((r) => {
          // 발행 상태
          if (listFilters.publishStatus === 'unpublished' && r.isPublished) return false
          if (listFilters.publishStatus === 'published' && !r.isPublished) return false
          // audio 상태
          if (listFilters.audioStatus === 'with' && r.has_audio !== true) return false
          if (listFilters.audioStatus === 'without' && r.has_audio === true) return false
          // 소스 (비어있으면 모두 통과)
          if (listFilters.sources.size > 0 && !listFilters.sources.has(r.source)) return false
          // 검색 (title + description)
          if (lfSearch) {
            const hay = `${r.title} ${r.description ?? ''}`.toLowerCase()
            if (!hay.includes(lfSearch)) return false
          }
          // 점수 (0 = 모두)
          if (listFilters.minScore > 0) {
            const score = (r.score?.total ?? 0) * 100
            if (score < listFilters.minScore) return false
          }
          // CEFR (소스별 spec.targetCefr.min 이 cefrLevels 안에 있어야)
          if (listFilters.cefrLevels.size > 0) {
            const cefrMin = SOURCE_SPECS[r.source].targetCefr.min
            if (!listFilters.cefrLevels.has(cefrMin)) return false
          }
          // 기간 (recencyDays)
          if (lfRecencyMs != null) {
            if (!r.published_at) return false
            const age = now - new Date(r.published_at).getTime()
            if (age > lfRecencyMs) return false
          }
          // v06.74 — article 단계 상태 필터 ('none' = 후보 (article 없음))
          if (listFilters.articleStatuses.size > 0) {
            const stat = r.articleStatus ?? 'none'
            if (!listFilters.articleStatuses.has(stat)) return false
          }
          return true
        })
        const displayRows = [...visibleRows].sort((a, b) => {
          if (sortBy === 'score') return (b.score?.total ?? 0) - (a.score?.total ?? 0)
          return (b.published_at ?? '').localeCompare(a.published_at ?? '')
        })
        const visibleKeys = new Set(displayRows.map(rowKey))
        const visibleSelected = new Set([...selected].filter((k) => visibleKeys.has(k)))

      return (
        <section className="overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
          {/* 헤더 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] bg-[var(--bg2)] p-3 font-mono text-[11px]">
            <label className="inline-flex items-center gap-2 text-[var(--t2)]">
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
            <span className="text-[var(--t2)]">
              <strong className="text-[var(--t1)]">{displayRows.length}</strong>건
              {rows.length > displayRows.length && (
                <span className="text-[var(--t2)]">
                  {' '}
                  (필터로 {rows.length - displayRows.length} 숨김 / 전체 {rows.length})
                </span>
              )}
              {' · 선택 '}
              <strong className="text-[var(--p)]">{visibleSelected.size}</strong>건
            </span>

            {/* v06.41 — 정렬 토글 */}
            <div className="ml-2 inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] p-1">
              <button
                type="button"
                onClick={() => setSortBy('score')}
                className={`rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                  sortBy === 'score'
                    ? 'bg-[var(--p)] text-[var(--on-p)]'
                    : 'text-[var(--t2)] hover:text-[var(--t1)]'
                }`}
                title="학습 친화도 순 (recency + source + length + level)"
              >
                적합도
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                className={`rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                  sortBy === 'date'
                    ? 'bg-[var(--p)] text-[var(--on-p)]'
                    : 'text-[var(--t2)] hover:text-[var(--t1)]'
                }`}
                title="발행일 내림차순"
              >
                최신순
              </button>
            </div>

            {/* v06.73 — 필터 통합 패널 토글 (hidePublished/audioOnly 등 모두 통합) */}
            <button
              type="button"
              onClick={() => setListFiltersExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-display text-[10px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              title="검색 / 소스 / 점수 / CEFR / 발행 / audio / 기간"
            >
              {listFiltersExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              필터
              {(() => {
                let n = 0
                if (listFilters.search) n++
                if (listFilters.sources.size > 0) n++
                if (listFilters.minScore > 0) n++
                if (listFilters.cefrLevels.size > 0) n++
                if (listFilters.publishStatus !== 'all') n++
                if (listFilters.audioStatus !== 'all') n++
                if (listFilters.recencyDays != null) n++
                if (listFilters.articleStatuses.size > 0) n++
                return n > 0 ? (
                  <span className="ml-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-2 font-mono text-[9px] text-[var(--on-p)]">
                    {n}
                  </span>
                ) : null
              })()}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {/* v06.74 — 선택 일괄 삭제 */}
              <button
                type="button"
                onClick={() => handleDeleteRows()}
                disabled={deleting || selected.size === 0}
                className="inline-flex h-8 items-center gap-2 rounded-[var(--r-sm)] border border-[var(--learn-error)] bg-[var(--bg)] px-3 font-display text-[11px] font-[700] text-[var(--learn-error)] hover:bg-[var(--learn-error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--learn-error)] disabled:opacity-50"
                title="선택 항목을 seed_catalog 에서 숨기거나 (미발행) library_articles 영구 삭제 (큐 진행 중)"
              >
                {deleting ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Trash2 size={11} />
                )}
                삭제 {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
              <button
                type="button"
                onClick={handleBulkEnqueue}
                disabled={enqueuing || selected.size === 0}
                className="inline-flex h-8 items-center gap-2 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-3 font-display text-[11px] font-[700] text-[var(--on-p)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-50"
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

          {/* v06.73 — 필터 패널 (펼치기) */}
          {listFiltersExpanded && (
            <div className="grid gap-3 border-b border-[var(--bd)] bg-[var(--bg)] p-3 sm:grid-cols-2">
              {/* 검색 */}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  검색 (제목 · 설명)
                </span>
                <input
                  type="search"
                  value={listFilters.search}
                  onChange={(e) =>
                    setListFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="키워드…"
                  className="h-7 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[11px] text-[var(--t1)]"
                />
              </label>

              {/* 소스 다중 선택 */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  소스 ({listFilters.sources.size === 0 ? '전체' : `${listFilters.sources.size} 선택`})
                </span>
                <div className="flex flex-wrap gap-1">
                  {SOURCES.map((s) => {
                    const checked = listFilters.sources.has(s.key)
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() =>
                          setListFilters((f) => {
                            const next = new Set(f.sources)
                            if (next.has(s.key)) next.delete(s.key)
                            else next.add(s.key)
                            return { ...f, sources: next }
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2 py-1 font-mono text-[10px] font-[600]"
                        style={{
                          background: checked
                            ? `color-mix(in srgb, ${s.color} 14%, transparent)`
                            : 'var(--bg)',
                          borderColor: checked ? s.color : 'var(--bd)',
                          color: checked ? s.color : 'var(--t3)',
                        }}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 점수 minScore */}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  최소 점수 (★ 0 = 전체)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={listFilters.minScore}
                    onChange={(e) =>
                      setListFilters((f) => ({
                        ...f,
                        minScore: parseInt(e.target.value, 10),
                      }))
                    }
                    className="h-1.5 flex-1 cursor-pointer accent-[var(--p)]"
                  />
                  <span className="w-12 text-right font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {listFilters.minScore > 0 ? `★${listFilters.minScore}+` : '전체'}
                  </span>
                </div>
              </label>

              {/* CEFR 다중 선택 */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  CEFR (소스 기준 · {listFilters.cefrLevels.size === 0 ? '전체' : `${listFilters.cefrLevels.size} 선택`})
                </span>
                <div className="flex flex-wrap gap-1">
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lv) => {
                    const checked = listFilters.cefrLevels.has(lv)
                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() =>
                          setListFilters((f) => {
                            const next = new Set(f.cefrLevels)
                            if (next.has(lv)) next.delete(lv)
                            else next.add(lv)
                            return { ...f, cefrLevels: next }
                          })
                        }
                        className={`inline-flex items-center rounded-[var(--r-sm)] border px-2 py-1 font-mono text-[10px] font-[700] ${
                          checked
                            ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                            : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)]'
                        }`}
                      >
                        {lv}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 발행 상태 */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  발행 상태
                </span>
                <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] p-1">
                  {(['all', 'unpublished', 'published'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setListFilters((f) => ({ ...f, publishStatus: opt }))}
                      className={`flex-1 rounded-[var(--r-sm)] px-2 py-1 font-display text-[10.5px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                        listFilters.publishStatus === opt
                          ? 'bg-[var(--p)] text-[var(--on-p)]'
                          : 'text-[var(--t2)] hover:text-[var(--t1)]'
                      }`}
                    >
                      {opt === 'all' ? '전체' : opt === 'unpublished' ? '미발행' : '발행됨'}
                    </button>
                  ))}
                </div>
              </div>

              {/* audio 상태 */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  🎧 audio 보유
                </span>
                <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] p-1">
                  {(['all', 'with', 'without'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setListFilters((f) => ({ ...f, audioStatus: opt }))}
                      className={`flex-1 rounded-[var(--r-sm)] px-2 py-1 font-display text-[10.5px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                        listFilters.audioStatus === opt
                          ? 'bg-[var(--p)] text-[var(--on-p)]'
                          : 'text-[var(--t2)] hover:text-[var(--t1)]'
                      }`}
                    >
                      {opt === 'all' ? '전체' : opt === 'with' ? '있음만' : '없음만'}
                    </button>
                  ))}
                </div>
              </div>

              {/* v06.74 — article 단계 상태 다중 선택 */}
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  큐 단계 ({listFilters.articleStatuses.size === 0 ? '전체' : `${listFilters.articleStatuses.size} 선택`})
                </span>
                <div className="flex flex-wrap gap-1">
                  {STATUS_OPTIONS.map((opt) => {
                    const checked = listFilters.articleStatuses.has(opt)
                    const meta = STATUS_BADGE[opt]
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setListFilters((f) => {
                            const next = new Set(f.articleStatuses)
                            if (next.has(opt)) next.delete(opt)
                            else next.add(opt)
                            return { ...f, articleStatuses: next }
                          })
                        }
                        className="inline-flex items-center rounded-[var(--r-full)] border px-2 py-1 font-mono text-[10px] font-[700]"
                        style={{
                          background: checked ? meta.bg : 'var(--bg)',
                          borderColor: checked ? meta.fg : 'var(--bd)',
                          color: checked ? meta.fg : 'var(--t3)',
                        }}
                      >
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 기간 recencyDays */}
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
                  발행일 — 최근 N일 (0 = 전체)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={365}
                    step={1}
                    value={listFilters.recencyDays ?? 0}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setListFilters((f) => ({ ...f, recencyDays: v === 0 ? null : v }))
                    }}
                    className="h-1.5 flex-1 cursor-pointer accent-[var(--p)]"
                  />
                  <span className="w-16 text-right font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {listFilters.recencyDays != null ? `${listFilters.recencyDays}일` : '전체'}
                  </span>
                </div>
              </label>

              {/* 초기화 */}
              <button
                type="button"
                onClick={() =>
                  setListFilters({
                    search: '',
                    sources: new Set(),
                    minScore: 0,
                    cefrLevels: new Set(),
                    publishStatus: 'all',
                    audioStatus: 'all',
                    recencyDays: null,
                    articleStatuses: new Set(),
                  })
                }
                className="font-display text-[10.5px] font-[600] text-[var(--t2)] hover:text-[var(--p)] sm:col-span-2"
              >
                필터 초기화
              </button>
            </div>
          )}

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
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      {sourceCfg && (
                        <span
                          className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-mono text-[9px] font-[700]"
                          style={{
                            color: sourceCfg.color,
                            background: `color-mix(in srgb, ${sourceCfg.color} 12%, transparent)`,
                          }}
                        >
                          <sourceCfg.Icon size={9} />
                          {sourceCfg.label}
                        </span>
                      )}
                      <span className="font-mono text-[9.5px] text-[var(--t2)]">
                        {r.feed_label}
                      </span>
                      {scorePct !== null && (
                        <span
                          className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-mono text-[9px] font-[700] tabular-nums"
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
                          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-[var(--t2)]">
                            <Calendar size={9} />
                            {d.toISOString().slice(0, 10)}
                          </span>
                        )
                      })()}
                      {r.has_audio && (
                        <span
                          className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-mono text-[9px] font-[700]"
                          style={{ color: 'var(--active)', background: 'color-mix(in srgb, var(--active) 14%, transparent)' }}
                          title="audio (mp3) 포함 — LCP librivox_audio 와 동일 연계로 reader 에서 player 자동 노출"
                        >
                          🎧 듣기
                        </span>
                      )}
                      {/* v06.74 — article 단계 상태 badge (있으면 표시) */}
                      {(() => {
                        const stat: ArticleStatusValue | 'none' = r.articleStatus ?? 'none'
                        if (stat === 'none' && !r.isPublished && !isEnqueued) return null
                        const meta = STATUS_BADGE[stat]
                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-mono text-[9px] font-[700]"
                            style={{ color: meta.fg, background: meta.bg }}
                            title={r.articleStatusMessage ?? meta.title}
                          >
                            {meta.label}
                          </span>
                        )
                      })()}
                      {isEnqueued && !r.articleStatus && (
                        <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--memory-stable)] bg-[var(--success-light)] px-2 py-1 font-mono text-[9px] font-[700] text-[var(--memory-stable)]">
                          <CheckCircle2 size={9} /> 큐
                        </span>
                      )}
                    </div>
                    <div className="font-display text-[13px] font-[600] text-[var(--t1)] line-clamp-1">
                      {r.title}
                    </div>
                    {r.description && (
                      <p className="mt-0.5 font-body text-[11px] leading-relaxed text-[var(--t2)] line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="원문"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
                    >
                      <ExternalLink size={11} />
                    </a>
                    {r.articleStatus === 'failed' && (
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--learn-review)]"
                        title="실패 — 재처리는 /admin/articles 검수 페이지의 '재처리' 액션"
                      >
                        <RefreshCw size={11} />
                      </span>
                    )}
                    {/* v06.74 — 단건 삭제 (seed_catalog hide + article delete 분기) */}
                    <button
                      type="button"
                      onClick={() => handleDeleteRows([r])}
                      disabled={deleting}
                      title={
                        r.articleStatus === 'published'
                          ? 'published 상태는 먼저 검토대기로 되돌려야 삭제 가능'
                          : r.articleStatus
                            ? 'library_articles 영구 삭제'
                            : 'seed_catalog 에서 숨김 (다음 GET 시 재노출 안 됨)'
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--learn-error-light)] hover:text-[var(--learn-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--learn-error)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )
      })()}

      {/* 빈 상태 */}
      {rows.length === 0 && !fetching && failedFeeds.length === 0 && (
        <div className="rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] p-8 text-center font-body text-[12px] text-[var(--t2)]">
          소스를 선택하고 <strong className="text-[var(--t1)]">&ldquo;일괄 가져오기&rdquo;</strong> 를 누르세요.
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

// 선택한 학습자 수준 대비 소스 고정 CEFR 밴드의 적합도.
//   fit  = 밴드가 수준대와 겹침 (적합)
//   easy = 소스가 수준보다 쉬움 (밴드가 아래)
//   hard = 소스가 수준보다 어려움 (밴드가 위)
// ※ 소스 밴드 기준이지 기사별 실측 난이도가 아님.
const CEFR_RANK: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 }
const LEVEL_BAND: Record<LearnerLevel, [number, number]> = {
  beginner: [0, 1], // A1–A2
  intermediate: [2, 3], // B1–B2
  advanced: [4, 5], // C1–C2
}
function fitForLevel(
  spec: { targetCefr: { min: string; max: string } },
  level: LearnerLevel,
): 'fit' | 'easy' | 'hard' {
  const [lo, hi] = LEVEL_BAND[level]
  const smin = CEFR_RANK[spec.targetCefr.min] ?? 0
  const smax = CEFR_RANK[spec.targetCefr.max] ?? 5
  if (smin > hi) return 'hard'
  if (smax < lo) return 'easy'
  return 'fit'
}
