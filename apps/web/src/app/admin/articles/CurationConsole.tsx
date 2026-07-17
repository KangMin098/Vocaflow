// apps/web/src/app/admin/articles/CurationConsole.tsx
// ACP §18 — 큐레이션 콘솔 셸 (4단계 파이프라인 + SourcePolicy 분기).
//
// 핵심 설계: 소스별 차이는 SourcePolicy 로만 분기 — source 하드코딩 금지(useSourcePolicy 경유).
//   소스 GET 은 "소스별 탭" 으로 분리하되, 각 탭은 하드코딩 화면이 아니라 단일 컴포넌트
//   `SourceGetView` 가 source 를 받아 렌더(정보·특성·학습자 가치·정책·후보). 새 소스 = 한 줄.
//
// 4단계: 커버리지 · 소스 GET · 검수 · 발행.

'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  CloudSun,
  Dna,
  Download,
  FlaskConical,
  Globe,
  LayoutGrid,
  Layers,
  Library,
  MapPin,
  Megaphone,
  Microscope,
  Mountain,
  Newspaper,
  Radio,
  Rocket,
  SearchCheck,
  Send,
} from 'lucide-react'

import type { ArticleAdminRow, ArticleStats, SourceFeedHealth } from '@/lib/articles/types'
import type { LearnerLevel } from '@vocaflow/library-pipeline/curation-spec'
import { SOURCE_LABEL } from '@/lib/articles/source-guide'
import { CoverageMatrix } from './CoverageMatrix'
import { SourceFeedList } from './SourceFeedList'
import { GetGuidePanel } from './GetGuidePanel'
import { SourceGetView } from './SourceGetView'
import { CuratedArticlesTab } from './CuratedArticlesTab'
import { BulkArticlesTab } from './BulkArticlesTab'

type Stage = 'coverage' | 'get' | 'review' | 'publish'
type SourceKey =
  | 'voa' | 'nasa' | 'nih' | 'simple_wikipedia' | 'the_conversation' | 'wikinews' | 'owid' | 'factbook' | 'elife' | 'wikipedia' | 'plos' | 'wikivoyage' | 'usgs' | 'noaa'
type StatTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger'

interface Props {
  articles: ArticleAdminRow[]
  stats: ArticleStats
  feedHealth: SourceFeedHealth[]
}

const STAGES: Array<{ key: Stage; label: string; Icon: typeof LayoutGrid }> = [
  { key: 'coverage', label: '커버리지', Icon: LayoutGrid },
  { key: 'get', label: '소스 GET', Icon: Download },
  { key: 'review', label: '검수', Icon: SearchCheck },
  { key: 'publish', label: '발행', Icon: Send },
]
const STAGE_KEYS: Stage[] = STAGES.map((s) => s.key)

// 소스별 탭 — 라벨은 정본 SOURCE_LABEL(source-guide) 단일출처에서만(중복 정의·드리프트 금지).
//   여기선 key + Icon 만 정의 → 커버리지(SourceFeedList)와 동일 라벨 보장.
const SOURCE_OPTIONS: Array<{ key: SourceKey; Icon: typeof Radio }> = [
  { key: 'voa', Icon: Radio },
  { key: 'nasa', Icon: Rocket },
  { key: 'nih', Icon: FlaskConical },
  { key: 'simple_wikipedia', Icon: BookOpen },
  { key: 'the_conversation', Icon: Megaphone },
  { key: 'wikinews', Icon: Newspaper },
  { key: 'owid', Icon: BarChart3 },
  { key: 'factbook', Icon: Globe },
  { key: 'elife', Icon: Microscope },
  { key: 'wikipedia', Icon: Library },
  { key: 'plos', Icon: Dna },
  { key: 'wikivoyage', Icon: MapPin },
  { key: 'usgs', Icon: Mountain },
  { key: 'noaa', Icon: CloudSun },
]
const SOURCE_KEYS: SourceKey[] = SOURCE_OPTIONS.map((s) => s.key)

