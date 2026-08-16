// apps/web/src/components/textviewer/TextHubContent.tsx
//
// TextViewer 허브 본문 — Client Component.
// 실 데이터 페치 (useTexts) + 4 Tier IA 마크업 책임.

'use client'

import { BookOpen, FileText, Layers } from 'lucide-react'
import Link from 'next/link'

import { ContinueRow } from '@/components/hub/ContinueRow'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { DiscoveryFooter } from '@/components/textviewer/DiscoveryFooter'
import { EmptyState } from '@/components/textviewer/EmptyState'
import { MyLibraryCarousel } from '@/components/textviewer/MyLibraryCarousel'
import { useSubscribedSets } from '@/hooks/useSubscribedSets'
import { useTexts } from '@/hooks/useTexts'
import { useUserVLevel } from '@/hooks/useUserVLevel'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'
import { MY_LIBRARY_TABS, type MyLibraryView } from '@/lib/library/tabs'
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

  // 도서 / 낱개 본문 분리
  const books = texts.filter((t) => t.bookId)
  const scripts = texts.filter((t) => !t.bookId)

  // 지금 보고 있는 면 — 캐러셀과 **같은 규칙**으로 정한다. 헤더가 면을 모르면 어느 면에서든
  // 같은 말을 하게 되고, 실제로 그래서 Decks 면이 "스크립트을 모았어요 / 새 스크립트 추가하기"
  // 를 띄우고 있었다(사용자 지적 2026-08-16).
  const effectiveView: MyLibraryView =
    view ?? (books.length > 0 ? 'books' : scripts.length > 0 ? 'scripts' : 'vocab')

  // 면별 개수 — 헤더 문장이 지금 보는 것을 말하도록.
  const faceCount =
    effectiveView === 'books'
      ? books.length
      : effectiveView === 'scripts'
        ? scripts.length
        : subscribedSets.length
  const faceLabel = MY_LIBRARY_TABS.find((t) => t.view === effectiveView)!.label

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      <ModuleHero
        eyebrow={`My Library · ${faceLabel}`}
        title="My Library"
        note={
          // 진도(진행 중/정복)는 **읽는 자료**에만 뜻이 있다 — 구독 단어장에는 '정복한 권수' 가 없다.
          effectiveView === 'vocab'
            ? `구독한 단어장 ${faceCount}개`
            : stats.inProgress > 0
              ? `진행 중 ${stats.inProgress}권 · 정복 ${stats.conquered}권`
              : stats.conquered > 0
                ? `정복 ${stats.conquered}권 · 새로 하나 시작해 보세요`
                : `${faceCount}개를 모았어요`
        }
        gradient={{ from: '#A5B4FC', to: '#6366F1' }}
        icon={BookOpen}
        stats={[
          // 라벨은 레지스트리에서 — 여기서 '도서/스크립트/단어장' 으로 다시 짓고 있었다.
          { label: MATERIAL_LABEL.book, value: books.length, unit: '권', emphasis: true },
          { label: MATERIAL_LABEL.script, value: scripts.length, unit: '개' },
          { label: MATERIAL_LABEL.word_set, value: subscribedSets.length, unit: '개' },
        ]}
      />

      {/* 다음 행동은 **면마다 다르다**. Decks 면에 "새 스크립트 추가하기" 를 두면
          이 면이 무엇을 모으는 곳인지 잘못 가르친다(구독 단어장은 내가 쓰는 게 아니라 고르는 것). */}
      {effectiveView === 'vocab' ? (
        <Link
          href="/library/vocab"
          className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-r from-[var(--p)]/5 to-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:from-[var(--p)]/10 hover:shadow-[var(--sh-sm)]"
        >
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#A5B4FC] to-[#6366F1] text-white shadow-[var(--sh-xs)]"
            aria-hidden="true"
          >
            <Layers size={18} strokeWidth={2} />
          </span>
          <div className="flex-1">
            <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
              단어장 더 둘러보기
            </p>
            <p className="font-body text-[12px] text-[var(--t2)]">
              공용 서가에서 구독하면 여기에 쌓여요
            </p>
          </div>
          <span
            className="font-display text-[18px] font-[700] text-[var(--p)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-1"
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      ) : (
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
              {effectiveView === 'books' ? '새 책 넣기' : '새 글 넣기'}
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
      )}

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
        // 헤더와 **같은 값**을 넘긴다 — 각자 기본 면을 고르면 헤더와 캐러셀이 다른 면을 말한다.
        view={effectiveView}
      />

      <DiscoveryFooter />
    </div>
  )
}
