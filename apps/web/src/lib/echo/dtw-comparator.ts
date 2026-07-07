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

// ── 보정 상수 (2026-07-07 재설계 — 구 절대값 비교의 구조적 0점 해소) ──
// pitch: 화자 평균 제거 후 semitone 편차 — 자연 억양 기복이 ±3~6st 이므로
//        DTW 평균 5st 편차에서 0점 (동일 곡선 ~0.5st → 90+)
const PITCH_THRESHOLD_ST = 5
// energy: 시퀀스별 피크 정규화(0..1) 후 상대 강세 패턴 차이 — 0.4 평균차에서 0점
const ENERGY_THRESHOLD_REL = 0.4
// timing: voiced 발화 길이 로그 비율 — 2.5배(또는 1/2.5) 에서 0점, 1.25배 ≈ 76점
const TIMING_LOG_MAX = Math.log(2.5)

/** Hz → semitone (임의 기준음 대비) — 화자 기저 피치와 무관한 '모양' 비교용 */
function toSemitones(frequencies: number[]): number[] {
  return frequencies.map((f) => 12 * Math.log2(f / 100))
}

/** 시퀀스 평균을 0 으로 센터링 — 남/녀/저음/고음 화자 차이 제거 */
function meanCenter(values: number[]): number[] {
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return values.map((v) => v - mean)
}

/** 시퀀스 피크 기준 0..1 정규화 — 마이크 게인/거리 차이 제거 */
function peakNormalize(values: number[]): number[] {
  const peak = Math.max(...values, 1e-6)
  return values.map((v) => v / peak)
}

/** voiced 구간 실제 발화 길이 (앞뒤 무음 트리밍) — 수동 정지 녹음의 무음 꼬리 제거 */
function voicedDurationMs(timestamps: number[]): number {
  if (timestamps.length < 2) return 0
  return timestamps[timestamps.length - 1]! - timestamps[0]!
}

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

  // 1. Pitch — semitone 변환 + 화자 평균 제거 후 곡선 '모양' DTW
  //    (구: 절대 Hz 비교 → 여성 참조음성 vs 남성 화자가 평균차만으로 0점이 되는 결함)
  const refShape = meanCenter(toSemitones(refV.frequencies))
  const userShape = meanCenter(toSemitones(userV.frequencies))
  const pitchDtw = new DynamicTimeWarping(
    refShape,
    userShape,
    (a: number, b: number) => Math.abs(a - b),
  )
  const pitchAvg = pitchDtw.getDistance() / pitchDtw.getPath().length
  const pitchScore = Math.max(0, Math.min(100, 100 * (1 - pitchAvg / PITCH_THRESHOLD_ST)))

  // 2. Energy — 피크 정규화 후 상대 강세 패턴 DTW
  //    (구: 절대 RMS 비교 → 점수가 발음이 아닌 마이크 볼륨에 좌우되는 결함)
  const refEnergy = peakNormalize(refV.energies)
  const userEnergy = peakNormalize(userV.energies)
  const energyDtw = new DynamicTimeWarping(
    refEnergy,
    userEnergy,
    (a: number, b: number) => Math.abs(a - b),
  )
  const energyAvg = energyDtw.getDistance() / energyDtw.getPath().length
  const energyScore = Math.max(0, Math.min(100, 100 * (1 - energyAvg / ENERGY_THRESHOLD_REL)))

  // 3. Timing — voiced 발화 길이의 로그 비율 (빠름/느림 대칭 감점)
  //    (구: 무음 포함 전체 녹음 길이 비율 → 버튼 누르기까지의 침묵이 리듬 0점을 만들던 결함)
  const refDur = Math.max(voicedDurationMs(refV.timestamps), 1)
  const userDur = Math.max(voicedDurationMs(userV.timestamps), 1)
  const logDelta = Math.abs(Math.log(userDur / refDur))
  const timingScore = Math.max(0, Math.min(100, 100 * (1 - logDelta / TIMING_LOG_MAX)))

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
