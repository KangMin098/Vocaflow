// packages/video-factory/src/remotion/Thumbnail.tsx
//
// **썸네일 — 포스터 프레임과 다른 물건이다.**
//
// 포스터(영상 첫 컷의 한 장)는 **영상 안에서** 읽히도록 만들어졌다. 그런데 YouTube 목록에서
// 썸네일은 **168×94px** 로 줄어든다. 거기서 본문 글자는 한 획도 안 남는다.
// 그래서 썸네일은 따로 그린다 — 규격 1280×720(YouTube 권장), 큰 글자 두 덩어리와 수치 하나.
//
// ── 여기서 지키는 것 ────────────────────────────────────────────
//  · 큰 글자는 **제목 하나뿐**. 두 개를 크게 하면 둘 다 안 읽힌다.
//  · 수치는 **설계도의 근거(`evidence`)에서** 온다 — 썸네일에도 지어낸 숫자를 쓰지 않는다.
//  · 낚시 문구를 만들지 않는다. 제목은 그 구성요소의 실제 이름이다(Calm UI 의 연장).
//  · 밝은 종이 바탕 — 목록에서 어두운 썸네일 사이에 놓이면 오히려 눈에 띈다.

import React from 'react'
import { AbsoluteFill } from 'remotion'

import type { VideoSpec } from '../spec/types'
import { accentColor, accentSoft, FONT, SURFACE } from '../theme/palette'
import { KO, hasHangul } from './Frame'

export const THUMB_WIDTH = 1280
export const THUMB_HEIGHT = 720

export type ThumbnailProps = {
  spec: VideoSpec
  brand: string
}

/** 종류를 한 낱말로 — 목록에서 "이게 무슨 영상인가" 를 먼저 답한다. */
const KIND_CHIP: Record<VideoSpec['kind'], string> = {
  intro: '소개',
  benefit: '왜 다른가',
  curriculum: '커리큘럼',
  series: '시리즈',
  type: '문항 유형',
  module: '학습 활동',
  method: '학습 방법',
  advice: '권장안',
  request: '기획',
}

export const Thumbnail: React.FC<ThumbnailProps> = ({ spec, brand }) => {
  const color = accentColor(spec.accent)
  // 근거가 있으면 **가장 큰 수** 하나를 쓴다 — 작은 수는 썸네일에서 설득력이 없다.
  const headline = [...spec.evidence]
    .map((e) => ({ e, n: Number(e.value.replace(/,/g, '')) }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.e

  const titleKo = hasHangul(spec.title)

  return (
    <AbsoluteFill style={{ backgroundColor: SURFACE.page }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${SURFACE.page} 0%, ${SURFACE.canvas} 100%)`,
        }}
      />
      {/* 왼쪽 굵은 띠 — 작게 줄어도 색은 남는다. 시리즈를 색으로 가르는 축과 같은 색. */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 24, backgroundColor: color }} />

      <AbsoluteFill
        style={{
          padding: '64px 72px 64px 120px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-block',
              fontFamily: FONT.display,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: '0.04em',
              color,
              backgroundColor: accentSoft(spec.accent),
              padding: '10px 22px',
              borderRadius: 10,
              ...KO,
            }}
          >
            {KIND_CHIP[spec.kind]}
          </div>

          <div
            style={{
              marginTop: 28,
              fontFamily: titleKo ? FONT.body : FONT.display,
              fontWeight: 800,
              // 제목이 길면 줄인다 — 두 줄까지가 썸네일에서 읽히는 한계다.
              fontSize: spec.title.length > 14 ? 92 : 118,
              lineHeight: 1.1,
              color: SURFACE.ink,
              ...KO,
            }}
          >
            {spec.title}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 26,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: SURFACE.inkFaint,
            }}
          >
            {brand}
          </div>

          {/* 수치 한 덩어리 — 근거가 없으면 아예 그리지 않는다. */}
          {headline ? (
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 86,
                  lineHeight: 1,
                  color,
                }}
              >
                {headline.value}
              </div>
              <div
                style={{
                  fontFamily: FONT.body,
                  fontSize: 28,
                  color: SURFACE.inkMuted,
                  marginTop: 6,
                  ...KO,
                }}
              >
                {headline.label}
              </div>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
