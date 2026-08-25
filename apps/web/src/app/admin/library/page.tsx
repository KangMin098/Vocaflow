// apps/web/src/app/admin/library/page.tsx
// 콘텐츠 관리 — 스크립트 CRUD · CEFR · 큐레이션

'use client'

import {
  BookOpen,
  Edit3,
  Eye,
  FileText,
  Library,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { AdminToolbar } from '@/components/admin/AdminToolbar'

interface ContentItem {
  id: string
  title: string
  author: string
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  category: string
  status: 'published' | 'draft' | 'review'
  curated: boolean
  views: number
  wordCount: number
  updatedAt: string
}

const KPIS: AdminKpi[] = [
  {
    label: '총 콘텐츠',
    value: '89',
    delta: { value: 4, positive: true },
    icon: Library,
    accent: 'var(--p)',
    bg: 'var(--p-light)',
  },
  {
    label: '공식 큐레이션',
    value: '24',
    delta: { value: 2, positive: true },
    icon: Star,
    accent: 'var(--active)',
    bg: 'var(--warning-light)',
  },
  {
    label: '검토 대기',
    value: '6',
    delta: { value: 3, positive: false },
    icon: Eye,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
  },
  {
    label: '주간 학습자',
    value: '432',
    delta: { value: 11, positive: true },
    icon: Users,
    accent: '#8B5CF6',
    bg: '#F5F3FF',
  },
]

const CONTENTS: ContentItem[] = [
  {
    id: 'c-001',
    title: 'The Great Gatsby — Chapter 1',
    author: 'F. Scott Fitzgerald',
    cefr: 'B2',
    category: '소설',
    status: 'published',
    curated: true,
    views: 1240,
    wordCount: 4823,
    updatedAt: '2025-12-01',
  },
  {
    id: 'c-002',
    title: 'TED Talk · The Power of Vulnerability',
    author: 'Brené Brown',
    cefr: 'B1',
    category: '강연',
    status: 'published',
    curated: true,
    views: 980,
    wordCount: 2410,
    updatedAt: '2025-11-22',
  },
  {
    id: 'c-003',
    title: '1984 — Part One Ch.1',
    author: 'George Orwell',
    cefr: 'C1',
    category: '소설',
    status: 'published',
    curated: false,
    views: 612,
    wordCount: 5104,
    updatedAt: '2025-11-15',
  },
  {
    id: 'c-004',
    title: 'NYT Article — Climate Adaptation',
    author: 'NYT Editorial',
    cefr: 'B2',
    category: '뉴스',
    status: 'review',
    curated: false,
    views: 0,
    wordCount: 1820,
    updatedAt: '2026-01-04',
  },
  {
    id: 'c-005',
    title: 'Steve Jobs Stanford Speech',
    author: 'Steve Jobs',
    cefr: 'B1',
    category: '강연',
    status: 'published',
    curated: true,
    views: 2104,
    wordCount: 2210,
    updatedAt: '2025-08-30',
  },
  {
    id: 'c-006',
    title: 'Harry Potter — Sample',
    author: 'J.K. Rowling',
    cefr: 'A2',
    category: '소설',
    status: 'draft',
    curated: false,
    views: 0,
    wordCount: 1430,
    updatedAt: '2026-04-14',
  },
]

const CEFR_COLOR: Record<ContentItem['cefr'], string> = {
  A1: '#22C55E',
  A2: '#10B981',
  B1: '#06B6D4',
  B2: '#3B82F6',
  C1: '#8B5CF6',
  C2: '#EC4899',
}

const STATUS_META: Record<
  ContentItem['status'],
  { label: string; color: string; bg: string }
> = {
  published: { label: '공개', color: 'var(--success)', bg: 'var(--success-light)' },
  draft: { label: '초안', color: 'var(--t3)', bg: 'var(--bg3)' },
  review: { label: '검토중', color: 'var(--info)', bg: 'var(--info-light)' },
}

export default function AdminLibraryPage() {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<'all' | 'curated' | 'review' | 'draft'>('all')

  const filtered = useMemo(() => {
    return CONTENTS.filter((c) => {
      if (query) {
        const q = query.toLowerCase()
        if (!c.title.toLowerCase().includes(q) && !c.author.toLowerCase().includes(q))
          return false
      }
      if (activeChip === 'curated' && !c.curated) return false
      if (activeChip === 'review' && c.status !== 'review') return false
      if (activeChip === 'draft' && c.status !== 'draft') return false
      return true
    })
  }, [query, activeChip])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={Library}
        title="콘텐츠 관리"
        description="스크립트 CRUD · 카테고리 · 큐레이션"
        actions={
          <button className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[#8B5CF6] px-3 py-2 font-display text-[12px] font-[600] text-white shadow-[var(--sh-sm)] hover:bg-[#7C3AED]">
            <Plus size={14} aria-hidden />
            스크립트 추가
          </button>
        }
      />

      <AdminScreenHelp screen="library" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <AdminToolbar
        searchPlaceholder="제목·저자 검색"
        searchValue={query}
        onSearchChange={setQuery}
        chips={[
          {
            label: '전체',
            active: activeChip === 'all',
            count: CONTENTS.length,
            onClick: () => setActiveChip('all'),
          },
          {
            label: '큐레이션',
            active: activeChip === 'curated',
            count: CONTENTS.filter((c) => c.curated).length,
            onClick: () => setActiveChip('curated'),
          },
          {
            label: '검토',
            active: activeChip === 'review',
            count: CONTENTS.filter((c) => c.status === 'review').length,
            onClick: () => setActiveChip('review'),
          },
          {
            label: '초안',
            active: activeChip === 'draft',
            count: CONTENTS.filter((c) => c.status === 'draft').length,
            onClick: () => setActiveChip('draft'),
          },
        ]}
      />

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((c) => {
          const status = STATUS_META[c.status]
          return (
            <li
              key={c.id}
              className="group rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:border-[#8B5CF6]/40 hover:shadow-[var(--sh-md)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[700]"
                      style={{
                        backgroundColor: `${CEFR_COLOR[c.cefr]}15`,
                        color: CEFR_COLOR[c.cefr],
                      }}
                    >
                      {c.cefr}
                    </span>
                    <span
                      className="inline-flex rounded-full px-2 py-1 font-display text-[10px] font-[700]"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                    {c.curated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--active)]">
                        <Star size={9} fill="currentColor" aria-hidden />
                        큐레이션
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-[var(--t2)]">{c.category}</span>
                  </div>
                  <h3 className="mt-2 font-english text-[15px] font-[600] leading-snug text-[var(--t1)]">
                    {c.title}
                  </h3>
                  <p className="mt-0.5 font-body text-[12px] text-[var(--t2)]">{c.author}</p>
                </div>
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
                  aria-label="더보기"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--bd)] pt-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                    조회
                  </dt>
                  <dd className="mt-0.5 font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
                    {c.views.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                    단어 수
                  </dt>
                  <dd className="mt-0.5 font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
                    {c.wordCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                    수정일
                  </dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-[var(--t2)]">{c.updatedAt}</dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center gap-1 border-t border-[var(--bd)] pt-3 opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100">
                <button className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]">
                  <Edit3 size={11} aria-hidden />
                  수정
                </button>
                <button className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]">
                  <FileText size={11} aria-hidden />
                  AI 재분석
                </button>
                <button className="ml-auto inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--error-ink)] hover:bg-[var(--error-light)]">
                  <Trash2 size={11} aria-hidden />
                  삭제
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] py-12 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]">
            <BookOpen size={18} aria-hidden />
          </span>
          <p className="font-body text-[13px] text-[var(--t2)]">조건에 맞는 콘텐츠가 없어요.</p>
        </div>
      )}
    </div>
  )
}
