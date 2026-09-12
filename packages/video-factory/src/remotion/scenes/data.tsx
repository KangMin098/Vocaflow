// packages/video-factory/src/remotion/scenes/data.tsx
//
// **자료 컷 3종** — 수치 · 커리큘럼 계단 · 서가.
//
// 공통 규칙: 수치에 말을 얹지 않는다(§6 감성 표 — "지표·수치: 말을 얹지 않는다. 숫자만").
// 출처는 작게 항상 붙인다 — 광고에 쓰는 화면이라 근거 없는 수치는 표시광고법 리스크다.

import React from 'react'

import type { AccentKey, LadderScene, ShelfScene, StatScene } from '../../spec/types'
import { ACCENT, FONT, SURFACE } from '../../theme/palette'
import { enterExit, progress, spread, transform } from '../motion'
import { KO, useFormat } from '../Frame'

/* ── 수치 ─────────────────────────────────────────────────────── */

export const Stat: React.FC<{ scene: StatScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(28 * scale) }}>
      {scene.stats.map((s, i) => {
        const delay = spread(i, scene.stats.length, duration)
        const e = enterExit(frame, duration, delay)
        // 숫자면 세어 올린다. 문자열이면 그대로 — 억지로 애니메이션하지 않는다.
        const raw = Number(s.value.replace(/,/g, ''))
        const countable = Number.isFinite(raw) && s.value.trim() !== ''
        const p = progress(frame, 6 + delay, Math.max(24, duration - 18))
        const shown = countable
          ? new Intl.NumberFormat('ko-KR').format(Math.round(raw * p))
          : s.value

        return (
          <div key={i} style={{ opacity: e.opacity, transform: transform(e) }}>
            <div
              style={{
                fontFamily: FONT.display,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                fontSize: Math.round(76 * scale),
                lineHeight: 1.05,
                color: ACCENT[accent],
              }}
            >
              {shown}
            </div>
            <div
              style={{
                fontFamily: FONT.body,
                fontSize: Math.round(30 * scale),
                color: SURFACE.ink,
                marginTop: Math.round(4 * scale),
                ...KO,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: Math.round(18 * scale),
                color: SURFACE.inkFaint,
                marginTop: Math.round(4 * scale),
                ...KO,
              }}
            >
              {s.source}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 커리큘럼 계단 ────────────────────────────────────────────── */

export const Ladder: React.FC<{ scene: LadderScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  // **못 잰 단(null)과 재고 0 인 단은 다르다.** null 을 0 으로 접으면 "아직 없다" 로 그려지는데,
  // 실제로는 "모른다" 다. 분모(max)에서도 빼야 막대가 왜곡되지 않는다.
  const max = Math.max(1, ...scene.rungs.map((r) => r.items ?? 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: Math.round(10 * scale) }}>
      {scene.rungs.map((r, i) => {
        // 아래 단부터 차오른다 — 사다리는 밑에서 오른다(철학 4 Implicit Progress).
        // 간격은 **컷 길이에 맞춰 눌린다** — 고정 간격은 마지막 단을 삼킨다(`spread` 주석 참조).
        const delay = spread(i, scene.rungs.length, duration)
        const e = enterExit(frame, duration, delay)
        const fill = progress(frame, 6 + delay, Math.max(30, duration - 16))
        const items = r.items
        const unmeasured = items === null
        const width = items === null ? 0 : (items / max) * fill
        const empty = items === 0
        const on = scene.highlightStep === undefined || scene.highlightStep === r.step

        return (
          <div
            key={r.step}
            style={{
              opacity: e.opacity * (on ? 1 : 0.45),
              transform: transform(e),
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(16 * scale),
            }}
          >
            {/* 라벨이 두 줄로 접히면 줄 높이가 들쭉날쭉해진다 — 폭을 넉넉히 잡고 한 줄로 고정. */}
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: Math.round(22 * scale),
                color: SURFACE.inkFaint,
                width: Math.round(230 * scale),
                flexShrink: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r.step}단 · {r.schoolBand}
            </div>
            <div
              style={{
                flex: 1,
                height: Math.round(44 * scale),
                backgroundColor: SURFACE.edge,
                borderRadius: Math.round(6 * scale),
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${width * 100}%`,
                  height: '100%',
                  backgroundColor: empty ? SURFACE.border : ACCENT[accent],
                }}
              />
              {/*
                숫자를 막대 **안**에 고정으로 두면 막대가 짧을 때 앞자리가 막대에 먹힌다
                (실측 2026-09-12: "25,748" 이 "5,748" 로 읽혔다).
                막대가 짧으면 막대 **오른쪽**에, 길면 막대 안 왼쪽에 둔다.
              */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: `calc(${(width > 0.3 ? 0 : width) * 100}% + ${Math.round(14 * scale)}px)`,
                  fontFamily: FONT.display,
                  fontSize: Math.round(24 * scale),
                  fontVariantNumeric: 'tabular-nums',
                  color: width > 0.3 ? SURFACE.inverted : SURFACE.ink,
                  whiteSpace: 'nowrap',
                }}
              >
                {/* 재고 0 은 빈칸이 아니라 **아직 없다**고 말한다 — 0 을 숨기면 거짓이 된다. */}
                {unmeasured
                  ? '못 잼'
                  : empty
                    ? '아직 없음'
                    : new Intl.NumberFormat('ko-KR').format(items)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 서가 ─────────────────────────────────────────────────────── */

export const Shelf: React.FC<{ scene: ShelfScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  const color = ACCENT[accent]

  return (
    // 책 묶음과 선반을 **같은 폭**으로 묶어 가운데 세운다.
    // 책은 왼쪽 35%만 쓰는데 선반만 화면을 가로지르면 무게가 한쪽으로 쏠린다
    // (실측 2026-09-12 스틸).
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: Math.round(18 * scale),
          minHeight: Math.round(300 * scale),
        }}
      >
        {scene.volumes.map((v, i) => {
          // 책이 하나씩 꽂힌다. 계단이므로 뒤로 갈수록 조금씩 높다.
          const e = enterExit(frame, duration, spread(i, scene.volumes.length, duration))
          const h = Math.round((230 + i * 16) * scale)
          const pending = v.state === 'pending'
          return (
            <div
              key={v.title}
              style={{
                opacity: e.opacity * (pending ? 0.4 : 1),
                transform: `translateY(${e.y * 2}px)`,
                width: Math.round(118 * scale),
                height: h,
                backgroundColor: pending ? SURFACE.edge : color,
                border: pending ? `${Math.round(2 * scale)}px dashed ${SURFACE.border}` : 'none',
                borderRadius: `${Math.round(4 * scale)}px ${Math.round(4 * scale)}px 0 0`,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: Math.round(14 * scale),
              }}
            >
              <div
                style={{
                  writingMode: 'vertical-rl',
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: Math.round(19 * scale),
                  color: pending ? SURFACE.inkFaint : SURFACE.inverted,
                  letterSpacing: '0.03em',
                  // 책등 제목은 **한 줄**이다. 접히면 두 줄이 나란히 서서 책이 아니라 표처럼 보인다.
                  whiteSpace: 'nowrap',
                  maxHeight: h - Math.round(24 * scale),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {v.title}
              </div>
            </div>
          )
        })}
      </div>
      {/* 선반 */}
      <div style={{ height: Math.round(8 * scale), backgroundColor: SURFACE.border }} />
      <div
        style={{
          marginTop: Math.round(18 * scale),
          fontFamily: FONT.body,
          fontSize: Math.round(24 * scale),
          color: SURFACE.inkMuted,
          ...KO,
        }}
      >
        {/* 점선 책 = 아직 한 권이 안 찬 단. 색만으로 가르지 않고 말로도 적는다. */}
        점선은 아직 한 권(60문항)이 안 찬 단입니다
      </div>
      </div>
    </div>
  )
}
