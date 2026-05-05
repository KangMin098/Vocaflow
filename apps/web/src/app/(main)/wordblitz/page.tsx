// apps/web/src/app/(main)/wordblitz/page.tsx
// WordBlitz Hub — 게임 소개 + 통계 + 시작 CTA → /play/wordblitz
// 정서적 부호화: 인형뽑기 정글 분위기 미리보기로 기대감 형성

import {
  Award,
  Clock,
  Gamepad2,
  Layers,
  Maximize2,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

interface RecentScore {
  date: string
  score: number
  combo: number
  accuracy: number
}

const RECENT_SCORES: RecentScore[] = [
  { date: '오늘', score: 1240, combo: 8, accuracy: 90 },
  { date: '어제', score: 980, combo: 5, accuracy: 82 },
  { date: '4일 전', score: 1410, combo: 11, accuracy: 94 },
  { date: '6일 전', score: 760, combo: 4, accuracy: 76 },
]

interface RuleStep {
  step: string
  title: string
  description: string
}

const RULES: RuleStep[] = [
  {
    step: '01',
    title: '뜻을 읽어요',
    description: '화면 상단에 한국어 뜻이 표시됩니다.',
  },
  {
    step: '02',
    title: '인형을 골라요',
    description: '4개의 인형 중 뜻에 해당하는 영단어를 잡습니다.',
  },
  {
    step: '03',
    title: '연속 정답으로 콤보',
    description: '연속 정답 시 콤보 보너스 (최대 4단계).',
  },
]

export const metadata = {
  title: 'WordBlitz · Vocaflow',
}

export default function WordBlitzHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      {/* ── Hero ── */}
      <section
        aria-label="WordBlitz 소개"
        className="relative mb-6 overflow-hidden rounded-[var(--r-xl)] shadow-[var(--sh-sm)]"
        style={{
          background:
            'linear-gradient(135deg, #2d6a2d 0%, #3d8a3d 50%, #5ab540 100%)',
        }}
      >
        {/* 우상단 노란 highlight — 64→40 축소 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-2xl"
          style={{ background: 'radial-gradient(circle, #FFE234, transparent)' }}
        />

        <div className="relative px-5 py-6 text-[var(--ti)] md:px-7 md:py-7">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE234]/20 px-2.5 py-0.5 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#FFE234] backdrop-blur">
                <Sparkles size={11} aria-hidden />
                정글 어드벤처
              </span>
              <h1
                className="mt-2 font-display text-[28px] font-[800] leading-[1.05] tracking-tight text-[#FFE234] md:text-[36px]"
                style={{ textShadow: '2px 2px 0 #1a4a08, 3px 3px 8px rgba(0,0,0,0.35)' }}
              >
                WordBlitz
              </h1>
              <p className="mt-1 max-w-md font-body text-[13px] leading-snug text-[var(--ti)]/85 md:text-[14px]">
                Best 1410 · 콤보 11 · 정확도 94% — 더 높은 점수에 도전해 볼까요?
              </p>

              {/* Inline stats — Best/콤보/정확도 */}
              <ul className="mt-3 grid grid-cols-3 gap-3 border-t border-[#FFE234]/20 pt-3 md:max-w-sm">
                <li>
                  <p className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[#FFE234]/80">
                    Best
                  </p>
                  <p className="mt-0.5 font-display text-[22px] font-[800] tabular-nums leading-none text-[#FFE234]">
                    1410
                  </p>
                </li>
                <li className="border-l border-[#FFE234]/15 pl-3">
                  <p className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] opacity-75">
                    최고 콤보
                  </p>
                  <p className="mt-0.5 font-display text-[18px] font-[700] tabular-nums leading-none">
                    11
                  </p>
                </li>
                <li className="border-l border-[#FFE234]/15 pl-3">
                  <p className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] opacity-75">
                    정확도
                  </p>
                  <p className="mt-0.5 font-display text-[18px] font-[700] tabular-nums leading-none">
                    94<span className="ml-0.5 text-[11px] font-[600] opacity-75">%</span>
                  </p>
                </li>
              </ul>
            </div>

            {/* CTA + 크리처 — 우측 정렬 */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/play/wordblitz"
                  className="group inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[#FFE234] px-5 py-2.5 font-display text-[14px] font-[800] text-[#1a4a08] shadow-[0_3px_0_#B8860B,var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[#FFD93D] active:translate-y-0.5 active:shadow-[0_1px_0_#B8860B]"
                >
                  <Gamepad2 size={15} strokeWidth={2.5} aria-hidden />
                  바로 시작
                  <Zap
                    size={12}
                    strokeWidth={2.5}
                    aria-hidden
                    className="transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/play/wordblitz"
                  aria-label="풀스크린으로 시작"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-full)] border border-[var(--ti)]/30 bg-[var(--ti)]/10 text-[var(--ti)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ti)]/20"
                >
                  <Maximize2 size={14} aria-hidden />
                </Link>
              </div>

              {/* 크리처 — 4→3 축소, 12→10 size */}
              <div className="hidden items-end gap-2 md:flex">
                {['🐻', '🦊', '🐰'].map((c, i) => (
                  <span
                    key={i}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ti)]/15 text-[20px] backdrop-blur"
                    style={{
                      animation: `creatureBob 2.5s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes creatureBob {
            0%, 100% { transform: translateY(0) rotate(-3deg); }
            50%      { transform: translateY(-8px) rotate(3deg); }
          }
        `}</style>
      </section>

      {/* ── 학습 효과 + 통계 (2 cols) ── */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 학습 효과 (1 col) */}
        <aside
          aria-label="학습 효과"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]"
              aria-hidden
            >
              <Layers size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">학습 효과</h2>
          </header>
          <ul className="mt-4 space-y-3">
            {[
              { ko: '능동적 회상', en: 'Active Recall — 4 옵션 즉시 인출' },
              { ko: '정서적 부호화', en: 'Emotional Encoding — 콤보 도파민' },
              { ko: '간격 반복', en: 'Spaced Repetition — 오답 단어 우선 노출' },
            ].map((e) => (
              <li key={e.en}>
                <p className="font-display text-[13px] font-[700] text-[var(--t1)]">{e.ko}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--t3)]">{e.en}</p>
              </li>
            ))}
          </ul>
        </aside>

        {/* 게임 룰 (2 col) */}
        <aside
          aria-label="게임 규칙"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-4 flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--success-light)] text-[var(--success)]"
              aria-hidden
            >
              <Gamepad2 size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">게임 규칙</h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">3단계</span>
          </header>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {RULES.map((r) => (
              <li
                key={r.step}
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
              >
                <p className="font-mono text-[10px] font-[700] tabular-nums tracking-[0.10em] text-[var(--success)]">
                  {r.step}
                </p>
                <p className="mt-1 font-display text-[13px] font-[700] text-[var(--t1)]">
                  {r.title}
                </p>
                <p className="mt-1 font-body text-[11px] leading-relaxed text-[var(--t3)]">
                  {r.description}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {/* ── Best score + 최근 기록 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Best score 강조 */}
        <aside
          aria-label="최고 점수"
          className="rounded-[var(--r-lg)] border-2 border-[#FFE234]/40 bg-gradient-to-br from-[#FEF3C7] to-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[#FFE234] text-[#1a4a08]"
              aria-hidden
            >
              <Trophy size={14} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최고 기록</h2>
          </header>
          <p className="mt-4 font-display text-[40px] font-[800] tabular-nums leading-none text-[var(--t1)]">
            1,410
            <span className="ml-1 font-display text-[16px] font-[600] text-[var(--t3)]">점</span>
          </p>
          <p className="mt-2 font-mono text-[11px] text-[var(--t3)]">
            <Award size={11} className="mr-1 inline align-text-bottom" aria-hidden />
            4일 전 · 콤보 11 · 94%
          </p>
        </aside>

        {/* 최근 기록 (2 cols) */}
        <aside
          aria-label="최근 기록"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-3 flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg2)] text-[var(--t2)]"
              aria-hidden
            >
              <Clock size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최근 기록</h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">{RECENT_SCORES.length}회</span>
          </header>
          <ul className="divide-y divide-[var(--bg2)]">
            {RECENT_SCORES.map((s, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 font-mono text-[11px] text-[var(--t3)]">
                  {s.date}
                </span>
                <span className="flex-1 font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
                  {s.score.toLocaleString()}
                  <span className="ml-1 font-mono text-[10px] text-[var(--t3)]">점</span>
                </span>
                <span className="shrink-0 rounded-full bg-[var(--p-light)] px-2 py-0.5 font-mono text-[10px] font-[700] text-[var(--p)]">
                  콤보 {s.combo}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--t2)]">
                  {s.accuracy}%
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* ── Bottom CTA ── */}
      <footer className="mt-10 text-center">
        <Link
          href="/play/wordblitz"
          className="inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[#3d8a3d] px-8 py-3.5 font-display text-[15px] font-[700] text-[#FFE234] shadow-[0_4px_0_#1a4a08,var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:bg-[#5ab540] active:translate-y-1 active:shadow-[0_2px_0_#1a4a08]"
        >
          <Gamepad2 size={16} strokeWidth={2.5} aria-hidden />
          지금 한 판
        </Link>
        <p className="mt-3 font-body text-[12px] italic text-[var(--t3)]">
          짧고 즐겁게. 5분 안에 끝나는 한 라운드.
        </p>
      </footer>
    </div>
  )
}
