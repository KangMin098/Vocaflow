// apps/web/src/app/(main)/flashcard/page.tsx
// Flashcard Hub — Continue + Today Queue + Stats + Configure
// 학습 과학 매핑:
//   · Zeigarnik: 미완료 SRS 세션 surface
//   · Retrieval priming: Memory Decay 4단계 큐 미리보기
//   · Self-determination: 단어장·모드·길이 사용자 선택
//   · Implicit Progress: 7일 정확도 sparkline + Streak

'use client'

import { Activity, Flame, Layers, Target, TrendingUp } from 'lucide-react'
import { useState } from 'react'

import { ContinueRow } from '@/components/hub/ContinueRow'
import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { TodayQueue, type QueueBucket } from '@/components/hub/TodayQueue'

const FLASHCARD_ACCENT = '#EC4899' // CLAUDE.md §13 — Flashcard 모듈 색(면/그래프/점)
// 같은 핑크를 '채움 위 글자' 나 '작은 글자' 로 쓰면 3.4~3.5:1 로 AA 미달이라(2026-08-09 axe)
// 글자·채움 CTA 는 한 단계 깊은 톤을 쓴다(흰 글자 6.04 · 종이 위 5.78).
const FLASHCARD_INK = '#BE185D'

const QUEUE: QueueBucket[] = [
  { kind: 'risk', count: 5, preview: ['vulnerable', 'unmistakable', 'inclined'] },
  { kind: 'shaky', count: 12, preview: ['criticize', 'reserved', 'judgments'] },
  { kind: 'new', count: 3, preview: ['advantages', 'consequence'] },
  { kind: 'stable', count: 23 },
]

// 7일 정확도 sparkline 데이터
const ACCURACY_7D = [82, 85, 88, 79, 91, 87, 92]

const VOCABULARIES = [
  { value: 'gatsby-1', label: 'The Great Gatsby — Chapter 1', hint: '32단어' },
  { value: 'gatsby-2', label: 'The Great Gatsby — Chapter 2', hint: '28단어' },
  { value: 'all', label: '전체 단어장 통합', hint: '847단어' },
]

