// apps/web/src/components/pairflip/PairFlipHub.tsx
// PairFlip Hub — v06.27 hub IA 정합 (다른 hub 들과 동일 구조: max-w-5xl · ModuleHero · bordered section cards)
//
// 변경 근거:
//   · 이전 v06.21: PairFlipStartScreen(min-h-80vh + PairFlipEnv 아이보리 배경 + fixed 마스코트)
//     → 다른 hub (flashcard·spellforge·scriptquiz·dictate) 와 시각·구조 단절
//   · v06.27: 표준 hub IA 로 재구성 — Editorial 네이비/골드 팔레트는 카드 안으로 흡수, 마스코트는 인라인
//   · ModuleHero (premium) + 학습 효과 카드 + 시작 설정 카드 (Level + Mode + CTA)
//   · max-w-5xl · border-bd bg-bg shadow-sm — 다른 hub 와 동일 토큰

'use client'

import { Activity, Layers, Shuffle, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ModuleHero } from '@/components/hub/ModuleHero'

import { STORAGE_KEYS } from './constants'
import { PairFlipLevelSelector } from './PairFlipLevelSelector'
import { PairFlipMascot } from './PairFlipMascot'
import { PairFlipModeSelector } from './PairFlipModeSelector'
import { PF_COLORS } from './theme'
import type { PairFlipConfig, PairFlipLevel, PairFlipMode } from './types'

const PAIRFLIP_ACCENT = '#F59E0B' // Editorial 골드 — Sidebar 익히기 그룹 핑크와 별개로 모듈 내부 액센트

/** scores(module='pairflip') 서버 집계 — /pairflip 페이지가 주입. 기록 없으면 zero. */
export interface PairFlipHubStats {
  bestScore: number
  maxCombo: number
  gamesPlayed: number
}

const STATS_ZERO: PairFlipHubStats = { bestScore: 0, maxCombo: 0, gamesPlayed: 0 }

const LEARNING_EFFECTS = [
  { ko: '재인', en: 'Recognition — 카드 한쪽으로 짝 식별' },
  { ko: '공간 기억', en: 'Spatial Memory — 위치 추적 (Tversky)' },
  { ko: '작업 기억', en: 'Working Memory — 동시 다중 매칭' },
]

