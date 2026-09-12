// packages/video-factory/src/remotion/Root.tsx
//
// **컴포지션 등록 — 손으로 적지 않는다.**
//
// 설계도(spec) × 규격(format) 의 곱만큼 컴포지션이 자동으로 생긴다. 플랫폼에 시리즈가
// 하나 늘면 여기 아무것도 안 고쳐도 컴포지션이 3개(가로·세로·정사각) 는다.
// 그것이 "영상 몇 편" 이 아니라 "공장" 인 이유다.
//
// ⚠️ 이 파일은 **브라우저에서 실행된다**(Remotion 이 헤드리스 크롬에 띄운다).
//   그래서 `node:fs` 를 쓸 수 없고, 원료는 **번들 시점에 import** 된다.
//   두 JSON 이 없으면 번들이 실패한다 — `src/render/ensure.ts` 가 렌더 전에 만들어 둔다.

import React from 'react'
import { Composition } from 'remotion'

import bundleJson from '../../work/source-bundle.json'
import voiceIndex from '../../work/voice/index.json'
import { buildSpecs } from '../catalog/build'
import type { SourceBundle } from '../catalog/bundle'
import { FORMATS } from '../spec/format'
import { applyVoiceTiming, type VoiceManifest } from '../voice/timing'
import { VideoComposition, specDuration } from './VideoComposition'

const BRAND = 'VOCAFLOW'

const bundle = bundleJson as unknown as SourceBundle
const voices = voiceIndex as unknown as Record<string, VoiceManifest>

export const Root: React.FC = () => (
  <>
    {buildSpecs(bundle).flatMap((raw) => {
      const voice = voices[raw.id] ?? null
      // 음성을 구웠으면 그 **실측 길이**가 컷 길이다. 안 구웠으면 자막 길이 계산으로 간다.
      const spec = applyVoiceTiming(raw, voice)
      const duration = specDuration(spec)
      return spec.formats.map((format) => {
        const def = FORMATS[format]
        return (
          <Composition
            key={`${spec.id}-${format}`}
            id={`${spec.id}--${format}`}
            component={VideoComposition}
            durationInFrames={duration}
            fps={30}
            width={def.width}
            height={def.height}
            defaultProps={{ spec, format, voice, brand: BRAND }}
          />
        )
      })
    })}
  </>
)
