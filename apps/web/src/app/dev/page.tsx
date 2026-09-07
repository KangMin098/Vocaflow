// apps/web/src/app/dev/page.tsx
// 개발 진입점 — 전체 화면 인덱스 + 진행 현황

'use client'

import {
  Anchor,
  BarChart3,
  BookMarked,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  CreditCard,
  FileText,
  Flag,
  FlaskConical,
  Headphones,
  HelpCircle,
  Home as HomeIcon,
  LayoutDashboard,
  Layers,
  Library,
  LogIn,
  Mail,
  Menu,
  PencilLine,
  Settings as SettingsIcon,
  ShieldCheck,
  Sliders,
  Sparkles,
  Type,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

type Status = 'done' | 'progress' | 'pending'

interface Screen {
  href: string
  label: string
  description: string
  icon: LucideIcon
  status: Status
}

interface ScreenGroup {
  title: string
  description: string
  accent: string
  screens: Screen[]
}

const GROUPS: ScreenGroup[] = [
  {
    title: '인증 (Authentication)',
    description: '로그인 · 가입 · 비밀번호 · 이메일 인증',
    accent: 'var(--p)',
    screens: [
      { href: '/login', label: '로그인', description: '이메일·소셜 로그인', icon: LogIn, status: 'done' },
      { href: '/signup', label: '회원가입', description: '신규 가입 · 약관 동의', icon: UserPlus, status: 'done' },
      { href: '/reset-password', label: '비밀번호 재설정', description: '재설정 링크 발송', icon: ShieldCheck, status: 'done' },
      { href: '/verify-email', label: '이메일 인증', description: '인증 코드 확인', icon: Mail, status: 'done' },
    ],
  },
  {
    title: '메인 앱 (Learning Platform)',
    description: '학습 핵심 모듈 · 7개 도메인',
    accent: '#8B5CF6',
    screens: [
      { href: '/hub', label: '허브 (Home Hub)', description: 'Hero · 모듈 진입 · 이어하기', icon: HomeIcon, status: 'done' },
      { href: '/library', label: '라이브러리', description: '스크립트 카드 · 카테고리 · 큐레이션', icon: Library, status: 'done' },
      { href: '/text', label: '직접 입력 (TextViewer)', description: '텍스트·파일·URL → AI 단어 추출', icon: FileText, status: 'done' },
      { href: '/text/1', label: '학습 워크스페이스', description: '스크립트 읽기 + 단어 학습 (text/[id])', icon: Menu, status: 'done' },
      { href: '/wordvault', label: '단어장 (WordVault)', description: 'Browse · Study · Review 3-View', icon: BookMarked, status: 'done' },
      { href: '/flashcard', label: '플래시카드 Hub', description: 'Continue · SRS Queue · 7일 정확도 · 시작 설정', icon: Layers, status: 'done' },
      { href: '/flashcard/play', label: '플래시카드 세션', description: 'SM-2 SRS · 능동적 회상 3초 · 4단계 평가', icon: Layers, status: 'done' },
      { href: '/spellforge', label: 'SpellForge Hub', description: 'Memory Decay · 모드/난이도 선택 · Best 점수', icon: Type, status: 'done' },
      { href: '/spellforge/play', label: 'SpellForge 세션', description: '스펠링 타이핑 · 파란 패널 · IME 분리', icon: Type, status: 'done' },
      { href: '/wordblitz', label: 'WordBlitz Hub', description: '게임 소개 · 최근 점수 · 시작 진입점', icon: Zap, status: 'done' },
      { href: '/play/wordblitz', label: 'WordBlitz Play (3D)', description: '인형뽑기 3D · GLB 집게 · 풀스크린', icon: Zap, status: 'progress' },
      { href: '/play/pirate-quest', label: "Pirate's Bounty (3D)", description: '해변 단어 매칭 · 21 GLB 해적 자산 · TTS 듣기', icon: Anchor, status: 'done' },
      { href: '/scriptquiz', label: 'ScriptQuiz Hub', description: 'Chapter grid · 영어 immersion · 한영 토글', icon: HelpCircle, status: 'done' },
      { href: '/scriptquiz/play', label: 'ScriptQuiz 세션', description: '3-screen · 영어 질문/선택지 · O/X 피드백', icon: HelpCircle, status: 'done' },
      { href: '/dictate', label: 'Dictation Hub', description: 'CEFR 자동 감지 · 리소스 선택 · 직접 입력 · 최근 세션', icon: Headphones, status: 'done' },
      { href: '/dictate/setup', label: 'Dictation Setup', description: '단위/갯수/순서/채점/속도/반복/힌트 설정', icon: PencilLine, status: 'done' },
      { href: '/dictate/session', label: 'Dictation 세션', description: 'TTS 받아쓰기 · 단어별 채점 · 4단계 힌트 · Focus Mode', icon: PencilLine, status: 'done' },
      { href: '/dictate/results', label: 'Dictation 결과', description: '정확도 · 오류 패턴 · 오답 단어 · 다음 단계 추천', icon: PencilLine, status: 'done' },
      { href: '/dashboard', label: '대시보드', description: '학습 통계 · 히트맵 · 점수 추이', icon: BarChart3, status: 'done' },
      { href: '/settings', label: '설정', description: '학습 흐름 · 외형 · 음성 · 알림 · 데이터', icon: SettingsIcon, status: 'done' },
    ],
  },
  {
    title: '마케팅 (Marketing)',
    description: '랜딩 · 가격 · 정책 · 회사 소개',
    accent: 'var(--info)',
    screens: [
      { href: '/about', label: '소개', description: '미션 · 학습 철학 4 + 학습 과학 7', icon: Sparkles, status: 'done' },
      { href: '/pricing', label: '가격', description: '3-tier · 비교표 · FAQ', icon: BarChart3, status: 'done' },
      { href: '/terms', label: '이용약관', description: '9 sections · sticky TOC', icon: ShieldCheck, status: 'done' },
      { href: '/privacy', label: '개인정보처리방침', description: '8 sections · sticky TOC', icon: ShieldCheck, status: 'done' },
    ],
  },
  {
    title: '관리자 (Admin Console)',
    description: '플랫폼 운영 · 콘텐츠 큐레이션 · 사용자 관리',
    accent: '#8B5CF6',
    screens: [
      { href: '/admin', label: '관리자 대시보드', description: 'KPI 개요 · 섹션 진입 · 최근 활동', icon: LayoutDashboard, status: 'done' },
      { href: '/admin/users', label: '사용자 관리', description: 'KPI 4 · 검색·필터 · 7명 mock', icon: Users, status: 'done' },
      { href: '/admin/library', label: '콘텐츠 관리', description: 'CRUD 카드 · CEFR · 큐레이션 · 6건 mock', icon: Library, status: 'done' },
      { href: '/admin/vocabulary', label: '단어장 마스터', description: '표준 단어 · IPA 검증 · TTS 캐시', icon: BookMarked, status: 'done' },
      { href: '/admin/analytics', label: '플랫폼 분석', description: 'DAU 라인 · 코호트 · funnel · 모듈 사용', icon: BarChart3, status: 'done' },
      { href: '/admin/reports', label: '신고/문의', description: '큐 + 심각도 + SLA + 상태 흐름', icon: Flag, status: 'done' },
      { href: '/admin/billing', label: '결제/구독', description: 'MRR 차트 · 트랜잭션 · 요금제 분포', icon: CreditCard, status: 'done' },
      { href: '/admin/settings', label: '시스템 설정', description: 'feature flags · AI 프롬프트 · 공지 · 점검', icon: Sliders, status: 'done' },
    ],
  },
  {
    title: '개발 도구 (Dev)',
    description: '컴포넌트 카탈로그 · 검증',
    accent: 'var(--active)',
    screens: [
      { href: '/dev/components', label: 'UI 컴포넌트 카탈로그', description: 'Parts Kit 14종 검증 페이지', icon: FlaskConical, status: 'done' },
    ],
  },
]

const STATUS_META: Record<Status, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  done: {
    label: '구현',
    icon: CheckCircle2,
    color: 'var(--success)',
    bg: 'var(--success-light)',
  },
  progress: {
    label: '진행',
    icon: CircleDot,
    color: 'var(--active)',
    bg: 'var(--active-light)',
  },
  pending: {
    label: '대기',
    icon: CircleDashed,
    color: 'var(--t3)',
    bg: 'var(--bg3)',
  },
}

