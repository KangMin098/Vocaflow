// apps/web/src/app/admin/page.tsx
// 관리자 대시보드 — 파이프라인 실측 현황 (모든 숫자 = 요청 시점 DB 카운트)
//
// v06.35 이전에는 KPI·섹션·활동 로그가 전부 코드 상수였다. 상수는 반드시 낡으므로
// 이 화면은 상수를 두지 않는다 — lib/admin/dashboard-stats.ts 가 유일한 숫자 출처다.
// 아직 목업으로 남은 화면(사용자·콘텐츠·분석·신고·결제·설정)은 링크에 "목업" 을 달아
// 여기서 본 실측과 그 화면의 데모 숫자를 혼동하지 않게 한다.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookImage,
  BookMarked,
  Brain,
  ClipboardCheck,
  CreditCard,
  Database,
  Flag,
  Gauge,
  Library,
  Newspaper,
  Scale,
  ScanLine,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  fmt,
  getAdminDashboardStats,
  relativeKo,
  sum,
  type Count,
  type DashboardStats,
} from '@/lib/admin/dashboard-stats'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title: '대시보드 — Vocaflow Admin',
  description: '파이프라인 실측 현황 · 처리 대기 · 최근 변경',
}

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────
// 지표 칩
// ─────────────────────────────────────────────

/** 색은 "지금 사람 손이 필요한가" 만 말한다. 값이 0 이면 무채색 — 할 일 없음을 소리치지 않는다. */
type Tone = 'idle' | 'todo' | 'busy' | 'ok' | 'error'

interface Metric {
  label: string
  value: Count
  tone: Tone
}

const TONE_STYLE: Record<Tone, { fg: string; bg: string }> = {
  idle: { fg: 'var(--t2)', bg: 'var(--bg2)' },
  todo: { fg: 'var(--warning)', bg: 'var(--warning-light)' },
  busy: { fg: 'var(--info)', bg: 'var(--info-light)' },
  ok: { fg: 'var(--success)', bg: 'var(--success-light)' },
  error: { fg: 'var(--error)', bg: 'var(--error-light)' },
}

function MetricChip({ label, value, tone }: Metric) {
  const style = TONE_STYLE[value ? tone : 'idle']
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-2 py-0.5 font-body text-[11px]"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {label}
      <span className="font-display font-[700] tabular-nums">{fmt(value)}</span>
    </span>
  )
}

// ─────────────────────────────────────────────
// 파이프라인 카드
// ─────────────────────────────────────────────

interface PipelineCard {
  href: string
  label: string
  sub: string
  Icon: LucideIcon
  metrics: Metric[]
}

function buildPipelines(s: DashboardStats): PipelineCard[] {
  return [
    {
      href: '/admin/curation',
      label: 'LCP · 도서 큐레이션',
      sub: '9 소스 시드 → 자동 처리 → 검수 → 공개',
      Icon: Workflow,
      metrics: [
        { label: '후보 시드', value: s.books.seeds, tone: 'idle' },
        { label: '처리 중', value: s.books.inFlight, tone: 'busy' },
        { label: '검수 대기', value: s.books.ready, tone: 'todo' },
        { label: '공개', value: s.books.published, tone: 'ok' },
        { label: '실패', value: s.books.failed, tone: 'error' },
      ],
    },
    {
      href: '/admin/articles',
      label: 'ACP · 짧은 글',
      sub: 'arXiv · NASA · NIH · VOA 4 피드',
      Icon: Newspaper,
      metrics: [
        { label: '후보 시드', value: s.articles.seeds, tone: 'idle' },
        { label: '처리 중', value: s.articles.inFlight, tone: 'busy' },
        { label: '검수 대기', value: s.articles.ready, tone: 'todo' },
        { label: '공개', value: s.articles.published, tone: 'ok' },
        { label: '실패', value: s.articles.failed, tone: 'error' },
      ],
    },
    {
      href: '/admin/curation',
      label: '드레인 큐 · Claude Code',
      sub: '챕터 퀴즈 · LibriVox 매핑 · 추출 감사 작업',
      Icon: ClipboardCheck,
      metrics: [
        { label: '대기', value: s.jobs.pending, tone: 'todo' },
        { label: '진행 중', value: s.jobs.running, tone: 'busy' },
        { label: '매핑 대기', value: s.jobs.awaitingMapping, tone: 'todo' },
        { label: '실패', value: s.jobs.failed, tone: 'error' },
      ],
    },
    {
      href: '/admin/vocab',
      label: 'VCB · 단어장 파이프라인',
      sub: 'seed → enrichment → shared_words',
      Icon: Sparkles,
      metrics: [
        { label: '대기', value: s.vcb.pending, tone: 'todo' },
        { label: '내보냄', value: s.vcb.exported, tone: 'busy' },
        { label: '완료', value: s.vcb.enriched, tone: 'ok' },
        { label: 'QA 플래그', value: s.vcb.flagged, tone: 'todo' },
        { label: '실패', value: s.vcb.failed, tone: 'error' },
      ],
    },
    {
      href: '/admin/vrl',
      label: 'VRL · 어휘 레벨',
      sub: 'V-Level · Track · Domain · Skill 4축 분류',
      Icon: Brain,
      metrics: [
        { label: '분류 완료', value: s.vrl.classified, tone: 'ok' },
        { label: '미해결 이슈', value: s.vrl.openConcerns, tone: 'error' },
      ],
    },
    {
      href: '/admin/comic',
      label: 'CCP · 도서 만화',
      sub: '카탈로그 도서 → 컷 생성 → 편입',
      Icon: BookImage,
      metrics: [
        { label: '초안', value: s.comics.draft, tone: 'todo' },
        { label: '공개', value: s.comics.published, tone: 'ok' },
      ],
    },
    // PDCP(퍼블릭도메인 스캔 만화) 카드는 ADR 0007 로 제거했다 — 파이프라인 자체가 없어졌다.
    {
      href: '/admin/pending-words',
      label: 'Pending Words',
      sub: '학습자가 만난 미등재 단어 큐',
      Icon: Database,
      metrics: [{ label: '미처리', value: s.words.pending, tone: 'todo' }],
    },
  ]
}

