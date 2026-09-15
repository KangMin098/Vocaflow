// packages/video-factory/src/remotion/scenes/text.tsx
//
// **말 컷 3종** — 여는 물음 · 장점 진술 · 닫는 걸음.
//
// 여기가 "사람의 목소리" 가 나는 자리다(§6). 물음과 격려는 **Lora italic**,
// 지표는 Plus Jakarta — 두 말투를 한 서체로 쓰면 어디가 사람 말인지 구분이 사라진다.
//
// 닫는 컷에 트로피·폭죽이 없다. 있는 것은 **다음 한 걸음**뿐이다(D5).

import React from 'react'

import type { AccentKey, ClosingScene, HookScene, StatementScene } from '../../spec/types'
import { ACCENT, ACCENT_SOFT, FONT, SURFACE } from '../../theme/palette'
import { enterExit, transform } from '../motion'
import { KO, hasHangul, useFormat, voiceFont } from '../Frame'

/**
 * "사람이 말하는 자리" 의 표시.
 *
 * 영어는 기울여서, 한글은 **왼쪽 세로선**으로 나타낸다 — 한글에는 이탤릭이라는 장치가 없고,
 * 억지로 기울이면 시스템 고딕이 찌그러진 가짜 이탤릭이 나온다(CLAUDE.md 「한글에 Lora」 금지).
 */
const VoiceLine: React.FC<{
  text: string
  size: number
  scale: number
  color: string
  rule: string
}> = ({ text, size, scale, color, rule }) => {
  const ko = hasHangul(text)
  return (
    <div
      style={{
        ...voiceFont(text),
        fontSize: size,
        lineHeight: 1.3,
        color,
        borderLeft: ko ? `${Math.round(5 * scale)}px solid ${rule}` : undefined,
        paddingLeft: ko ? Math.round(22 * scale) : undefined,
        ...KO,
      }}
    >
      {text}
    </div>
  )
}

export const Hook: React.FC<{ scene: HookScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  const e = enterExit(frame, duration)
  const sub = enterExit(frame, duration, 8)

  return (
    <div style={{ opacity: e.opacity, transform: transform(e) }}>
      <VoiceLine
        text={scene.line}
        size={Math.round(84 * scale)}
        scale={scale}
        color={SURFACE.ink}
        rule={ACCENT[accent]}
      />
      {scene.sub ? (
        <div
          style={{
            opacity: sub.opacity,
            transform: transform(sub),
            marginTop: Math.round(24 * scale),
            fontFamily: FONT.body,
            fontSize: Math.round(34 * scale),
            color: ACCENT[accent],
            ...KO,
          }}
        >
          {scene.sub}
        </div>
      ) : null}
    </div>
  )
}

export const Statement: React.FC<{
  scene: StatementScene
  accent: AccentKey
  duration: number
}> = ({ scene, accent, duration }) => {
  const { scale, frame } = useFormat()
  const e = enterExit(frame, duration)
  const body = enterExit(frame, duration, 6)
  const basis = enterExit(frame, duration, 12)

  return (
    <div style={{ opacity: e.opacity, transform: transform(e) }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 800,
          fontSize: Math.round(66 * scale),
          lineHeight: 1.2,
          color: SURFACE.ink,
          ...KO,
        }}
      >
        {scene.title}
      </div>
      <div
        style={{
          opacity: body.opacity,
          transform: transform(body),
          marginTop: Math.round(22 * scale),
          fontFamily: FONT.body,
          fontSize: Math.round(36 * scale),
          lineHeight: 1.55,
          color: SURFACE.inkMuted,
          ...KO,
        }}
      >
        {scene.body}
      </div>
      {/* 근거 — 이게 없으면 항목 자체가 성립하지 않는다(differentiators.ts 의 규칙). */}
      <div
        style={{
          opacity: basis.opacity,
          transform: transform(basis),
          marginTop: Math.round(28 * scale),
          display: 'inline-block',
          fontFamily: FONT.mono,
          fontSize: Math.round(22 * scale),
          color: ACCENT[accent],
          backgroundColor: ACCENT_SOFT[accent],
          padding: `${Math.round(8 * scale)}px ${Math.round(16 * scale)}px`,
          borderRadius: Math.round(8 * scale),
          ...KO,
        }}
      >
        {scene.basis}
      </div>
    </div>
  )
}

export const Closing: React.FC<{ scene: ClosingScene; accent: AccentKey; duration: number }> = ({
  scene,
  accent,
  duration,
}) => {
  const { scale, frame } = useFormat()
  const e = enterExit(frame, duration)
  const cta = enterExit(frame, duration, 8)

  return (
    <div style={{ opacity: e.opacity, transform: transform(e) }}>
      <VoiceLine
        text={scene.line}
        size={Math.round(60 * scale)}
        scale={scale}
        color={SURFACE.ink}
        rule={ACCENT[accent]}
      />
      <div
        style={{
          opacity: cta.opacity,
          transform: transform(cta),
          marginTop: Math.round(30 * scale),
          display: 'inline-block',
          fontFamily: FONT.display,
          fontWeight: 700,
          fontSize: Math.round(34 * scale),
          color: SURFACE.inverted,
          backgroundColor: ACCENT[accent],
          padding: `${Math.round(16 * scale)}px ${Math.round(30 * scale)}px`,
          borderRadius: Math.round(10 * scale),
          ...KO,
        }}
      >
        {scene.cta}
      </div>
      <div
        style={{
          opacity: cta.opacity,
          marginTop: Math.round(22 * scale),
          fontFamily: FONT.mono,
          fontSize: Math.round(28 * scale),
          color: SURFACE.inkMuted,
        }}
      >
        {scene.url}
      </div>
    </div>
  )
}
