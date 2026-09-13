// packages/video-factory/src/remotion/scenes/progression.tsx
//
// **나아가는 차례** — 단어 하나가 거치는 자리들이 아래에서 위로 하나씩 켜진다.
//
// ── 왜 `Ladder` 를 재사용하지 않았나 ────────────────────────────────
// 겉모습이 비슷해서 한 컴포넌트로 묶고 싶어지는데, **말하는 것이 다르다.**
// 계단(`Ladder`)은 단마다 **재고 막대**를 그린다 — 그게 그 컷의 본론이다. 단계에는 재고가 없다.
// 막대를 붙이면 길이가 곧 뜻이 되어 "Applied 가 Recalled 보다 많다" 는, 아무도 하지 않은 말이
// 화면에 생긴다. 프레임워크 정본(`axes.ts`)이 **Stage 는 학습자 등급이 아니라 단어 상태**라고
// 못 박은 것과 정면으로 어긋난다. 그래서 막대 없이 **순서와 조건**만 그린다.
//
// ── 세로 규격에서 ───────────────────────────────────────────────────
// 자리가 5개라 세로(1080×1920)에서는 넉넉하지만, `says` 는 긴 글이므로 `prose` 배율을 쓴다
// (`typeScale` 과 방향이 반대다 — 세로에서 긴 글은 **작아져야** 한 줄에 들어간다).

import React from 'react'

import type { AccentKey, ProgressionScene } from '../../spec/types'
import { proseColumnWidth } from '../../spec/layout'
import { ACCENT, FONT, SURFACE } from '../../theme/palette'
import { enterExit, spread, transform } from '../motion'
import { KO, useFormat } from '../Frame'

export const Progression: React.FC<{
  scene: ProgressionScene
  accent: AccentKey
  duration: number
}> = ({ scene, accent, duration }) => {
  const { format, scale, prose, frame } = useFormat()
  // 「지금 여기」로 표시된 자리가 있는가. 없으면 아무 데도 흐리지 않는다(총론).
  const anyNow = scene.steps.some((s) => s.now)

  return (
    <div
      style={{
        display: 'flex',
        // 아래에서 위로 오른다 — 사다리와 같은 방향이어야 두 컷이 한 영상에 있어도 안 헷갈린다.
        flexDirection: 'column-reverse',
        gap: Math.round(14 * scale),
        // **실제 글 폭에 맞춰 가운데로 모은다.**
        //
        // 가로(1920)에서 왼쪽에 붙여 두면 오른쪽 3분의 2가 빈 채로 남아 미완성으로 읽힌다
        // (실측 2026-09-13 첫 스틸). 그런데 폭을 고정하고 가운데 두는 것만으로는 **부족했다** —
        // 상자만 가운데로 가고 글은 그 안에서 왼쪽에 붙어, 눈에는 여전히 왼쪽으로 쏠려 보였다
        // (두 번째 스틸). 그래서 상자를 **글 폭만큼만** 잡고(fit-content) 그것을 가운데 둔다.
        // 상한은 `proseColumnWidth` — 가용 폭을 다 쓰면 한 줄이 1,700px 라 눈이 다음 줄 머리를 못 찾는다.
        width: 'fit-content',
        maxWidth: proseColumnWidth(format),
        alignSelf: 'center',
      }}
    >
      {scene.steps.map((s, i) => {
        // 간격을 컷 길이에 맞춰 누른다 — 고정 간격은 마지막 자리를 삼킨다
        // (실측 2026-09-12: 107프레임 컷에서 48프레임 스태거 때문에 7번째 단이 안 보였다).
        const delay = spread(i, scene.steps.length, duration)
        const e = enterExit(frame, duration, delay)
        const dim = anyNow && !s.now

        return (
          <div
            key={s.code}
            style={{
              opacity: e.opacity * (dim ? 0.4 : 1),
              transform: transform(e),
              display: 'flex',
              alignItems: 'flex-start',
              gap: Math.round(18 * scale),
            }}
          >
            {/* 코드 — 좁은 자리에서 이름 대신 읽히는 안정 라벨. 한 줄 고정. */}
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: Math.round(20 * scale),
                color: SURFACE.inkFaint,
                width: Math.round(52 * scale),
                flexShrink: 0,
                paddingTop: Math.round(8 * scale),
                whiteSpace: 'nowrap',
              }}
            >
              {s.code}
            </div>

            {/* 「지금 여기」 표시는 색 **하나로만** 하지 않는다 — 색맹 대응(CLAUDE.md).
                채워진 점 vs 테두리 점으로 모양이 함께 갈린다. */}
            <div
              style={{
                width: Math.round(16 * scale),
                height: Math.round(16 * scale),
                borderRadius: '50%',
                flexShrink: 0,
                marginTop: Math.round(12 * scale),
                backgroundColor: s.now ? ACCENT[accent] : 'transparent',
                border: `${Math.max(2, Math.round(2 * scale))}px solid ${
                  s.now ? ACCENT[accent] : SURFACE.border
                }`,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: Math.round(34 * scale),
                  fontWeight: 600,
                  color: s.now ? ACCENT[accent] : SURFACE.ink,
                  lineHeight: 1.15,
                }}
              >
                {s.name}
              </div>
              <div
                style={{
                  ...KO,
                  fontFamily: FONT.body,
                  fontSize: Math.round(23 * prose),
                  color: SURFACE.inkMuted,
                  lineHeight: 1.45,
                  marginTop: Math.round(4 * scale),
                }}
              >
                {s.says}
              </div>
              {/* 조건이 **없는** 자리(첫 자리)는 줄 자체를 그리지 않는다 —
                  빈 줄을 남기면 "조건이 있는데 안 적혔다" 로 읽힌다. */}
              {s.by !== null && (
                <div
                  style={{
                    ...KO,
                    fontFamily: FONT.mono,
                    fontSize: Math.round(19 * prose),
                    color: SURFACE.inkFaint,
                    marginTop: Math.round(5 * scale),
                  }}
                >
                  ↑ {s.by}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