// ─────────────────────────────────────────────
// 운영 · 관리 링크
// ─────────────────────────────────────────────

interface OpsLink {
  href: string
  label: string
  note: string
  Icon: LucideIcon
  /** DB 를 읽지 않고 데모 상수를 그리는 화면 — 숫자를 믿으면 안 된다. */
  mock?: boolean
}

function buildOpsLinks(s: DashboardStats): OpsLink[] {
  const quality = s.qualityLastMeasuredAt
    ? `마지막 수집 ${relativeKo(s.qualityLastMeasuredAt)}`
    : '수집 이력 없음'

  return [
    {
      href: '/admin/vocabulary',
      label: '단어장 마스터',
      note: `사전 ${fmt(s.words.dict)}개`,
      Icon: BookMarked,
    },
    {
      href: '/admin/quality',
      label: '품질 지표',
      note: quality,
      Icon: Gauge,
    },
    {
      href: '/admin/quality/gates',
      label: '품질 게이트',
      note: '발행 전 차단 규칙 점검',
      Icon: ShieldCheck,
    },
    {
      href: '/admin/quality/judge',
      label: '추출 판정',
      note: `누적 판정 ${fmt(s.words.judgments)}건`,
      Icon: Scale,
    },
    {
      href: '/admin/users',
      label: '사용자',
      note: `가입 ${fmt(s.learners.total)}명`,
      Icon: Users,
      mock: true,
    },
    {
      href: '/admin/library',
      label: '콘텐츠',
      note: `텍스트 ${fmt(s.texts)}편 · 챕터 퀴즈 ${fmt(s.words.chapterQuiz)}문항`,
      Icon: Library,
      mock: true,
    },
    {
      href: '/admin/analytics',
      label: '플랫폼 분석',
      note: 'DAU/MAU · retention',
      Icon: BarChart3,
      mock: true,
    },
    {
      href: '/admin/reports',
      label: '신고/문의',
      note: s.reportsOpen === null ? 'reports 테이블 없음' : `미처리 ${fmt(s.reportsOpen)}건`,
      Icon: Flag,
      mock: true,
    },
    {
      href: '/admin/billing',
      label: '결제/구독',
      note: '결제 테이블 없음',
      Icon: CreditCard,
      mock: true,
    },
    {
      href: '/admin/settings',
      label: '시스템 설정',
      note: 'feature flags · AI 프롬프트',
      Icon: Sliders,
      mock: true,
    },
  ]
}

// ─────────────────────────────────────────────
// 페이지
// ─────────────────────────────────────────────

