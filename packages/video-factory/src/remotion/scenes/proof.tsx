// packages/video-factory/src/remotion/scenes/proof.tsx
//
// **증명 컷 3종** — 이 제품이 아니면 만들 수 없는 그림들.
//
//  · 커버리지 — 지문 위에 아는 낱말이 칠해진다. 랜딩 히어로와 **같은 지문·같은 수치**.
//  · 망각 곡선 — `R(t) = exp(ln 0.9 · t / S)`. 스냅샷(4색)이 아니라 **시간축**으로 보여 준다.
//  · 문항 — DB 에서 꺼낸 **실제 문항**이 풀린다.
//
// 셋 다 "말하지 말고 증명하라" 의 이행이다. 여기가 비면 남는 건 예쁜 자막뿐이다.

import React from 'react'

import type { CoverageScene, DecayScene, ItemScene } from '../../spec/types'
import { ACCENT, ACCENT_SOFT, DECAY, FONT, SURFACE, decayColor, retention } from '../../theme/palette'
import type { AccentKey } from '../../spec/types'
import { enterExit, progress, spread, transform } from '../motion'
import { KO, Title, useFormat } from '../Frame'

/* ── 커버리지 ─────────────────────────────────────────────────── */

export const Coverage: React.FC<{ scene: CoverageScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  const e = enterExit(frame, duration)

  // 낱말이 **차례로** 칠해진다. 한 번에 다 칠하면 "이미 그렇게 그려진 그림" 으로 보이고,
  // 차례로 칠하면 **지금 계산되고 있다**로 보인다. 같은 정보인데 신뢰가 다르다.
  const words = scene.tokens.filter((t) => !t.plain)
  const paintUntil = progress(frame, 8, Math.max(20, duration - 24)) * words.length

  let wordIdx = -1
  const known = words.filter((w) => w.known).length
  const ratio = words.length > 0 ? known / words.length : 0

  return (
    <div style={{ opacity: e.opacity, transform: transform(e) }}>
      <div
        style={{
          fontFamily: FONT.english,
          fontSize: Math.round(40 * scale),
          lineHeight: 1.75,
          color: SURFACE.inkFaint,
        }}
      >
        {scene.tokens.map((t, i) => {
          if (t.plain) return <span key={i}>{t.text}</span>
          wordIdx++
          const painted = wordIdx < paintUntil
          if (!painted) return <span key={i}>{t.text}</span>
          return (
            <span
              key={i}
              style={
                t.known
                  ? { color: SURFACE.ink, backgroundColor: ACCENT_SOFT[accent], borderRadius: 4 }
                  : {
                      color: DECAY.risk,
                      borderBottom: `${Math.max(2, Math.round(3 * scale))}px solid ${DECAY.risk}`,
                    }
              }
            >
              {t.text}
            </span>
          )
        })}
      </div>

      {/*
        수치는 **하나만** 둔다. 채색 진행률을 곱한 값과 최종값을 나란히 놓았더니
        "46%" 와 "67%" 가 같은 줄에 떠서 서로를 부정했다(실측 2026-09-12 스틸).
        큰 숫자가 최종값까지 세어 올라가고, 옆에는 **누구 기준인지**만 적는다.
      */}
      <div
        style={{
          marginTop: Math.round(36 * scale),
          display: 'flex',
          alignItems: 'baseline',
          gap: Math.round(16 * scale),
          ...KO,
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            fontSize: Math.round(88 * scale),
            color: ACCENT[accent],
            lineHeight: 1,
          }}
        >
          {Math.round(ratio * Math.min(1, paintUntil / Math.max(1, words.length)) * 100)}%
        </div>
        <div
          style={{ fontFamily: FONT.body, fontSize: Math.round(28 * scale), color: SURFACE.inkMuted }}
        >
          {scene.label}
        </div>
      </div>
    </div>
  )
}

/* ── 망각 곡선 ────────────────────────────────────────────────── */

