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
// 승인된 요청 편 — 없으면 ensure.ts 가 빈 배열 파일을 만든다(요청 편은 선택)
import requestSpecsJson from '../../work/request-specs.json'
// 내린 편 — 없으면 번들이 실패한다(빈 목록으로 삼키지 않는다 · requests/retired.ts)
import retiredJson from '../../work/retired.json'
import { mergeSpecs } from '../requests/merge'
import { buildSpecs } from '../catalog/build'
import type { SourceBundle } from '../catalog/bundle'
import type { VideoSpec } from '../spec/types'
import { FORMATS } from '../spec/format'
import { applyVoiceTiming, type VoiceManifest } from '../voice/timing'
import { VideoComposition, specDuration } from './VideoComposition'
import { THUMB_HEIGHT, THUMB_WIDTH, Thumbnail } from './Thumbnail'

const BRAND = 'VOCAFLOW'

const bundle = bundleJson as unknown as SourceBundle
const voices = voiceIndex as unknown as Record<string, VoiceManifest>

/** 규칙 편 + 요청 편 − 내린 편 — CLI 와 같은 합치기(`requests/merge.ts`). */
const specs: VideoSpec[] = mergeSpecs(
  buildSpecs(bundle),
  requestSpecsJson as unknown as VideoSpec[],
  new Set(retiredJson as string[]),
)

export const Root: React.FC = () => (
  <>
    {specs.flatMap((raw) => {
      const voice = voices[raw.id] ?? null
      // 음성을 구웠으면 그 **실측 길이**가 컷 길이다. 안 구웠으면 자막 길이 계산으로 간다.
      const spec = applyVoiceTiming(raw, voice)
      const duration = specDuration(spec)
      const thumb = (
        // 썸네일도 설계도에서 나온다 — 손으로 만들면 62장이 제각각이 되고, 하나 고칠 때마다
        // 62번 고쳐야 한다. 1프레임짜리 컴포지션으로 두면 `renderStill` 이 그려 준다.
        <Composition
          key={`${spec.id}--thumb`}
          id={`${spec.id}--thumb`}
          component={Thumbnail}
          durationInFrames={1}
          fps={30}
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
          defaultProps={{ spec, brand: BRAND }}
        />
      )
      return [
        thumb,
        ...spec.formats.map((format) => {
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
        }),
      ]
    })}
  </>
)
