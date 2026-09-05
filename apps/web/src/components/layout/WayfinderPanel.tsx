// apps/web/src/components/layout/WayfinderPanel.tsx
//
// 「나의 자리」 — 나침반 띠의 **두 번째 층**. 학습자가 폈을 때만 나온다.
//
// 왜 접어 두나 (철학 ② Progressive Disclosure · 학습원칙 ⑥ Cognitive Load):
//   여섯 질문을 한 줄에 다 그리면 넷은 읽히지 않고 노이즈가 된다. 상시 층은 세 개
//   (위치·단계·다음 걸음)만 말하고, 나머지 셋(가치·동기·성장)은 **학습자가 물었을 때**
//   답한다. 물어보는 행위 자체가 "지금 방향이 궁금하다" 는 신호이므로 그때가 가장 잘 읽힌다.
//
// 왜 모달이 아닌가:
//   학습 중 모달 오버레이는 금지다(CLAUDE.md §학습 UX). 이 패널은 띠 아래로 **밀고 들어온다** —
//   뒤 화면을 가리지 않고, Esc 없이도 같은 버튼으로 닫힌다.
//
// 네 칸이 답하는 것:
//   ① 여정   — 나는 사다리의 어디에 있나            (Q1 위치 · Q4 방향)
//   ② 사정권 — 그 자리가 나에게 무엇을 열어 주나      (Q4 가치)   ← 우리 카탈로그 실측
//   ③ 예보   — 왜 내일이 아니라 오늘인가             (Q5 동기)   ← R(t) 를 시간축으로
//   ④ 지난 주 — 과거의 나보다 얼마나 왔나            (Q6 성장)

'use client'

import Link from 'next/link'

import { MEMORY_ATTENTION_LABEL, MEMORY_LABEL } from '@/lib/framework/memory-labels'
import { V_LEVEL_MAX } from '@/lib/learner/reach-math'
import { formatRibbonCount, ribbonCountAria } from '@/lib/learner/today-status'
import {
  forecastSentence,
  pastSentence,
  reachSentence,
  type WayfinderModel,
} from '@/lib/learner/wayfinder'

import { MemorySparkline } from './MemorySparkline'

function Cell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t3)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** 사람의 목소리가 나는 자리 — Lora italic (§6 감성 표). */
function Says({ children }: { children: React.ReactNode }) {
  return (
    <p className="break-keep font-english text-[13px] italic leading-snug text-[var(--t2)]">
      {children}
    </p>
  )
}

/**
 * V-Level 사다리 — 0~11 을 눈금으로 놓고 내 자리를 표시한다.
 *
 * 게이지 바가 아니다. 퍼센트도 없다 — 레벨은 채워지는 것이 아니라 **서 있는 자리**다.
 * 진단 전이면 눈금만 그리고 표식을 두지 않는다(모르는 것을 아는 척하지 않는다).
 */
function LevelLadder({ vLevel }: { vLevel: number | null }) {
  const rungs = Array.from({ length: V_LEVEL_MAX + 1 }, (_, i) => i)
  return (
    <div
      className="flex items-end gap-[3px]"
      role="img"
      aria-label={vLevel === null ? '레벨 진단 전' : `V-Level ${vLevel} (0~${V_LEVEL_MAX} 중)`}
    >
      {rungs.map((r) => {
        const isMine = vLevel !== null && r === vLevel
        const isNext = vLevel !== null && r === vLevel + 1
        return (
          <span
            key={r}
            className="w-[7px] rounded-[1px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]"
            style={{
              // 자리는 높이로도 말한다 — 색만으로 정보를 전달하지 않는다(접근성).
              height: isMine ? 22 : isNext ? 14 : 8,
              background: isMine
                ? 'var(--p)'
                : isNext
                  ? 'var(--active)'
                  : r < (vLevel ?? -1)
                    ? 'var(--t4)'
                    : 'var(--bd)',
            }}
          />
        )
      })}
    </div>
  )
}

export interface WayfinderPanelProps {
  model: WayfinderModel
  /** 처방을 계산하지 못했다 — 실패를 정상처럼 그리지 않는다 */
  unavailable: boolean
  id: string
}

