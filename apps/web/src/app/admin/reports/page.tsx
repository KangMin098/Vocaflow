// apps/web/src/app/admin/reports/page.tsx
// 신고/문의 — 큐 + 심각도 + 상태 흐름 (열린/처리중/완료)

'use client'

import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock3,
  Flag,
  HelpCircle,
  Inbox,
  MessageSquare,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { AdminToolbar } from '@/components/admin/AdminToolbar'

type ReportType = 'content' | 'inquiry' | 'bug'
type ReportSeverity = 'low' | 'normal' | 'high' | 'critical'
type ReportStatus = 'open' | 'in-progress' | 'resolved'

interface Report {
  id: string
  type: ReportType
  severity: ReportSeverity
  status: ReportStatus
  title: string
  reporter: string
  context?: string
  createdAt: string
  ageHours: number
}

const KPIS: AdminKpi[] = [
  {
    label: '미처리',
    value: '7',
    delta: { value: 2, positive: false, suffix: '' },
    icon: Inbox,
    accent: 'var(--error)',
    bg: 'var(--error-light)',
    hint: 'SLA 위반 1건',
  },
  {
    label: '처리 중',
    value: '12',
    delta: { value: 3, positive: true, suffix: '' },
    icon: Clock3,
    accent: 'var(--active)',
    bg: 'var(--warning-light)',
  },
  {
    label: '오늘 해결',
    value: '8',
    delta: { value: 25, positive: true },
    icon: CheckCircle2,
    accent: 'var(--success)',
    bg: 'var(--success-light)',
  },
  {
    label: '평균 응답',
    value: '2.4h',
    delta: { value: 18, positive: true },
    icon: MessageSquare,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
    hint: 'SLA 4시간',
  },
]

const REPORTS: Report[] = [
  {
    id: 'r-001',
    type: 'content',
    severity: 'high',
    status: 'open',
    title: '콘텐츠 신고 — 저작권 위반 의심',
    reporter: 'alex.chen@example.com',
    context: 'The Great Gatsby — Chapter 3 (사용자 업로드)',
    createdAt: '2026-04-30 10:24',
    ageHours: 14,
  },
  {
    id: 'r-002',
    type: 'bug',
    severity: 'critical',
    status: 'in-progress',
    title: 'Flashcard 답 확인 후 다음 카드로 진행 안 됨',
    reporter: 'student.k@example.com',
    context: 'Chrome 124 · macOS · 재현율 100%',
    createdAt: '2026-04-30 09:11',
    ageHours: 15,
  },
  {
    id: 'r-003',
    type: 'inquiry',
    severity: 'normal',
    status: 'open',
    title: '환불 문의 — 결제 후 14일 이내',
    reporter: 'maria@example.com',
    createdAt: '2026-04-30 08:55',
    ageHours: 16,
  },
  {
    id: 'r-004',
    type: 'content',
    severity: 'normal',
    status: 'in-progress',
    title: '단어 발음 오류 — "advantages"',
    reporter: 'system',
    context: 'IPA 검증 자동 체크 트리거',
    createdAt: '2026-04-30 06:40',
    ageHours: 18,
  },
  {
    id: 'r-005',
    type: 'inquiry',
    severity: 'low',
    status: 'resolved',
    title: '비밀번호 재설정 메일 누락',
    reporter: 'doyoon.lee@example.com',
    createdAt: '2026-04-29 22:14',
    ageHours: 26,
  },
  {
    id: 'r-006',
    type: 'bug',
    severity: 'high',
    status: 'resolved',
    title: 'WordBlitz 3D 집게 미표시 (특정 환경)',
    reporter: '운영팀',
    context: 'GLB 머티리얼 0개 + 카메라 fov 좁음',
    createdAt: '2026-04-29 18:00',
    ageHours: 30,
  },
]

const TYPE_META: Record<ReportType, { label: string; icon: LucideIcon; color: string; bg: string }> =
  {
    content: { label: '콘텐츠', icon: Flag, color: 'var(--error)', bg: 'var(--error-light)' },
    inquiry: { label: '문의', icon: HelpCircle, color: 'var(--info)', bg: 'var(--info-light)' },
    bug: { label: '버그', icon: Bug, color: 'var(--active)', bg: 'var(--warning-light)' },
  }

const SEVERITY_META: Record<
  ReportSeverity,
  { label: string; color: string; bg: string; weight: number }
> = {
  low: { label: '낮음', color: 'var(--t3)', bg: 'var(--bg3)', weight: 1 },
  normal: { label: '보통', color: 'var(--info)', bg: 'var(--info-light)', weight: 2 },
  high: { label: '높음', color: 'var(--active)', bg: 'var(--warning-light)', weight: 3 },
  critical: {
    label: '긴급',
    color: 'var(--error)',
    bg: 'var(--error-light)',
    weight: 4,
  },
}

