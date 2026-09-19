// apps/web/src/components/textfit/PaintedPassage.tsx
//
// **칠해지는 입력칸** — `/fit` 의 골격(2026-09-19 발산 A, `docs/design/compare/fit.md`).
//
// 입력칸이 곧 결과다. 붙여 넣은(또는 예시) 지문이 Lora 원문 그대로 놓이고, 고른 학년에서
// 처음 만나는 낱말이 **주묵 옅은 면**으로 칠해진다. 학년 슬라이더의 눈금 자체가 학년별 커버리지다.
// 슬라이더를 움직이면 낱말 면 색이 200ms 에 바뀐다 — 랜딩 히어로(`CoverageHero`)와 같은 몸짓.
// 광고(서명 있음)와 도구(평균)의 간극을 닫는 것이 이 재설계의 이유였다.
//
// 규약: 색 + 밑줄 + 범례 3중(색맹 대응) · 모션은 색 전환 200ms 뿐(이동·스케일 0 — reduced-motion 에서도
//   그대로 유효) · 44px 타깃 · 토큰 경유(다크 자동) · 영어 원문 Lora · 한국어 이탤릭 없음.

'use client'

import { LEVEL_LABEL, PROFILE_LEVELS, type LevelReading, type ProfileLevel } from '@/lib/textfit/profile'
import { BAND_COPY } from '@/lib/textfit/coverage'
import { countUnknownTypes, isUnknownAt, type PaintToken } from '@/lib/textfit/paint'

const pct = (v: number) => `${Math.round(v * 100)}`

/** 슬라이더 손잡이 지름(px) — 눈금을 손잡이 중심에 맞추는 데 쓴다. */
const THUMB = 22

/**
 * 칠하지 않는 조각들을 한 덩어리로 묶는다 — 지문 12,000자면 조각이 수천 개라 노드마다 span 을 두지 않는다.
 * 원문은 그대로다(이어 붙이면 글자 하나까지 같다).
 */
export function runs(tokens: PaintToken[], level: number): Array<{ text: string; unknown: boolean }> {
  const out: Array<{ text: string; unknown: boolean }> = []
  for (const tok of tokens) {
    const unknown = isUnknownAt(tok, level)
    const last = out[out.length - 1]
    if (!unknown && last && !last.unknown) last.text += tok.t
    else out.push({ text: tok.t, unknown })
  }
  return out
}

interface Props {
  /** 칠할 조각 — 원문이 없으면(공유 링크) `null` */
  tokens: PaintToken[] | null
  readings: LevelReading[]
  fitLevel: ProfileLevel | null
  level: ProfileLevel
  onLevelChange: (level: ProfileLevel) => void
  /** 새 지문을 분석하는 중 — 칠이 옛 결과일 수 있다 */
  stale: boolean
}

