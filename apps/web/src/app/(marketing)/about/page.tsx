// apps/web/src/app/(marketing)/about/page.tsx
// 소개 — 학습 철학(4) + 학습 과학(7) + 7모듈 + 미션
// CLAUDE.md §디자인 철학·학습 과학 원칙 직접 시각화

import {
  Brain,
  Eye,
  Feather,
  Gauge,
  Heart,
  Layers,
  RefreshCw,
  Repeat,
  Sparkles,
  Sprout,
  Type,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

interface Principle {
  ko: string
  en: string
  desc: string
  icon: LucideIcon
  accent: string
}

const PHILOSOPHY: Principle[] = [
  {
    ko: '차분한 인터페이스',
    en: 'Calm UI',
    desc: '학습 중 시각·청각 자극을 최소화합니다. 광고도, 알림도, 빨간 카운터도 없어요.',
    icon: Waves,
    accent: 'var(--info)',
  },
  {
    ko: '점진적 공개',
    en: 'Progressive Disclosure',
    desc: '본질만 먼저 보여주고, 깊이는 당신이 원할 때 펼쳐냅니다.',
    icon: Eye,
    accent: 'var(--p)',
  },
  {
    ko: '공감 피드백',
    en: 'Empathetic Feedback',
    desc: '비난 대신 격려. "오답"이 아니라 "다시 만나봐요".',
    icon: Heart,
    accent: '#EC4899',
  },
  {
    ko: '암묵적 진행',
    en: 'Implicit Progress',
    desc: '숫자 대신 환경의 변화로 성장을 보여줍니다. Streak, 단어 색의 변화 같은 것들로요.',
    icon: Sprout,
    accent: 'var(--success)',
  },
]

const SCIENCE: Principle[] = [
  {
    ko: '능동적 회상',
    en: 'Active Recall',
    desc: '인출이 재인보다 강한 기억을 만든다 (Karpicke & Roediger, 2008).',
    icon: Brain,
    accent: 'var(--p)',
  },
  {
    ko: '간격 반복',
    en: 'Spaced Repetition',
    desc: '망각곡선의 가장자리에서 다시 만나면 기억이 단단해집니다 (Ebbinghaus, SM-2).',
    icon: Repeat,
    accent: '#8B5CF6',
  },
  {
    ko: '바람직한 어려움',
    en: 'Desirable Difficulty',
    desc: '약간의 분투가 보유율을 끌어올립니다 (Bjork).',
    icon: Gauge,
    accent: 'var(--active)',
  },
  {
    ko: '이중 부호화',
    en: 'Dual Coding',
    desc: '언어와 시각·청각이 함께 들어올 때, 기억은 두 채널로 입력됩니다 (Paivio).',
    icon: Layers,
    accent: 'var(--info)',
  },
  {
    ko: '맥락 의존 기억',
    en: 'Context-Dependent',
    desc: '단어를 학습한 그 스크립트에서 다시 만나면, 인출은 더 강해집니다.',
    icon: Type,
    accent: '#10B981',
  },
  {
    ko: '인지 부하 관리',
    en: 'Cognitive Load',
    desc: '작업기억은 동시에 약 4가지만 다룹니다 (Sweller). 한 번에 한 단어부터.',
    icon: Feather,
    accent: '#F59E0B',
  },
  {
    ko: '정서적 부호화',
    en: 'Emotional Encoding',
    desc: '도파민 보상과 자기효능감이 해마의 기억을 더 깊이 새깁니다.',
    icon: Sparkles,
    accent: '#EC4899',
  },
]

interface Module {
  href: string
  label: string
  desc: string
  icon: string
  color: string
}

const MODULES: Module[] = [
  { href: '/text', label: 'TextViewer', desc: '스크립트 입력 → AI 단어 추출', icon: '📖', color: 'var(--p)' },
  { href: '/wordvault', label: 'WordVault', desc: '맥락 결합 단어장', icon: '📝', color: 'var(--on-p-tint)' },
  { href: '/flashcard', label: 'Flashcard', desc: 'SM-2 간격 반복', icon: '🃏', color: 'var(--p)' },
  { href: '/spellforge', label: 'SpellForge', desc: '능동적 타이핑 회상', icon: '⚡', color: '#4A9FCF' },
  { href: '/play/wordblitz', label: 'WordBlitz', desc: '속사 단어 인지', icon: '⏱', color: '#8B5CF6' },
  { href: '/scriptquiz', label: 'ScriptQuiz', desc: '맥락 독해 퀴즈', icon: '✏️', color: 'var(--active)' },
  { href: '/dashboard', label: 'Dashboard', desc: '암묵적 진행 시각화', icon: '📊', color: 'var(--info)' },
]

export const metadata = {
  title: '소개 · Vocaflow',
  description: '영어를 오래 가게 만드는 학습 — 학습 철학 4개 + 학습 과학 7개를 도구로 합니다.',
}

export default function AboutPage() {
  return (
    <div className="bg-[var(--bg)]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--bd)] bg-gradient-to-br from-[var(--p-light)] via-[var(--bg)] to-[var(--bg)]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg)] px-4 py-1.5 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)] shadow-[var(--sh-xs)]">
            <Sparkles size={12} className="text-[var(--p)]" aria-hidden />
            우리의 미션
          </span>
          <h1 className="mt-6 font-display text-[36px] font-[800] leading-[1.15] tracking-tight text-[var(--t1)] md:text-[52px]">
            영어를{' '}
            <span className="bg-gradient-to-r from-[var(--p)] to-[#8B5CF6] bg-clip-text text-transparent">
              오래 가게
            </span>{' '}
            만드는 학습
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-english text-[18px] italic leading-[1.7] text-[var(--t2)]">
            “We don&apos;t teach English. We help you remember it.”
          </p>
          <p className="mx-auto mt-3 max-w-2xl font-body text-[15px] leading-relaxed text-[var(--t2)]">
            Vocaflow는 학습 과학과 디자인을 도구로, 단어를 외우는 게 아니라 <strong className="font-[600] text-[var(--t1)]">머리에 남도록</strong>{' '}
            돕습니다. 차분하게, 단단하게, 오래.
          </p>
        </div>
      </section>

      {/* ── 디자인 철학 4 ── */}
      <section className="border-b border-[var(--bd)] bg-[var(--bg2)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
              Design Philosophy
            </p>
            <h2 className="mt-2 font-display text-[28px] font-[800] tracking-tight text-[var(--t1)] md:text-[34px]">
              학습은 차분할수록 깊어집니다
            </h2>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-[var(--t2)]">
              화려함은 흥미를 끌지만, 깊은 학습은 산만함을 견디지 못합니다. Vocaflow는 4가지 디자인 철학을 모든 화면의 기준으로 삼습니다.
            </p>
          </header>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PHILOSOPHY.map((p) => {
              const Icon = p.icon
              return (
                <li
                  key={p.en}
                  className="group relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-[0.08] blur-2xl"
                    style={{ background: `radial-gradient(circle, ${p.accent}, transparent)` }}
                  />
                  <span
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-md)]"
                    style={{ backgroundColor: `${p.accent}15`, color: p.accent }}
                    aria-hidden
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <p className="relative mt-4 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
                    {p.en}
                  </p>
                  <h3 className="relative mt-1 font-display text-[20px] font-[700] text-[var(--t1)]">
                    {p.ko}
                  </h3>
                  <p className="relative mt-2 font-body text-[14px] leading-relaxed text-[var(--t2)]">
                    {p.desc}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ── 학습 과학 7 ── */}
      <section className="border-b border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
              Learning Science
            </p>
            <h2 className="mt-2 font-display text-[28px] font-[800] tracking-tight text-[var(--t1)] md:text-[34px]">
              인지심리학이 입증한 7가지 원칙
            </h2>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-[var(--t2)]">
              모든 모듈은 최소 1개 이상의 학습 과학 원칙에 근거합니다. 토큰과 컬러는 이 원칙을 구현하기 위한 도구일 뿐.
            </p>
          </header>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCIENCE.map((p, i) => {
              const Icon = p.icon
              return (
                <li
                  key={p.en}
                  className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 transition-all duration-[var(--dur-normal)] hover:border-[var(--bdf)]/40 hover:shadow-[var(--sh-sm)]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
                      style={{ backgroundColor: `${p.accent}15`, color: p.accent }}
                      aria-hidden
                    >
                      <Icon size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-[700] tabular-nums tracking-[0.10em] text-[var(--t2)]">
                        {String(i + 1).padStart(2, '0')} · {p.en}
                      </p>
                      <h3 className="mt-1 font-display text-[15px] font-[700] text-[var(--t1)]">
                        {p.ko}
                      </h3>
                      <p className="mt-1.5 font-body text-[12px] leading-relaxed text-[var(--t2)]">
                        {p.desc}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ── 7 모듈 ── */}
      <section className="border-b border-[var(--bd)] bg-[var(--bg2)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--success)]">
              Modules
            </p>
            <h2 className="mt-2 font-display text-[28px] font-[800] tracking-tight text-[var(--t1)] md:text-[34px]">
              하나의 스크립트, 7가지 만남
            </h2>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-[var(--t2)]">
              같은 단어를 여러 맥락에서 만날 때 기억은 단단해집니다. 7개 모듈은 그 만남의 다른 얼굴들입니다.
            </p>
          </header>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {MODULES.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="group flex aspect-square min-h-[120px] flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-center shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
                >
                  <span className="text-[28px] leading-none transition-transform duration-[var(--dur-normal)] group-hover:scale-110">
                    {m.icon}
                  </span>
                  <span className="font-display text-[12px] font-[600] text-[var(--t1)]">
                    {m.label}
                  </span>
                  <span className="font-body text-[10px] leading-tight text-[var(--t2)]">
                    {m.desc}
                  </span>
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 right-0 h-[3px] origin-left scale-x-0 rounded-b-[var(--r-lg)] transition-transform duration-[var(--dur-normal)] group-hover:scale-x-100"
                    style={{ backgroundColor: m.color }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 안티패턴(차별화 메시지) ── */}
      <section className="border-b border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
          <header className="mb-8 text-center">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--error-ink)]">
              What we never do
            </p>
            <h2 className="mt-2 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)] md:text-[32px]">
              저희가 절대 하지 않는 것들
            </h2>
          </header>

          <ul className="space-y-3">
            {[
              { bad: '"정확도 67% 😢" 빨간 글씨로 압박', good: '진행은 색·아이콘·여백의 변화로 보여줍니다.' },
              { bad: '"3일 연속 학습이 끊겼어요!" 모달', good: '잠시 떠나도 비난하지 않습니다. 돌아오면 그냥 환영해요.' },
              { bad: '오답을 빨강으로만 표시', good: '"다시 만나봐요" — 색맹과 정서를 모두 배려합니다.' },
              { bad: '학습 흐름을 끊는 광고·업셀', good: '학습 중에는 어떤 방해도 없습니다.' },
              { bad: '진행률 100%에 폭죽·트로피 과장 보상', good: '"오늘 잘 마쳤어요" 한 줄, 그것으로 충분합니다.' },
            ].map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
              >
                <span className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error-light)] font-display text-[11px] font-[700] text-[var(--error-ink)]">
                    ✕
                  </span>
                  <span className="h-3 w-px bg-[var(--bd)]" aria-hidden />
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-light)] font-display text-[11px] font-[700] text-[var(--success)]">
                    ✓
                  </span>
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-body text-[13px] text-[var(--t2)] line-through decoration-[var(--error)]/40">
                    {item.bad}
                  </p>
                  <p className="font-body text-[14px] leading-relaxed text-[var(--t1)]">
                    {item.good}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-br from-[var(--p)] to-[#6D28D9] text-[var(--ti)]">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <h2 className="font-display text-[28px] font-[800] tracking-tight md:text-[36px]">
            지금 단어 한 개부터
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-body text-[15px] leading-relaxed opacity-90">
            오래 가는 학습은 가벼운 시작에서 옵니다. 30초만 투자해 보세요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--ti)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--p)] shadow-[var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:scale-[1.02] active:scale-[0.97]"
            >
              <Zap size={16} strokeWidth={2.5} aria-hidden />
              무료로 시작하기
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-[var(--r-md)] border-2 border-[var(--ti)]/30 px-6 py-3 font-display text-[14px] font-[600] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:border-[var(--ti)]/60"
            >
              <RefreshCw size={14} strokeWidth={2} aria-hidden />
              요금제 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
