// apps/web/src/app/(main)/library/scripts/page.tsx
//
// /library/scripts — 공용 스크립트 라이브러리 (기존 /library 콘텐츠 이전).
// 외부 gradient/max-w wrapper 는 layout.tsx 가 담당.

import Link from 'next/link'

import { CategoryChip } from '@/components/library/CategoryChip'
import { ContinueCard } from '@/components/library/ContinueCard'
import { CurationCard } from '@/components/library/CurationCard'
import { LibraryCard } from '@/components/library/LibraryCard'
import type { CategoryItem, CurationItem, LibraryText } from '@/types/library'
import { RefreshCw, Search } from 'lucide-react'

export const metadata = {
  title: '스크립트 라이브러리 · Vocaflow',
  description: '공용 영어 스크립트 컬렉션',
}

// Mock data (Supabase 연동 시 교체)
const MOCK_CONTINUE: LibraryText[] = [
  {
    id: '1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cefrLevel: 'B2',
    category: '클래식',
    preview: 'In my younger and more vulnerable years...',
    wordCount: 156,
    progressPercent: 78,
    totalPages: 12,
    currentPage: 9,
    coverGradient: { from: '#0F766E', to: '#064E3B' },
    addedAt: new Date('2024-12-01'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    isBookmarked: true,
  },
  {
    id: '2',
    title: '1984',
    author: 'George Orwell',
    cefrLevel: 'B2',
    category: '클래식',
    preview: 'It was a bright cold day in April...',
    wordCount: 89,
    progressPercent: 32,
    totalPages: 8,
    currentPage: 2,
    coverGradient: { from: '#1F2937', to: '#0F172A' },
    addedAt: new Date('2024-11-20'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isBookmarked: false,
  },
  {
    id: '3',
    title: 'Peter Pan',
    author: 'J.M. Barrie',
    cefrLevel: 'A2',
    category: '단편',
    preview: 'All children, except one, grow up...',
    wordCount: 28,
    progressPercent: 12,
    totalPages: 5,
    currentPage: 0,
    coverGradient: { from: '#155E75', to: '#0E7490' },
    addedAt: new Date('2024-11-15'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    isBookmarked: false,
  },
]

const MOCK_CATEGORIES: CategoryItem[] = [
  { emoji: '📚', label: '클래식', count: 1200 },
  { emoji: '📖', label: '현대 소설', count: 892 },
  { emoji: '✨', label: '단편', count: 1900 },
  { emoji: '🔍', label: '추리', count: 245 },
  { emoji: '🚀', label: 'SF', count: 312 },
  { emoji: '🗺', label: '모험', count: 467 },
  { emoji: '💼', label: '비즈니스', count: 178 },
]

const MOCK_CURATION: CurationItem[] = [
  {
    id: 'c1',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    cefrLevel: 'B2',
    category: '클래식',
    preview: 'It is a truth universally acknowledged...',
    wordCount: 124000,
    progressPercent: 0,
    totalPages: 80,
    currentPage: 0,
    coverGradient: { from: '#FCA5A5', to: '#B91C1C' },
    addedAt: new Date(),
    lastStudiedAt: null,
    isBookmarked: false,
    rating: 4.5,
    popularUsers: 89000,
    estimatedHours: 12,
  },
  {
    id: 'c2',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    cefrLevel: 'A2',
    category: '단편',
    preview: 'Alice was beginning to get very tired...',
    wordCount: 27000,
    progressPercent: 0,
    totalPages: 30,
    currentPage: 0,
    coverGradient: { from: '#6EE7B7', to: '#047857' },
    addedAt: new Date(),
    lastStudiedAt: null,
    isBookmarked: false,
    rating: 4.7,
    popularUsers: 67000,
    estimatedHours: 3,
  },
  {
    id: 'c3',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    cefrLevel: 'C1',
    category: '추리',
    preview: 'To Sherlock Holmes she is always the woman...',
    wordCount: 98000,
    progressPercent: 0,
    totalPages: 60,
    currentPage: 0,
    coverGradient: { from: '#475569', to: '#0F172A' },
    addedAt: new Date(),
    lastStudiedAt: null,
    isBookmarked: false,
    rating: 4.8,
    popularUsers: 112000,
    estimatedHours: 9,
  },
  {
    id: 'c4',
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    cefrLevel: 'A2',
    category: '단편',
    preview: 'Once when I was six years old...',
    wordCount: 18000,
    progressPercent: 0,
    totalPages: 27,
    currentPage: 0,
    coverGradient: { from: '#FDE68A', to: '#D97706' },
    addedAt: new Date(),
    lastStudiedAt: null,
    isBookmarked: false,
    rating: 4.9,
    popularUsers: 156000,
    estimatedHours: 2,
  },
]

const MOCK_LIBRARY: LibraryText[] = [
  {
    id: 'l1',
    title: 'The Climate Report 2024',
    author: 'National Geographic',
    cefrLevel: 'B1',
    category: '비즈니스',
    preview: 'Climate change continues to reshape...',
    wordCount: 47,
    progressPercent: 45,
    totalPages: 6,
    currentPage: 3,
    coverGradient: { from: '#1E40AF', to: '#1E3A8A' },
    addedAt: new Date('2024-12-15'),
    lastStudiedAt: new Date(),
    isBookmarked: false,
  },
  {
    id: 'l2',
    title: 'Steve Jobs Stanford Speech',
    author: 'Steve Jobs',
    cefrLevel: 'C1',
    category: '단편',
    preview: "You can't connect the dots looking forward...",
    wordCount: 32,
    progressPercent: 100,
    totalPages: 4,
    currentPage: 4,
    coverGradient: { from: '#831843', to: '#500724' },
    addedAt: new Date('2024-12-10'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isBookmarked: true,
  },
  {
    id: 'l3',
    title: 'TED Talk: How to Speak',
    author: 'Patrick Winston',
    cefrLevel: 'B2',
    category: '단편',
    preview: 'The way you speak determines how...',
    wordCount: 28,
    progressPercent: 35,
    totalPages: 4,
    currentPage: 1,
    coverGradient: { from: '#581C87', to: '#3B0764' },
    addedAt: new Date('2024-12-20'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    isBookmarked: false,
  },
  {
    id: 'l4',
    title: 'A Letter from Earth',
    author: 'Mark Twain',
    cefrLevel: 'A2',
    category: '단편',
    preview: 'Dear traveler from the stars...',
    wordCount: 22,
    progressPercent: 0,
    totalPages: 3,
    currentPage: 0,
    coverGradient: { from: '#365314', to: '#1A2E05' },
    addedAt: new Date('2024-12-25'),
    lastStudiedAt: null,
    isBookmarked: false,
  },
  {
    id: 'l5',
    title: 'Modern Web Architecture',
    author: 'Mark Allen',
    cefrLevel: 'B2',
    category: '비즈니스',
    preview: 'Building scalable systems requires...',
    wordCount: 54,
    progressPercent: 88,
    totalPages: 8,
    currentPage: 7,
    coverGradient: { from: '#7C2D12', to: '#92400E' },
    addedAt: new Date('2024-11-30'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    isBookmarked: false,
  },
]

export default function LibraryScriptsPage() {
  const stats = {
    textCount: 47,
    wordCount: 1247,
    studyHours: 23,
    avgAccuracy: 87,
  }

  return (
    <>
      {/* Header */}
      <header className="mb-8">
        <h1 className="mb-2 font-display text-[32px] font-[800] leading-[1.1] tracking-tight text-[var(--t1)] md:text-[40px]">
          스크립트 라이브러리
        </h1>
        <p className="max-w-2xl font-body text-[15px] leading-relaxed text-[var(--t2)]">
          <span className="font-english font-[600] text-[var(--t1)]">{stats.textCount}개</span>의
          영어 스크립트이 당신의 학습을 기다리고 있어요.
        </p>
      </header>

      {/* Search */}
      <section className="mb-6">
        <div className="relative max-w-3xl">
          <Search
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--t3)]"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="스크립트 · 단어 · 예문 · 저자 검색..."
            aria-label="스크립트 라이브러리 검색"
            className="focus:ring-[var(--p)]/15 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] py-3.5 pl-12 pr-20 font-body text-[15px] text-[var(--t1)] transition-all duration-[var(--dur-normal)] placeholder:text-[var(--t3)] focus:border-[var(--p)] focus:outline-none focus:ring-2"
          />
          <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[11px] text-[var(--t3)] md:inline-block">
            ⌘K
          </kbd>
        </div>
      </section>

      {/* Continue Section */}
      <section className="mb-12">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-4 bg-[var(--t3)]" aria-hidden="true" />
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">이어서 학습</h2>
            <span className="ml-1 font-display text-[12px] font-[600] text-[var(--t3)]">
              {MOCK_CONTINUE.length}
            </span>
          </div>
          <Link
            href="/text"
            className="inline-flex items-center gap-1 font-body text-[12px] font-[500] text-[var(--t3)] no-underline transition-colors duration-[var(--dur-normal)] hover:text-[var(--p)]"
          >
            전체 보기
            <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MOCK_CONTINUE.map((text) => (
            <ContinueCard key={text.id} text={text} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mb-10">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-4 bg-[var(--t3)]" aria-hidden="true" />
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">카테고리</h2>
            <span className="ml-1 font-display text-[12px] font-[600] text-[var(--t3)]">
              {MOCK_CATEGORIES.length + 6}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {MOCK_CATEGORIES.map((cat) => (
            <CategoryChip key={cat.label} category={cat} />
          ))}
          <CategoryChip category={{ emoji: '', label: '+6 더보기', count: 0 }} isMore />
        </div>
      </section>

      {/* Curation */}
      <section className="mb-12">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-4 bg-[var(--t3)]" aria-hidden="true" />
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">오늘의 추천</h2>
            <span className="ml-2 inline-block rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-0.5 font-display text-[10px] font-[700] tracking-[0.04em] text-[var(--p)]">
              큐레이션
            </span>
          </div>
          <button className="inline-flex items-center gap-1 font-body text-[12px] font-[500] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--p)]">
            새로고침
            <RefreshCw size={12} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {MOCK_CURATION.map((item) => (
            <CurationCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Library Grid */}
      <section className="mb-12">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-4 bg-[var(--t3)]" aria-hidden="true" />
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">전체 라이브러리</h2>
            <span className="ml-1 font-display text-[12px] font-[600] text-[var(--t3)]">
              {stats.textCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {MOCK_LIBRARY.map((text) => (
            <LibraryCard key={text.id} text={text} />
          ))}
        </div>
      </section>
    </>
  )
}
