// apps/web/src/components/marketing/CoverageHero.tsx
//
// 랜딩 히어로의 **작동하는 증명** — 지문 하나를 놓고 레벨을 움직이면 색과 숫자가 함께 변한다.
//
// 규칙 이행 (`docs/DESIGN_SYSTEM.md §🎯 첫인상`):
//   I1 제품이 실제로 수행한 결과가 첫 화면에 있다 (서버가 분석해 내려준 실데이터)
//   I2 클릭 0 · 입력 0 — 진입 즉시 고1 기준으로 이미 칠해져 있다
//   I3 조작 가능 — 슬라이더를 움직이면 네트워크 없이 즉시 바뀐다(8레벨 사전 계산)
//   I5 숫자는 전부 계산값. 상수 없음
//   I6 서버 렌더 HTML 에 지문과 판정이 남는다 (이 컴포넌트의 첫 렌더가 곧 SSR 결과)
//
// 규약: Memory Decay 4색만(새 색 0) · **색 + 밑줄 + 범례 3중**(색맹 대응) · 44px 타깃 ·
//   모션은 색 전환 200ms 뿐(이동·스케일 0 → `prefers-reduced-motion` 에서도 그대로 유효) ·
//   토큰 경유라 `data-theme="dark"` 자동 대응.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import type { HeroDemo } from '@/lib/marketing/hero-demo'
import { BAND_COPY } from '@/lib/textfit/coverage'
import { LEVEL_LABEL, PROFILE_LEVELS } from '@/lib/textfit/profile'
import type { ProfileLevel } from '@/lib/textfit/profile'

/**
 * 처음 보이는 레벨 — **고1**.
 *
 * 왜 가운데가 아니라 여기인가: 이 자리는 "몇 %인지" 가 아니라 **"레벨을 바꾸면 숫자가 변한다"**
 * 를 보여 주는 자리다. 그러려면 첫 화면이 100% 도 0% 도 아니어야 하고, 방문자 다수(고교
 * 교사·학생)가 자기 반을 먼저 떠올리는 지점이어야 한다.
 */
const DEFAULT_LEVEL: ProfileLevel = 6

/** 슬라이더 조작을 한동안 멈추면 그때 한 번 보낸다 — 드래그 중 수십 번 보내지 않는다. */
const TRACK_DEBOUNCE_MS = 600

const pct = (v: number) => `${Math.round(v * 100)}%`

export function CoverageHero({ demo }: { demo: HeroDemo }) {
  const [level, setLevel] = useState<ProfileLevel>(DEFAULT_LEVEL)
  const [moved, setMoved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reading = demo.readings.find((r) => r.level === level) ?? demo.readings[0]
  /** 레벨 미상 낱말 수 — 감추지 않고 범례에서 셈을 밝힌다. */
  const unleveled = demo.tokens.filter((t) => t.v === null).length

  const onChange = useCallback((next: ProfileLevel) => {
    setLevel(next)
    setMoved(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      track({ name: 'landing_demo_moved', props: { level: next } })
    }, TRACK_DEBOUNCE_MS)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <section
      aria-label="지문 커버리지 실시간 예시"
      className="mx-auto mt-6 max-w-2xl rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 text-left md:mt-8 md:p-6"
    >
      {/* ── 지문 — 영어 원문이므로 Lora ── */}
      <p className="font-english text-[14px] leading-[1.75] text-[var(--t1)] md:text-[16.5px] md:leading-[1.85]">
        {demo.tokens.map((tok, i) => {
          if (tok.v === undefined) return <span key={i}>{tok.t}</span>

          // 레벨 미상 — 실재하는 낱말이지만 학습 어휘 목록 밖이다. 안다고도 모른다고도 하지 않는다.
          if (tok.v === null) return <span key={i}>{tok.t}</span>

          const unknown = tok.v > level
          return (
            <span
              key={i}
              className={
                unknown
                  ? 'font-[600] text-[var(--memory-risk-ink)] underline decoration-[var(--memory-risk-ink)] decoration-wavy underline-offset-[3px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]'
                  : 'text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]'
              }
            >
              {tok.t}
            </span>
          )
        })}
      </p>

      {/* ── 범례 — 색 하나로만 말하지 않는다. 레벨 미상은 표식 대신 **숫자로** 말한다 ── */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-[11px] text-[var(--t2)]">
        <li className="flex items-center gap-1.5">
          <span className="font-english text-[13px] text-[var(--t1)]">Aa</span> 이미 아는 낱말
        </li>
        <li className="flex items-center gap-1.5">
          <span className="font-english text-[13px] font-[600] text-[var(--memory-risk-ink)] underline decoration-wavy underline-offset-[3px]">
            Aa
          </span>
          이 레벨에서 처음 만나는 낱말
        </li>
        {unleveled > 0 && (
          // 감추지 않는다 — 다만 흔한 낱말에 표식을 흩뿌리는 대신 한 줄로 셈을 밝힌다.
          <li className="text-[var(--t3)]">레벨 미상 {unleveled}낱말은 절반만 안다고 셈</li>
        )}
      </ul>

      {/* ── 조작 — 이 한 개가 "내 것" 을 만든다 ── */}
      <div className="mt-4 border-t border-[var(--bd)] pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="hero-level"
            className="font-display text-[12px] font-[700] text-[var(--t2)]"
          >
            읽는 사람의 수준
          </label>
          <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
            {LEVEL_LABEL[level]}
          </span>
        </div>

        <input
          id="hero-level"
          type="range"
          min={PROFILE_LEVELS[0]}
          max={PROFILE_LEVELS[PROFILE_LEVELS.length - 1]}
          step={1}
          value={level}
          onChange={(e) => onChange(Number(e.target.value) as ProfileLevel)}
          aria-valuetext={`${LEVEL_LABEL[level]} — 커버리지 ${pct(reading.coverage)}`}
          className="mt-2 h-[44px] w-full cursor-pointer appearance-none bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--bg)] [&::-moz-range-thumb]:bg-[var(--p)] [&::-moz-range-track]:h-[4px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[var(--bd)] [&::-webkit-slider-runnable-track]:h-[4px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[var(--bd)] [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg)] [&::-webkit-slider-thumb]:bg-[var(--p)]"
        />

        <div className="flex justify-between font-display text-[9.5px] font-[600] uppercase tracking-[0.06em] text-[var(--t3)]">
          <span>{LEVEL_LABEL[PROFILE_LEVELS[0]]}</span>
          <span>{LEVEL_LABEL[PROFILE_LEVELS[PROFILE_LEVELS.length - 1]]}</span>
        </div>

        {/* ── 판정 — 숫자는 계산값이고, 대역 이름이 그 뜻을 말한다 ── */}
        <div className="mt-3.5 flex items-end justify-between gap-4">
          <p className="font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
            {BAND_COPY[reading.band].verdict}
          </p>
          <p className="shrink-0 text-right">
            <span className="font-display text-[30px] font-[800] tabular-nums leading-none tracking-tight text-[var(--t1)] md:text-[36px]">
              {pct(reading.coverage)}
            </span>
            <span className="mt-1 block font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              어휘 커버리지
            </span>
          </p>
        </div>

        <p className="mt-2.5 font-body text-[11.5px] leading-relaxed text-[var(--t3)]">
          {moved ? (
            <>같은 글인데 숫자가 바뀝니다 — 글이 아니라 <strong>읽는 사람</strong>이 기준이니까요.</>
          ) : (
            <>슬라이더를 움직여 보세요. 같은 글의 숫자가 달라집니다.</>
          )}
        </p>
      </div>
    </section>
  )
}