export function CurationConsole({ articles, stats, feedHealth }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // stage 를 URL(?stage=)로 동기화 — 프리뷰 검수 후 복귀 시 stage 유지(제자리 복귀).
  const stageParam = searchParams.get('stage') as Stage | null
  const stage: Stage = stageParam && STAGE_KEYS.includes(stageParam) ? stageParam : 'coverage'
  const setStage = (s: Stage): void => {
    const params = new URLSearchParams(searchParams.toString())
    if (s === 'coverage') params.delete('stage')
    else params.set('stage', s)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const [getSource, setGetSource] = useState<SourceKey>('voa')

  const refetchAll = (): void => {
    router.refresh()
  }
  const goReview = (): void => {
    setStage('review')
    setTimeout(refetchAll, 400)
  }
  // 커버리지/추천 → 소스 GET 점프 (해당 소스 탭 선택).
  const jumpToGet = (source: string): void => {
    if ((SOURCE_KEYS as string[]).includes(source)) setGetSource(source as SourceKey)
    setStage('get')
  }

  return (
    <div className="flex flex-col gap-6">
      <StageTabs stage={stage} onChange={setStage} />

      <div role="tabpanel" id={`curation-panel-${stage}`} aria-labelledby={`curation-tab-${stage}`}>
        {stage === 'coverage' && (
          <div className="flex flex-col gap-6">
            <StatsBar stats={stats} />
            <CoverageMatrix articles={articles} onCellClick={() => setStage('get')} />
            <SourceFeedList feedHealth={feedHealth} onPickSource={jumpToGet} />
          </div>
        )}
        {stage === 'get' && (
          <SourceGetStage
            source={getSource}
            onSource={setGetSource}
            onEnqueued={goReview}
            articles={articles}
            feedHealth={feedHealth}
          />
        )}
        {stage === 'review' && (
          <CuratedArticlesTab
            articles={articles}
            onChanged={refetchAll}
            initialFilter="ready"
            showGate
            heading="🔍 검수 큐"
            backStage="review"
          />
        )}
        {stage === 'publish' && (
          <CuratedArticlesTab
            articles={articles}
            onChanged={refetchAll}
            initialFilter="published"
            backStage="publish"
          />
        )}
      </div>
    </div>
  )
}

// ── Stage tabs ───────────────────────────────────

function StageTabs({ stage, onChange }: { stage: Stage; onChange: (s: Stage) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--bd)]">
      {STAGES.map(({ key, label, Icon }, i) => {
        const active = stage === key
        return (
          <button
            key={key}
            role="tab"
            id={`curation-tab-${key}`}
            aria-selected={active}
            aria-controls={`curation-panel-${key}`}
            type="button"
            onClick={() => onChange(key)}
            className={[
              'inline-flex min-h-[44px] items-center gap-2 -mb-px border-b-2 px-4',
              'font-display text-[13px] font-[600]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'border-[var(--p)] text-[var(--p)]'
                : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]',
            ].join(' ')}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--r-full)] font-mono text-[10px] font-[700]"
              style={{
                backgroundColor: active ? 'var(--p)' : 'var(--bg2)',
                color: active ? 'var(--ti)' : 'var(--t3)',
              }}
              aria-hidden
            >
              {i + 1}
            </span>
            <Icon size={14} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Stats bar (커버리지 stage) ────────────────────

function StatsBar({ stats }: { stats: ArticleStats }) {
  const items: Array<{ label: string; value: number; tone: StatTone }> = [
    { label: '전체', value: stats.total, tone: 'neutral' },
    { label: '게시됨', value: stats.published, tone: 'success' },
    { label: '검토 대기', value: stats.ready, tone: 'warning' },
    { label: '처리 중', value: stats.inProgress, tone: 'info' },
    { label: '실패', value: stats.failed, tone: 'danger' },
  ]
  const colorMap: Record<StatTone, { bg: string; text: string; value: string }> = {
    neutral: { bg: 'var(--bg2)', text: 'var(--t3)', value: 'var(--t1)' },
    success: { bg: 'var(--learn-known-light)', text: 'var(--learn-known)', value: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', text: 'var(--learn-review)', value: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', text: 'var(--learn-fresh)', value: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', text: 'var(--learn-error)', value: 'var(--learn-error)' },
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((it) => {
        const c = colorMap[it.tone]
        return (
          <div
            key={it.label}
            className="flex flex-col gap-0.5 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3"
            style={{ backgroundColor: c.bg }}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: c.text }}>
              {it.label}
            </span>
            <span className="font-display text-[24px] font-[700] tabular-nums" style={{ color: c.value }}>
              {it.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── 소스 GET stage — 소스별 탭 ────────────────────

function SourceGetStage({
  source,
  onSource,
  onEnqueued,
  articles,
  feedHealth,
}: {
  source: SourceKey
  onSource: (s: SourceKey) => void
  onEnqueued: () => void
  articles: ArticleAdminRow[]
  feedHealth: SourceFeedHealth[]
}) {
  const [mode, setMode] = useState<'source' | 'bulk'>('source')
  const [level, setLevel] = useState<LearnerLevel>('intermediate')

  // 추천 카드의 "이 소스 GET" → 소스별 모드 + 해당 소스 탭.
  const pickRecommended = (s: string): void => {
    if ((SOURCE_KEYS as string[]).includes(s)) onSource(s as SourceKey)
    setMode('source')
  }

  return (
    <div className="flex flex-col gap-4">
      <GetGuidePanel
        articles={articles}
        feedHealth={feedHealth}
        level={level}
        onLevel={setLevel}
        onPickSource={pickRecommended}
      />

      <div role="tablist" aria-label="GET 모드" className="flex gap-1">
        <ModeButton active={mode === 'source'} onClick={() => setMode('source')} Icon={Download} label="소스별" />
        <ModeButton active={mode === 'bulk'} onClick={() => setMode('bulk')} Icon={Layers} label="대량 (LCP)" />
      </div>

      {mode === 'bulk' ? (
        <BulkArticlesTab onEnqueued={onEnqueued} />
      ) : (
        <>
          <SourceTabs source={source} onChange={onSource} feedHealth={feedHealth} />
          <SourceGetView
            key={source}
            source={source}
            level={level}
            feedHealth={feedHealth}
            onEnqueued={onEnqueued}
          />
        </>
      )}
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  Icon: typeof Download
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'inline-flex min-h-[40px] items-center gap-2 rounded-[var(--r-sm)] px-3',
        'font-display text-[12px] font-[600]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
        active
          ? 'bg-[var(--p)] text-[var(--ti)]'
          : 'border border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)]',
      ].join(' ')}
    >
      <Icon size={13} aria-hidden />
      {label}
    </button>
  )
}

// 소스별 탭 — 각 탭이 그 소스 전용 GET 화면(SourceGetView). 후보 수 배지로 잔여 후보 표시.
function SourceTabs({
  source,
  onChange,
  feedHealth,
}: {
  source: SourceKey
  onChange: (s: SourceKey) => void
  feedHealth: SourceFeedHealth[]
}) {
  const pendingBySource = new Map<string, number>()
  for (const f of feedHealth) pendingBySource.set(f.source, (pendingBySource.get(f.source) ?? 0) + f.pending)

  return (
    <div role="tablist" aria-label="소스별" className="flex flex-wrap gap-1 border-b border-[var(--bd)]">
      {SOURCE_OPTIONS.map(({ key, Icon }) => {
        const active = source === key
        const label = SOURCE_LABEL[key] ?? key
        const pending = pendingBySource.get(key) ?? 0
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={[
              'inline-flex min-h-[40px] items-center gap-1.5 -mb-px border-b-2 px-3',
              'font-display text-[12px] font-[600]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'border-[var(--p)] text-[var(--p)]'
                : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]',
            ].join(' ')}
          >
            <Icon size={13} aria-hidden />
            {label}
            {pending > 0 && (
              <span
                className="inline-flex min-w-[16px] items-center justify-center rounded-[var(--r-full)] bg-[var(--bg2)] px-1 font-mono text-[9px] font-[700] text-[var(--t2)]"
                aria-label={`후보 ${pending}`}
              >
                {pending}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
