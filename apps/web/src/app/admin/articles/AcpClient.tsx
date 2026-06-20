// apps/web/src/app/admin/articles/AcpClient.tsx
// ACP v1.0 — 탭 클라이언트.
// 활성 소스 (v06.69 기준): VOA · NASA · NIH · Simple Wikipedia · The Conversation · Wikinews.
// arxiv 는 v06.69 에서 플랫폼 전체 삭제 (사용자 명시).

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Download, FlaskConical, FolderOpen, Megaphone, Newspaper, Radio, Rocket } from 'lucide-react'

import type { ArticleAdminRow, ArticleStats } from '@/lib/articles/types'
import { VoaFeedTab } from './VoaFeedTab'
import { RssFeedTab } from './RssFeedTab'
import { CuratedArticlesTab } from './CuratedArticlesTab'
import { BulkArticlesTab } from './BulkArticlesTab'

type TabKey =
  | 'mine' | 'bulk' | 'voa' | 'nasa' | 'nih' | 'simple_wikipedia' | 'the_conversation' | 'wikinews'
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
      <RegisterCefrMatrix articles={articles} />
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
        {tab === 'simple_wikipedia' && (
          <RssFeedTab
            source="simple_wikipedia"
            heading="📘 Simple English Wikipedia"
            subtitle="CC-BY-SA · A2~B1 설명문 (전 주제) · URL 직접 입력"
            feeds={[]}
            emptyIcon={BookOpen}
            urlPattern={/^https?:\/\/simple\.wikipedia\.org\/wiki\//}
            urlHostHint="simple.wikipedia.org/wiki/ 도메인"
            urlPlaceholder="https://simple.wikipedia.org/wiki/Photosynthesis"
            onEnqueued={goToMine}
          />
        )}
        {tab === 'the_conversation' && (
          <RssFeedTab
            source="the_conversation"
            heading="📣 The Conversation"
            subtitle="CC-BY-ND · B2~C1 논증문 (CSAT 유형) · 본문 불변(display_only)"
            feeds={[]}
            emptyIcon={Megaphone}
            urlPattern={/^https?:\/\/theconversation\.com\//}
            urlHostHint="theconversation.com 도메인"
            urlPlaceholder="https://theconversation.com/..."
            onEnqueued={goToMine}
          />
        )}
        {tab === 'wikinews' && (
          <RssFeedTab
            source="wikinews"
            heading="🗞 Wikinews"
            subtitle="CC-BY 2.5 · A2~B2 시사 · URL 직접 입력"
            feeds={[]}
            emptyIcon={Newspaper}
            urlPattern={/^https?:\/\/en\.wikinews\.org\/wiki\//}
            urlHostHint="en.wikinews.org/wiki/ 도메인"
            urlPlaceholder="https://en.wikinews.org/wiki/..."
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

// ── Register × CEFR 매트릭스 (ACP §18 §4-B) ──────────
// 큐레이션을 "소스 더 넣기"가 아니라 "빈 칸 채우기"로 — register×cefr 균형 관리.

const MATRIX_REGISTERS: Array<{ key: string; label: string }> = [
  { key: 'expository', label: '설명' },
  { key: 'argumentative', label: '논증' },
  { key: 'news', label: '시사' },
  { key: 'narrative', label: '내러티브' },
  { key: 'reference', label: '참고' },
]
const MATRIX_CEFRS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function RegisterCefrMatrix({ articles }: { articles: ArticleAdminRow[] }) {
  const counts = new Map<string, number>()
  let unclassified = 0
  for (const a of articles) {
    if (!a.register || !a.cefr_level) {
      unclassified++
      continue
    }
    const key = `${a.register}|${a.cefr_level}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return (
    <section
      aria-label="레지스터 × CEFR 분포"
      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">
          레지스터 × CEFR 분포
        </h2>
        <span className="font-mono text-[10px] text-[var(--t3)]">
          빈 칸(·) = 큐레이션 우선 채움
          {unclassified > 0 ? ` · 미분류 ${unclassified}` : ''}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--t3)]">
              <th className="px-2 py-1 text-left font-[600]">register \ CEFR</th>
              {MATRIX_CEFRS.map((c) => (
                <th key={c} className="px-2 py-1 font-mono font-[700]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_REGISTERS.map((r) => (
              <tr key={r.key} className="border-t border-[var(--bd)]">
                <td className="px-2 py-1 text-left font-display text-[12px] font-[600] text-[var(--t2)]">
                  {r.label}
                </td>
                {MATRIX_CEFRS.map((c) => {
                  const n = counts.get(`${r.key}|${c}`) ?? 0
                  return (
                    <td
                      key={c}
                      className="px-2 py-1 font-mono text-[12px] tabular-nums"
                      style={{
                        color: n > 0 ? 'var(--t1)' : 'var(--t5)',
                        backgroundColor: n > 0 ? 'var(--learn-known-light)' : 'transparent',
                      }}
                    >
                      {n > 0 ? n : '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Tab list ─────────────────────────────────────

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Newspaper }> = [
  { key: 'mine', label: 'Curated', Icon: FolderOpen },
  { key: 'bulk', label: 'LCP 대량', Icon: Download },
  { key: 'voa', label: 'VOA', Icon: Radio },
  { key: 'nasa', label: 'NASA', Icon: Rocket },
  { key: 'nih', label: 'NIH', Icon: FlaskConical },
  { key: 'simple_wikipedia', label: 'Wikipedia', Icon: BookOpen },
  { key: 'the_conversation', label: 'Conversation', Icon: Megaphone },
  { key: 'wikinews', label: 'Wikinews', Icon: Newspaper },
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
