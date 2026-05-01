// apps/web/src/app/(main)/hub/page.tsx
// ⚠️ 개발 임시 버전 — 디자인 확인용 Mock 데이터.
//    Supabase 연동 후 fetchHubData 호출하는 원본으로 교체 예정.

import { ContinueCard } from '@/components/home/ContinueCard'
import { HubHero } from '@/components/home/HubHero'
import { ModuleCard } from '@/components/home/ModuleCard'

export const metadata = {
  title: 'Hub · Vocaflow',
  description: '오늘의 학습을 시작하세요',
}

const MOCK_DATA = {
  userName: '동현',
  streak: 23,
  reviewCount: 12,
  todayCount: 8,
  accuracy: 87,
  lastStudied: {
    text: new Date(Date.now() - 1000 * 60 * 5),
    wordvault: new Date(Date.now() - 1000 * 60 * 60 * 2),
    flashcard: new Date(Date.now() - 1000 * 60 * 60 * 4),
    spellforge: new Date(Date.now() - 1000 * 60 * 60 * 24),
    wordblitz: new Date(Date.now() - 1000 * 60 * 60 * 72),
    scriptquiz: null,
    dashboard: new Date(Date.now() - 1000 * 60 * 30),
  } as const,
  recentText: {
    id: 'mock-text-1',
    title: 'The Climate Report 2024',
    preview:
      'Climate change continues to reshape ecosystems around the world. ' +
      'Scientists report unprecedented shifts in temperature patterns and rainfall distribution across continents.',
    progressPercent: 62,
    relativeTime: '2시간 전',
    moduleLabel: '플래시카드',
    wordCount: 47,
  },
}

export default function HubPage() {
  const data = MOCK_DATA

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
      {/* ① Hero */}
      <HubHero
        userName={data.userName}
        streak={data.streak}
        reviewCount={data.reviewCount}
        todayCount={data.todayCount}
        accuracy={data.accuracy}
      />

      {/* ② Module Grid */}
      <section aria-label="학습 모듈">
        <h2 className="sr-only">학습 모듈</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <ModuleCard module="text" lastStudiedAt={data.lastStudied.text} />
          <ModuleCard module="wordvault" lastStudiedAt={data.lastStudied.wordvault} />
          <ModuleCard module="flashcard" lastStudiedAt={data.lastStudied.flashcard} />
          <ModuleCard module="spellforge" lastStudiedAt={data.lastStudied.spellforge} />
          <ModuleCard module="wordblitz" lastStudiedAt={data.lastStudied.wordblitz} />
          <ModuleCard module="scriptquiz" lastStudiedAt={data.lastStudied.scriptquiz} />
          <ModuleCard module="dashboard" lastStudiedAt={data.lastStudied.dashboard} />
        </div>
      </section>

      {/* ③ Continue */}
      <section aria-label="이어하기">
        <h2 className="sr-only">이어하기</h2>
        <ContinueCard
          textId={data.recentText.id}
          title={data.recentText.title}
          preview={data.recentText.preview}
          progressPercent={data.recentText.progressPercent}
          relativeTime={data.recentText.relativeTime}
          moduleLabel={data.recentText.moduleLabel}
          wordCount={data.recentText.wordCount}
        />
      </section>

      {/* ④ Reflection — Supabase 연동 시 활성화 */}
      <section
        aria-label="최근 학습 활동"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] md:p-8"
      >
        <h2 className="mb-4 font-display text-[18px] font-[600] text-[var(--t1)]">
          최근 학습 활동
        </h2>
        <p className="py-4 font-body text-[14px] text-[var(--t3)]">
          Supabase 연동 후 RecentActivity 컴포넌트가 표시됩니다.
        </p>
      </section>
    </div>
  )
}
