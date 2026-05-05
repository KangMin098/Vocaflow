// apps/web/src/app/(main)/scriptquiz/page.tsx
// ScriptQuiz Hub — Chapter 정확도 grid + 영어/한영 토글
// 학습 과학:
//   · 맥락 의존 기억 — chapter 단위로 묶어 인출
//   · Self-determination — 스크립트·문항수·언어 모드 사용자 선택
//   · Spaced Repetition — 정확도 70% 미만 chapter 재도전 강조
//   · Immersion (default) — 영어 질문/선택지, 한영 토글로 학습자 자율성 보장

'use client'

import { Activity, BookOpen, FileText, Languages, RefreshCcw } from 'lucide-react'
import { useState } from 'react'

import { ContinueRow } from '@/components/hub/ContinueRow'
import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'

const QUIZ_ACCENT = 'var(--active)' // 앰버

interface ChapterStat {
  id: string
  title: string
  attempts: number
  /** 0~100 */
  bestAccuracy: number
  lastAt?: string
}

const CHAPTERS: ChapterStat[] = [
  {
    id: 'gatsby-1',
    title: 'The Great Gatsby — Ch.1',
    attempts: 3,
    bestAccuracy: 88,
    lastAt: '2일 전',
  },
  {
    id: 'gatsby-2',
    title: 'The Great Gatsby — Ch.2',
    attempts: 2,
    bestAccuracy: 64,
    lastAt: '4일 전',
  },
  {
    id: 'gatsby-3',
    title: 'The Great Gatsby — Ch.3',
    attempts: 1,
    bestAccuracy: 56,
    lastAt: '어제',
  },
  {
    id: 'ted-1',
    title: 'TED · Power of Vulnerability',
    attempts: 4,
    bestAccuracy: 92,
    lastAt: '5일 전',
  },
  {
    id: 'jobs-1',
    title: 'Steve Jobs Stanford Speech',
    attempts: 2,
    bestAccuracy: 84,
    lastAt: '1주 전',
  },
  {
    id: '1984-1',
    title: '1984 — Part One Ch.1',
    attempts: 0,
    bestAccuracy: 0,
  },
]

