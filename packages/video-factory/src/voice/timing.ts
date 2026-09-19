// packages/video-factory/src/voice/timing.ts
//
// **음성의 순수한 부분** — 타입과, manifest 를 설계도에 얹는 함수.
//
// 왜 `edge-tts.ts` 에서 갈라 놓았나 (실측 2026-09-12):
//   `Root.tsx` 는 **브라우저에서 번들된다.** 거기서 `applyVoiceTiming` 하나를 쓰자고
//   `edge-tts.ts` 를 import 했더니 `node:fs` · `node:crypto` 가 같이 끌려와
//   webpack 이 `Can't resolve 'node:fs'` 로 번들을 거부했다.
//   **굽는 쪽(Node)과 그리는 쪽(브라우저)이 같은 파일을 보면 안 된다.**

import type { VideoSpec } from '../spec/types'

export interface WordMark {
  /** 컷 시작으로부터의 초. */
  at: number
  /** 그 낱말이 소리 나는 길이(초). */
  dur: number
  text: string
}

export interface VoiceClip {
  /** `work/voice` 기준 상대 경로. Remotion 이 `staticFile()` 로 읽는다. */
  file: string
  /** 말이 실제로 끝나는 시점(초) — 파일 길이가 아니라 **마지막 낱말의 끝**이다. */
  speechSec: number
  /** 이 컷에 배정할 길이(프레임). */
  frames: number
  words: WordMark[]
}

/** 영상 한 편의 컷별 음성. 키는 컷 인덱스. */
export type VoiceManifest = Record<string, VoiceClip>

/**
 * 구운 음성의 **실측 길이**를 설계도에 반영한다.
 *
 * 음성이 없는 컷은 원래 길이를 그대로 둔다 — 0 으로 만들면 컷이 사라진다.
 */
export function applyVoiceTiming(spec: VideoSpec, manifest: VoiceManifest | null): VideoSpec {
  if (!manifest) return spec
  return {
    ...spec,
    scenes: spec.scenes.map((scene, i) => {
      const clip = manifest[String(i)]
      return clip ? { ...scene, frames: clip.frames } : scene
    }),
  }
}

/** 이 컷이 소리로 읽을 문장. 자막과 다를 수 있다. */
export function narrationOf(scene: VideoSpec['scenes'][number]): string {
  return (scene.narration ?? scene.caption).trim()
}