const STATUS_META: Record<
  ReportStatus,
  { label: string; color: string; bg: string }
> = {
  open: { label: '미처리', color: 'var(--error)', bg: 'var(--error-light)' },
  'in-progress': { label: '처리중', color: 'var(--active)', bg: 'var(--warning-light)' },
  resolved: { label: '완료', color: 'var(--success)', bg: 'var(--success-light)' },
}

export default function AdminReportsPage() {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<'all' | 'open' | 'critical' | 'bug'>('all')

  const filtered = useMemo(() => {
    return REPORTS.filter((r) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !r.title.toLowerCase().includes(q) &&
          !r.reporter.toLowerCase().includes(q) &&
          !(r.context ?? '').toLowerCase().includes(q)
        )
          return false
      }
      if (activeChip === 'open' && r.status !== 'open') return false
      if (activeChip === 'critical' && r.severity !== 'critical') return false
      if (activeChip === 'bug' && r.type !== 'bug') return false
      return true
    }).sort((a, b) => {
      // open first, then by severity weight, then newest
      const statusOrder = { open: 0, 'in-progress': 1, resolved: 2 }
      const sa = statusOrder[a.status]
      const sb = statusOrder[b.status]
      if (sa !== sb) return sa - sb
      return SEVERITY_META[b.severity].weight - SEVERITY_META[a.severity].weight
    })
  }, [query, activeChip])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={ShieldAlert}
        title="신고/문의"
        description="콘텐츠 신고 · 문의 · 버그 리포트"
      />

      <AdminScreenHelp screen="reports" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <AdminToolbar
        searchPlaceholder="제목·신고자·맥락 검색"
        searchValue={query}
        onSearchChange={setQuery}
        chips={[
          {
            label: '전체',
            active: activeChip === 'all',
            count: REPORTS.length,
            onClick: () => setActiveChip('all'),
          },
          {
            label: '미처리',
            active: activeChip === 'open',
            count: REPORTS.filter((r) => r.status === 'open').length,
            onClick: () => setActiveChip('open'),
          },
          {
            label: '긴급',
            active: activeChip === 'critical',
            count: REPORTS.filter((r) => r.severity === 'critical').length,
            onClick: () => setActiveChip('critical'),
          },
          {
            label: '버그',
            active: activeChip === 'bug',
            count: REPORTS.filter((r) => r.type === 'bug').length,
            onClick: () => setActiveChip('bug'),
          },
        ]}
      />

      <ul className="space-y-3">
        {filtered.map((r) => {
          const type = TYPE_META[r.type]
          const sev = SEVERITY_META[r.severity]
          const status = STATUS_META[r.status]
          const TypeIcon = type.icon
          const isSlaWarning = r.status !== 'resolved' && r.ageHours > 4

          return (
            <li
              key={r.id}
              className={`group rounded-[var(--r-lg)] border bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)] md:p-5 ${
                isSlaWarning
                  ? 'border-[var(--error)]/30'
                  : r.status === 'resolved'
                    ? 'border-[var(--bd)] opacity-70'
                    : 'border-[var(--bd)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)]"
                  style={{ backgroundColor: type.bg, color: type.color }}
                  aria-hidden
                >
                  <TypeIcon size={16} strokeWidth={1.75} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full px-2 py-1 font-display text-[10px] font-[700] uppercase tracking-[0.06em]"
                      style={{ backgroundColor: type.bg, color: type.color }}
                    >
                      {type.label}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display text-[10px] font-[700]"
                      style={{ backgroundColor: sev.bg, color: sev.color }}
                    >
                      {r.severity === 'critical' && <AlertTriangle size={10} aria-hidden />}
                      {sev.label}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display text-[10px] font-[700]"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                    {isSlaWarning && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--error)]/10 px-2 py-1 font-mono text-[10px] font-[700] text-[var(--error-ink)]">
                        <Clock3 size={10} aria-hidden />
                        {r.ageHours}h · SLA 위반
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 font-display text-[14px] font-[700] text-[var(--t1)]">
                    {r.title}
                  </h3>
                  {r.context && (
                    <p className="mt-1 font-body text-[12px] text-[var(--t2)]">{r.context}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-[var(--t2)]">
                    <span>신고자 · {r.reporter}</span>
                    <span>·</span>
                    <span>{r.createdAt}</span>
                    <span>·</span>
                    <span>{r.id}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="hidden flex-col gap-2 md:flex">
                  {r.status !== 'resolved' && (
                    <button className="rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-1 font-display text-[11px] font-[600] text-[var(--on-p)] hover:bg-[var(--p-hover)]">
                      처리
                    </button>
                  )}
                  <button className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]">
                    상세
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] py-12 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
            <CheckCircle2 size={18} aria-hidden />
          </span>
          <p className="font-body text-[13px] text-[var(--t2)]">큐가 비어있습니다. 잘 하고 있어요.</p>
        </div>
      )}
    </div>
  )
}
