// apps/web/src/app/(main)/spellforge/page.tsx
// SpellForge Hub
// 학습 과학:
//   · Active Recall + Desirable Difficulty (보기 X · 타이핑 강제)
//   · Memory Decay 색별 큐
//   · Self-determination — 모드(단어→철자 vs 뜻→철자) + 난이도

'use client'

import { Activity, Award, Keyboard, TrendingUp, Zap } from 'lucide-react'
import { useState } from 'react'

import { ContinueRow } from '@/components/hub/ContinueRow'
import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { TodayQueue, type QueueBucket } from '@/components/hub/TodayQueue'

const SPELLFORGE_ACCENT = '#4A9FCF' // CLAUDE.md 게임 전용 파란 패널

const QUEUE: QueueBucket[] = [
  { kind: 'risk', count: 4, preview: ['unmistakable', 'consequence'] },
  { kind: 'shaky', count: 12, preview: ['advantages', 'criticizing', 'communicative'] },
  { kind: 'new', count: 2 },
  { kind: 'stable', count: 18 },
]

const VOCABULARIES = [
  { value: 'gatsby-1', label: 'The Great Gatsby — Chapter 1', hint: '32단어' },
  { value: 'shaky-only', label: 'Shaky 단어만 모아보기', hint: '12단어' },
  { value: 'all', label: '전체 단어장 통합', hint: '847단어' },
]

// 7일 IME 정확도 + 평균 응답 시간
const IME_ACC_7D = [88, 90, 92, 87, 94, 91, 92]
const RECENT_SCORES = [
  { date: '오늘', score: 920, accuracy: 92 },
  { date: '어제', score: 880, accuracy: 90 },
  { date: '4일 전', score: 1240, accuracy: 96 },
]

