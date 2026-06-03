// apps/web/src/lib/echo/dtw-comparator.ts
//
// EchoMatch Layer 4 — DTW 비교 + 3축 점수 산출.
// pitch (40%) + energy (30%) + timing (30%) 가중평균 → 0-100 점.

import DynamicTimeWarping from 'dynamic-time-warping-ts'

import { voicedFrames, type PitchContour } from './pitch-extractor'

export interface ComparisonScore {
  /** 인토네이션 정합 (피치 contour) 0-100 */
  pitch: number
  /** 강세 정합 (RMS energy) 0-100 */
  energy: number
  /** 리듬 정합 (시간축 alignment) 0-100 */
  timing: number
  /** 가중평균 0-100 */
  overall: number
}

const PITCH_THRESHOLD = 80 // Hz 평균 차이 (PoC 후 보정)
const ENERGY_THRESHOLD = 0.08 // RMS 평균 차이
const MAX_DURATION_RATIO = 2.5 // user/reference 비율 max

export function compareContours(
  reference: PitchContour,
  user: PitchContour,
): ComparisonScore {
  const refV = voicedFrames(reference)
  const userV = voicedFrames(user)

  // 빈 voiced — 점수 0
  if (refV.frequencies.length < 4 || userV.frequencies.length < 4) {
    return { pitch: 0, energy: 0, timing: 0, overall: 0 }
  }

  // 1. Pitch DTW (Hz)
  const pitchDtw = new DynamicTimeWarping(
    refV.frequencies,
    userV.frequencies,
    (a: number, b: number) => Math.abs(a - b),
  )
  const pitchAvg = pitchDtw.getDistance() / pitchDtw.getPath().length
  const pitchScore = Math.max(0, Math.min(100, 100 * (1 - pitchAvg / PITCH_THRESHOLD)))

  // 2. Energy DTW
  const energyDtw = new DynamicTimeWarping(
    refV.energies,
    userV.energies,
    (a: number, b: number) => Math.abs(a - b),
  )
  const energyAvg = energyDtw.getDistance() / energyDtw.getPath().length
  const energyScore = Math.max(0, Math.min(100, 100 * (1 - energyAvg / ENERGY_THRESHOLD)))

  // 3. Timing — 길이 비율 정합 (1.0 에 가까울수록 좋음)
  const ratio = user.durationMs / Math.max(reference.durationMs, 1)
  const ratioDelta = Math.abs(1 - ratio)
  const timingScore = Math.max(
    0,
    Math.min(100, 100 * (1 - ratioDelta / (MAX_DURATION_RATIO - 1))),
  )

  // 4. 가중평균 (spec: pitch 40% · energy 30% · timing 30%)
  const overall = Math.round(pitchScore * 0.4 + energyScore * 0.3 + timingScore * 0.3)

  return {
    pitch: Math.round(pitchScore),
    energy: Math.round(energyScore),
    timing: Math.round(timingScore),
    overall,
  }
}

/** 점수에 따른 격려 메시지 (CLAUDE.md Empathetic Feedback 정합) */
export function scoreFeedback(overall: number): { label: string; tone: 'great' | 'good' | 'fair' | 'try' } {
  if (overall >= 90) return { label: '훌륭해요! 원어민에 가까워요', tone: 'great' }
  if (overall >= 70) return { label: '좋아요! 자연스러운 발화예요', tone: 'good' }
  if (overall >= 50) return { label: 'Good start! 다시 시도해볼까요?', tone: 'fair' }
  return { label: '천천히, 다시 들어보고 따라해봐요', tone: 'try' }
}
