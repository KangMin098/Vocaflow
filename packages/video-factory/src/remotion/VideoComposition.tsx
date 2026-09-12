// packages/video-factory/src/remotion/VideoComposition.tsx
//
// **설계도 한 편 → 화면.** 컷을 순서대로 놓고, 각 컷에 나레이션을 얹는다.
//
// 여기가 엔진 어댑터다 — 위쪽(`spec/`, `catalog/`)에는 Remotion 이 한 글자도 없고,
// 아래쪽(`scenes/`)은 그리기만 한다. 렌더러를 바꾼다면 **이 파일과 scenes 만** 다시 쓴다.

import React from 'react'
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion'

import type { FormatId } from '../spec/format'
import { sceneFrames } from '../spec/validate'
import type { SceneSpec, VideoSpec } from '../spec/types'
import type { VoiceManifest } from '../voice/timing'
import { Frame, FormatContext } from './Frame'
import { Coverage, Decay, Item } from './scenes/proof'
import { Ladder, Shelf, Stat } from './scenes/data'
import { Closing, Hook, Statement } from './scenes/text'

export type VideoCompositionProps = {
  spec: VideoSpec
  format: FormatId
  /** 구운 나레이션. 없으면 **무음으로 렌더된다** — 자막이 있으므로 내용은 전달된다. */
  voice: VoiceManifest | null
  brand: string
}

/**
 * 자막을 깔 것인가.
 *
 * 여는 컷·닫는 컷은 **그 문장 자체가 화면 한복판에 크게 떠 있다.** 같은 말을 아래에 또 깔면
 * 한 화면에 같은 문장이 두 번 있는 꼴이라 시선이 갈라진다(실측 2026-09-12 스틸).
 * 접근성 목적(소리를 꺼도 전달)은 큰 글씨가 이미 달성하므로 중복만 걷어낸다.
 */
function captionFor(scene: SceneSpec): string {
  if (scene.kind === 'hook' && scene.caption.includes(scene.line)) return ''
  if (scene.kind === 'closing' && scene.caption.includes(scene.line)) return ''
  return scene.caption
}

function SceneBody({
  scene,
  accent,
  duration,
}: {
  scene: SceneSpec
  accent: VideoSpec['accent']
  duration: number
}): React.ReactElement {
  switch (scene.kind) {
    case 'hook':
      return <Hook scene={scene} accent={accent} duration={duration} />
    case 'statement':
      return <Statement scene={scene} accent={accent} duration={duration} />
    case 'closing':
      return <Closing scene={scene} accent={accent} duration={duration} />
    case 'coverage':
      return <Coverage scene={scene} accent={accent} duration={duration} />
    case 'decay':
      return <Decay scene={scene} accent={accent} duration={duration} />
    case 'item':
      return <Item scene={scene} accent={accent} duration={duration} />
    case 'stat':
      return <Stat scene={scene} accent={accent} duration={duration} />
    case 'ladder':
      return <Ladder scene={scene} accent={accent} duration={duration} />
    case 'shelf':
      return <Shelf scene={scene} accent={accent} duration={duration} />
  }
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  spec,
  format,
  voice,
  brand,
}) => {
  const durations = spec.scenes.map((s) => sceneFrames(s, spec.audience))
  const total = durations.reduce((a, b) => a + b, 0)

  let at = 0
  const placed = spec.scenes.map((scene, i) => {
    const from = at
    const duration = durations[i]!
    at += duration
    return { scene, i, from, duration }
  })

  return (
    <FormatContext.Provider value={format}>
      <AbsoluteFill>
        {placed.map(({ scene, i, from, duration }) => {
          const clip = voice?.[String(i)]
          return (
            <Sequence key={i} from={from} durationInFrames={duration} name={`${i}-${scene.kind}`}>
              {/*
                진행 실선은 **영상 전체**에서의 위치여야 한다. 컷 안의 진행으로 그리면
                컷마다 0 에서 다시 차올라 "얼마나 남았나" 를 못 말한다.
              */}
              <Frame
                format={format}
                accent={spec.accent}
                caption={captionFor(scene)}
                overallProgress={total > 0 ? (from + duration / 2) / total : 0}
                brand={brand}
              >
                <SceneBody scene={scene} accent={spec.accent} duration={duration} />
              </Frame>
              {clip ? <Audio src={staticFile(`voice/${clip.file}`)} /> : null}
            </Sequence>
          )
        })}
      </AbsoluteFill>
    </FormatContext.Provider>
  )
}

/** 이 설계도의 총 길이(프레임). 컴포지션 등록과 렌더가 같은 값을 써야 한다. */
export function specDuration(spec: VideoSpec): number {
  return spec.scenes.reduce((sum, s) => sum + sceneFrames(s, spec.audience), 0)
}