export default async function AdminDashboardPage() {
  // service_role 로 집계하므로 게이트가 유일한 방어선 — 반드시 먼저.
  await requireAdmin('/admin')
  const client = createAdminClient() as unknown as SupabaseClient
  const stats = await getAdminDashboardStats(client)

  const kpis: AdminKpi[] = [
    {
      label: '공개 콘텐츠',
      value: fmt(
        sum(
          stats.books.published,
          stats.articles.published,
          stats.comics.published,
          stats.pdComics.published,
        ),
      ),
      icon: Library,
      accent: 'var(--success)',
      bg: 'var(--success-light)',
      hint: `도서 ${fmt(stats.books.published)} · 글 ${fmt(stats.articles.published)} · 만화 ${fmt(
        sum(stats.comics.published, stats.pdComics.published),
      )}`,
    },
    {
      label: '검수 대기',
      value: fmt(sum(stats.books.ready, stats.articles.ready, stats.pdComics.review)),
      icon: ClipboardCheck,
      accent: 'var(--warning)',
      bg: 'var(--warning-light)',
      hint: `도서 ${fmt(stats.books.ready)} · 글 ${fmt(stats.articles.ready)} · PD 만화 ${fmt(
        stats.pdComics.review,
      )}`,
    },
    {
      label: '실패 · 재처리 필요',
      value: fmt(
        sum(
          stats.books.failed,
          stats.articles.failed,
          stats.pdComics.failed,
          stats.jobs.failed,
          stats.vcb.failed,
        ),
      ),
      icon: AlertTriangle,
      accent: 'var(--error)',
      bg: 'var(--error-light)',
      hint: `도서 ${fmt(stats.books.failed)} · 글 ${fmt(stats.articles.failed)} · 작업 ${fmt(
        stats.jobs.failed,
      )}`,
    },
    {
      label: '오늘 학습자',
      value: fmt(stats.learners.activeToday),
      icon: Users,
      accent: '#8B5CF6',
      bg: '#F5F3FF',
      hint: `가입 ${fmt(stats.learners.total)}명 · 학습 텍스트 ${fmt(stats.texts)}편`,
    },
  ]

  const pipelines = buildPipelines(stats)
  const opsLinks = buildOpsLinks(stats)
  const now = Date.now()
  const fetchedAt = new Date(now).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
  })

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
        <p className="hidden font-body text-[12px] text-[var(--t2)] md:block">
          조회 시각 · {fetchedAt} KST
        </p>
      </header>

      <AdminScreenHelp screen="dashboard" className="-mt-4 mb-6" />

      {/* ── KPI ── */}
      <section aria-label="핵심 지표">
        <AdminKpiGrid kpis={kpis} />
      </section>

      {/* ── 파이프라인 현황 ── */}
      <section aria-label="파이프라인 현황" className="mb-8">
        <header className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">파이프라인 현황</h2>
          <span className="font-body text-[13px] text-[var(--t2)]">·</span>
          <p className="font-body text-[13px] text-[var(--t2)]">{pipelines.length}개 큐</p>
          <span
            className="ml-auto h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
            aria-hidden="true"
          />
        </header>

        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pipelines.map((p) => (
            <li key={p.label}>
              <Link
                href={p.href}
                className="group flex h-full items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[#8B5CF6]/40 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 active:translate-y-0"
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[#8B5CF6]/10 group-hover:text-[#8B5CF6]"
                  aria-hidden="true"
                >
                  <p.Icon size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-[14px] font-[600] text-[var(--t1)]">{p.label}</p>
                    <ArrowUpRight
                      size={14}
                      strokeWidth={1.75}
                      className="shrink-0 text-[var(--t2)] opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-0.5 font-body text-[12px] text-[var(--t2)]">{p.sub}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {p.metrics.map((m) => (
                      <MetricChip key={m.label} {...m} />
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 운영 · 관리 ── */}
      <section aria-label="운영 및 관리" className="mb-8">
        <header className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">운영 · 관리</h2>
          <span className="font-body text-[13px] text-[var(--t2)]">·</span>
          <p className="font-body text-[13px] text-[var(--t2)]">
            &ldquo;목업&rdquo; 은 DB 를 읽지 않는 데모 화면
          </p>
          <span
            className="ml-auto h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
            aria-hidden="true"
          />
        </header>

        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {opsLinks.map((o) => (
            <li key={o.href}>
              <Link
                href={o.href}
                className="group flex h-full items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2.5 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:border-[#8B5CF6]/40 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1"
              >
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg2)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[#8B5CF6]/10 group-hover:text-[#8B5CF6]"
                  aria-hidden="true"
                >
                  <o.Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display text-[13px] font-[600] text-[var(--t1)]">
                      {o.label}
                    </p>
                    {o.mock && (
                      <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-px font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                        목업
                      </span>
                    )}
                  </div>
                  <p className="truncate font-body text-[11px] text-[var(--t2)]">{o.note}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 최근 변경 ── */}
      <section
        aria-label="최근 변경"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
      >
        <header className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            최근 파이프라인 변경
          </h2>
          <span
            className="ml-auto h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
            aria-hidden="true"
          />
          <span className="font-mono text-[11px] text-[var(--t2)]">updated_at 기준</span>
        </header>

        {stats.recent.length === 0 ? (
          <p className="py-4 text-center font-body text-[13px] text-[var(--t2)]">
            최근 변경된 파이프라인 항목이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--bg2)]">
            {stats.recent.map((e) => (
              <li key={`${e.kind}-${e.href}-${e.at}`}>
                <Link
                  href={e.href}
                  className="group flex items-center gap-3 py-2.5 transition-opacity duration-[var(--dur-normal)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                >
                  <span
                    className="inline-flex w-[68px] shrink-0 justify-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10px] font-[700] uppercase tracking-[0.04em]"
                    style={{ backgroundColor: 'var(--bg2)', color: e.accent }}
                  >
                    {e.kind}
                  </span>
                  <p className="min-w-0 flex-1 truncate font-body text-[13px] text-[var(--t1)]">
                    {e.title}
                  </p>
                  <p className="shrink-0 font-body text-[12px] text-[var(--t2)]">{e.detail}</p>
                  <p className="w-[64px] shrink-0 text-right font-mono text-[11px] text-[var(--t2)]">
                    {relativeKo(e.at, now)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
