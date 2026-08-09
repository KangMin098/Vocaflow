// apps/web/src/components/dashboard/RecentActivity.tsx
//
// 최근 학습 활동 v3 — Phase 3-3: useHubData 연동.
//
// 디자인 (CLAUDE.md §13 / v06.21):
//   [Activity 아이콘 · 최근 N건]  [chip][chip][chip][chip][chip]  [전체 →]
//
//   chip = [모듈 dot] [짧은 라벨] [본문(점수/✓✗)] [· 시간]
//   - 좁은 viewport: 가로 스크롤
//   - 빈 상태: "아직 학습 활동이 없어요" 격려형 안내

'use client'

import { Activity } from 'lucide-react'

import { useHubData, type ModuleId } from '@/hooks/useHubData'

// ════════════════════════════════════════════════════════════
// 모듈별 시각 매핑 (FlowNav 단계 accent 정합)
// ════════════════════════════════════════════════════════════
const MODULE_COLOR: Partial<Record<ModuleId, string>> = {
  textviewer: '#8B5CF6', // purple (스크립트)
  workspace: '#8B5CF6',
  wordvault: '#6366F1', // indigo (단어)
  flashcard: '#EC4899', // pink (익히기)
  spellforge: '#EC4899',
  wordblitz: '#EC4899',
  pairflip: '#EC4899',
  scriptquiz: 'var(--memory-shaky)', // amber (정복)
  dictation: '#06B6D4', // cyan (완성)
  pirate_quest: 'var(--memory-stable)',
}

const MODULE_SHORT: Partial<Record<ModuleId, string>> = {
  textviewer: '스크립트',
  workspace: '워크',
  wordvault: '단어장',
  flashcard: '플래시',
  spellforge: '스펠',
  wordblitz: '블리츠',
  pairflip: '페어',
  scriptquiz: '퀴즈',
  dictation: '딕테',
  pirate_quest: '해적',
}

// ════════════════════════════════════════════════════════════
// RecentActivity — useHubData 자가 페치
// ════════════════════════════════════════════════════════════
export function RecentActivity() {
  const { data, isLoading } = useHubData()

  if (isLoading) {
    return (
      <div
        aria-hidden
        className="h-[58px] animate-pulse rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
      />
    )
  }

  const activities = data?.recentActivities ?? []

  return (
    <section
      aria-label={`최근 학습 활동 ${activities.length}건`}
      className="flex items-center gap-3 rounded-ios-xl bg-[var(--bg)] px-4 py-3 shadow-ios-1"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 border-r border-[var(--bd)] pr-3">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          aria-hidden="true"
        >
          <Activity size={12} strokeWidth={2.2} />
        </span>
        <div className="flex flex-col leading-none">
          <span className="font-display text-[12px] font-[700] text-[var(--t1)]">최근</span>
          <span className="mt-0.5 font-mono text-[10px] font-[600] text-[var(--t2)]">
            {activities.length}건
          </span>
        </div>
      </header>

      {/* Chip row */}
      <ul
        // 가로 스크롤 영역은 키보드로도 스크롤할 수 있어야 한다(axe scrollable-region-focusable).
        tabIndex={0}
        className="flex flex-1 items-center gap-2 overflow-x-auto rounded-[var(--r-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {activities.length === 0 ? (
          <li className="font-body text-[12px] text-[var(--t2)]">
            아직 학습 활동이 없어요 · 첫 학습을 시작해보세요
          </li>
        ) : (
          activities.map((a) => <ActivityChip key={a.id} item={a} />)
        )}
      </ul>
    </section>
  )
}

// ════════════════════════════════════════════════════════════
// ActivityChip
// ════════════════════════════════════════════════════════════
type ActivityItem = NonNullable<
  ReturnType<typeof useHubData>['data']
>['recentActivities'][number]

function ActivityChip({ item }: { item: ActivityItem }) {
  const color = MODULE_COLOR[item.module] ?? 'var(--t3)'
  const short = MODULE_SHORT[item.module] ?? item.module

  // 본문 라벨 — 게임 점수 우선, 학습 기록은 ✓/✗
  let body: string
  if (item.score !== null) {
    body = `${item.score}점`
  } else if (item.isCorrect === true) {
    body = '✓'
  } else if (item.isCorrect === false) {
    body = '✗'
  } else {
    body = ''
  }

  return (
    <li>
      <span
        title={`${short} · ${item.textTitle} · ${item.relativeTime}`}
        className="group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5"
        aria-label={`${short} ${body}, ${item.relativeTime} — ${item.textTitle}`}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-display text-[11px] font-[700]" style={{ color }}>
          {short}
        </span>
        {body && (
          <span className="font-display text-[11px] font-[600] text-[var(--t1)]">{body}</span>
        )}
        <span className="font-mono text-[10px] tabular-nums text-[var(--t2)]">
          · {item.relativeTime}
        </span>
      </span>
    </li>
  )
}
