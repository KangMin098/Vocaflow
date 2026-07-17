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

/** 점수에 따른 격려 메시지 (CLAUDE.md Empathetic Feedback 정합)
 *  주의: 채점은 '억양·강세·리듬(프로소디) 모양'의 정합이지 발음/단어 정확도가 아님 →
 *  문구를 '원어민' 단정 대신 '또박또박 따라했다'(TTS 기준 정직) 로 완화. */
export function scoreFeedback(overall: number): { label: string; tone: 'great' | 'good' | 'fair' | 'try' } {
  if (overall >= 90) return { label: '훌륭해요! 억양·리듬이 아주 잘 맞았어요', tone: 'great' }
  if (overall >= 70) return { label: '좋아요! 자연스러운 억양이에요', tone: 'good' }
  if (overall >= 50) return { label: 'Good start! 다시 한 번 따라해볼까요?', tone: 'fair' }
  return { label: '천천히, 다시 들어보고 따라해봐요', tone: 'try' }
}

// ── 구간 divergence (시각화 피드백 — '어디서 억양이 달라졌나') ──────────────
export interface DivergenceRegion {
  /** 0..1 — 시각화 시간축 시작 */
  startPct: number
  /** 0..1 — 시각화 시간축 끝 */
  endPct: number
}

const DIVERGENCE_BINS = 24
// 한 구간(bin)에서 mean-centered semitone 평균이 이만큼 이상 벌어지면 '달라진 곳' 표시.
//   compareContours 의 PITCH_THRESHOLD_ST(5=0점) 보다 낮게 — 시각 지목은 더 민감하게.
const DIVERGENCE_ST = 3

/** frequencies → {정규화시간, mean-centered semitone} (voiced 만). compareContours 와 동일 규칙. */
function shapeByTime(contour: PitchContour, maxDurMs: number): Array<{ t: number; v: number }> {
  const pts: Array<{ t: number; v: number }> = []
  for (let i = 0; i < contour.frequencies.length; i++) {
    const f = contour.frequencies[i]!
    if (f > 50 && f < 800) pts.push({ t: contour.timestamps[i]! / maxDurMs, v: 12 * Math.log2(f / 100) })
  }
  if (pts.length === 0) return pts
  const mean = pts.reduce((s, p) => s + p.v, 0) / pts.length
  for (const p of pts) p.v -= mean
  return pts
}

/**
 * 참조↔사용자 억양이 크게 벌어진 시간 구간(0..1) 목록.
 * PitchVisualizer 음영용 — "어디서 달라졌는지" 지목(행동 가능 피드백).
 * 양쪽 다 발화가 있는 구간에서 mean-centered semitone 평균차 ≥ DIVERGENCE_ST 만 표시
 * (길이 차이는 timing 점수가 담당하므로 한쪽만 발화한 구간은 표시 안 함 — 과표시 방지).
 */
export function divergenceRegions(
  reference: PitchContour,
  user: PitchContour,
  bins = DIVERGENCE_BINS,
): DivergenceRegion[] {
  const maxDur = Math.max(reference.durationMs, user.durationMs, 1)
  const refS = shapeByTime(reference, maxDur)
  const userS = shapeByTime(user, maxDur)
  if (refS.length < 2 || userS.length < 2) return []

  const binMean = (arr: Array<{ t: number; v: number }>, b: number): number | null => {
    const lo = b / bins
    const hi = (b + 1) / bins
    let sum = 0
    let n = 0
    for (const p of arr) {
      if (p.t >= lo && p.t < hi) {
        sum += p.v
        n += 1
      }
    }
    return n > 0 ? sum / n : null
  }

  const diverged: boolean[] = []
  for (let b = 0; b < bins; b++) {
    const r = binMean(refS, b)
    const u = binMean(userS, b)
    diverged.push(r != null && u != null && Math.abs(r - u) >= DIVERGENCE_ST)
  }

  // 연속 구간 병합
  const regions: DivergenceRegion[] = []
  let start = -1
  for (let b = 0; b <= bins; b++) {
    if (b < bins && diverged[b]) {
      if (start < 0) start = b
    } else if (start >= 0) {
      regions.push({ startPct: start / bins, endPct: b / bins })
      start = -1
    }
  }
  return regions
}