export default function FlashcardHubPage() {
  const [vocab, setVocab] = useState('gatsby-1')
  const [mode, setMode] = useState<'word-to-meaning' | 'meaning-to-word'>('word-to-meaning')
  const [length, setLength] = useState<'10' | '20' | '30'>('20')

  const totalQueue = QUEUE.reduce((s, b) => s + b.count, 0)
  const todayPriority = QUEUE.find((b) => b.kind === 'risk')!.count + QUEUE.find((b) => b.kind === 'shaky')!.count

  // sparkline path
  const sparkPath = (() => {
    const max = Math.max(...ACCURACY_7D)
    const min = Math.min(...ACCURACY_7D)
    const range = max - min || 1
    return ACCURACY_7D.map((v, i) => {
      const x = (i / (ACCURACY_7D.length - 1)) * 100
      const y = 28 - ((v - min) / range) * 24
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
    }).join(' ')
  })()

  return (
    <div className="mx-auto flex max-w-[var(--ios-content-wide-max)] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      {/* ── 1. Hero ── */}
      <ModuleHero
        eyebrow="Flashcard · 능동적 회상"
        title="오늘의 카드"
        note={
          todayPriority > 0
            ? `약 ${Math.max(3, Math.round(todayPriority * 0.4))}분이면 끝나요 · 우선 ${todayPriority}장`
            : '오늘 만날 카드가 없어요 — 새 단어를 추가해 보세요'
        }
        gradient={{ from: '#FB7185', to: '#9F1239' }}
        icon={Layers}
        stats={[
          { label: '오늘', value: todayPriority, unit: '장', emphasis: true },
          { label: 'Streak', value: 12, unit: '일' },
          { label: '7일 정확도', value: 87, unit: '%' },
        ]}
      />

      {/* ── 2. Continue (Zeigarnik) ── */}
      <ContinueRow
        accent={FLASHCARD_ACCENT}
        href="/flashcard/play"
        session={{
          title: 'Day 12 · The Great Gatsby — Ch.1',
          subtitle: '23 / 30 카드까지 학습 — 어제 멈춘 자리에서 이어집니다',
          progress: 23 / 30,
          hint: '어제 22:14',
        }}
      />

      {/* ── 3. Today Queue (Memory Decay) ── */}
      <TodayQueue buckets={QUEUE} totalLabel={`${totalQueue}개 추천`} />

      {/* ── 4. Stats (sparkline + 보조 KPI) ── */}
      <section
        aria-label="최근 학습"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <article className="md:col-span-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <header className="mb-3 flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
              style={{ backgroundColor: '#FCE7F3', color: FLASHCARD_INK }}
              aria-hidden
            >
              <Activity size={13} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">7일 정확도</h2>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-[700] text-[var(--success)]">
              <TrendingUp size={11} strokeWidth={2.5} aria-hidden />
              +5%
            </span>
          </header>
          <div className="flex items-end gap-4">
            <div>
              <p className="font-display text-[36px] font-[700] tabular-nums leading-none text-[var(--t1)]">
                87
                <span className="ml-1 text-[16px] text-[var(--t2)]">%</span>
              </p>
              <p className="mt-1 font-body text-[11px] text-[var(--t2)]">평균 · 오늘까지</p>
            </div>
            <svg viewBox="0 0 100 32" className="h-12 flex-1" preserveAspectRatio="none" aria-hidden>
              <path
                d={sparkPath}
                fill="none"
                stroke={FLASHCARD_ACCENT}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {ACCURACY_7D.map((v, i) => {
                const max = Math.max(...ACCURACY_7D)
                const min = Math.min(...ACCURACY_7D)
                const range = max - min || 1
                const x = (i / (ACCURACY_7D.length - 1)) * 100
                const y = 28 - ((v - min) / range) * 24
                return <circle key={i} cx={x} cy={y} r="1.2" fill={FLASHCARD_ACCENT} />
              })}
            </svg>
          </div>
        </article>

        <article className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
              style={{ backgroundColor: '#FCE7F3', color: FLASHCARD_INK }}
              aria-hidden
            >
              <Flame size={13} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">Streak</h2>
          </header>
          <p className="mt-3 font-display text-[36px] font-[700] tabular-nums leading-none text-[var(--t1)]">
            12<span className="ml-1 text-[16px] text-[var(--t2)]">일</span>
          </p>
          <p className="mt-1 font-body text-[11px] text-[var(--t2)]">이번 달 최장</p>
          <div className="mt-3 flex items-center gap-1">
            <Target size={12} className="text-[var(--t2)]" aria-hidden />
            <p className="font-mono text-[10px] text-[var(--t2)]">누적 847 카드 · retention 89%</p>
          </div>
        </article>
      </section>

      {/* ── 5. Configure & Start (Autonomy) ── */}
      <HubStartCard
        title="설정 후 시작"
        description="단어장과 모드를 선택하세요"
        vocabulary={{
          label: '단어장',
          value: vocab,
          options: VOCABULARIES,
          onChange: setVocab,
        }}
        choices={[
          {
            label: '모드',
            value: mode,
            options: [
              { value: 'word-to-meaning', label: '단어 → 뜻', hint: '영어 단어 보고 뜻 회상' },
              { value: 'meaning-to-word', label: '뜻 → 단어', hint: '한국어 뜻 보고 영단어 회상 (어려움)' },
            ],
            onChange: (v) => setMode(v as 'word-to-meaning' | 'meaning-to-word'),
          },
          {
            label: '길이',
            value: length,
            options: [
              { value: '10', label: '10장' },
              { value: '20', label: '20장 (권장)' },
              { value: '30', label: '30장' },
            ],
            onChange: (v) => setLength(v as '10' | '20' | '30'),
          },
        ]}
        cta={{
          label: '시작하기',
          href: `/flashcard/play?vocab=${vocab}&mode=${mode}&length=${length}`,
          accent: FLASHCARD_INK,
        }}
      />
    </div>
  )
}