export function PaintedPassage({ tokens, readings, fitLevel, level, onLevelChange, stale }: Props) {
  const reading = readings.find((r) => r.level === level) ?? readings[0]
  if (!reading) return null

  const unknown = tokens ? countUnknownTypes(tokens, level) : null
  const unleveled = tokens ? tokens.filter((t) => t.v === null).length : 0
  const first = PROFILE_LEVELS[0]
  const last = PROFILE_LEVELS[PROFILE_LEVELS.length - 1]
  const span = last - first

  return (
    <div className="flex flex-col gap-5">
      {tokens && (
        <>
          <p
            aria-busy={stale}
            className={`m-0 font-english text-[16px] leading-[1.9] text-[var(--t1)] transition-opacity duration-[var(--dur-normal)] md:text-[17.5px] ${stale ? 'opacity-60' : ''}`}
          >
            {runs(tokens, level).map((run, i) =>
              run.unknown ? (
                <mark
                  key={i}
                  className="rounded-[var(--r-sm)] bg-[var(--ju-wash)] px-[1px] text-[var(--t1)] underline decoration-[var(--ju)] decoration-1 underline-offset-[4px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
                >
                  {run.text}
                </mark>
              ) : (
                <span key={i}>{run.text}</span>
              ),
            )}
          </p>

          <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 font-body text-[12px] text-[var(--t2)]">
            <li className="flex items-center gap-1.5">
              <mark className="rounded-[var(--r-sm)] bg-[var(--ju-wash)] px-[1px] font-english text-[13px] text-[var(--t1)] underline decoration-[var(--ju)] decoration-1 underline-offset-[4px]">
                Aa
              </mark>
              {LEVEL_LABEL[level]}에서 처음 만나는 낱말{' '}
              <b className="font-mono tabular-nums text-[var(--t1)]">{unknown}</b>개
            </li>
            {unleveled > 0 && (
              // 감추지 않는다 — 흔한 낱말에 표식을 흩뿌리는 대신 셈을 밝힌다.
              <li className="text-[var(--t2)]">레벨 미상 {unleveled}낱말은 절반만 안다고 셈</li>
            )}
          </ul>
        </>
      )}

      {/* ── 학년 슬라이더 — 눈금 자체가 학년별 커버리지다 ── */}
      <div className="border-t border-[var(--bd)] pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="fit-level" className="font-display text-[12.5px] font-[700] text-[var(--t2)]">
            우리 반 학년
          </label>
          <span className="font-display text-[13.5px] font-[700] text-[var(--t1)]">{LEVEL_LABEL[level]}</span>
        </div>

        <input
          id="fit-level"
          type="range"
          min={first}
          max={last}
          step={1}
          value={level}
          onChange={(e) => onLevelChange(Number(e.target.value) as ProfileLevel)}
          aria-valuetext={`${LEVEL_LABEL[level]} — 어휘 커버리지 ${pct(reading.coverage)}%`}
          className="mt-2 h-[44px] w-full cursor-pointer appearance-none bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--bg)] [&::-moz-range-thumb]:bg-[var(--ju)] [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:bg-[var(--bd)] [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-[var(--bd)] [&::-webkit-slider-thumb]:mt-[-9.5px] [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg)] [&::-webkit-slider-thumb]:bg-[var(--ju)]"
        />

        {/* 눈금 — 손잡이 중심에 맞춘 학년별 커버리지. 숫자로도 읽힌다(색 단독 금지). */}
        <ol aria-label="학년별 어휘 커버리지" className="relative m-0 h-9 list-none p-0">
          {readings.map((r) => {
            const x = (r.level - first) / span
            const on = r.level === level
            const isFit = r.level === fitLevel
            return (
              <li
                key={r.level}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${x})` }}
              >
                <span
                  className={`font-mono text-[11px] tabular-nums ${on ? 'font-[700] text-[var(--t1)]' : 'text-[var(--t2)]'}`}
                >
                  <span className="sr-only">{LEVEL_LABEL[r.level]} </span>
                  {pct(r.coverage)}
                </span>
                {isFit && (
                  <span className="font-display text-[10px] font-[700] text-[var(--memory-stable-ink)]">적정</span>
                )}
              </li>
            )
          })}
        </ol>

        <div className="flex justify-between font-body text-[11px] text-[var(--t2)]">
          <span>{LEVEL_LABEL[first]}</span>
          <span>{LEVEL_LABEL[last]}</span>
        </div>
      </div>

      {/* ── 판정 — 숫자는 계산값, 대역 이름이 뜻을 말한다 ── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 break-keep font-body text-[13.5px] leading-[1.6] text-[var(--t1)]">
            {BAND_COPY[reading.band].verdict}
          </p>
          <p className="m-0 mt-1 font-body text-[12px] text-[var(--t2)]">
            범위 {pct(reading.coverageLow)}–{pct(reading.coverageHigh)}% · 레벨을 확인 못 한 낱말을 감추지 않은 폭
          </p>
        </div>
        <p className="m-0 shrink-0 text-right">
          <span className="font-mono text-[34px] font-[700] leading-none tabular-nums text-[var(--t1)] md:text-[40px]">
            {pct(reading.coverage)}
            <span className="text-[18px]">%</span>
          </span>
          <span className="mt-1 block font-display text-[11px] font-[600] text-[var(--t2)]">어휘 커버리지</span>
        </p>
      </div>
    </div>
  )
}