export default function ScriptQuizHubPage() {
  const [chapterId, setChapterId] = useState('gatsby-3')
  const [count, setCount] = useState<'5' | '10' | '15'>('5')
  const [showKorean, setShowKorean] = useState(false)

  // ── 통계 ──
  const attempted = CHAPTERS.filter((c) => c.attempts > 0)
  const avgAccuracy = attempted.length
    ? Math.round(
        attempted.reduce((s, c) => s + c.bestAccuracy, 0) / attempted.length
      )
    : 0
  const weakChapters = attempted.filter((c) => c.bestAccuracy < 70)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* ── 1. Hero ── */}
      <ModuleHero
        eyebrow="ScriptQuiz · 스크립트 독해"
        title="스크립트 독해 검증"
        note={
          weakChapters.length > 0
            ? `재도전 권장 ${weakChapters.length} chapter · 평균 정확도 ${avgAccuracy}%`
            : attempted.length > 0
              ? `${attempted.length}/${CHAPTERS.length} chapter 학습 · 평균 ${avgAccuracy}%`
              : '아직 풀어본 chapter 가 없어요 — 첫 도전을 시작해 보세요'
        }
        gradient={{ from: '#F59E0B', to: '#B45309' }}
        icon={FileText}
        stats={[
          { label: '평균 정확도', value: avgAccuracy, unit: '%', emphasis: true },
          { label: '재도전 권장', value: weakChapters.length, unit: 'ch' },
          { label: '학습 진도', value: `${attempted.length}/${CHAPTERS.length}` },
        ]}
      />

      {/* ── 2. Continue ── */}
      <ContinueRow
        accent={QUIZ_ACCENT}
        href="/scriptquiz/play"
        session={{
          title: 'Gatsby Ch.3 · 4문제 남음',
          subtitle: '어제 56% 정확도 — 한 번 더 도전해보세요',
          progress: 0.4,
          hint: '어제 21:30',
        }}
      />

      {/* ── 3. Chapter accuracy grid (재도전 권장 우선) ── */}
      <section
        aria-label="스크립트별 정확도"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
      >
        <header className="mb-4 flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
            style={{ backgroundColor: 'var(--warning-light)', color: QUIZ_ACCENT }}
            aria-hidden
          >
            <BookOpen size={13} strokeWidth={2} />
          </span>
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">스크립트별 정확도</h2>
          <span className="font-body text-[12px] text-[var(--t3)]">·</span>
          <p className="font-body text-[12px] text-[var(--t3)]">
            70% 미만 재도전 권장 (Spaced Repetition)
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {[...CHAPTERS]
            .sort((a, b) => {
              // 재도전 권장(<70%) 우선
              const aWeak = a.attempts > 0 && a.bestAccuracy < 70 ? 0 : 1
              const bWeak = b.attempts > 0 && b.bestAccuracy < 70 ? 0 : 1
              if (aWeak !== bWeak) return aWeak - bWeak
              return b.bestAccuracy - a.bestAccuracy
            })
            .map((ch) => {
              const isWeak = ch.attempts > 0 && ch.bestAccuracy < 70
              const isUnattempted = ch.attempts === 0
              const accColor =
                ch.bestAccuracy >= 85
                  ? 'var(--success)'
                  : ch.bestAccuracy >= 70
                    ? 'var(--info)'
                    : ch.bestAccuracy > 0
                      ? 'var(--active)'
                      : 'var(--t3)'
              return (
                <li key={ch.id}>
                  <button
                    type="button"
                    onClick={() => setChapterId(ch.id)}
                    className={`flex w-full items-center gap-3 rounded-[var(--r-md)] border p-3 text-left transition-all duration-[var(--dur-normal)] ${
                      chapterId === ch.id
                        ? 'border-[var(--active)] bg-[var(--warning-light)]'
                        : isWeak
                          ? 'border-[var(--active)]/30 bg-[var(--bg)] hover:border-[var(--active)]/60'
                          : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--bd)]'
                    }`}
                    aria-pressed={chapterId === ch.id}
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
                      style={{ backgroundColor: `${accColor}15`, color: accColor }}
                      aria-hidden
                    >
                      {isWeak ? <RefreshCcw size={14} /> : <FileText size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-english text-[13px] font-[600] text-[var(--t1)]">
                        {ch.title}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--t3)]">
                        {isUnattempted
                          ? '아직 도전 안 함'
                          : `${ch.attempts}회 도전 · ${ch.lastAt}`}
                      </p>
                    </div>
                    <span
                      className="font-display text-[16px] font-[800] tabular-nums leading-none"
                      style={{ color: accColor }}
                    >
                      {isUnattempted ? '—' : `${ch.bestAccuracy}%`}
                    </span>
                  </button>
                </li>
              )
            })}
        </ul>
      </section>

      {/* ── 4. 평균 정확도 mini stat ── */}
      <section className="grid grid-cols-3 gap-3">
        {[
          {
            label: '평균 정확도',
            value: `${avgAccuracy}%`,
            color: 'var(--success)',
            icon: Activity,
          },
          {
            label: '재도전 권장',
            value: weakChapters.length,
            color: 'var(--active)',
            icon: RefreshCcw,
          },
          {
            label: '미도전',
            value: CHAPTERS.length - attempted.length,
            color: 'var(--t3)',
            icon: BookOpen,
          },
        ].map((m) => {
          const Icon = m.icon
          return (
            <article
              key={m.label}
              className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]"
                  style={{ backgroundColor: `${m.color}15`, color: m.color }}
                  aria-hidden
                >
                  <Icon size={12} strokeWidth={2} />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
                  {m.label}
                </p>
              </div>
              <p
                className="mt-2 font-display text-[24px] font-[800] tabular-nums leading-none"
                style={{ color: m.color }}
              >
                {m.value}
              </p>
            </article>
          )
        })}
      </section>

      {/* ── 5. Configure & Start ── */}
      <HubStartCard
        title="설정 후 시작"
        description="영어 immersion 기본 — 어려우면 한국어 번역도 함께 보세요"
        choices={[
          {
            label: '문항 수',
            value: count,
            options: [
              { value: '5', label: '5문제 (~3분)' },
              { value: '10', label: '10문제 (~6분)' },
              { value: '15', label: '15문제 (~10분)' },
            ],
            onChange: (v) => setCount(v as '5' | '10' | '15'),
          },
        ]}
        extras={
          <label className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg)] text-[var(--p)]"
              aria-hidden
            >
              <Languages size={14} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[13px] font-[600] text-[var(--t1)]">
                한국어 번역 보기
              </span>
              <span className="block font-body text-[11px] text-[var(--t3)]">
                질문·선택지 아래 회색 작은 글씨로 보조 표시 — 영어로만 보고 싶다면 끄세요
              </span>
            </span>
            <input
              type="checkbox"
              checked={showKorean}
              onChange={(e) => setShowKorean(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[var(--p)]"
              aria-label="한국어 번역 보기"
            />
          </label>
        }
        cta={{
          label: '시작하기',
          href: `/scriptquiz/play?ch=${chapterId}&n=${count}${showKorean ? '&ko=1' : ''}`,
          accent: QUIZ_ACCENT,
        }}
      />
    </div>
  )
}