export default function RootIndexPage() {
  const allScreens = GROUPS.flatMap((g) => g.screens)
  const total = allScreens.length
  const done = allScreens.filter((s) => s.status === 'done').length
  const progress = allScreens.filter((s) => s.status === 'progress').length
  const pending = allScreens.filter((s) => s.status === 'pending').length
  const donePercent = Math.round((done / total) * 100)

  return (
    <main className="min-h-screen bg-[var(--bg2)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* ── Hero ── */}
        <header className="mb-10 text-center">
          <span className="inline-flex items-center justify-center rounded-2xl bg-[var(--p-light)] p-4">
            <Sparkles size={28} className="text-[var(--p)]" />
          </span>
          <h1 className="mt-5 font-display text-[36px] font-[800] tracking-tight text-[var(--t1)]">
            Vocaflow
          </h1>
          <p className="mt-2 font-body text-[16px] text-[var(--t2)]">
            영어 스크립트 기반 종합 학습 플랫폼
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--t2)]">
            개발 진입점 · 화면 인덱스 + 진행 현황
          </p>
        </header>

        {/* ── 진행률 요약 ── */}
        <section
          aria-label="전체 진행 현황"
          className="mb-10 rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)]"
        >
          {/* 390px 에서 두 블록이 나란히 설 자리가 없어 상태 칩이 화면 밖으로 22px 밀렸다
              (실측 2026-08-26). 감싸서 아래로 내린다 — 가로 스크롤은 어떤 화면에서도 의도가 아니다. */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
                전체 진행률
              </p>
              <p className="mt-1 font-display text-[40px] font-[800] leading-none text-[var(--t1)]">
                {donePercent}
                <span className="ml-1 text-[24px] text-[var(--t2)]">%</span>
              </p>
              <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
                {done} / {total} 화면 구현 완료
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill status="done" count={done} />
              <StatusPill status="progress" count={progress} />
              <StatusPill status="pending" count={pending} />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5 h-2 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
            <div
              className="h-full rounded-[var(--r-full)] bg-[var(--success)] transition-[width] duration-[var(--dur-slow)]"
              style={{ width: `${donePercent}%` }}
              aria-hidden="true"
            />
          </div>
        </section>

        {/* ── 그룹별 화면 리스트 ── */}
        <div className="flex flex-col gap-10">
          {GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <header className="mb-4 flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: group.accent }}
                  aria-hidden="true"
                />
                <h2 className="font-display text-[18px] font-[700] text-[var(--t1)]">
                  {group.title}
                </h2>
                <span className="font-body text-[13px] text-[var(--t2)]">·</span>
                <p className="font-body text-[13px] text-[var(--t2)]">{group.description}</p>
                <span
                  className="ml-auto h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
                  aria-hidden="true"
                />
                <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                  {group.screens.filter((s) => s.status === 'done').length} / {group.screens.length}
                </span>
              </header>

              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.screens.map((screen) => (
                  <li key={screen.href}>
                    <ScreenCard screen={screen} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ── 푸터 ── */}
        <footer className="mt-12 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--t2)]">
            Vocaflow Design System v06.6 · Phase 1.5
          </p>
          <p className="mt-2 font-body text-[12px] text-[var(--t2)]">
            완성형 화면은 클릭하여 검증할 수 있습니다 · 대기 화면은 placeholder가 표시됩니다
          </p>
        </footer>
      </div>
    </main>
  )
}

function StatusPill({ status, count }: { status: Status; count: number }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[var(--r-full)] px-3 py-1"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span className="font-display text-[11px] font-[700] uppercase tracking-[0.06em]">
        {meta.label}
      </span>
      <span className="font-mono text-[12px] font-[700] tabular-nums">{count}</span>
    </span>
  )
}