export default function SpellForgeHubPage() {
  const [vocab, setVocab] = useState('shaky-only')
  const [mode, setMode] = useState<'word-from-en' | 'word-from-ko'>('word-from-en')
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal')

  const totalQueue = QUEUE.reduce((s, b) => s + b.count, 0)
  const focusCount = QUEUE.find((b) => b.kind === 'shaky')!.count + QUEUE.find((b) => b.kind === 'risk')!.count

  // sparkline path (정확도)
  const sparkPath = (() => {
    const max = Math.max(...IME_ACC_7D)
    const min = Math.min(...IME_ACC_7D)
    const range = max - min || 1
    return IME_ACC_7D.map((v, i) => {
      const x = (i / (IME_ACC_7D.length - 1)) * 100
      const y = 28 - ((v - min) / range) * 24
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
    }).join(' ')
  })()

  return (
    <div className="mx-auto flex max-w-[var(--ios-content-wide-max)] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      {/* ── 1. Hero ── */}
      <ModuleHero
        eyebrow="SpellForge · 타이핑 단련"
        title="철자 연습"
        note={
          focusCount > 0
            ? `흔들리는 철자 ${focusCount}개 · IME 정확도 92% 유지 중`
            : '철자가 안정적이에요 — 새 단어로 도전해 보세요'
        }
        gradient={{ from: '#5CB8E0', to: '#3A7FAF' }}
        icon={Keyboard}
        stats={[
          { label: '집중 큐', value: focusCount, unit: '단어', emphasis: true },
          { label: 'Best', value: 1240, unit: '점' },
          { label: 'IME 정확도', value: 92, unit: '%' },
        ]}
      />

      {/* ── 2. Continue ── */}
      <ContinueRow
        accent={SPELLFORGE_ACCENT}
        href="/spellforge/play"
        session={{
          title: '어제 라운드 · 정확도 90%',
          subtitle: 'criticizing · communicative · advantages — 한 번 더 마무리해보세요',
          progress: 0.6,
          hint: '어제 21:08',
        }}
      />

      {/* ── 3. Today Queue ── */}
      <TodayQueue buckets={QUEUE} totalLabel={`${totalQueue}개 추천`} />

      {/* ── 4. Stats ── */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="md:col-span-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <header className="mb-3 flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
              style={{ backgroundColor: `${SPELLFORGE_ACCENT}15`, color: SPELLFORGE_ACCENT }}
              aria-hidden
            >
              <Activity size={13} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">7일 정확도 추이</h2>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-[700] text-[var(--success)]">
              <TrendingUp size={11} strokeWidth={2.5} aria-hidden />
              +4%
            </span>
          </header>
          <div className="flex items-end gap-4">
            <div>
              <p className="font-display text-[36px] font-[700] tabular-nums leading-none text-[var(--t1)]">
                92<span className="ml-1 text-[16px] text-[var(--t2)]">%</span>
              </p>
              <p className="mt-1 font-body text-[11px] text-[var(--t2)]">평균 IME 정확도</p>
            </div>
            <svg viewBox="0 0 100 32" className="h-12 flex-1" preserveAspectRatio="none" aria-hidden>
              <path
                d={sparkPath}
                fill="none"
                stroke={SPELLFORGE_ACCENT}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {IME_ACC_7D.map((v, i) => {
                const max = Math.max(...IME_ACC_7D)
                const min = Math.min(...IME_ACC_7D)
                const range = max - min || 1
                const x = (i / (IME_ACC_7D.length - 1)) * 100
                const y = 28 - ((v - min) / range) * 24
                return <circle key={i} cx={x} cy={y} r="1.2" fill={SPELLFORGE_ACCENT} />
              })}
            </svg>
          </div>
        </article>

        <article className="rounded-[var(--r-lg)] border-2 border-[#FFE234]/40 bg-gradient-to-br from-[#FEF3C7] to-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[#FFE234] text-[#1a4a08]"
              aria-hidden
            >
              <Award size={13} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최고 점수</h2>
          </header>
          <p className="mt-3 font-display text-[36px] font-[700] tabular-nums leading-none text-[var(--t1)]">
            1,240<span className="ml-1 text-[14px] text-[var(--t2)]">점</span>
          </p>
          <ul className="mt-3 divide-y divide-[var(--bd)]">
            {RECENT_SCORES.map((s) => (
              <li key={s.date} className="flex items-center justify-between py-1.5">
                <span className="font-mono text-[10px] text-[var(--t2)]">{s.date}</span>
                <span className="font-mono text-[11px] font-[700] tabular-nums text-[var(--t1)]">
                  {s.score} <span className="text-[10px] text-[var(--t2)]">· {s.accuracy}%</span>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {/* ── 5. Configure & Start ── */}
      <HubStartCard
        title="설정 후 시작"
        description="어려울수록 기억은 단단해져요 (Desirable Difficulty)"
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
              { value: 'word-from-en', label: '뜻 → 철자', hint: '한국어 뜻 보고 영단어 타이핑' },
              { value: 'word-from-ko', label: '발음 → 철자', hint: 'TTS 듣고 영단어 타이핑' },
            ],
            onChange: (v) => setMode(v as 'word-from-en' | 'word-from-ko'),
          },
          {
            label: '난이도',
            value: difficulty,
            options: [
              { value: 'easy', label: '쉬움', hint: '첫 글자 힌트' },
              { value: 'normal', label: '보통' },
              { value: 'hard', label: '어려움', hint: '힌트·발음 없음' },
            ],
            onChange: (v) => setDifficulty(v as 'easy' | 'normal' | 'hard'),
          },
        ]}
        extras={
          <p className="font-body text-[11px] italic leading-relaxed text-[var(--t2)]">
            <Zap size={10} className="mr-1 inline align-text-bottom text-[var(--active)]" aria-hidden />
            힌트를 사용하면 점수 -20 — 그래도 처음엔 권장해요.
          </p>
        }
        cta={{
          label: '시작하기',
          href: `/spellforge/play?vocab=${vocab}&mode=${mode}&difficulty=${difficulty}`,
          accent: SPELLFORGE_ACCENT,
        }}
      />
    </div>
  )
}
