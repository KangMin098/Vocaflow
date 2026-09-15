// apps/web/src/components/csat/PlanTimeline.tsx
//
// **한 회차의 시간 띠 — 「45분 선을 몇 번에서 넘는가」.**
//
// ── 무엇을 대신하나 ───────────────────────────────────────────────────
// 전에는 이 자리에 숫자 두 개가 있었다: 「절차 시간 합 51분 · 쓸 수 있는 시간 45분」.
// 맞는 말인데 **학습자가 할 수 있는 일이 없다.** 6분이 모자란 건 알겠는데 어느 번호에서
// 손이 멈추는지, 무엇을 줄여야 하는지는 두 숫자로 안 보인다.
//
// 띠로 쌓으면 한 자리로 찍힌다 — 그리고 배율을 쥐여 주면 **자기 속도로** 다시 그려진다.
// 읽는 속도는 사람마다 다르고, 그게 이 계획이 자기 것이 되는 지점이다(I3).
//
// ── 비난하지 않는다 (철학 3) ──────────────────────────────────────────
// 넘는 구간을 빨갛게 칠하고 끝내지 않는다. 시간이 모자란 것은 **절차가 무겁다는 뜻**이고,
// 화면은 그렇게 적는다. 색은 `--warning`(주의)이지 `--error`(실패)가 아니다.

'use client'

