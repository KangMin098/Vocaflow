// apps/web/src/app/(main)/text/page.tsx
//
// TextViewer 허브 — 사용자 입력 스크립트 라이브러리
// CLAUDE.md §17.1 L1 Acquire — 누적 자산 관리 + 신규 입력 진입점
//
// 4 Tier IA:
//   Tier 1: ModuleHero (통계 + 신규 추가 CTA)
//   Tier 2: ContinueRow (가장 최근 진행 중 1개 — Zeigarnik)
//   Tier 3: MyTextsGrid (CEFR 필터 + 검색 + 카드 그리드)
//   Tier 4: DiscoveryFooter (/library 전환)
//
// 학습 과학 매핑:
//   - Zeigarnik: Continue Row 미완료 surface
//   - Endowment Effect: 통계로 자기 자산 인지
//   - Self-determination: 4가지 행동 자율 선택
//   - Cognitive Load: 4 Tier 제한

import { BookOpen, FileText } from 'lucide-react'
import Link from 'next/link'

import { ContinueRow } from '@/components/hub/ContinueRow'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { DiscoveryFooter } from '@/components/textviewer/DiscoveryFooter'
import { EmptyState } from '@/components/textviewer/EmptyState'
import { MyTextsGrid } from '@/components/textviewer/MyTextsGrid'
import type { LibraryText } from '@/types/library'

export const metadata = {
  title: '스크립트 · Vocaflow',
  description: '내가 쌓아온 영어 스크립트 라이브러리',
}

// TextViewer accent — distinct from /flashcard, /spellforge
const TEXT_ACCENT = '#8B5CF6'

// Mock data — Phase 2: Supabase texts 테이블 fetch (user_id, last_opened DESC)
const MOCK_TEXTS: LibraryText[] = [
  {
    id: '1',
    title: 'The Great Gatsby — Chapter 1',
    author: 'F. Scott Fitzgerald',
    cefrLevel: 'B2',
    category: '클래식',
    preview: 'In my younger and more vulnerable years...',
    wordCount: 32,
    progressPercent: 72,
    totalPages: 12,
    currentPage: 9,
    coverGradient: { from: '#0F766E', to: '#064E3B' },
    addedAt: new Date('2024-12-01'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isBookmarked: true,
  },
  {
    id: '2',
    title: 'TED · Power of Vulnerability',
    author: 'Brené Brown',
    cefrLevel: 'B1',
    category: '강연',
    preview: 'I have had a slightly different relationship with vulnerability...',
    wordCount: 24,
    progressPercent: 45,
    totalPages: 6,
    currentPage: 3,
    coverGradient: { from: '#7C3AED', to: '#4C1D95' },
    addedAt: new Date('2024-11-25'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    isBookmarked: false,
  },
  {
    id: '3',
    title: 'Steve Jobs Stanford Speech',
    author: 'Steve Jobs',
    cefrLevel: 'B2',
    category: '연설',
    preview: 'Today I want to tell you three stories from my life...',
    wordCount: 18,
    progressPercent: 100,
    totalPages: 4,
    currentPage: 4,
    coverGradient: { from: '#DC2626', to: '#7F1D1D' },
    addedAt: new Date('2024-11-15'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    isBookmarked: true,
  },
  {
    id: '4',
    title: 'NYT · Tech Trends 2024',
    author: 'NYT Editorial',
    cefrLevel: 'C1',
    category: '뉴스',
    preview: 'Artificial intelligence has reshaped how we approach...',
    wordCount: 41,
    progressPercent: 28,
    totalPages: 8,
    currentPage: 2,
    coverGradient: { from: '#1F2937', to: '#0F172A' },
    addedAt: new Date('2024-12-05'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    isBookmarked: false,
  },
  {
    id: '5',
    title: 'A Brief History of Time — Ch.1',
    author: 'Stephen Hawking',
    cefrLevel: 'C1',
    category: '과학',
    preview: 'The universe is everything that exists...',
    wordCount: 27,
    progressPercent: 12,
    totalPages: 10,
    currentPage: 1,
    coverGradient: { from: '#0EA5E9', to: '#075985' },
    addedAt: new Date('2024-12-03'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    isBookmarked: false,
  },
  {
    id: '6',
    title: 'Peter Pan — Opening',
    author: 'J.M. Barrie',
    cefrLevel: 'A2',
    category: '단편',
    preview: 'All children, except one, grow up...',
    wordCount: 22,
    progressPercent: 0,
    totalPages: 5,
    currentPage: 0,
    coverGradient: { from: '#155E75', to: '#0E7490' },
    addedAt: new Date('2024-12-08'),
    lastStudiedAt: null,
    isBookmarked: false,
  },
]

export default function TextViewerHubPage() {
  // Stats summary
  const total = MOCK_TEXTS.length
  const conquered = MOCK_TEXTS.filter((t) => t.progressPercent >= 100).length
  const inProgress = MOCK_TEXTS.filter(
    (t) => t.progressPercent > 0 && t.progressPercent < 100,
  ).length

  // Continue: most recent in-progress text
  const continueText = MOCK_TEXTS
    .filter((t) => t.progressPercent > 0 && t.progressPercent < 100)
    .sort((a, b) => {
      const aTime = a.lastStudiedAt?.getTime() ?? 0
      const bTime = b.lastStudiedAt?.getTime() ?? 0
      return bTime - aTime
    })[0]

  // Empty state
  if (total === 0) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* Tier 1: Hero */}
      <ModuleHero
        eyebrow="스크립트 · 내 라이브러리"
        title="내 라이브러리"
        note={
          inProgress > 0
            ? `진행 중 ${inProgress}권 · 정복 ${conquered}권`
            : conquered > 0
              ? `정복 ${conquered}권 · 새 스크립트을 시작해 보세요`
              : `${total}권의 스크립트을 모았어요`
        }
        gradient={{ from: '#A78BFA', to: '#6D28D9' }}
        icon={BookOpen}
        stats={[
          { label: '진행 중', value: inProgress, unit: '권', emphasis: true },
          { label: '정복', value: conquered, unit: '권' },
          { label: '내 스크립트', value: total, unit: '권' },
        ]}
      />

      {/* Tier 1.5: New input CTA — visually integrated with Hero */}
      <Link
        href="/text/new"
        className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-r from-[var(--p)]/5 to-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:from-[var(--p)]/10 hover:shadow-[var(--sh-sm)]"
      >
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#A78BFA] to-[#6D28D9] text-white shadow-[var(--sh-xs)]"
          aria-hidden="true"
        >
          <FileText size={18} strokeWidth={2} />
        </span>
        <div className="flex-1">
          <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
            새 스크립트 추가하기
          </p>
          <p className="font-body text-[12px] text-[var(--t3)]">
            텍스트 직접 입력 · PDF · DOCX · TXT · URL
          </p>
        </div>
        <span
          className="font-display text-[18px] font-[700] text-[var(--p)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-1"
          aria-hidden="true"
        >
          →
        </span>
      </Link>

      {/* Tier 2: Continue */}
      {continueText && (
        <ContinueRow
          accent={TEXT_ACCENT}
          href={`/text/${continueText.id}`}
          session={{
            title: continueText.title,
            subtitle: `${continueText.currentPage} / ${continueText.totalPages} 페이지 — 어제 멈춘 자리에서 이어집니다`,
            progress: continueText.progressPercent / 100,
            hint: continueText.author,
          }}
        />
      )}

      {/* Tier 3: My Texts */}
      <MyTextsGrid texts={MOCK_TEXTS} />

      {/* Tier 4: Discovery */}
      <DiscoveryFooter />
    </div>
  )
}
