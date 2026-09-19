// apps/web/src/components/pairflip/PairFlipHub.tsx
// PairFlip Hub — v06.27 hub IA 정합 (다른 hub 들과 동일 구조: max-w-5xl · ModuleHero · bordered section cards)
//
// 변경 근거:
//   · 이전 v06.21: PairFlipStartScreen(min-h-80vh + PairFlipEnv 아이보리 배경 + fixed 마스코트)
//     → 다른 hub (flashcard·spellforge·scriptquiz·dictate) 와 시각·구조 단절
//   · v06.27: 표준 hub IA 로 재구성 — Editorial 네이비/골드 팔레트는 카드 안으로 흡수, 마스코트는 인라인
//   · ModuleHero (premium) + 학습 효과 카드 + 시작 설정 카드 (Level + Mode + CTA)
//   · max-w-5xl · border-bd bg-bg shadow-sm — 다른 hub 와 동일 토큰
//
// 2026-09-19 화면 재설계(DD-35 · docs/design/compare/game-hubs.md 발산 A 「이번 판 낱말」):
//   게임몰 스킨(5열 난이도 타일 선택 = 네이비 그라디언트+그림자 · 네이비→보라 그라디언트 CTA 금색 글씨)을 걷고
//   모듈 허브와 같은 문법 — 판면 머리 · 이번 판 낱말(괘선 두 단) · 글자 탭 난이도 · 주묵 1차 행동.
//   **서명**: 난이도를 고르면 그 판의 쌍 수만큼 권점이 옮겨 찍힌다(`/hub` · 모듈 허브와 같은 몸짓).
//   매칭 모드 선택은 걷었다 — 두 번째 모드는 「준비 중」 이라 고를 것이 하나뿐이었다(없는 기능을 보이지 않는다).

'use client'

import { ChevronRight, Shuffle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'

import { PAIRFLIP_LEVELS, STORAGE_KEYS } from './constants'
import { GamePoolPanel } from '@/components/hub/GamePoolPanel'

import { PairFlipMascot } from './PairFlipMascot'
import type { PairFlipConfig, PairFlipLevel, PairFlipMode } from './types'

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

/**
 * 한 판이 성립하는 최소 단어 수 = 가장 쉬운 난이도의 pairCount(`constants.ts` Easy = 4).
 * 허브가 더 낮게 잡으면 "시작" 을 눌러도 판이 안 만들어진다.
 */
const MIN_PAIRS = 4

export function PairFlipHub({
  stats = STATS_ZERO,
  poolWords = [],
  ownedTotal = 0,
}: {
  stats?: PairFlipHubStats
  /** 게임이 실제로 쓸 짝 후보(`fetchDuePairs`) — 허브가 따로 세지 않는다 */
  poolWords?: { en: string; ko: string }[]
  /** 학습자 보유 단어 총수. 위 풀은 `PAIRFLIP_MAX_PAIRS` 로 잘려 있어 총수가 아니다 */
  ownedTotal?: number
}) {
  const router = useRouter()
  const [level, setLevel] = useState<PairFlipLevel>('normal')
  // 고를 수 있는 모드는 하나뿐이다(영영 정의는 「준비 중」) — 선택지를 보이지 않고 그 모드로 시작한다
  const mode: PairFlipMode = 'word_meaning'
  const pairCount = PAIRFLIP_LEVELS.find((l) => l.id === level)?.pairCount ?? MIN_PAIRS

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
        // PRACTICE 그룹 — 조용한 변형(형제 일관)
        quiet
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

      {/* ── 2. 이번 판 낱말 — 난이도의 쌍 수만큼 권점(서명) ── */}
      <GamePoolPanel words={poolWords} ownedTotal={ownedTotal} minWords={MIN_PAIRS} marked={pairCount} />

      {/* ── 3. 시작 — 난이도 글자 탭 + 주묵 1차 행동(모듈 허브와 같은 부품) ── */}
      <HubStartCard
        title="난이도"
        description="쌍이 많을수록 기억할 자리가 늘어요"
        choices={[
          {
            label: '난이도',
            value: level,
            options: PAIRFLIP_LEVELS.map((l) => ({
              value: l.id,
              label: `${l.label} · ${l.pairCount}쌍`,
              hint: `${l.description} — 카드 ${l.cardCount}장 · ${l.timeLimit}초`,
            })),
            onChange: (v) => setLevel(v as PairFlipLevel),
          },
        ]}
        cta={{
          label: '시작하기',
          href: '/pairflip/play',
          onStart: handleStart,
          disabled: poolWords.length < MIN_PAIRS,
          disabledReason: `짝을 만들 단어가 ${MIN_PAIRS}개 이상 있어야 해요`,
        }}
      />

      {/* ── 4. 설명은 접어 둔다 — 상자 없이 괘선 목록 ── */}
      <details className="group">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-body text-[12.5px] text-[var(--t2)] transition-colors hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] [&::-webkit-details-marker]:hidden">
          <ChevronRight size={13} aria-hidden className="shrink-0 transition-transform duration-[var(--dur-normal)] group-open:rotate-90" />
          이 게임이 뭘 하는지
        </summary>
        <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section aria-label="학습 효과">
            <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">학습 효과</h2>
            <ul className="m-0 mt-2 list-none border-t border-[var(--bd)] p-0">
              {LEARNING_EFFECTS.map((e) => (
                <li key={e.en} className="border-b border-[var(--bd)] py-2">
                  <p className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">{e.ko}</p>
                  <p className="m-0 mt-0.5 font-mono text-[11px] text-[var(--t2)]">{e.en}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="게임 규칙" className="relative">
            <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">게임 규칙</h2>
            <ol className="m-0 mt-2 list-none border-t border-[var(--bd)] p-0">
              {[
                { step: '1', title: '카드를 뒤집어요', desc: '뒷면의 단어/뜻을 확인' },
                { step: '2', title: '짝을 찾아요', desc: '같은 단어쌍의 위치를 기억' },
                { step: '3', title: '콤보', desc: '연속 매칭 시 점수 가속' },
              ].map((r) => (
                <li key={r.step} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 border-b border-[var(--bd)] py-2">
                  <span className="font-mono text-[12px] font-[700] text-[var(--t2)]">{r.step}.</span>
                  <span>
                    <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{r.title}</span>{' '}
                    <span className="font-body text-[12px] text-[var(--t2)]">— {r.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div aria-hidden className="pointer-events-none absolute -bottom-2 right-0 hidden md:block">
              <PairFlipMascot mood="idle" size={56} />
            </div>
          </section>
        </div>
      </details>
    </div>
  )
}
