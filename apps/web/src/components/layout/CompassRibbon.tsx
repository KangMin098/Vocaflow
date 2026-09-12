// apps/web/src/components/layout/CompassRibbon.tsx
//
// 나침반 띠 — 셸 최상단의 **유일한** 상태 표면 (ADR 0006 D2 계승).
//
// ── 무엇을 고쳤나 (실측 2026-09-05, dev 1280×900, 계정 lexicon-test) ──────────────
// 이전 `StatusRibbon` 을 학습자 라우트 9곳에서 재 봤다:
//   면적 1040×69px(뷰포트 6.2%) · 내용 칩 1개(`새 단어 8`) · 9개 라우트에서 텍스트 100% 동일.
// 화면의 6%를 늘 쓰면서 위치도 단계도 다음 걸음도 말하지 않았다. 게다가 규칙 ①(전부 0이면
// 격려 문장)이 `fresh=8` 때문에 켜지지 않아, 격려도 상태도 아닌 **고아 숫자 하나**였다.
//
// ── 상시 층이 말하는 것 — 셋뿐이다 (학습원칙 ⑥ 작업기억) ────────────────────────
//   ① 나는 어디에 있나        → 표면 이름 (`SURFACES` 정본)
//   ② 오늘 어디까지 왔나       → 계단 점 (완료 · 지금 · 남음)
//   ③ 지금 누를 한 개는       → 문장 하나 + 버튼 하나
//
// 나머지 셋(가치·동기·성장)은 「나의 자리」를 펴야 나온다(`WayfinderPanel`).
//
// 설계 규칙:
//   ① CTA 는 **언제나 하나**. 셸에서 고르게 하지 않는다 — 고르는 곳은 화면 본문이다
//   ② 0 을 나열하지 않는다. 계단이 없으면 계단을 그리지 않는다(빈 칸을 0으로 채우지 않는다)
//   ③ 퍼센트·게이지 금지 (철학 ④). 진행은 점의 채워짐으로만 보인다
//   ④ 학습 세션(풀스크린)에서는 통째로 사라진다 — 작업기억 보호
//   ⑤ 모션은 상태가 **바뀔 때만**. 정지 상태는 완전 정지(perpetual micro-motion 금지)

'use client'

import { ChevronDown, Flame } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useId, useMemo, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'
import { buildWayfinder, type WayfinderModel } from '@/lib/learner/wayfinder'
import type { WayfinderData } from '@/lib/learner/wayfinder-query'

import { WayfinderPanel } from './WayfinderPanel'

export interface CompassRibbonProps {
  /** 비로그인이면 null — 띠를 그리지 않는다 */
  data: WayfinderData | null
}

/** 계단 점 — 완료/지금/남음 셋을 **색이 아니라 형태로도** 구분한다(색맹 대응). */
function StepDots({ model }: { model: WayfinderModel }) {
  const label = `오늘의 흐름 — ${model.total}단계 중 ${model.done}단계 완료${
    model.steps.find((s) => s.current) ? `, 지금은 ${model.steps.find((s) => s.current)!.name}` : ''
  }`
  return (
    <Link
      href="/hub"
      aria-label={label}
      // 회귀(`22-shell-status` H)가 셸의 진행과 무대의 "오늘의 흐름" 이 **같은 수인지**를
      // 대조한다. 이전 띠는 `오늘 2/3` 이라는 **텍스트**를 그려서 정규식으로 읽혔는데,
      // 지금은 점만 그린다(철학 ④ — 퍼센트·분수 금지). 텍스트를 되살리는 대신
      // 기계가 읽을 자리를 따로 둔다 — 안 그러면 그 회귀가 조용히 skip 으로 바뀐다.
      data-today-progress={`${model.done}/${model.total}`}
      className="group flex min-h-11 shrink-0 items-center gap-[5px] rounded-[var(--r-md)] px-1.5 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      {model.steps.map((s) => (
        <span
          key={s.key}
          aria-hidden
          className="rounded-full transition-[width,height,background-color] duration-[var(--dur-normal)] ease-[var(--ease)]"
          style={
            s.current
              ? // 지금 — 가장 크고, 테두리로 한 번 더 구분된다
                {
                  width: 9,
                  height: 9,
                  background: 'var(--active)',
                  boxShadow: '0 0 0 2px var(--active-light)',
                }
              : s.done
                ? { width: 7, height: 7, background: 'var(--p)' }
                : { width: 5, height: 5, background: 'var(--t4)' }
          }
        />
      ))}
    </Link>
  )
}

