// apps/web/src/app/admin/articles/CurationConsole.tsx
// ACP §18 P1 — 큐레이션 콘솔 셸 (단일 화면 + SourcePolicy 분기).
//
// 핵심 설계: VOA·The Conversation 등을 별도 화면으로 만들지 않는다. 하나의 4단계
//   파이프라인(커버리지 · 소스GET · 검수 · 발행)에서 소스별 차이는 SourcePolicy 로만
//   분기한다. source 문자열 하드코딩(if (source === 'voa')) 금지 — 전부 useSourcePolicy 경유.
//
// P1 범위: 4-stage 셸 + useSourcePolicy 단일 진입 + 분기 규칙 라이브 렌더(PolicyBar).
//   각 stage 내용은 기존 완성 컴포넌트 재사용(소스GET=VoaFeedTab/RssFeedTab/BulkArticlesTab,
//   검수/발행=CuratedArticlesTab). P2~P4 에서 목업 고도화(CandidateTable·ReviewPanel)로 교체.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Download,
  FlaskConical,
  LayoutGrid,
  Layers,
  Megaphone,
  Newspaper,
  Radio,
  Rocket,
  SearchCheck,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react'

import type { ArticleAdminRow, ArticleStats } from '@/lib/articles/types'
import {
  useSourcePolicy,
  SUPPLY_LABEL,
  MEDIA_LABEL,
  DERIVATION_LABEL,
  ATTRIBUTION_LABEL,
} from '@/lib/articles/use-source-policy'
import { CoverageMatrix } from './CoverageMatrix'
import { CuratedArticlesTab } from './CuratedArticlesTab'
import { BulkArticlesTab } from './BulkArticlesTab'
import { VoaFeedTab } from './VoaFeedTab'
import { RssFeedTab } from './RssFeedTab'

type Stage = 'coverage' | 'get' | 'review' | 'publish'
type SourceKey = 'voa' | 'nasa' | 'nih' | 'simple_wikipedia' | 'the_conversation' | 'wikinews'
type StatTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger'

interface Props {
  articles: ArticleAdminRow[]
  stats: ArticleStats
}

const STAGES: Array<{ key: Stage; label: string; Icon: typeof LayoutGrid }> = [
  { key: 'coverage', label: '커버리지', Icon: LayoutGrid },
  { key: 'get', label: '소스 GET', Icon: Download },
  { key: 'review', label: '검수', Icon: SearchCheck },
  { key: 'publish', label: '발행', Icon: Send },
]