export function WayfinderPanel({ model, unavailable, id }: WayfinderPanelProps) {
  const reachLine = reachSentence(model.reach)
  const forecastLine = forecastSentence(model.forecast)
  const pastLine = pastSentence(model.past)
  const { attention, fresh } = model.counts

  return (
    <div
      id={id}
      // `wayfinder-reveal` — 10px 이동 + 페이드, `--dur-slow`(300ms). 모션 예산 안이고
      // `prefers-reduced-motion` 에서는 globals.css 가 이동만 걷고 **페이드는 남긴다**
      // (전부 0.01ms 로 죽이면 무엇이 바뀌었는지 알 수 없다 — 스킬 §5.1).
      className="wayfinder-reveal border-b border-[var(--bd)] bg-[var(--bg2)] px-4 py-5 md:px-6"
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* ① 여정 — 나는 어디에 서 있나 */}
        <Cell title="여정">
          <LevelLadder vLevel={model.reach.vLevel} />
          <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
            {model.reach.vLevel === null ? '아직 진단 전이에요' : `V-Level ${model.reach.vLevel}`}
            {model.surface && (
              <span className="ml-2 font-[500] text-[var(--t3)]">지금 {model.surface.name}</span>
            )}
          </p>
          {model.surface && <Says>{model.surface.says}</Says>}
        </Cell>

        {/* ② 사정권 — 그 자리가 무엇을 열어 주나. 우리 카탈로그 실측 없이는 못 쓰는 문장이다. */}
        <Cell title="사정권">
          <p className="font-display text-[20px] font-[700] tabular-nums leading-none text-[var(--t1)]">
            {model.reach.vLevel === null
              ? model.reach.total.toLocaleString('ko-KR')
              : model.reach.open.toLocaleString('ko-KR')}
            <span className="ml-1 font-[500] text-[14px] text-[var(--t2)]">권</span>
          </p>
          {reachLine && <Says>{reachLine}</Says>}
          <Link
            href="/library/books"
            className="inline-flex min-h-11 items-center font-display text-[12px] font-[700] text-[var(--p)] underline-offset-4 transition-colors duration-[var(--dur-normal)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            서가 열기
          </Link>
        </Cell>

        {/* ③ 예보 — 왜 오늘인가. 경쟁사에는 이 곡선이 없다(R(t) 를 저장하지 않고 매번 푼다). */}
        <Cell title={`앞으로 ${model.forecast.horizonDays}일`}>
          {model.forecast.tracked > 0 ? (
            <>
              <MemorySparkline forecast={model.forecast} />
              {forecastLine && <Says>{forecastLine}</Says>}
            </>
          ) : (
            <Says>한 번 복습하면 단어마다 며칠을 버티는지가 여기 그려져요</Says>
          )}
          {/*
            이전 띠가 상시로 그리던 두 수. 여기서 **뜻을 얻는다** — 곡선 옆에 있으면
            "다시 볼 98" 이 밀린 일이 아니라 곡선의 아래쪽이라는 것이 보인다.
            링크 목적지는 걸러진 목록이다(칩이 N 이라고 말했으면 누른 자리에 N 개가 있어야 한다).
          */}
          <div className="flex flex-wrap items-center gap-x-4">
            {attention > 0 && (
              <Link
                href="/wordvault/browse?filter=state:attention"
                aria-label={`${MEMORY_ATTENTION_LABEL} 단어 ${ribbonCountAria(attention)} 보기`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] pr-2 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--warning)]" />
                <span className="font-display text-[12px] font-[600] text-[var(--t2)]">
                  {MEMORY_ATTENTION_LABEL}{' '}
                  <span className="font-[700] tabular-nums text-[var(--t1)]">
                    {formatRibbonCount(attention)}
                  </span>
                </span>
              </Link>
            )}
            {fresh > 0 && (
              <Link
                href="/wordvault/browse?filter=state:new"
                aria-label={`아직 안 배운 단어 ${ribbonCountAria(fresh)} 보기`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] pr-2 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--memory-new)]" />
                <span className="font-display text-[12px] font-[600] text-[var(--t2)]">
                  {MEMORY_LABEL.new.label}{' '}
                  <span className="font-[700] tabular-nums text-[var(--t1)]">
                    {formatRibbonCount(fresh)}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </Cell>

        {/* ④ 지난 주 — 과거의 나. 줄어든 주에도 비교를 말하지 않는다(철학 ③). */}
        <Cell title="지난 7일">
          <div
            className="flex items-center gap-[5px]"
            role="img"
            aria-label={`지난 7일 중 ${model.past.activeDays}일 학습`}
          >
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className="h-[9px] w-[9px] rounded-full"
                style={{
                  background: i < model.past.activeDays ? 'var(--success)' : 'var(--bd)',
                }}
              />
            ))}
          </div>
          {/*
            연속일은 여기서 그리지 않는다 — 펼침 버튼이 이미 그린다. 같은 값을 두 곳에 두면
            반드시 어긋난다(ADR 0006 D2. 한때 띠 3일 · 히어로 3일 · 히트맵 0일 이었다).
          */}
          <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
            {model.past.activeDays}일
          </p>
          {pastLine && <Says>{pastLine}</Says>}
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center font-display text-[12px] font-[700] text-[var(--p)] underline-offset-4 transition-colors duration-[var(--dur-normal)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            지나온 길
          </Link>
        </Cell>
      </div>

      {/*
        처방 실패를 조용히 넘기지 않는다 — 폴백값은 신규 학습자의 정상 상태와 똑같이 생겼다
        (2026-07-19 에 그래서 3주 넘게 아무도 몰랐다).
      */}
      {unavailable && (
        <p className="mt-4 break-keep font-body text-[12px] text-[var(--t3)]">
          오늘의 흐름을 지금 계산하지 못했어요. 화면을 새로 고치면 다시 시도해요.
        </p>
      )}
    </div>
  )
}
