// apps/web/src/components/textviewer/TextHubContent.tsx
//
// TextViewer 허브 본문 — Client Component.
// 실 데이터 페치 (useTexts) + 4 Tier IA 마크업 책임.

'use client'

import { BookOpen, FileText } from 'lucide-react'
import Link from 'next/link'

import { ContinueRow } from '@/components/hub/ContinueRow'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { DiscoveryFooter } from '@/components/textviewer/DiscoveryFooter'
import { EmptyState } from '@/components/textviewer/EmptyState'
import { MyLibraryCarousel } from '@/components/textviewer/MyLibraryCarousel'
import { useSubscribedSets } from '@/hooks/useSubscribedSets'
import { useTexts } from '@/hooks/useTexts'
import { useUserVLevel } from '@/hooks/useUserVLevel'
import type { MyLibraryView } from '@/lib/library/tabs'
import { workspaceHref } from '@/lib/text-viewer/workspace-href'

// v06.34 — 보라 saturate 폐기. 슬레이트 인디고 계열로 — Lora 영문 자료 정합 + Calm UI
const TEXT_ACCENT = '#6366F1'

function TextHubLoadingSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10"
      aria-busy="true"
      aria-label="스크립트 라이브러리 불러오는 중"
    >
      <div className="h-[180px] animate-pulse rounded-[var(--r-2xl)] bg-[var(--bg2)]" />
      <div className="h-[68px] animate-pulse rounded-[var(--r-lg)] bg-[var(--bg2)]" />
      <div className="h-[120px] animate-pulse rounded-[var(--r-lg)] bg-[var(--bg2)]" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[200px] animate-pulse rounded-[var(--r-lg)] bg-[var(--bg2)]"
          />
        ))}
      </div>
    </div>
  )
}

export function TextHubContent({ view = null }: { view?: MyLibraryView | null }) {
  const { texts, isLoading, stats, continueText } = useTexts()
  const { sets: subscribedSets } = useSubscribedSets()
  const userVLevel = useUserVLevel()

  if (isLoading) {
    return <TextHubLoadingSkeleton />
  }

  if (stats.total === 0 && subscribedSets.length === 0) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
        <EmptyState />
      </div>
    )
  }

  // 도서 / 스크립트 분리
  const books = texts.filter((t) => t.bookId)
  const scripts = texts.filter((t) => !t.bookId)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      <ModuleHero
        eyebrow="스크립트 · 내 라이브러리"
        title="내 라이브러리"
        note={
          stats.inProgress > 0
            ? `진행 중 ${stats.inProgress}권 · 정복 ${stats.conquered}권`
            : stats.conquered > 0
              ? `정복 ${stats.conquered}권 · 새 스크립트을 시작해 보세요`
              : `${stats.total}권의 스크립트을 모았어요`
        }
        gradient={{ from: '#A5B4FC', to: '#6366F1' }}
        icon={BookOpen}
        stats={[
          { label: '도서', value: books.length, unit: '권', emphasis: true },
          { label: '스크립트', value: scripts.length, unit: '개' },
          { label: '단어장', value: subscribedSets.length, unit: '개' },
        ]}
      />

      <Link
        href="/text/new"
        className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-r from-[var(--p)]/5 to-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:from-[var(--p)]/10 hover:shadow-[var(--sh-sm)]"
      >
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#A5B4FC] to-[#6366F1] text-white shadow-[var(--sh-xs)]"
          aria-hidden="true"
        >
          <FileText size={18} strokeWidth={2} />
        </span>
        <div className="flex-1">
          <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
            새 스크립트 추가하기
          </p>
          <p className="font-body text-[12px] text-[var(--t2)]">
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

      {continueText && (
        <ContinueRow
          accent={TEXT_ACCENT}
          href={workspaceHref(continueText)}
          session={{
            title: continueText.title,
            subtitle: `${continueText.currentPage} / ${continueText.totalPages} 페이지 — 어제 멈춘 자리에서 이어집니다`,
            progress: continueText.progressPercent / 100,
            hint: continueText.author,
          }}
        />
      )}

      <MyLibraryCarousel
        books={books}
        scripts={scripts}
        vocabSets={subscribedSets}
        userVLevel={userVLevel}
        view={view}
      />

      <DiscoveryFooter />
    </div>
  )
}
