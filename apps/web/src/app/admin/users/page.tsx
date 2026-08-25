// apps/web/src/app/admin/users/page.tsx
// 사용자 관리 — 목록 + KPI + 검색/필터 + 상태 액션
// 인지 부하: 6열 한정, 핵심 지표만 KPI 4개

'use client'

import {
  Activity,
  Crown,
  Flame,
  MoreHorizontal,
  Plus,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { AdminToolbar } from '@/components/admin/AdminToolbar'

interface AdminUser {
  id: string
  name: string
  email: string
  plan: 'free' | 'pro' | 'team'
  status: 'active' | 'suspended' | 'inactive'
  streak: number
  joinedAt: string
  lastActive: string
}

const KPIS: AdminKpi[] = [
  {
    label: '총 사용자',
    value: '1,247',
    delta: { value: 12, positive: true },
    icon: Users,
    accent: '#8B5CF6',
    bg: '#F5F3FF',
  },
  {
    label: '오늘 활성',
    value: '348',
    delta: { value: 8, positive: true },
    icon: TrendingUp,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
    hint: 'DAU · 28% engagement',
  },
  {
    label: 'Pro 구독',
    value: '184',
    delta: { value: 3, positive: true },
    icon: Crown,
    accent: 'var(--p)',
    bg: 'var(--p-light)',
    hint: '14.7% 전환율',
  },
  {
    label: '제재 계정',
    value: '3',
    delta: { value: 1, positive: false },
    icon: UserX,
    accent: 'var(--error)',
    bg: 'var(--error-light)',
    hint: '미처리 1건',
  },
]

const USERS: AdminUser[] = [
  {
    id: 'u-001',
    name: '김학생',
    email: 'student.k@example.com',
    plan: 'pro',
    status: 'active',
    streak: 23,
    joinedAt: '2025-08-12',
    lastActive: '5분 전',
  },
  {
    id: 'u-002',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    plan: 'free',
    status: 'active',
    streak: 7,
    joinedAt: '2025-09-04',
    lastActive: '1시간 전',
  },
  {
    id: 'u-003',
    name: '박서연',
    email: 'seoyun@example.com',
    plan: 'team',
    status: 'active',
    streak: 41,
    joinedAt: '2025-04-22',
    lastActive: '방금',
  },
  {
    id: 'u-004',
    name: 'Maria Lopez',
    email: 'maria@example.com',
    plan: 'pro',
    status: 'inactive',
    streak: 0,
    joinedAt: '2025-11-10',
    lastActive: '14일 전',
  },
  {
    id: 'u-005',
    name: '이도윤',
    email: 'doyoon.lee@example.com',
    plan: 'free',
    status: 'suspended',
    streak: 0,
    joinedAt: '2025-10-30',
    lastActive: '7일 전',
  },
  {
    id: 'u-006',
    name: 'Yui Tanaka',
    email: 'yui.t@example.com',
    plan: 'free',
    status: 'active',
    streak: 12,
    joinedAt: '2025-12-15',
    lastActive: '30분 전',
  },
  {
    id: 'u-007',
    name: '정민호',
    email: 'minho.j@example.com',
    plan: 'pro',
    status: 'active',
    streak: 89,
    joinedAt: '2025-02-01',
    lastActive: '2시간 전',
  },
]

const PLAN_META: Record<AdminUser['plan'], { label: string; color: string; bg: string }> = {
  free: { label: 'Free', color: 'var(--t2)', bg: 'var(--bg3)' },
  pro: { label: 'Pro', color: 'var(--p)', bg: 'var(--p-light)' },
  team: { label: 'Team', color: '#8B5CF6', bg: '#F5F3FF' },
}

const STATUS_META: Record<
  AdminUser['status'],
  { label: string; color: string; bg: string }
> = {
  active: { label: '활성', color: 'var(--success)', bg: 'var(--success-light)' },
  inactive: { label: '비활성', color: 'var(--t3)', bg: 'var(--bg3)' },
  suspended: { label: '제재', color: 'var(--error)', bg: 'var(--error-light)' },
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<'all' | 'pro' | 'team' | 'suspended'>('all')

  const filtered = useMemo(() => {
    return USERS.filter((u) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !u.id.toLowerCase().includes(q)
        )
          return false
      }
      if (activeChip === 'pro' && u.plan !== 'pro') return false
      if (activeChip === 'team' && u.plan !== 'team') return false
      if (activeChip === 'suspended' && u.status !== 'suspended') return false
      return true
    })
  }, [query, activeChip])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={Users}
        title="사용자 관리"
        description="가입 · 제재 · 구독 상태 · 학습 통계"
        actions={
          <button className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[#8B5CF6] px-3 py-2 font-display text-[12px] font-[600] text-white shadow-[var(--sh-sm)] hover:bg-[#7C3AED]">
            <Plus size={14} aria-hidden />
            초대
          </button>
        }
      />

      <AdminScreenHelp screen="users" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <AdminToolbar
        searchPlaceholder="이름·이메일·ID 검색"
        searchValue={query}
        onSearchChange={setQuery}
        chips={[
          {
            label: '전체',
            active: activeChip === 'all',
            count: USERS.length,
            onClick: () => setActiveChip('all'),
          },
          {
            label: 'Pro',
            active: activeChip === 'pro',
            count: USERS.filter((u) => u.plan === 'pro').length,
            onClick: () => setActiveChip('pro'),
          },
          {
            label: 'Team',
            active: activeChip === 'team',
            count: USERS.filter((u) => u.plan === 'team').length,
            onClick: () => setActiveChip('team'),
          },
          {
            label: '제재',
            active: activeChip === 'suspended',
            count: USERS.filter((u) => u.status === 'suspended').length,
            onClick: () => setActiveChip('suspended'),
          },
        ]}
      />

      {/* ── Users table ── */}
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full">
          <thead className="bg-[var(--bg2)]">
            <tr>
              {['사용자', '플랜', '상태', '연속', '가입일', '마지막 활동', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--bd)]">
            {filtered.map((u) => {
              const plan = PLAN_META[u.plan]
              const status = STATUS_META[u.status]
              return (
                <tr key={u.id} className="transition-colors hover:bg-[var(--bg2)]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8B5CF6]/20 to-[#6D28D9]/20 font-display text-[12px] font-[700] text-[#6D28D9]"
                        aria-hidden
                      >
                        {u.name[0]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-[13px] font-[600] text-[var(--t1)]">
                          {u.name}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[var(--t2)]">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2 py-1 font-display text-[11px] font-[700]"
                      style={{ backgroundColor: plan.bg, color: plan.color }}
                    >
                      {plan.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display text-[11px] font-[700]"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-[var(--t1)]">
                    {u.streak > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[#EC4899]">
                        <Flame size={11} aria-hidden />
                        {u.streak}일
                      </span>
                    ) : (
                      <span className="text-[var(--t2)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {u.joinedAt}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--t2)]">
                    <span className="inline-flex items-center gap-1">
                      <Activity size={10} aria-hidden />
                      {u.lastActive}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
                      aria-label="더보기"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]">
              <UserCheck size={18} aria-hidden />
            </span>
            <p className="font-body text-[13px] text-[var(--t2)]">조건에 맞는 사용자가 없어요.</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-right font-mono text-[11px] text-[var(--t2)]">
        {filtered.length}명 표시 · 전체 {USERS.length}명
      </p>
    </div>
  )
}
