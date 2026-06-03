// apps/web/src/app/admin/articles/AcpClient.tsx
// ACP v1.0 Phase 18 (VOA) + Phase 19 (NASA · NIH · arXiv) — 5탭 클라이언트

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Beaker, Download, FlaskConical, FolderOpen, Newspaper, Radio, Rocket } from 'lucide-react'

import type { ArticleAdminRow, ArticleStats } from '@/lib/articles/types'
import { VoaFeedTab } from './VoaFeedTab'
import { RssFeedTab } from './RssFeedTab'
import { CuratedArticlesTab } from './CuratedArticlesTab'
import { BulkArticlesTab } from './BulkArticlesTab'

type TabKey = 'mine' | 'bulk' | 'voa' | 'nasa' | 'nih' | 'arxiv'
type StatTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger'

interface Props {
  articles: ArticleAdminRow[]
  stats: ArticleStats
}

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

const ARXIV_FEEDS = [
  { id: 'cs-AI', label: 'CS — Artificial Intelligence' },
  { id: 'cs-CL', label: 'CS — Computation & Language (NLP)' },
  { id: 'cs-LG', label: 'CS — Machine Learning' },
  { id: 'q-bio', label: 'Quantitative Biology' },
  { id: 'math-HO', label: 'Math — History & Overview' },
  { id: 'physics-gen-ph', label: 'Physics — General' },
]

export function AcpClient({ articles, stats }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('mine')

  const refetchAll = (): void => {
    router.refresh()
  }

  const goToMine = (): void => {
    setTab('mine')
    setTimeout(refetchAll, 400)
  }

  return (
    <div className="flex flex-col gap-6">
      <StatsBar stats={stats} />
      <TabList tab={tab} onChange={setTab} stats={stats} />

      <div role="tabpanel" id={`acp-panel-${tab}`} aria-labelledby={`acp-tab-${tab}`}>
        {tab === 'mine' && <CuratedArticlesTab articles={articles} onChanged={refetchAll} />}
        {tab === 'bulk' && <BulkArticlesTab onEnqueued={goToMine} />}
        {tab === 'voa' && <VoaFeedTab onEnqueued={goToMine} />}
        {tab === 'nasa' && (
          <RssFeedTab
            source="nasa"
            heading="🚀 NASA"
            subtitle="U.S. federal government · Public Domain"
            feeds={NASA_FEEDS}
            emptyIcon={Rocket}
            urlPattern={/^https:\/\/(?:(?:www|apod)\.)?nasa\.gov\//}
            urlHostHint="nasa.gov / apod.nasa.gov 도메인"
            urlPlaceholder="https://www.nasa.gov/news-release/...  또는  https://apod.nasa.gov/apod/ap240519.html"
            onEnqueued={goToMine}
          />
        )}
        {tab === 'nih' && (
          <RssFeedTab
            source="nih"
            heading="🩺 NIH"
            subtitle="National Institutes of Health · Public Domain"
            feeds={NIH_FEEDS}
            emptyIcon={FlaskConical}
            urlPattern={/^https:\/\/(?:(?:www|directorsblog)\.)?nih\.gov\/|^https:\/\/medlineplus\.gov\//}
            urlHostHint="nih.gov / medlineplus.gov 도메인"
            urlPlaceholder="https://www.nih.gov/news-events/news-releases/..."
            onEnqueued={goToMine}
          />
        )}
        {tab === 'arxiv' && (
          <RssFeedTab
            source="arxiv"
            heading="📐 arXiv"
            subtitle="abstract only · CC-BY-4.0 (대부분)"
            feeds={ARXIV_FEEDS}
            emptyIcon={Beaker}
            urlPattern={/^https?:\/\/(?:www\.)?arxiv\.org\/abs\/|^arxiv:|^\d{4}\.\d{4,5}/}
            urlHostHint="arxiv.org/abs/ 또는 arxiv ID (예: 2401.12345)"
            urlPlaceholder="https://arxiv.org/abs/2401.12345  또는  2401.12345"
            onEnqueued={goToMine}
          />
        )}
      </div>
    </div>
  )
}

// ── Stats bar ────────────────────────────────────

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

// ── Tab list ─────────────────────────────────────

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Newspaper }> = [
  { key: 'mine', label: 'Curated', Icon: FolderOpen },
  { key: 'bulk', label: 'LCP 대량', Icon: Download },
  { key: 'voa', label: 'VOA', Icon: Radio },
  { key: 'nasa', label: 'NASA', Icon: Rocket },
  { key: 'nih', label: 'NIH', Icon: FlaskConical },
  { key: 'arxiv', label: 'arXiv', Icon: Beaker },
]

function TabList({
  tab,
  onChange,
  stats,
}: {
  tab: TabKey
  onChange: (t: TabKey) => void
  stats: ArticleStats
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--bd)]">
      {TABS.map(({ key, label, Icon }) => {
        const active = tab === key
        const badge = key === 'mine' && stats.total > 0 ? stats.total : null
        return (
          <button
            key={key}
            role="tab"
            id={`acp-tab-${key}`}
            aria-selected={active}
            aria-controls={`acp-panel-${key}`}
            type="button"
            onClick={() => onChange(key)}
            className={[
              'inline-flex min-h-[40px] items-center gap-2 -mb-px border-b-2 px-3',
              'font-display text-[13px] font-[600]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'border-[var(--p)] text-[var(--p)]'
                : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]',
            ].join(' ')}
          >
            <Icon size={14} aria-hidden />
            {label}
            {badge != null && (
              <span
                className="inline-flex min-w-[18px] items-center justify-center rounded-[var(--r-full)] bg-[var(--bg2)] px-1.5 font-mono text-[10px] font-[700] text-[var(--t2)]"
                aria-label={`${badge}건`}
              >
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
