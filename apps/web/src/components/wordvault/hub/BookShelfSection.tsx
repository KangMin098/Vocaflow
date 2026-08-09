// apps/web/src/components/wordvault/hub/BookShelfSection.tsx
//
// BookShelfSection — "내 단어장 성장" 섹션 (v06.14 → v06.20 hybrid)
//
// AssetCollectionsRow 의 자산-출처 카드 디자인 언어를 계승하면서,
// 5 Book Type (text · level · smart · goal · theme) 으로 확장한 "내 책장".
//
// Book Type:
//   - text  : 스크립트 자동 그룹 (texts 1건당 1 book)
//   - level : CEFR 자동 그룹 (단어 1+ 인 레벨만)
//   - smart : 스마트 큐 (위급/신규 등 동적 — 1+ 일 때만)
//   - goal  : 목표 (Phase 2 잠금)
//   - theme : 주제 (Phase 2 잠금)
//
// 디자인:
//   - 카드 디자인 = AssetCollectionsRow CollectionCard 와 동일 언어 (일관성)
//   - 데스크톱 ≤3개: grid-cols-3 / 4+ 또는 모바일: snap-x 가로 스크롤
//   - Phase 2 잠금: opacity-50 + "곧 추가됩니다" + pointer-events-none

'use client'

import { ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'

export type BookType = 'text' | 'shared' | 'level' | 'smart' | 'goal' | 'theme'

export interface VaultBook {
  id: string
  type: BookType
  title: string
  subtitle: string
  wordCount: number
  distribution: { stable: number; shaky: number; risk: number; new: number }
  /** 'text' 타입 전용 — 정복 진행 상태 배지 */
  textStatus?: 'in-progress' | 'extracted' | 'conquered'
  href: string
  /** Phase 2 잠금 카드 */
  isLocked?: boolean
}

interface BookShelfSectionProps {
  books: VaultBook[]
}

const TYPE_BADGE: Record<BookType, { label: string; className: string }> = {
  text: {
    label: '스크립트',
    className: 'bg-[var(--p-light)] text-[var(--on-p-tint)]',
  },
  shared: {
    label: '공용 단어장',
    className: 'bg-[#8B5CF6]/10 text-[#6D28D9]',
  },
  level: {
    label: '레벨',
    className: 'bg-[var(--info-light)] text-[var(--info)]',
  },
  smart: {
    label: '스마트',
    className: 'bg-[var(--active-light)] text-[var(--active)]',
  },
  goal: {
    label: '목표',
    className: 'bg-[var(--bg3)] text-[var(--t2)]',
  },
  theme: {
    label: '주제',
    className: 'bg-[var(--bg3)] text-[var(--t2)]',
  },
}

const TEXT_STATUS_BADGE: Record<
  NonNullable<VaultBook['textStatus']>,
  { label: string; className: string }
> = {
  'in-progress': { label: '진행 중', className: 'text-[var(--p)]' },
  extracted: { label: '추출 완료', className: 'text-[var(--t2)]' },
  conquered: { label: '정복 ✓', className: 'text-[var(--success)]' },
}

export function BookShelfSection({ books }: BookShelfSectionProps) {
  if (books.length === 0) return null

  // 정렬: 활성(잠금 X) 먼저, 그 안에서 type 우선순위 (text → level → smart → goal → theme)
  const order: Record<BookType, number> = {
    shared: 0,
    text: 1,
    level: 2,
    smart: 3,
    goal: 4,
    theme: 5,
  }
  const sorted = [...books].sort((a, b) => {
    if (!!a.isLocked !== !!b.isLocked) return a.isLocked ? 1 : -1
    return order[a.type] - order[b.type]
  })

  const useScroll = sorted.length > 3

  return (
    <section aria-label="내 단어장 성장">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            📚 내 단어장 성장
          </h2>
          <p className="font-body text-[11px] text-[var(--t2)]">
            출처·레벨·스마트 큐로 묶인 내 단어장
          </p>
        </div>
      </header>

      <div
        className={
          useScroll
            ? '-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]'
            : 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'
        }
      >
        {sorted.map((book) => (
          <BookCard key={book.id} book={book} compact={useScroll} />
        ))}
      </div>
    </section>
  )
}

function BookCard({ book, compact }: { book: VaultBook; compact: boolean }) {
  const badge = TYPE_BADGE[book.type]
  const textBadge = book.textStatus ? TEXT_STATUS_BADGE[book.textStatus] : null

  const baseClass = `group flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] ease-[var(--ease)] ${
    compact ? 'min-w-[280px] snap-start md:min-w-[300px]' : ''
  }`

  if (book.isLocked) {
    return (
      <div
        aria-label={`${book.title} — 곧 추가됩니다`}
        aria-disabled="true"
        className={`${baseClass} pointer-events-none opacity-50`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-wider ${badge.className}`}
          >
            {badge.label}
          </span>
          <Lock size={13} className="text-[var(--t2)]" aria-hidden="true" />
        </div>
        <div>
          <h3 className="line-clamp-1 font-display text-[15px] font-[700] text-[var(--t1)]">
            {book.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t2)]">
            {book.subtitle}
          </p>
        </div>
        <p className="mt-auto font-body text-[11px] text-[var(--t2)]">곧 추가됩니다</p>
      </div>
    )
  }

  return (
    <Link
      href={book.href}
      aria-label={`${book.title} 단어장 — ${book.wordCount}개 단어`}
      className={`${baseClass} hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2`}
    >
      {/* Top — type badge + (text 한정) status */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </span>
        {textBadge && (
          <span
            className={`font-display text-[10px] font-[700] uppercase tracking-wider ${textBadge.className}`}
          >
            {textBadge.label}
          </span>
        )}
      </div>

      {/* Title + subtitle */}
      <div>
        <h3 className="line-clamp-1 font-display text-[15px] font-[700] text-[var(--t1)]">
          {book.title}
        </h3>
        <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t2)]">
          {book.subtitle}
        </p>
      </div>

      {/* Mini 4-color distribution */}
      <MiniBar distribution={book.distribution} />

      {/* Bottom — word count + arrow */}
      <div className="mt-auto flex items-end justify-between">
        <span className="font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--t1)]">
          {book.wordCount}
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
  distribution: VaultBook['distribution']
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