function ScreenCard({ screen }: { screen: Screen }) {
  const meta = STATUS_META[screen.status]
  const StatusIcon = meta.icon
  const Icon = screen.icon
  const isInteractive = screen.status !== 'progress'

  const inner = (
    <div
      className={`group flex h-full items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ${
        isInteractive
          ? 'hover:-translate-y-0.5 hover:border-[var(--p)]/40 hover:shadow-[var(--sh-md)]'
          : 'cursor-not-allowed opacity-70'
      }`}
    >
      {/* Icon */}
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[var(--p-light)] group-hover:text-[var(--on-p-tint)]"
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={1.75} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-[14px] font-[600] text-[var(--t1)]">
            {screen.label}
          </p>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-full)] px-2 py-1"
            style={{ backgroundColor: meta.bg, color: meta.color }}
            aria-label={`상태: ${meta.label}`}
          >
            <StatusIcon size={10} strokeWidth={2.5} aria-hidden="true" />
            <span className="font-display text-[10px] font-[700] uppercase tracking-[0.06em]">
              {meta.label}
            </span>
          </span>
        </div>
        <p className="truncate font-body text-[12px] text-[var(--t2)]">{screen.description}</p>
        <p className="mt-1 truncate font-mono text-[10px] text-[var(--t2)]">{screen.href}</p>
      </div>
    </div>
  )

  if (!isInteractive) return inner
  return <Link href={screen.href}>{inner}</Link>
}
