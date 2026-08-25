// apps/web/src/app/admin/billing/page.tsx
// 결제/구독 — MRR · 결제 내역 · 환불 처리

'use client'

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Download,
  RefreshCcw,
  TicketPercent,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { AdminToolbar } from '@/components/admin/AdminToolbar'

const KPIS: AdminKpi[] = [
  {
    label: 'MRR',
    value: '₩1.84M',
    delta: { value: 14, positive: true },
    icon: DollarSign,
    accent: 'var(--success)',
    bg: 'var(--success-light)',
    hint: 'Monthly Recurring',
  },
  {
    label: '활성 구독',
    value: '184',
    delta: { value: 12, positive: true, suffix: '' },
    icon: Users,
    accent: 'var(--p)',
    bg: 'var(--p-light)',
  },
  {
    label: '신규 (이번 주)',
    value: '14',
    delta: { value: 22, positive: true },
    icon: TrendingUp,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
  },
  {
    label: '이탈 (이번 주)',
    value: '3',
    delta: { value: 1, positive: true, suffix: '' },
    icon: ArrowDownRight,
    accent: 'var(--error)',
    bg: 'var(--error-light)',
    hint: 'churn 1.6%',
  },
]

type TxStatus = 'paid' | 'refunded' | 'failed' | 'pending'
type TxPlan = 'pro' | 'team'

interface Transaction {
  id: string
  user: string
  email: string
  plan: TxPlan
  amount: number
  status: TxStatus
  method: '카드' | '토스페이' | 'PayPal'
  date: string
}

const TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-93281',
    user: '김학생',
    email: 'student.k@example.com',
    plan: 'pro',
    amount: 9900,
    status: 'paid',
    method: '카드',
    date: '2026-04-30 09:14',
  },
  {
    id: 'tx-93280',
    user: '박서연',
    email: 'seoyun@example.com',
    plan: 'team',
    amount: 29900,
    status: 'paid',
    method: '토스페이',
    date: '2026-04-30 08:42',
  },
  {
    id: 'tx-93279',
    user: 'Alex Chen',
    email: 'alex.chen@example.com',
    plan: 'pro',
    amount: 9900,
    status: 'failed',
    method: '카드',
    date: '2026-04-30 07:55',
  },
  {
    id: 'tx-93278',
    user: 'Maria Lopez',
    email: 'maria@example.com',
    plan: 'pro',
    amount: 9900,
    status: 'refunded',
    method: 'PayPal',
    date: '2026-04-29 22:11',
  },
  {
    id: 'tx-93277',
    user: '정민호',
    email: 'minho.j@example.com',
    plan: 'pro',
    amount: 9900,
    status: 'paid',
    method: '카드',
    date: '2026-04-29 18:23',
  },
  {
    id: 'tx-93276',
    user: 'Yui Tanaka',
    email: 'yui.t@example.com',
    plan: 'team',
    amount: 29900,
    status: 'pending',
    method: '카드',
    date: '2026-04-29 14:50',
  },
]

const STATUS_META: Record<
  TxStatus,
  { label: string; color: string; bg: string; icon: LucideIcon }
> = {
  paid: {
    label: '결제됨',
    color: 'var(--success)',
    bg: 'var(--success-light)',
    icon: ArrowUpRight,
  },
  refunded: {
    label: '환불',
    color: 'var(--t3)',
    bg: 'var(--bg3)',
    icon: RefreshCcw,
  },
  failed: { label: '실패', color: 'var(--error)', bg: 'var(--error-light)', icon: ArrowDownRight },
  pending: { label: '대기', color: 'var(--active)', bg: 'var(--warning-light)', icon: TicketPercent },
}

