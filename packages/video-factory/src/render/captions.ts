// packages/video-factory/src/render/captions.ts
//
// **WebVTT 자막 — 영상에 구워 넣은 자막과 별개로 파일로도 낸다.**
//
// 왜 둘 다 하나:
//   · 구워 넣은 자막은 **소리를 끈 사람**에게 닿는다(피드에서 대부분이 그렇다).
//   · VTT 파일은 **화면 낭독기·검색엔진·YouTube**에 닿는다. 구운 픽셀은 기계가 못 읽는다.
// YouTube 는 업로드 시 이 파일을 그대로 받는다 — 자동 자막보다 정확하다.
//
// 타이밍은 짐작이 아니다: 컷 경계는 **음성 실측 길이**에서 오고,
// 낱말 단위 눈금(`VoiceClip.words`)이 있으면 그것도 쓸 수 있다.

import { FPS } from '../spec/format'
import { CPS } from '../spec/timing'
import { sceneFrames } from '../spec/validate'
import type { VideoSpec } from '../spec/types'
import type { VoiceManifest } from '../voice/timing'
import { splitCaption, type Cue } from './cue'

function stamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`
}

/**
 * 이 편의 자막 큐 전부 — **평가(`spec/evaluate.ts`)가 재는 것과 같은 값**이다.
 *
 * ⚠️ 예전에는 **컷 하나 = 큐 하나**였고, 주석에 "낱말 단위로 쪼개면 읽기가 더 어렵다" 고
 *   적혀 있었다. 그 말 자체는 맞지만 결론이 틀렸다 — 쪼개지 않는 것과 **7초 넘게 한 건을
 *   띄워 두는 것**은 다른 문제다. 컷 길이는 나레이션 실측이 정하므로 말이 길면 큐도 길어졌고,
 *   실측 2026-09-13 에 **269컷 중 15컷이 7초를 넘었다**(최대 8.1초).
 *   Netflix 규격의 상한이고, 넘으면 시청자가 다 읽고 같은 글을 다시 읽기 시작한다.
 *
 *   그래서 **문장 단위는 유지하되, 상한을 넘는 큐만 낱말 경계에서 나눈다.**
 *   나누는 자리는 Edge TTS 의 낱말 눈금이 정한다 — 말이 실제로 끊기는 자리다.
 */
export function cuesOf(spec: VideoSpec, voice: VoiceManifest | null): Cue[] {
  const out: Cue[] = []
  let at = 0
  spec.scenes.forEach((scene, i) => {
    const clip = voice?.[String(i)]
    const frames = clip?.frames ?? sceneFrames(scene, spec.audience)
    const start = at / FPS
    const sec = frames / FPS
    at += frames
    if (scene.caption.trim() === '') return
    out.push(...splitCaption(scene.caption, start, sec, CPS[spec.audience], clip?.words))
  })
  return out
}

export function toWebVtt(spec: VideoSpec, voice: VoiceManifest | null): string {
  const lines: string[] = ['WEBVTT', '']
  cuesOf(spec, voice).forEach((c, i) => {
    lines.push(`${i + 1}`)
    lines.push(`${stamp(c.start)} --> ${stamp(c.end)}`)
    lines.push(c.text)
    lines.push('')
  })
  return lines.join('\n')
}

/**
 * 영상 설명글 — YouTube 설명란과 `<meta>` 에 그대로 쓴다.
 *
 * **근거를 빼지 않는다.** 광고로 쓰는 영상이라 수치가 어디서 왔는지 적어야 하고,
 * 그건 설명란이 가장 적당한 자리다.
 */
export function toDescription(spec: VideoSpec): string {
  const out: string[] = [spec.subtitle, '']
  for (const scene of spec.scenes) {
    if (scene.kind === 'closing') out.push(`→ ${scene.cta} · ${scene.url}`)
  }
  if (spec.evidence.length > 0) {
    out.push('', '─ 근거 ─')
    for (const e of spec.evidence) out.push(`${e.label} ${e.value} — ${e.source}`)
  }
  return out.join('\n').trim() + '\n'
}

/** 포스터로 쓸 프레임 — **첫 프레임은 페이드 중이라 비어 있다.** 첫 컷의 70% 지점을 쓴다. */
export function posterFrame(spec: VideoSpec, voice: VoiceManifest | null): number {
  const first = spec.scenes[0]
  if (!first) return 0
  const frames = voice?.['0']?.frames ?? sceneFrames(first, spec.audience)
  return Math.floor(frames * 0.7)
}