import { useMemo, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { SPEED_MAX, SPEED_MIN, buildTimeline, mmss, type TimelineRow } from '@/lib/csat/plan-timeline'

/** 고를 수 있는 속도 — 슬라이더 대신 칩 셋이다. 연속 값은 「내 속도」를 고르게 하지 않고 만지작거리게 한다. */
const SPEEDS: { v: number; label: string; hint: string }[] = [
  { v: 0.8, label: '천천히', hint: '기준보다 25% 더 걸림' },
  { v: 1, label: '기준', hint: '분석이 적어 둔 권장 시간' },
  { v: 1.25, label: '빠르게', hint: '기준보다 20% 덜 걸림' },
]

/** 시간 → 칸의 짙기(%). 폭이 말하는 것을 색이 한 번 더 말한다. 바닥을 두어 옅은 칸도 보인다. */
function tone(sec: number, longest: number): number {
  if (longest <= 0) return 20
  return Math.round(20 + 35 * (sec / longest))
}

export function PlanTimeline({ rows, availableSec }: { rows: TimelineRow[]; availableSec: number }) {
  const [speed, setSpeed] = useState(1)
  const t = useMemo(() => buildTimeline(rows, availableSec, speed), [rows, availableSec, speed])

  // 띠의 가로 전체가 가리키는 시간 — 넘칠 때는 합계까지 그려야 **얼마나** 넘는지 보인다.
  const span = Math.max(t.total, t.available)
  const longest = useMemo(() => Math.max(1, ...t.segs.map((s) => s.sec)), [t])

  function pick(v: number) {
    if (v === speed) return
    setSpeed(v)
    track({
      name: 'csat_plan_speed_set',
      props: {
        speed: Math.round(v * 100),
        overSec: buildTimeline(rows, availableSec, v).overflow,
        breaks: buildTimeline(rows, availableSec, v).breaksAt !== null,
      },
    })
  }

  return (
    <section aria-labelledby="plan-time-h" className="mb-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="plan-time-h" className="break-keep font-display text-sm font-bold text-[var(--t1)]">
          {t.breaksAt !== null ? (
            <>
              지금 절차대로면 <span className="tabular-nums">{t.breaksAt}</span>번에서 시간이 끝납니다
            </>
          ) : (
            <>
              지금 절차대로면 <span className="tabular-nums">{mmss(t.slack)}</span> 남습니다
            </>
          )}
        </h2>
        <p className="tabular-nums text-xs text-[var(--t3)]">
          합 {mmss(t.total)} / 쓸 수 있는 시간 {mmss(t.available)}
        </p>
      </div>

      {/* 띠 — **이것이 증명이다**(I1). 문항마다 한 칸, 폭은 그 문항의 시간 예산이다. */}
      <div
        data-proof="plan-timeline"
        className="relative flex h-9 w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]"
        role="img"
        aria-label={
          t.breaksAt !== null
            ? `18번부터 시간을 쌓으면 ${t.breaksAt}번에서 쓸 수 있는 시간 ${mmss(t.available)}를 넘습니다. 합계 ${mmss(t.total)}.`
            : `18번부터 시간을 쌓아도 ${mmss(t.available)} 안에 들어옵니다. 합계 ${mmss(t.total)}, ${mmss(t.slack)} 남습니다.`
        }
      >
        {t.segs.map((s) => (
          s.sec > 0 ? (
            <span
              key={s.no}
              data-no={s.no}
              data-sec={s.sec}
              title={`${s.no}번 ${s.type_name} · ${mmss(s.sec)}`}
              className="h-full border-r border-[var(--bg)] last:border-r-0"
              style={{
                width: `${(100 * s.sec) / span}%`,
                // 색은 **폭과 같은 것**을 말한다 — 오래 걸리는 문항일수록 짙다. 색 하나에만
                // 실린 정보가 없으므로(폭이 같은 말을 한다) 색약 학습자에게 잃는 것이 없고,
                // 28칸이 한 톤이면 띠가 「빈 줄무늬」로 읽히던 것이 고쳐진다(실측 캡처).
                // 넘는 구간은 **주의**(--warning)지 실패(--error)가 아니다 — 절차가 무거운 것이다.
                // ⚠️ 두 번째 인자는 **`transparent`** 다. 처음에 `var(--bg)` 를 썼는데 그 변수가
                //    이 자리에서 안 풀려(실측: 계산된 배경 `rgba(0,0,0,0)`) `color-mix` 가 통째로
                //    무효가 됐다 — **띠가 아예 안 칠해졌다.** 그런데 화면은 멀쩡히 뜨고 계측기도
                //    `data-proof` 를 세므로 「증명 1개」로 보고됐다. 눈으로만 잡히는 종류라
                //    회귀(칸의 배경이 투명하지 않은가)를 함께 걸었다.
                background: s.over
                  ? 'var(--warning-light)'
                  : `color-mix(in srgb, var(--p) ${tone(s.sec, longest)}%, transparent)`,
              }}
            />
          ) : null
        ))}

        {/* 45분 선. 넘지 않으면 띠 끝과 겹치므로 그릴 필요가 없다. */}
        {t.total > t.available ? (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-[var(--warning)]"
            style={{ left: `${(100 * t.available) / span}%` }}
          />
        ) : null}
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3 text-[11px] tabular-nums text-[var(--t3)]">
        <span>18번 · 칸 하나가 한 문항</span>
        {t.total > t.available ? (
          <span className="break-keep font-bold text-[var(--warning-ink)]">
            ↑ {mmss(t.available)} 선 · {mmss(t.overflow)} 초과
          </span>
        ) : null}
        <span>45번</span>
      </div>

      {/* 조작 — 읽는 속도는 사람마다 다르다. 이걸 바꾸면 선이 옮겨 간다(I3). */}
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="내 읽기 속도">
        <span className="text-xs text-[var(--t3)]">내 속도</span>
        {SPEEDS.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => pick(s.v)}
            aria-pressed={speed === s.v}
            title={s.hint}
            className={[
              'inline-flex min-h-[44px] items-center break-keep rounded-[var(--r-full)] border px-3.5 text-sm',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
              speed === s.v
                ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:bg-[var(--bg3)] active:bg-[var(--bd)]',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
        <span className="sr-only">
          허용 범위 {SPEED_MIN}배부터 {SPEED_MAX}배까지
        </span>
      </div>

      {/* 넘칠 때도 **비난하지 않는다**(철학 3). 원인을 말하고 다음 한 걸음을 준다. */}
      {t.total > t.available ? (
        <p className="mt-3 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-sm leading-relaxed text-[var(--t2)]">
          시간이 모자란 것은 <strong>절차가 아직 무겁다는 뜻</strong>이에요. 아래에서 {t.breaksAt}번 뒤쪽
          유형부터 절차를 줄여 보세요 — 유형 화면의 「막히면」은 접어 두고 첫 단계만 쓰면 대개 절반으로 줍니다.
        </p>
      ) : null}

      {t.unknown > 0 ? (
        <p className="mt-2 break-keep text-xs leading-relaxed text-[var(--t3)]">
          {t.unknown}문항은 절차가 아직 없어 이 합계에 0초로 들어 있어요 — 실제로는 더 걸립니다.
          {t.perUnknown > 0 ? ` 남은 시간을 나누면 한 문항에 ${mmss(t.perUnknown)}입니다.` : ''}
        </p>
      ) : null}
    </section>
  )
}