export default function AdminBillingPage() {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<'all' | 'paid' | 'failed' | 'refunded'>('all')

  const filtered = useMemo(() => {
    return TRANSACTIONS.filter((t) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !t.user.toLowerCase().includes(q) &&
          !t.email.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        )
          return false
      }
      if (activeChip !== 'all' && t.status !== activeChip) return false
      return true
    })
  }, [query, activeChip])

  const totalRevenue = TRANSACTIONS.filter((t) => t.status === 'paid').reduce(
    (s, t) => s + t.amount,
    0
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={CreditCard}
        title="결제/구독"
        description="MRR · 결제 내역 · 환불 처리"
        actions={
          <button className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]">
            <Download size={14} aria-hidden />
            CSV
          </button>
        }
      />

      <AdminScreenHelp screen="billing" className="-mt-3 mb-6" />

      {/* 이 화면의 모든 수치는 데모 상수다 — PG 미연동(2026-08-17 실측: 결제 연동 0).
          경고를 화면 밖(대시보드 링크의 "목업" 태그)에만 두면, 이 화면만 열어 본 사람은
          MRR ₩1.84M 을 실적으로 읽는다. 자기 대시보드가 거짓을 말하면 지표로 판단하는
          습관이 만들어지지 않는다. 연동 시 이 배너와 상수를 함께 제거한다. */}
      <p
        role="status"
        className="mb-6 flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--warning-light)] px-4 py-3 font-body text-[13px] leading-[1.6] text-[var(--t1)]"
      >
        <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-[var(--warning)]" />
        <span>
          <b>데모 데이터입니다.</b> 결제 PG가 아직 연동되지 않아 아래 MRR·구독·거래 내역은 모두
          고정 상수예요. 실제 매출로 읽지 마세요.
        </span>
      </p>

      <AdminKpiGrid kpis={KPIS} />

      {/* MRR 미니 차트 + 요금제 분포 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          aria-label="MRR 추이"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--success-light)] text-[var(--success)]">
              <TrendingUp size={13} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최근 7일 MRR</h2>
            <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">
              ₩{(totalRevenue / 1000).toFixed(0)}K (오늘 결제)
            </span>
          </header>
          {/* 막대 차트 */}
          <ul className="flex h-32 items-end gap-2">
            {[1.62, 1.71, 1.68, 1.74, 1.77, 1.80, 1.84].map((v, i) => {
              const day = ['월', '화', '수', '목', '금', '토', '일'][i]
              const max = 1.84
              return (
                <li key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-[var(--r-sm)] bg-gradient-to-t from-[var(--success)] to-[var(--success)]/60 transition-[height] duration-[var(--dur-slow)]"
                      style={{ height: `${(v / max) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[var(--t2)]">{day}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          aria-label="요금제 분포"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]">
              <CreditCard size={13} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">요금제 분포</h2>
          </header>
          <ul className="space-y-3">
            {[
              { label: 'Pro', count: 162, total: 184, color: 'var(--p)' },
              { label: 'Team', count: 22, total: 184, color: '#8B5CF6' },
            ].map((p) => (
              <li key={p.label}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[12px] font-[600] text-[var(--t1)]">
                    {p.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {p.count} ({Math.round((p.count / p.total) * 100)}%)
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
                    style={{
                      width: `${(p.count / p.total) * 100}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <AdminToolbar
        searchPlaceholder="이름·이메일·트랜잭션 ID"
        searchValue={query}
        onSearchChange={setQuery}
        chips={[
          {
            label: '전체',
            active: activeChip === 'all',
            count: TRANSACTIONS.length,
            onClick: () => setActiveChip('all'),
          },
          {
            label: '결제됨',
            active: activeChip === 'paid',
            count: TRANSACTIONS.filter((t) => t.status === 'paid').length,
            onClick: () => setActiveChip('paid'),
          },
          {
            label: '실패',
            active: activeChip === 'failed',
            count: TRANSACTIONS.filter((t) => t.status === 'failed').length,
            onClick: () => setActiveChip('failed'),
          },
          {
            label: '환불',
            active: activeChip === 'refunded',
            count: TRANSACTIONS.filter((t) => t.status === 'refunded').length,
            onClick: () => setActiveChip('refunded'),
          },
        ]}
      />

      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full">
          <thead className="bg-[var(--bg2)]">
            <tr>
              {['트랜잭션', '사용자', '플랜', '금액', '결제수단', '상태', '일시'].map((h, i) => (
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
            {filtered.map((t) => {
              const status = STATUS_META[t.status]
              const StatusIcon = status.icon
              return (
                <tr key={t.id} className="transition-colors hover:bg-[var(--bg2)]/50">
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--t2)]">{t.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                      {t.user}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--t2)]">{t.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2 py-1 font-display text-[11px] font-[700]"
                      style={{
                        backgroundColor: t.plan === 'pro' ? 'var(--p-light)' : '#F5F3FF',
                        color: t.plan === 'pro' ? 'var(--p)' : '#8B5CF6',
                      }}
                    >
                      {t.plan === 'pro' ? 'Pro' : 'Team'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-display text-[13px] font-[700] tabular-nums text-[var(--t1)]">
                    ₩{t.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-body text-[12px] text-[var(--t2)]">{t.method}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display text-[11px] font-[700]"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <StatusIcon size={11} aria-hidden />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--t2)]">{t.date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
