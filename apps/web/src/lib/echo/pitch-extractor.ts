// apps/web/src/lib/echo/pitch-extractor.ts
//
// EchoMatch Layer 2 — 피치 추출 (YIN 알고리즘 wrapper).
// frame-by-frame pitch (Hz) + energy (RMS) contour 생성.

import { YIN } from 'pitchfinder'

export interface PitchContour {
  /** Hz — 0 은 unvoiced (무성 구간) */
  frequencies: number[]
  /** RMS energy 0..1 */
  energies: number[]
  /** 각 frame 의 시작 시간 (ms) */
  timestamps: number[]
  sampleRate: number
  /** 전체 길이 ms */
  durationMs: number
}

const FRAME_SIZE = 2048
const HOP_SIZE = 512

export function extractPitchContour(audioBuffer: AudioBuffer): PitchContour {
  const detectPitch = YIN({ sampleRate: audioBuffer.sampleRate })
  const data = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  const frequencies: number[] = []
  const energies: number[] = []
  const timestamps: number[] = []

  for (let i = 0; i + FRAME_SIZE < data.length; i += HOP_SIZE) {
    const frame = data.slice(i, i + FRAME_SIZE)
    const pitch = detectPitch(frame as Float32Array) ?? null

    let sumSq = 0
    for (let j = 0; j < frame.length; j++) sumSq += frame[j]! * frame[j]!
    const rms = Math.sqrt(sumSq / frame.length)

    frequencies.push(pitch ?? 0)
    energies.push(rms)
    timestamps.push((i / sampleRate) * 1000)
  }

  return {
    frequencies,
    energies,
    timestamps,
    sampleRate,
    durationMs: (data.length / sampleRate) * 1000,
  }
}

/** voiced frames 만 추출 (피치 있는 frame). */
export function voicedFrames(contour: PitchContour): {
  frequencies: number[]
  energies: number[]
  timestamps: number[]
} {
  const frequencies: number[] = []
  const energies: number[] = []
  const timestamps: number[] = []
  for (let i = 0; i < contour.frequencies.length; i++) {
    const f = contour.frequencies[i]!
    if (f > 50 && f < 800) {
      frequencies.push(f)
      energies.push(contour.energies[i]!)
      timestamps.push(contour.timestamps[i]!)
    }
  }
  return { frequencies, energies, timestamps }
}
