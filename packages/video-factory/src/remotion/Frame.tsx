// packages/video-factory/src/remotion/Frame.tsx
//
// **모든 컷이 들어앉는 틀** — 종이 바탕 · 안전 여백 · 자막 · 진행 실선.
//
// 왜 틀이 하나인가: 컷마다 배경과 여백을 따로 적으면 컷이 바뀔 때 화면이 미세하게 튄다.
// 그 튐은 한 편에 열 번이면 "싸구려" 로 읽힌다.
//
// ── 여기서 못 박는 것 ──────────────────────────────────────────
//  · 한글에 `wordBreak: keep-all` — 없으면 낱말이 쪼개진다
//    (실측 2026-09-12 · 글리프 확인 스틸에서 "아 / 는" 으로 갈렸다. CLAUDE.md I7 과 같은 결함).
//  · 자막은 **항상** 깔린다. 소리를 끄고 봐도 내용이 전달돼야 한다.
//  · 진행은 숫자 게이지가 아니라 **실선 한 줄**이다 (철학 4 Implicit Progress).

import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'

import { FORMATS, typeScale, type FormatId } from '../spec/format'
import type { AccentKey } from '../spec/types'
import { ACCENT, FONT, SURFACE } from '../theme/palette'

/** 한글이 낱말 중간에서 쪼개지지 않게 — 모든 한국어 텍스트에 얹는다. */
export const KO: React.CSSProperties = {
  wordBreak: 'keep-all',
  overflowWrap: 'break-word',
}

export interface FrameProps {
  format: FormatId
  accent: AccentKey
  caption: string
  /** 영상 전체에서 지금 어디쯤인가 (0~1). 진행 실선이 이 값만큼 찬다. */
  overallProgress: number
  /** 좌상단 브랜드 표기. 광고에서 잘려 나가지 않도록 안전 여백 안에 둔다. */
  brand: string
  children: React.ReactNode
}

export const Frame: React.FC<FrameProps> = ({
  format,
  accent,
  caption,
  overallProgress,
  brand,
  children,
}) => {
  const def = FORMATS[format]
  const scale = typeScale(format)
  const color = ACCENT[accent]

  return (
    <AbsoluteFill style={{ backgroundColor: SURFACE.page }}>
      {/* 종이 가장자리 — 바탕이 완전 평면이면 화면이 아니라 슬라이드처럼 보인다. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${SURFACE.page} 0%, ${SURFACE.canvas} 100%)`,
        }}
      />

      {/* 강조색 실선 — 시리즈를 눈으로 가르는 축(series-catalog.ts 의 accent 와 같은 역할). */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.round(6 * scale),
          backgroundColor: color,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: def.safe.top,
          left: def.safe.left,
          fontFamily: FONT.display,
          fontSize: Math.round(20 * scale),
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: SURFACE.inkFaint,
        }}
      >
        {brand}
      </div>

      {/* 본문 자리 — 자막이 차지하는 아래쪽을 비워 둔다. */}
      <AbsoluteFill
        style={{
          paddingTop: def.safe.top + Math.round(52 * scale),
          paddingRight: def.safe.right,
          paddingBottom: def.safe.bottom + Math.round(150 * scale),
          paddingLeft: def.safe.left,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {children}
      </AbsoluteFill>

      {/* 자막 */}
      <div
        style={{
          position: 'absolute',
          left: def.safe.left,
          right: def.safe.right,
          bottom: def.safe.bottom + Math.round(38 * scale),
          fontFamily: FONT.body,
          fontSize: Math.round(30 * scale),
          lineHeight: 1.45,
          color: SURFACE.ink,
          textAlign: 'center',
          ...KO,
        }}
      >
        {caption}
      </div>

      {/* 진행 실선 — 숫자를 쓰지 않는다. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.round(4 * scale),
          backgroundColor: SURFACE.border,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(1, overallProgress)) * 100}%`,
            height: '100%',
            backgroundColor: color,
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

/** 컷 안에서 쓰는 제목 — 한글·영문 양쪽에서 읽히는 크기. */
export const Title: React.FC<{
  children: React.ReactNode
  scale: number
  color?: string
  serif?: boolean
}> = ({ children, scale, color = SURFACE.ink, serif = false }) => (
  <div
    style={{
      fontFamily: serif ? FONT.english : FONT.display,
      fontWeight: 700,
      fontSize: Math.round(72 * scale),
      lineHeight: 1.2,
      color,
      ...KO,
    }}
  >
    {children}
  </div>
)

/**
 * 규격을 컷 컴포넌트까지 나른다.
 *
 * 왜 폭에서 추론하지 않는가: 세로(1080×1920)와 정사각(1080×1080)은 **폭이 같다.**
 * 추론하면 둘 중 하나가 조용히 틀린 배율로 그려진다 — 오류는 안 나고 글자만 어색해진다.
 */
export const FormatContext = React.createContext<FormatId>('wide')

export function useFormat(): { format: FormatId; scale: number; frame: number; fps: number } {
  const format = React.useContext(FormatContext)
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return { format, scale: typeScale(format), frame, fps }
}

/** 한글이 들어 있는가 — 서체를 가르는 유일한 기준. */
export function hasHangul(s: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(s)
}

/**
 * **사람이 말하는 자리**의 서체.
 *
 * 영어는 Lora italic 이 그 자리다(§6). 그런데 **Lora 에는 한글이 없다** — 한글에 italic 을
 * 걸면 브라우저가 시스템 고딕을 기울여 만드는 가짜 이탤릭이 나오고, 그건 싸구려로 읽힌다.
 * 게다가 CLAUDE.md 「절대 하지 않을 것 · Typography」가 **한글에 Lora** 를 금지한다.
 * (실측 2026-09-12 — 닫는 컷 스틸에서 한글이 기울어져 나왔다.)
 *
 * 그래서 한글은 **DM Sans 정체**로 쓰고, "사람의 목소리" 는 기울기가 아니라
 * **왼쪽 세로선**으로 표시한다. 한글 조판에 이탤릭이라는 장치가 원래 없다.
 */
export function voiceFont(text: string): React.CSSProperties {
  return hasHangul(text)
    ? { fontFamily: FONT.body, fontStyle: 'normal', fontWeight: 500 }
    : { fontFamily: FONT.english, fontStyle: 'italic', fontWeight: 600 }
}
