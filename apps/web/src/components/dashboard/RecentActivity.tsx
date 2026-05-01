// apps/web/src/components/dashboard/RecentActivity.tsx
// 최근 학습 활동 리스트

'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { BookMarked, Copy, HelpCircle, Pencil, Zap, type LucideIcon } from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface ActivityItem {
  id: string
  module: 'WordVault' | 'Flashcard' | 'SpellForge' | 'WordBlitz' | 'ScriptQuiz'
  action: string
  detail: string
  score?: number
  timeAgo: string
}

export interface RecentActivityProps {
  /** 활동 목록 — 미제공 시 목업 데이터 사용 */
  activities?: ActivityItem[]
}

// ══════════════════════════════════════════════════════════════
// 모듈 → 아이콘 + 색상
// ══════════════════════════════════════════════════════════════
const moduleConfig: Record<ActivityItem['module'], { icon: LucideIcon; color: string }> = {
  WordVault: { icon: BookMarked, color: '#8B5CF6' },
  Flashcard: { icon: Copy, color: '#EC4899' },
  SpellForge: { icon: Pencil, color: '#F97316' },
  WordBlitz: { icon: Zap, color: '#10B981' },
  ScriptQuiz: { icon: HelpCircle, color: '#EAB308' },
}

// ══════════════════════════════════════════════════════════════
// 목업 데이터 (activities prop 미제공 시 폴백)
// ══════════════════════════════════════════════════════════════
const defaultActivities: ActivityItem[] = [
  {
    id: '1',
    module: 'Flashcard',
    action: '학습 완료',
    detail: 'Day 12 · 20개 단어',
    score: 92,
    timeAgo: '10분 전',
  },
  {
    id: '2',
    module: 'SpellForge',
    action: '신기록 달성',
    detail: '어려움 난이도',
    score: 88,
    timeAgo: '1시간 전',
  },
  {
    id: '3',
    module: 'WordVault',
    action: '단어 12개 추가',
    detail: 'TED Talk · The Power of Habit',
    timeAgo: '3시간 전',
  },
  {
    id: '4',
    module: 'WordBlitz',
    action: '라운드 완료',
    detail: '정글 어드벤처 Stage 5',
    score: 76,
    timeAgo: '어제',
  },
  {
    id: '5',
    module: 'ScriptQuiz',
    action: '퀴즈 풀이',
    detail: 'BBC News · 5문제',
    score: 80,
    timeAgo: '2일 전',
  },
]

// ══════════════════════════════════════════════════════════════
// RecentActivity
// ══════════════════════════════════════════════════════════════
export function RecentActivity({ activities = defaultActivities }: RecentActivityProps = {}) {
  return (
    <Card variant="default" padding="md" className="h-full rounded-xl">
      <CardHeader>
        <CardTitle>최근 학습 활동</CardTitle>
        <CardDescription>지난 활동 {activities.length}건</CardDescription>
      </CardHeader>

      <div className="space-y-s-1">
        {activities.map((item) => {
          const config = moduleConfig[item.module]
          const Icon = config.icon

          return (
            <div
              key={item.id}
              className="group flex cursor-pointer items-start gap-s-3 rounded-lg p-s-2 transition-colors duration-normal hover:bg-bg2"
            >
              {/* 아이콘 칩 */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-normal group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${config.color}25, ${config.color}10)`,
                  border: `1px solid ${config.color}30`,
                }}
              >
                <Icon size={15} style={{ color: config.color }} />
              </div>

              {/* 내용 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-s-2">
                  <span
                    className="truncate font-display text-sm font-bold"
                    style={{ color: config.color }}
                  >
                    {item.module}
                  </span>
                  <span className="shrink-0 font-body text-xs text-t1">· {item.action}</span>
                </div>
                <div className="mt-[1px] truncate font-body text-xs text-t3">{item.detail}</div>
              </div>

              {/* 우측: 점수 + 시간 */}
              <div className="shrink-0 text-right">
                {item.score !== undefined && (
                  <div className="font-mono text-sm font-extrabold tabular-nums text-t1">
                    {item.score}
                    <span className="text-[10px] font-medium text-t3">점</span>
                  </div>
                )}
                <div className="font-mono text-[10px] uppercase tracking-wider text-t3">
                  {item.timeAgo}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 더보기 */}
      <button
        type="button"
        onClick={() => alert('전체 기록 (Phase 2)')}
        className="mt-s-3 w-full rounded-lg py-s-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3 transition-colors duration-normal hover:bg-bg2 hover:text-p"
      >
        전체 기록 보기 →
      </button>
    </Card>
  )
}