export function PairFlipHub({ stats = STATS_ZERO }: { stats?: PairFlipHubStats }) {
  const router = useRouter()
  const [level, setLevel] = useState<PairFlipLevel>('normal')
  const [mode, setMode] = useState<PairFlipMode>('word_meaning')

  const isCold = stats.gamesPlayed === 0
  const note = isCold
    ? '첫 게임을 시작해 보세요 — 카드 짝을 빨리 찾을수록 점수가 올라가요'
    : `Best ${stats.bestScore.toLocaleString()} · 최고 콤보 ×${stats.maxCombo} — 더 높은 점수에 도전`

  const handleStart = () => {
    const config: PairFlipConfig = { level, mode }
    try {
      sessionStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config))
    } catch {
      /* sessionStorage 사용 불가 — query string fallback 확장 가능 */
    }
    router.push('/pairflip/play')
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* ── 1. Hero ── */}
      <ModuleHero
        eyebrow="익히기 · 짝맞추기"
        title="PairFlip"
        note={note}
        gradient={{ from: '#1E3A8A', to: '#1E1B4B' }}
        icon={Shuffle}
        stats={[
          {
            label: 'Best',
            value: stats.bestScore.toLocaleString(),
            unit: '점',
            emphasis: true,
          },
          {
            label: '최고 콤보',
            value: stats.maxCombo > 0 ? `×${stats.maxCombo}` : '—',
          },
          {
            label: '게임',
            value: stats.gamesPlayed,
            unit: '회',
          },
        ]}
      />

      {/* ── 2. 학습 효과 + 게임 규칙 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 학습 효과 */}
        <aside
          aria-label="학습 효과"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]"
              style={{ backgroundColor: `${PAIRFLIP_ACCENT}15`, color: PAIRFLIP_ACCENT }}
              aria-hidden
            >
              <Activity size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">학습 효과</h2>
          </header>
          <ul className="mt-4 space-y-3">
            {LEARNING_EFFECTS.map((e) => (
              <li key={e.en}>
                <p className="font-display text-[13px] font-[700] text-[var(--t1)]">{e.ko}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--t3)]">{e.en}</p>
              </li>
            ))}
          </ul>
        </aside>

        {/* 게임 규칙 + 인라인 마스코트 */}
        <aside
          aria-label="게임 규칙"
          className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-4 flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]"
              style={{ backgroundColor: `${PF_COLORS.coverFrom}12`, color: PF_COLORS.coverFrom }}
              aria-hidden
            >
              <Sparkles size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">게임 규칙</h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">3단계</span>
          </header>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { step: '01', title: '카드를 클릭', desc: '뒷면을 뒤집어 단어/뜻 확인' },
              { step: '02', title: '짝을 찾아요', desc: '같은 단어쌍의 위치 기억' },
              { step: '03', title: '콤보 보너스', desc: '연속 매칭 시 점수 가속' },
            ].map((r) => (
              <li
                key={r.step}
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
              >
                <p
                  className="font-mono text-[10px] font-[700] tabular-nums tracking-[0.10em]"
                  style={{ color: PAIRFLIP_ACCENT }}
                >
                  {r.step}
                </p>
                <p className="mt-1 font-display text-[13px] font-[700] text-[var(--t1)]">
                  {r.title}
                </p>
                <p className="mt-0.5 font-body text-[11px] leading-snug text-[var(--t3)]">
                  {r.desc}
                </p>
              </li>
            ))}
          </ol>

          {/* 인라인 마스코트 — 우하단 (Calm UI: fixed 제거) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-3 -right-2 opacity-90 md:opacity-100"
          >
            <PairFlipMascot mood="idle" size={64} />
          </div>
        </aside>
      </div>

      {/* ── 3. 시작 설정 — Level + Mode + CTA ── */}
      <section
        aria-label="시작 설정"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] md:p-6"
      >
        <header className="mb-4 flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]"
            style={{ backgroundColor: `${PAIRFLIP_ACCENT}15`, color: PAIRFLIP_ACCENT }}
            aria-hidden
          >
            <Layers size={14} strokeWidth={1.75} />
          </span>
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">시작 설정</h2>
          <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">
            난이도와 모드를 선택하세요
          </span>
        </header>

        {/* Level */}
        <div className="mb-5">
          <p className="mb-2.5 font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
            난이도
          </p>
          <PairFlipLevelSelector selected={level} onChange={setLevel} />
        </div>

        {/* Mode */}
        <div className="mb-5">
          <p className="mb-2.5 font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
            매칭 모드
          </p>
          <PairFlipModeSelector selected={mode} onChange={setMode} />
        </div>

        {/* CTA — Editorial 골드/네이비, 다만 hub 안에 정렬 */}
        <button
          type="button"
          onClick={handleStart}
          aria-label="게임 시작"
          className="group inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] py-3.5 font-display text-[15px] font-[700] tracking-[0.01em] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:-translate-y-0.5 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 md:text-[16px]"
          style={{
            background: `linear-gradient(135deg, ${PF_COLORS.coverFrom} 0%, ${PF_COLORS.coverMid} 60%, ${PF_COLORS.coverTo} 100%)`,
            color: PF_COLORS.goldLight,
            boxShadow: `0 0 0 1px ${PAIRFLIP_ACCENT}66, 0 4px 0 ${PF_COLORS.coverTo}, 0 10px 24px rgba(15,23,42,0.22)`,
          }}
        >
          시작하기
          <span
            aria-hidden
            className="transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>
      </section>
    </div>
  )
}
