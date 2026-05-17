// apps/web/src/app/admin/articles/AcpClient.tsx
// ACP v1.0 Phase 18 — 2탭 클라이언트: VOA Feed + Curated Articles

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Newspaper, Radio } from 'lucide-react'

import type { ArticleAdminRow, ArticleStats } from '@/lib/articles/types'
import { VoaFeedTab } from './VoaFeedTab'
import { CuratedArticlesTab } from './CuratedArticlesTab'

type TabKey = 'voa' | 'mine'
type StatTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger'

interface Props {
  articles: ArticleAdminRow[]
  stats: ArticleStats
}

export function AcpClient({ articles, stats }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('voa')

  const refetchAll = (): void => {
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <StatsBar stats={stats} />
      <TabList tab={tab} onChange={setTab} stats={stats} />

      <div role="tabpanel" id={`acp-panel-${tab}`} aria-labelledby={`acp-tab-${tab}`}>
        {tab === 'voa' && <VoaFeedTab onEnqueued={() => { setTab('mine'); setTimeout(refetchAll, 400) }} />}
        {tab === 'mine' && <CuratedArticlesTab articles={articles} onChanged={refetchAll} />}
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
  { key: 'voa', label: 'VOA RSS', Icon: Radio },
  { key: 'mine', label: 'Curated Articles', Icon: FolderOpen },
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
