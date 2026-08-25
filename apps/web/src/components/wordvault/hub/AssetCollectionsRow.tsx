// apps/web/src/components/wordvault/hub/AssetCollectionsRow.tsx
//
// AssetCollectionsRow — 출처별 자산 컬렉션 (Endowment Effect 핵심)
// CLAUDE.md §17.10 IA — 자산 hub 의 PRIMARY 조직 단위
//
// 컬렉션 type 3종:
//   - 'text'   : 스크립트 자동 그룹 (texts.text_id 기반)
//   - 'custom' : 사용자 정의 (Phase 2)
//   - 'auto'   : 자동 큐레이션 (예: "이번 주 만난 단어")
//
// CollectionsCarousel(v06.16) 대체 — 더 풍부한 카드 (type 배지 + 분포 mini bar).
//
// 디자인 의도:
//   - 카드별 type 배지 + 4색 mini distribution bar (4px)
//   - 데스크톱 (≤3개): grid-cols-3 / 가로 스크롤 (4개 이상 또는 모바일)
//   - hover: -translate-y-0.5 + shadow-md (자산 가치감)
//
// 5관점:
//   - 실용: 출처별 1클릭 진입 (browse?textId=X / filter=recent7d 등)
//   - 접근성: aria-label 풀텍스트, snap-x 키보드 네비
//   - 디자인: type 색 차별 (스크립트=p / 내가만든=bg3 / 추천=active)

'use client'

import { ArrowRight, Clock, Flame, History, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

export type CollectionType = 'text' | 'custom' | 'auto'

export interface AssetCollection {
  id: string
  type: CollectionType
  title: string
  subtitle?: string
  wordCount: number
  /** 4색 분포 — mini bar 용 */
  distribution: { stable: number; shaky: number; risk: number; new: number }
  /** 카드 클릭 시 이동 URL */
  href: string
  /** 자동 큐레이션 카드 식별용 아이콘 */
  iconName?: 'history' | 'sparkles' | 'clock' | 'flame'
}

interface AssetCollectionsRowProps {
  collections: AssetCollection[]
}

const TYPE_BADGE: Record<
  CollectionType,
  { label: string; class: string }
> = {
  text: {
    label: '스크립트',
    class: 'bg-[var(--p-light)] text-[var(--on-p-tint)]',
  },
  custom: {
    label: '내가 만든',
    class: 'bg-[var(--bg3)] text-[var(--t2)]',
  },
  auto: {
    label: '추천',
    class: 'bg-[var(--active-light)] text-[var(--active)]',
  },
}

const ICON_MAP: Record<
  NonNullable<AssetCollection['iconName']>,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  history: History,
  sparkles: Sparkles,
  clock: Clock,
  flame: Flame,
}

export function AssetCollectionsRow({ collections }: AssetCollectionsRowProps) {
  if (collections.length === 0) return null

  // 정렬: auto 우선 → text → custom (instruction 기본 정렬 정합)
  const sorted = [...collections].sort((a, b) => {
    const order: Record<CollectionType, number> = { auto: 0, text: 1, custom: 2 }
    return order[a.type] - order[b.type]
  })

  const useScroll = sorted.length > 3

  return (
    <section aria-label="내 어휘 컬렉션">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            컬렉션
          </h2>
          <p className="font-body text-[11px] text-[var(--t2)]">
            출처별로 묶인 내 단어들
          </p>
        </div>
      </header>

      <div
        className={
          useScroll
            ? '-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]'
            : 'grid grid-cols-1 gap-3 md:grid-cols-3'
        }
      >
        {sorted.map((c) => (
          <CollectionCard key={c.id} collection={c} compact={useScroll} />
        ))}
      </div>
    </section>
  )
}

function CollectionCard({
  collection: c,
  compact,
}: {
  collection: AssetCollection
  compact: boolean
}) {
  const badge = TYPE_BADGE[c.type]
  const Icon = c.iconName ? ICON_MAP[c.iconName] : null

  return (
    <Link
      href={c.href}
      aria-label={`${c.title} 컬렉션 — ${c.wordCount}개 단어`}
      className={`group flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 ${
        compact ? 'min-w-[280px] snap-start md:min-w-[300px]' : ''
      }`}
    >
      {/* Top — type badge + optional icon */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700] uppercase tracking-wider ${badge.class}`}
        >
          {badge.label}
        </span>
        {Icon && (
          <span className="text-[var(--t2)]" aria-hidden="true">
            <Icon width={13} height={13} strokeWidth={2} />
          </span>
        )}
      </div>

      {/* Title + subtitle */}
      <div>
        <h3 className="line-clamp-1 font-display text-[15px] font-[700] text-[var(--t1)]">
          {c.title}
        </h3>
        {c.subtitle && (
          <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t2)]">
            {c.subtitle}
          </p>
        )}
      </div>

      {/* Mini 4-color distribution */}
      <MiniBar distribution={c.distribution} />

      {/* Bottom — word count + arrow */}
      <div className="mt-auto flex items-end justify-between">
        <span className="font-display text-[20px] font-[800] tabular-nums leading-none text-[var(--t1)]">
          {c.wordCount}
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[var(--p)]"
          aria-hidden="true"
        />
      </div>
    </Link>
  )
}

function MiniBar({
  distribution: d,
}: {
  distribution: AssetCollection['distribution']
}) {
  const total = d.stable + d.shaky + d.risk + d.new
  if (total === 0) return null

  const segments = [
    { key: 'stable', count: d.stable, color: 'var(--memory-stable)' },
    { key: 'shaky', count: d.shaky, color: 'var(--memory-shaky)' },
    { key: 'risk', count: d.risk, color: 'var(--memory-risk)' },
    { key: 'new', count: d.new, color: 'var(--memory-new)' },
  ].filter((s) => s.count > 0)

  return (
    <div
      role="img"
      aria-label={`분포: 안정 ${d.stable}, 흔들림 ${d.shaky}, 위급 ${d.risk}, 신규 ${d.new}`}
      className="flex h-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
    >
      {segments.map((seg) => (
        <span
          key={seg.key}
          className="block h-full"
          style={{
            width: `${(seg.count / total) * 100}%`,
            backgroundColor: seg.color,
          }}
        />
      ))}
    </div>
  )
}
