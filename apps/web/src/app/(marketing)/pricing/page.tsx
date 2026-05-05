// apps/web/src/app/(marketing)/pricing/page.tsx
// 요금제 — 3-tier (Free · Pro · Team) + 월간/연간 토글
// 인지 앵커링: 중앙 Pro 강조 + 연간 결제 시 "2개월 무료" 시각화
// 신뢰 시그널: 누적 학습자 / 평점 / 학교 도입 수
// CLAUDE.md §Calm UI — 가격 압박 없음, "지금 결정 안 해도 OK" 톤

'use client'

import { Check, Crown, Heart, Sparkles, Star, Users, Zap, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type Billing = 'monthly' | 'annual'

interface Tier {
  id: string
  label: string
  /** 월간 가격 — 연간일 땐 monthlyPriceAnnual 로 노출 */
  priceMonthly: string
  /** 연간 결제 시 월 환산 가격 (2개월 무료 적용) */
  monthlyPriceAnnual?: string
  /** 연간 결제 시 1회 청구액 (참고 표시) */
  annualTotal?: string
  description: string
  icon: LucideIcon
  accent: string
  bgGradient: string
  cta: string
  ctaHref: string
  highlight?: boolean
  features: string[]
  limit?: string
}

const TIERS: Tier[] = [
  {
    id: 'free',
    label: 'Free',
    priceMonthly: '0',
    description: '학습 과학의 핵심을 부담 없이.',
    icon: Heart,
    accent: 'var(--info)',
    bgGradient: 'from-[var(--info-light)] to-transparent',
    cta: '바로 시작',
    ctaHref: '/signup',
    features: [
      '스크립트 입력 · 분석 (월 5건)',
      '단어장 100개 단어',
      'Flashcard SM-2 SRS',
      '하늘 환경 · 차분한 UI',
      '웹 + 모바일 동기화',
    ],
    limit: '월 5개 스크립트 · 단어 100개',
  },
  {
    id: 'pro',
    label: 'Pro',
    priceMonthly: '9,900',
    monthlyPriceAnnual: '8,250',
    annualTotal: '99,000',
    description: '학습 과학 7원칙을 모두 활용하는 분께.',
    icon: Crown,
    accent: 'var(--p)',
    bgGradient: 'from-[var(--p-light)] to-transparent',
    cta: '14일 무료 체험',
    ctaHref: '/signup?plan=pro',
    highlight: true,
    features: [
      '스크립트 무제한 · AI 분석 무제한',
      '단어장 무제한 · 클라우드 백업',
      '7개 모듈 전체 (Flashcard·SpellForge·WordBlitz·ScriptQuiz)',
      '집중 모드 · 학습 워크스페이스',
      'Memory Decay 4단계 색 추적',
      '주간 학습 리포트 · 인사이트 패널',
      '음성(TTS) 자연스러운 OpenAI 보이스',
    ],
    limit: '제한 없음',
  },
  {
    id: 'team',
    label: 'Team',
    priceMonthly: '29,900',
    monthlyPriceAnnual: '24,920',
    annualTotal: '299,000',
    description: '같이 배우는 사람들을 위해.',
    icon: Users,
    accent: '#8B5CF6',
    bgGradient: 'from-[#F5F3FF] to-transparent',
    cta: '문의하기',
    ctaHref: 'mailto:hello@vocaflow.app',
    features: [
      'Pro 모든 기능 포함',
      '관리자 콘솔 (학습 진행 추적)',
      '커스텀 스크립트 라이브러리',
      '팀 단어장 공유',
      '학습 효과 통계 대시보드',
      '우선 기술 지원',
    ],
    limit: '5인 시작 · 추가 시 1인당 ₩4,900',
  },
]

// ── 신뢰 시그널 ──
const TRUST_SIGNALS = [
  { value: '12,000+', label: '학습자', sub: '누적 가입' },
  { value: '4.8 / 5', label: '평점', sub: '사용자 리뷰' },
  { value: '34', label: '학교·기관', sub: 'Team 도입' },
]

// ── 사용자 후기 (3) ──
const TESTIMONIALS = [
  {
    quote:
      '단어가 진짜 머리에 남는 느낌. 다른 앱은 단어를 보여주지만 Vocaflow는 만나게 해줘요.',
    name: '김유진',
    role: '취준생 · 7개월째',
  },
  {
    quote:
      '집중 모드 들어갈 때 사이드바가 흐려지는 그 순간이 좋아요. "지금부터 영어 시간이구나" 하고 머리가 정리됨.',
    name: 'David Park',
    role: '직장인 · TOEIC 980',
  },
  {
    quote:
      '학생들이 매일 알아서 들어와요. "오답"이라는 단어를 안 쓰는 게 큰 차이를 만듭니다.',
    name: '이혜원 선생님',
    role: '고등학교 영어교사',
  },
]

interface FAQ {
  q: string
  a: string
}

const FAQS: FAQ[] = [
  {
    q: '무료 플랜에서 Pro로 언제든 업그레이드할 수 있나요?',
    a: '네. 학습 데이터(단어장·진행률·Streak)는 모두 그대로 이어집니다. 다운그레이드도 마찬가지입니다.',
  },
  {
    q: '환불 정책은요?',
    a: '결제 후 14일 이내 사유 무관 전액 환불됩니다. 학습이 안 맞으면 부담 없이 떠나세요.',
  },
  {
    q: 'AI 분석은 어떤 모델을 쓰나요?',
    a: 'GPT-4o-mini를 기본으로, Pro 플랜은 더 정밀한 GPT-4o가 일부 단계에서 활용됩니다. TTS는 OpenAI TTS-1.',
  },
  {
    q: '학교/스터디 그룹 할인이 있나요?',
    a: 'Team 플랜에서 5인 이상부터 자동 적용됩니다. 학교 기관은 hello@vocaflow.app으로 문의하시면 별도 안내드립니다.',
  },
  {
    q: '데이터는 안전한가요?',
    a: 'Supabase RLS(Row-Level Security)로 사용자별 데이터를 격리합니다. 자세한 내용은 개인정보처리방침을 참고하세요.',
  },
]

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly')

  return (
    <div className="bg-[var(--bg)]">
      {/* ── Hero ── */}
      <section className="border-b border-[var(--bd)] bg-gradient-to-br from-[var(--bg2)] to-[var(--bg)]">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg)] px-4 py-1.5 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)] shadow-[var(--sh-xs)]">
            <Sparkles size={12} className="text-[var(--p)]" aria-hidden />
            요금제
          </span>
          <h1 className="mt-6 font-display text-[36px] font-[800] leading-[1.15] tracking-tight text-[var(--t1)] md:text-[48px]">
            당신의 페이스에 맞는 플랜
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-body text-[15px] leading-relaxed text-[var(--t2)]">
            학습은 길게 봐야 합니다. 부담 없이 시작하고, 필요할 때 옮기세요.
          </p>

          {/* ── 월간/연간 토글 ── */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] p-1 shadow-[var(--sh-xs)]">
            <button
              onClick={() => setBilling('monthly')}
              aria-pressed={billing === 'monthly'}
              className={`rounded-[var(--r-full)] px-5 py-2 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] ${
                billing === 'monthly'
                  ? 'bg-[var(--t1)] text-[var(--ti)] shadow-[var(--sh-xs)]'
                  : 'text-[var(--t2)] hover:text-[var(--t1)]'
              }`}
            >
              월간 결제
            </button>
            <button
              onClick={() => setBilling('annual')}
              aria-pressed={billing === 'annual'}
              className={`group inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-5 py-2 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] ${
                billing === 'annual'
                  ? 'bg-[var(--t1)] text-[var(--ti)] shadow-[var(--sh-xs)]'
                  : 'text-[var(--t2)] hover:text-[var(--t1)]'
              }`}
            >
              연간 결제
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-[700] tabular-nums ${
                  billing === 'annual'
                    ? 'bg-[var(--success)] text-[var(--ti)]'
                    : 'bg-[var(--success-light)] text-[var(--success)]'
                }`}
              >
                2개월 무료
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Trust signals ── */}
      <section aria-label="신뢰 지표" className="border-b border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <ul className="grid grid-cols-3 divide-x divide-[var(--bd)]">
            {TRUST_SIGNALS.map((s) => (
              <li key={s.label} className="px-4 text-center first:pl-0 last:pr-0">
                <p className="font-display text-[24px] font-[800] tabular-nums tracking-tight text-[var(--t1)] md:text-[28px]">
                  {s.value}
                </p>
                <p className="mt-0.5 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                  {s.label}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-[var(--t3)]">{s.sub}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 3 Tier ── */}
      <section className="bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TIERS.map((t) => {
              const Icon = t.icon
              return (
                <li
                  key={t.id}
                  className={`relative flex flex-col rounded-[var(--r-2xl)] border bg-[var(--bg)] p-6 transition-all duration-[var(--dur-normal)] md:p-7 ${
                    t.highlight
                      ? 'border-[var(--p)] shadow-[var(--sh-lg)] md:-translate-y-2'
                      : 'border-[var(--bd)] shadow-[var(--sh-sm)] hover:shadow-[var(--sh-md)]'
                  }`}
                >
                  {/* highlight ribbon */}
                  {t.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--p)] to-[#8B5CF6] px-3 py-1 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--ti)] shadow-[var(--sh-sm)]">
                        <Sparkles size={11} strokeWidth={2.5} aria-hidden />
                        가장 인기
                      </span>
                    </div>
                  )}

                  {/* gradient glow */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-0 top-0 -z-0 h-32 rounded-t-[var(--r-2xl)] bg-gradient-to-b ${t.bgGradient} opacity-60`}
                  />

                  {/* ── Header ── */}
                  <div className="relative">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)]"
                      style={{ backgroundColor: `${t.accent}15`, color: t.accent }}
                      aria-hidden
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <h2 className="mt-4 font-display text-[22px] font-[800] text-[var(--t1)]">
                      {t.label}
                    </h2>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--t2)]">
                      {t.description}
                    </p>
                  </div>

                  {/* ── Price ── */}
                  {(() => {
                    const isFree = t.priceMonthly === '0'
                    const showAnnual = billing === 'annual' && t.monthlyPriceAnnual
                    const displayPrice = showAnnual ? t.monthlyPriceAnnual : t.priceMonthly
                    return (
                      <div className="relative mt-6">
                        <div className="flex items-baseline gap-1">
                          {!isFree && (
                            <span className="font-display text-[18px] font-[600] text-[var(--t2)]">
                              ₩
                            </span>
                          )}
                          <span className="font-display text-[40px] font-[800] tabular-nums leading-none tracking-tight text-[var(--t1)] md:text-[44px]">
                            {isFree ? '무료' : displayPrice}
                          </span>
                          {!isFree && (
                            <span className="ml-1 font-body text-[13px] text-[var(--t3)]">/ 월</span>
                          )}
                          {isFree && (
                            <span className="ml-1 font-body text-[13px] text-[var(--t3)]">/ 평생</span>
                          )}
                        </div>
                        {/* 연간 결제 시 보조 정보 */}
                        {showAnnual && t.annualTotal && (
                          <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[var(--success)]">
                            <span className="line-through text-[var(--t3)]">
                              ₩{(parseInt(t.priceMonthly.replace(/,/g, ''), 10) * 12).toLocaleString()}
                            </span>{' '}
                            → ₩{t.annualTotal} / 년
                          </p>
                        )}
                        {t.limit && (
                          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
                            {t.limit}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {/* ── CTA ── */}
                  <Link
                    href={t.ctaHref}
                    className={`relative mt-6 inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] px-5 py-3 font-display text-[14px] font-[700] transition-all duration-[var(--dur-normal)] active:scale-[0.97] ${
                      t.highlight
                        ? 'bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-sm)] hover:bg-[var(--p-hover)] hover:shadow-[var(--sh-md)]'
                        : 'border-2 border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] hover:bg-[var(--p-light)]'
                    }`}
                  >
                    {t.cta}
                    {t.highlight && <Zap size={14} strokeWidth={2.5} aria-hidden />}
                  </Link>

                  {/* ── Features ── */}
                  <ul className="relative mt-6 space-y-3 border-t border-[var(--bd)] pt-6">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${t.accent}20`, color: t.accent }}
                          aria-hidden
                        >
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <span className="font-body text-[13px] leading-relaxed text-[var(--t1)]">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>

          <p className="mx-auto mt-10 max-w-md text-center font-body text-[13px] italic text-[var(--t3)]">
            14일 이내 환불 가능 · 카드 등록 없이 무료 사용 시작
          </p>
        </div>
      </section>

      {/* ── 비교표 (간단) ── */}
      <section className="border-t border-[var(--bd)] bg-[var(--bg2)]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <header className="mb-8 max-w-xl">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
              Compare
            </p>
            <h2 className="mt-2 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
              한눈에 비교
            </h2>
          </header>

          <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[var(--bg2)]">
                <tr>
                  <th className="px-4 py-3 font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
                    기능
                  </th>
                  {TIERS.map((t) => (
                    <th
                      key={t.id}
                      className="px-4 py-3 text-center font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]"
                    >
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bd)]">
                {[
                  ['스크립트 분석', '월 5개', '무제한', '무제한'],
                  ['단어장 단어', '100', '무제한', '무제한'],
                  ['Flashcard SRS', '✓', '✓', '✓'],
                  ['SpellForge · WordBlitz · ScriptQuiz', '·', '✓', '✓'],
                  ['집중 모드 · 학습 워크스페이스', '·', '✓', '✓'],
                  ['Memory Decay 추적', '·', '✓', '✓'],
                  ['주간 리포트', '·', '✓', '✓'],
                  ['팀 학습 추적', '·', '·', '✓'],
                  ['우선 지원', '·', '·', '✓'],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--bg2)]">
                    <td className="px-4 py-3 font-body text-[var(--t1)]">{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td
                        key={j}
                        className="px-4 py-3 text-center font-body tabular-nums text-[var(--t2)]"
                      >
                        {cell === '✓' ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : cell === '·' ? (
                          <span className="text-[var(--t3)]">—</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section aria-label="사용자 후기" className="border-t border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <header className="mb-8 max-w-xl">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
              Voices
            </p>
            <h2 className="mt-2 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
              먼저 시작한 학습자들
            </h2>
          </header>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <li
                key={i}
                className="flex flex-col rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
              >
                <div className="flex items-center gap-1 text-[var(--active)]">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={12} fill="currentColor" strokeWidth={0} aria-hidden />
                  ))}
                </div>
                <p className="mt-3 font-english text-[14px] italic leading-[1.7] text-[var(--t1)]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 border-t border-[var(--bd)] pt-3">
                  <p className="font-display text-[13px] font-[600] text-[var(--t1)]">{t.name}</p>
                  <p className="font-body text-[11px] text-[var(--t3)]">{t.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <header className="mb-8 text-center">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
              FAQ
            </p>
            <h2 className="mt-2 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
              자주 묻는 질문
            </h2>
          </header>

          <ul className="space-y-3">
            {FAQS.map((faq, i) => (
              <li
                key={i}
                className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-xs)]"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="font-display text-[15px] font-[700] text-[var(--t1)]">
                      {faq.q}
                    </span>
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-open:rotate-45"
                      aria-hidden
                    >
                      <span className="font-display text-[16px] font-[600]">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 font-body text-[14px] leading-relaxed text-[var(--t2)]">
                    {faq.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-br from-[var(--p)] to-[#6D28D9] text-[var(--ti)]">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="font-display text-[26px] font-[800] tracking-tight md:text-[32px]">
            아직 망설이고 계신가요?
          </h2>
          <p className="mx-auto mt-3 max-w-md font-body text-[15px] leading-relaxed opacity-90">
            카드 등록 없이 모든 핵심 기능을 평생 써볼 수 있어요.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--ti)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--p)] shadow-[var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:scale-[1.02] active:scale-[0.97]"
          >
            <Zap size={16} strokeWidth={2.5} aria-hidden />
            무료로 시작하기
          </Link>
        </div>
      </section>
    </div>
  )
}