export function CompassRibbon({ data }: CompassRibbonProps) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const panelId = useId()

  // 학습 세션은 셸을 걷어낸다 — Sidebar·MobileTabBar 와 같은 판정.
  const hidden = isFullScreenRoute(pathname) || !data

  const model = useMemo(
    () =>
      data
        ? buildWayfinder({
            blocks: data.blocks,
            isDiagnosed: data.isDiagnosed,
            pathname,
            reach: data.reach,
            forecast: data.forecast,
            past: data.past,
            counts: data.counts,
          })
        : null,
    [data, pathname],
  )

  if (hidden || !model || !data) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    // 폈다는 것은 "지금 방향이 궁금하다" 는 신호다 — 안 재면 이 층이 쓰이는지 영원히 모른다.
    if (next) track({ name: 'wayfinder_opened', props: { phase: model.phase, steps: model.total } })
  }

  return (
    <div className="border-b border-[var(--bd)] bg-[var(--bg)]">
      <div
        aria-label="오늘 상태"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-6"
      >
        {/* ① 나는 어디에 있나 — 데스크톱에서만. 모바일은 하단 탭이 이미 위치를 말한다 */}
        {model.surface && (
          <span className="hidden shrink-0 font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)] md:inline">
            {model.surface.name}
          </span>
        )}

        {/* ② 오늘 어디까지 왔나 — 계단이 있을 때만 그린다 */}
        {model.steps.length > 0 && <StepDots model={model} />}

        {/* ③ 지금 누를 한 개 */}
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--active-ink)]">
            {model.now.kicker}
          </span>
          <span className="min-w-0 truncate break-keep font-display text-[13px] font-[600] text-[var(--t1)]">
            {model.now.headline}
          </span>
        </p>

        <Link
          href={model.now.href}
          onClick={() =>
            track({ name: 'wayfinder_cta_clicked', props: { phase: model.phase, done: model.done } })
          }
          className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--r-full)] bg-[var(--p)] px-4 font-display text-[12px] font-[700] text-[var(--on-p)] transition-[filter,transform] duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          {model.now.cta}
        </Link>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-md)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          나의 자리
          {/*
            연속일을 **펼침 버튼 위에** 둔다 — 셸에서 streak 이 그려지는 자리는 여기 하나다
            (ADR 0006 D2: 같은 값이 여러 곳에 있으면 반드시 어긋난다. 실제로 한때
            띠 3일 · 히어로 3일 · 히트맵 0일 이었다).
            0이면 그리지 않는다 — 0을 보여주는 것은 "당신은 아무것도 안 했다" 의 반복이다(철학 ③).
          */}
          {model.past.streak > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[var(--active-ink)]"
              aria-label={`연속 ${model.past.streak}일`}
            >
              <Flame size={12} strokeWidth={2} aria-hidden />
              <span className="font-[700] tabular-nums">{model.past.streak}</span>
            </span>
          )}
          <ChevronDown
            size={14}
            strokeWidth={2.2}
            aria-hidden
            className="transition-transform duration-[var(--dur-normal)] ease-[var(--ease)]"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      </div>

      {open && <WayfinderPanel model={model} unavailable={data.unavailable} id={panelId} />}
    </div>
  )
}