export const Decay: React.FC<{ scene: DecayScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  const e = enterExit(frame, duration)
  const drawn = progress(frame, 10, Math.max(24, duration - 20))

  const W = Math.round(980 * scale)
  const H = Math.round(430 * scale)
  const pad = Math.round(10 * scale)

  /**
   * **세로축을 0 부터 그리지 않는다.**
   *
   * R 은 1.0 에서 시작해 좀처럼 0 에 닿지 않는다. 0~1 전체를 그리면 곡선이 위쪽 1/5 에
   * 눌려 붙어 **거의 직선으로 보인다**(실측 2026-09-12 스틸). 그러면 "쇠퇴" 라는
   * 이 컷의 단 하나뿐인 전달 내용이 사라진다.
   * 대신 축을 자른 사실을 **눈금으로 적어** 숨기지 않는다.
   */
  const Y_MIN = 0.4
  const yOf = (r: number) =>
    H - ((r - Y_MIN) / (1 - Y_MIN)) * (H - pad * 2) - pad

  // 점을 하루 단위로 찍는다 — 곡선이 **계산된 것**임이 보여야 한다.
  const pts = Array.from({ length: scene.days + 1 }, (_, d) => {
    const r = retention(d, scene.stability)
    return { d, r, x: (d / scene.days) * (W - pad * 2) + pad, y: yOf(r) }
  })
  const shown = pts.slice(0, Math.max(2, Math.ceil(drawn * pts.length)))
  const path = shown.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const head = shown[shown.length - 1]!

  // 임계선 두 개 — 색만으로 정보를 전달하지 않기 위해 값도 적는다.
  const line = (r: number, label: string, color: string) => {
    const y = yOf(r)
    return (
      <g key={label}>
        <line x1={pad} x2={W - pad} y1={y} y2={y} stroke={color} strokeDasharray="6 8" strokeWidth={2} />
        <text
          x={W - pad}
          y={y - 8}
          textAnchor="end"
          fontFamily={FONT.mono}
          fontSize={Math.round(20 * scale)}
          fill={color}
        >
          {label}
        </text>
      </g>
    )
  }

  return (
    <div style={{ opacity: e.opacity, transform: transform(e) }}>
      <svg width={W} height={H} style={{ maxWidth: '100%', overflow: 'visible' }}>
        {line(0.95, '0.95 안정', DECAY.stable)}
        {line(0.7, '0.70 위험', DECAY.risk)}
        <path d={path} fill="none" stroke={ACCENT[accent]} strokeWidth={Math.round(5 * scale)} />
        <circle cx={head.x} cy={head.y} r={Math.round(9 * scale)} fill={decayColor(head.r)} />
        {/* 자른 축임을 적는다 — 안 적으면 눈속임이 된다. */}
        <text
          x={pad}
          y={H - pad + Math.round(4 * scale)}
          fontFamily={FONT.mono}
          fontSize={Math.round(18 * scale)}
          fill={SURFACE.inkFaint}
        >
          세로축 {Y_MIN.toFixed(1)}–1.0
        </text>
        <text
          x={W - pad}
          y={H - pad + Math.round(4 * scale)}
          textAnchor="end"
          fontFamily={FONT.mono}
          fontSize={Math.round(18 * scale)}
          fill={SURFACE.inkFaint}
        >
          0일 → {scene.days}일
        </text>
      </svg>

      <div
        style={{
          marginTop: Math.round(20 * scale),
          display: 'flex',
          alignItems: 'baseline',
          gap: Math.round(18 * scale),
          ...KO,
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            fontSize: Math.round(64 * scale),
            color: decayColor(head.r),
            lineHeight: 1,
          }}
        >
          {head.d}일 뒤 {Math.round(head.r * 100)}%
        </div>
        <div
          style={{ fontFamily: FONT.mono, fontSize: Math.round(24 * scale), color: SURFACE.inkFaint }}
        >
          {scene.label}
        </div>
      </div>
    </div>
  )
}

/* ── 실제 문항 ────────────────────────────────────────────────── */

export const Item: React.FC<{ scene: ItemScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  const e = enterExit(frame, duration)
  // 정답은 **끝에서** 드러난다 — 먼저 보여 주면 문제가 아니라 광고가 된다.
  const revealAt = Math.max(20, duration - 30)
  const revealed = frame >= revealAt
  const { prompt, choices, answer } = scene.sample

  return (
    <div style={{ opacity: e.opacity, transform: transform(e) }}>
      <div
        style={{
          display: 'inline-block',
          fontFamily: FONT.display,
          fontSize: Math.round(22 * scale),
          letterSpacing: '0.04em',
          color: ACCENT[accent],
          backgroundColor: ACCENT_SOFT[accent],
          padding: `${Math.round(6 * scale)}px ${Math.round(14 * scale)}px`,
          borderRadius: Math.round(8 * scale),
          marginBottom: Math.round(20 * scale),
          ...KO,
        }}
      >
        {scene.typeLabel}
      </div>

      <div
        style={{
          fontFamily: /[가-힣]/.test(prompt) ? FONT.body : FONT.english,
          fontSize: Math.round(38 * scale),
          lineHeight: 1.5,
          color: SURFACE.ink,
          ...KO,
        }}
      >
        {prompt}
      </div>

      {choices.length > 0 ? (
        <div style={{ marginTop: Math.round(24 * scale) }}>
          {choices.map((c, i) => {
            const ce = enterExit(frame, duration, 10 + spread(i, choices.length, duration, 0.25))
            const isAnswer = typeof answer === 'number' ? answer === i : false
            const mark = revealed && isAnswer
            return (
              <div
                key={i}
                style={{
                  opacity: ce.opacity,
                  transform: transform(ce),
                  fontFamily: /[가-힣]/.test(c) ? FONT.body : FONT.english,
                  fontSize: Math.round(30 * scale),
                  lineHeight: 1.6,
                  color: mark ? SURFACE.ink : SURFACE.inkMuted,
                  borderLeft: `${Math.round(4 * scale)}px solid ${mark ? ACCENT[accent] : 'transparent'}`,
                  paddingLeft: Math.round(14 * scale),
                  ...KO,
                }}
              >
                {mark ? '✓ ' : ''}
                {c}
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            marginTop: Math.round(28 * scale),
            fontFamily: FONT.english,
            fontSize: Math.round(34 * scale),
            color: revealed ? ACCENT[accent] : 'transparent',
            borderBottom: `${Math.round(3 * scale)}px solid ${SURFACE.border}`,
            display: 'inline-block',
            minWidth: Math.round(320 * scale),
            ...KO,
          }}
        >
          {String(answer)}
        </div>
      )}
    </div>
  )
}

export const ProofTitle = Title
