// apps/web/src/app/admin/page.tsx
// 관리자 대시보드 — 플랫폼 KPI 개요

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookMarked,
  CreditCard,
  FileText,
  Flag,
  Library,
  ShieldCheck,
  Sliders,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

interface Kpi {
  label: string
  value: string
  delta?: { value: number; positive: boolean }
  icon: LucideIcon
  accent: string
  bg: string
}

const KPIS: Kpi[] = [
  {
    label: '총 사용자',
    value: '1,247',
    delta: { value: 12, positive: true },
    icon: Users,
    accent: '#8B5CF6',
    bg: '#F5F3FF',
  },
  {
    label: '활성 사용자 (오늘)',
    value: '348',
    delta: { value: 8, positive: true },
    icon: TrendingUp,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
  },
  {
    label: '라이브러리 콘텐츠',
    value: '89',
    delta: { value: 4, positive: true },
    icon: Library,
    accent: 'var(--p)',
    bg: 'var(--p-light)',
  },
  {
    label: '미처리 신고',
    value: '7',
    delta: { value: 2, positive: false },
    icon: AlertTriangle,
    accent: 'var(--error)',
    bg: 'var(--error-light)',
  },
]

interface Section {
  href: string
  label: string
  description: string
  icon: LucideIcon
  badge?: string
}

const SECTIONS: Section[] = [
  {
    href: '/admin/users',
    label: '사용자 관리',
    description: '가입 · 제재 · 구독 상태 · 학습 통계',
    icon: Users,
  },
  {
    href: '/admin/library',
    label: '콘텐츠 관리',
    description: '스크립트 CRUD · 카테고리 · 큐레이션',
    icon: Library,
  },
  {
    href: '/admin/vocabulary',
    label: '단어장 마스터',
    description: 'CEFR 레벨 · 예문 · 발음 보정',
    icon: BookMarked,
  },
  {
    href: '/admin/analytics',
    label: '플랫폼 분석',
    description: 'DAU/MAU · retention · 학습 효과',
    icon: BarChart3,
  },
  {
    href: '/admin/reports',
    label: '신고/문의',
    description: '콘텐츠 신고 · 사용자 문의 · 버그 리포트',
    icon: Flag,
    badge: '7',
  },
  {
    href: '/admin/billing',
    label: '결제/구독',
    description: '요금제 · 결제 내역 · 환불 처리',
    icon: CreditCard,
  },
  {
    href: '/admin/settings',
    label: '시스템 설정',
    description: 'feature flags · AI 프롬프트 · 공지',
    icon: Sliders,
  },
]

interface Activity {
  time: string
  icon: LucideIcon
  message: string
  accent: string
}

const ACTIVITIES: Activity[] = [
  {
    time: '5분 전',
    icon: UserPlus,
    message: '신규 가입 12건 (오늘 누적 48건)',
    accent: 'var(--success)',
  },
  {
    time: '1시간 전',
    icon: Flag,
    message: '콘텐츠 1건 신고 접수 — "The Great Gatsby Ch.3"',
    accent: 'var(--error)',
  },
  {
    time: '2시간 전',
    icon: FileText,
    message: 'AI 단어 추출 1,283건 처리 (GPT-4o-mini)',
    accent: 'var(--p)',
  },
  {
    time: '3시간 전',
    icon: ShieldCheck,
    message: '보안 점검 완료 · 이상 없음',
    accent: '#8B5CF6',
  },
]

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      {/* ── 헤더 ── */}
      <header className="mb-8 flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_2px_6px_rgba(139,92,246,0.30)]"
          aria-hidden="true"
        >
          <ShieldCheck size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
            Admin Console
          </p>
          <h1 className="font-display text-[24px] font-[800] tracking-tight text-[var(--t1)]">
            대시보드
          </h1>
        </div>
        <p className="hidden font-body text-[12px] text-[var(--t3)] md:block">
          마지막 업데이트 · 방금 전
        </p>
      </header>

      {/* ── KPI 그리드 ── */}
      <section aria-label="핵심 지표" className="mb-8">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((kpi) => {
            const Icon = kpi.icon
            return (
              <li
                key={kpi.label}
                className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
                    style={{ backgroundColor: kpi.bg, color: kpi.accent }}
                    aria-hidden="true"
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {kpi.delta && (
                    <span
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-[700] tabular-nums"
                      style={{
                        color: kpi.delta.positive ? 'var(--success)' : 'var(--error)',
                      }}
                    >
                      {kpi.delta.positive ? '▲' : '▼'} {Math.abs(kpi.delta.value)}%
                    </span>
                  )}
                </div>
                <p className="mt-3 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
                  {kpi.label}
                </p>
                <p className="mt-1 font-display text-[28px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                  {kpi.value}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── 섹션 카드 ── */}
      <section aria-label="관리 섹션" className="mb-8">
        <header className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">관리 섹션</h2>
          <span className="font-body text-[13px] text-[var(--t3)]">·</span>
          <p className="font-body text-[13px] text-[var(--t3)]">7개 모듈</p>
          <span
            className="ml-auto h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
            aria-hidden="true"
          />
        </header>

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex h-full items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[#8B5CF6]/40 hover:shadow-[var(--sh-md)]"
                >
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[#8B5CF6]/10 group-hover:text-[#8B5CF6]"
                    aria-hidden="true"
                  >
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-[14px] font-[600] text-[var(--t1)]">
                        {s.label}
                      </p>
                      {s.badge && (
                        <span
                          className="inline-flex shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[var(--error)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-white"
                          aria-label={`미처리 ${s.badge}개`}
                        >
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-body text-[12px] text-[var(--t3)]">{s.description}</p>
                  </div>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.75}
                    className="shrink-0 text-[var(--t3)] opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── 최근 활동 ── */}
      <section
        aria-label="최근 활동"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
      >
        <header className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최근 활동</h2>
          <span
            className="ml-auto h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
            aria-hidden="true"
          />
          <span className="font-mono text-[11px] text-[var(--t3)]">실시간</span>
        </header>

        <ul className="divide-y divide-[var(--bg2)]">
          {ACTIVITIES.map((a, i) => {
            const Icon = a.icon
            return (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg2)]"
                  style={{ color: a.accent }}
                  aria-hidden="true"
                >
                  <Icon size={13} strokeWidth={1.75} />
                </span>
                <p className="min-w-0 flex-1 font-body text-[13px] text-[var(--t1)]">{a.message}</p>
                <p className="shrink-0 font-mono text-[11px] text-[var(--t3)]">{a.time}</p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