export function CurationConsole({ articles, stats }: Props) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('coverage')

  const refetchAll = (): void => {
    router.refresh()
  }
  const goReview = (): void => {
    setStage('review')
    setTimeout(refetchAll, 400)
  }

  return (
    <div className="flex flex-col gap-6">
      <StageTabs stage={stage} onChange={setStage} />

      <div role="tabpanel" id={`curation-panel-${stage}`} aria-labelledby={`curation-tab-${stage}`}>
        {stage === 'coverage' && (
          <div className="flex flex-col gap-6">
            <StatsBar stats={stats} />
            <CoverageMatrix articles={articles} onCellClick={() => setStage('get')} />
          </div>
        )}
        {stage === 'get' && <SourceGetStage onEnqueued={goReview} />}
        {stage === 'review' && (
          <CuratedArticlesTab articles={articles} onChanged={refetchAll} initialFilter="in_progress" />
        )}
        {stage === 'publish' && (
          <CuratedArticlesTab articles={articles} onChanged={refetchAll} initialFilter="published" />
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

// ── 소스 GET stage (② 뷰) ─────────────────────────

const NASA_FEEDS = [
  { id: 'news', label: 'News Releases' },
  { id: 'apod', label: 'Astronomy Picture of the Day' },
  { id: 'iotd', label: 'Image of the Day' },
]
const NIH_FEEDS = [
  { id: 'medlineplus', label: "MedlinePlus What's New (안정)" },
  { id: 'directors-blog', label: "Director's Blog" },
  { id: 'news', label: 'NIH News Releases (현재 차단 · URL 직접 입력)' },
]

const SOURCE_OPTIONS: Array<{ key: SourceKey; label: string; Icon: typeof Radio }> = [
  { key: 'voa', label: 'VOA', Icon: Radio },
  { key: 'nasa', label: 'NASA', Icon: Rocket },
  { key: 'nih', label: 'NIH', Icon: FlaskConical },
  { key: 'simple_wikipedia', label: 'Wikipedia', Icon: BookOpen },
  { key: 'the_conversation', label: 'Conversation', Icon: Megaphone },
  { key: 'wikinews', label: 'Wikinews', Icon: Newspaper },
]

function SourceGetStage({ onEnqueued }: { onEnqueued: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [source, setSource] = useState<SourceKey>('voa')

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="GET 모드" className="flex gap-1">
        <ModeButton active={mode === 'single'} onClick={() => setMode('single')} Icon={Download} label="단일 소스" />
        <ModeButton active={mode === 'bulk'} onClick={() => setMode('bulk')} Icon={Layers} label="대량 (LCP)" />
      </div>

      {mode === 'bulk' ? (
        <BulkArticlesTab onEnqueued={onEnqueued} />
      ) : (
        <>
          <SourceSelector source={source} onChange={setSource} />
          <PolicyBar source={source} />
          <SourceGetBody source={source} onEnqueued={onEnqueued} />
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

function SourceSelector({
  source,
  onChange,
}: {
  source: SourceKey
  onChange: (s: SourceKey) => void
}) {
  return (
    <div role="tablist" aria-label="소스 선택" className="flex flex-wrap gap-1.5">
      {SOURCE_OPTIONS.map(({ key, label, Icon }) => {
        const active = source === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={[
              'inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-full)] px-3.5',
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
      })}
    </div>
  )
}

// PolicyBar — useSourcePolicy 의 라이브 분기 렌더. 소스 선택 시 4축 칩이 정책대로 바뀐다.
// (이게 P1 게이트의 "분기 규칙 매핑표" 그 자체 — 하드코딩 없이 policy 만 읽음.)
type ChipTone = 'neutral' | 'info' | 'known' | 'review'
const CHIP_COLORS: Record<ChipTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--bg)', fg: 'var(--t2)' },
  info: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  known: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
  review: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
}

function PolicyBar({ source }: { source: string }) {
  const policy = useSourcePolicy(source)
  const MediaIcon = policy.media === 'audio' ? Volume2 : VolumeX
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">정책</span>
      <PolicyChip
        label={`score · ${SUPPLY_LABEL[policy.supply]}`}
        tone={policy.supply === 'static' ? 'info' : 'neutral'}
      />
      <PolicyChip
        label={`진입 · ${MEDIA_LABEL[policy.media]}`}
        tone={policy.media === 'audio' ? 'known' : 'neutral'}
        Icon={MediaIcon}
      />
      <PolicyChip
        label={`단어세트 · ${DERIVATION_LABEL[policy.derivation]}`}
        tone={policy.derivation === 'display_only' ? 'review' : 'known'}
      />
      <PolicyChip
        label={`출처 · ${ATTRIBUTION_LABEL[policy.attribution]}`}
        tone={policy.attribution === 'required' ? 'review' : 'neutral'}
      />
      <span className="ml-auto font-mono text-[10px] text-[var(--t5)]">{policy.license}</span>
    </div>
  )
}

function PolicyChip({
  label,
  tone,
  Icon,
}: {
  label: string
  tone: ChipTone
  Icon?: typeof Volume2
}) {
  const c = CHIP_COLORS[tone]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 py-1 font-mono text-[10px] font-[600]"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {Icon && <Icon size={11} aria-hidden />}
      {label}
    </span>
  )
}

function SourceGetBody({
  source,
  onEnqueued,
}: {
  source: SourceKey
  onEnqueued: () => void
}) {
  switch (source) {
    case 'voa':
      return <VoaFeedTab onEnqueued={onEnqueued} />
    case 'nasa':
      return (
        <RssFeedTab
          source="nasa"
          heading="🚀 NASA"
          subtitle="U.S. federal government · Public Domain"
          feeds={NASA_FEEDS}
          emptyIcon={Rocket}
          urlPattern={/^https:\/\/(?:(?:www|apod)\.)?nasa\.gov\//}
          urlHostHint="nasa.gov / apod.nasa.gov 도메인"
          urlPlaceholder="https://www.nasa.gov/news-release/...  또는  https://apod.nasa.gov/apod/ap240519.html"
          onEnqueued={onEnqueued}
        />
      )
    case 'nih':
      return (
        <RssFeedTab
          source="nih"
          heading="🩺 NIH"
          subtitle="National Institutes of Health · Public Domain"
          feeds={NIH_FEEDS}
          emptyIcon={FlaskConical}
          urlPattern={/^https:\/\/(?:(?:www|directorsblog)\.)?nih\.gov\/|^https:\/\/medlineplus\.gov\//}
          urlHostHint="nih.gov / medlineplus.gov 도메인"
          urlPlaceholder="https://www.nih.gov/news-events/news-releases/..."
          onEnqueued={onEnqueued}
        />
      )
    case 'simple_wikipedia':
      return (
        <RssFeedTab
          source="simple_wikipedia"
          heading="📘 Simple English Wikipedia"
          subtitle="CC-BY-SA · A2~B1 설명문 (전 주제) · URL 직접 입력"
          feeds={[]}
          emptyIcon={BookOpen}
          urlPattern={/^https?:\/\/simple\.wikipedia\.org\/wiki\//}
          urlHostHint="simple.wikipedia.org/wiki/ 도메인"
          urlPlaceholder="https://simple.wikipedia.org/wiki/Photosynthesis"
          onEnqueued={onEnqueued}
        />
      )
    case 'the_conversation':
      return (
        <RssFeedTab
          source="the_conversation"
          heading="📣 The Conversation"
          subtitle="CC-BY-ND · B2~C1 논증문 (CSAT 유형) · 본문 불변(display_only)"
          feeds={[]}
          emptyIcon={Megaphone}
          urlPattern={/^https?:\/\/theconversation\.com\//}
          urlHostHint="theconversation.com 도메인"
          urlPlaceholder="https://theconversation.com/..."
          onEnqueued={onEnqueued}
        />
      )
    case 'wikinews':
      return (
        <RssFeedTab
          source="wikinews"
          heading="🗞 Wikinews"
          subtitle="CC-BY 2.5 · A2~B2 시사 · URL 직접 입력"
          feeds={[]}
          emptyIcon={Newspaper}
          urlPattern={/^https?:\/\/en\.wikinews\.org\/wiki\//}
          urlHostHint="en.wikinews.org/wiki/ 도메인"
          urlPlaceholder="https://en.wikinews.org/wiki/..."
          onEnqueued={onEnqueued}
        />
      )
  }
}
