// apps/web/src/lib/echo/__tests__/dtw-comparator.test.ts
//
// 채점 재설계(2026-07-07) 회귀 고정 — 구 절대값 비교의 구조적 0점 3건이
// 다시 들어오지 못하도록 각 결함을 시나리오로 고정한다.

import { describe, expect, it } from 'vitest'

import { compareContours } from '../dtw-comparator'
import type { PitchContour } from '../pitch-extractor'

const HOP_MS = 32

/** 주파수/에너지 배열로 합성 contour 생성 (frame 간격 32ms) */
function makeContour(
  frequencies: number[],
  energies?: number[],
  opts?: { leadingSilenceMs?: number; trailingSilenceMs?: number },
): PitchContour {
  const lead = Math.round((opts?.leadingSilenceMs ?? 0) / HOP_MS)
  const trail = Math.round((opts?.trailingSilenceMs ?? 0) / HOP_MS)
  const freqs = [
    ...Array.from({ length: lead }, () => 0),
    ...frequencies,
    ...Array.from({ length: trail }, () => 0),
  ]
  const en = [
    ...Array.from({ length: lead }, () => 0.001),
    ...(energies ?? frequencies.map(() => 0.05)),
    ...Array.from({ length: trail }, () => 0.001),
  ]
  return {
    frequencies: freqs,
    energies: en,
    timestamps: freqs.map((_, i) => i * HOP_MS),
    sampleRate: 16000,
    durationMs: freqs.length * HOP_MS,
  }
}

/** 자연스러운 억양 곡선 (여성 화자 ~200Hz 기준, 상승→하강) */
const FEMALE_SHAPE = [180, 190, 205, 220, 235, 225, 210, 195, 185, 175, 170, 165]
/** 같은 '모양'을 남성 기저 피치(~110Hz)로 — 옥타브 아래 동일 억양 */
const MALE_SAME_SHAPE = FEMALE_SHAPE.map((f) => f * 0.55)
/** 다른 모양 (단조 상승) — 같은 화자 대역 */
const FEMALE_DIFFERENT_SHAPE = [165, 170, 178, 186, 195, 204, 214, 224, 233, 240, 248, 255]

describe('compareContours — 재설계 채점', () => {
  it('동일 contour → 3축 모두 만점권', () => {
    const ref = makeContour(FEMALE_SHAPE)
    const s = compareContours(ref, makeContour(FEMALE_SHAPE))
    expect(s.pitch).toBeGreaterThanOrEqual(95)
    expect(s.energy).toBeGreaterThanOrEqual(95)
    expect(s.timing).toBeGreaterThanOrEqual(95)
    expect(s.overall).toBeGreaterThanOrEqual(95)
  })

  it('결함1 고정: 남성 화자가 여성 참조의 억양을 그대로 따라해도 pitch 고득점 (구현 전 0점)', () => {
    const ref = makeContour(FEMALE_SHAPE)
    const s = compareContours(ref, makeContour(MALE_SAME_SHAPE))
    expect(s.pitch).toBeGreaterThanOrEqual(85)
  })

  it('pitch 는 곡선 모양이 다르면 같은 모양보다 낮다 (변별력 보존)', () => {
    const ref = makeContour(FEMALE_SHAPE)
    const same = compareContours(ref, makeContour(MALE_SAME_SHAPE))
    const diff = compareContours(ref, makeContour(FEMALE_DIFFERENT_SHAPE))
    expect(diff.pitch).toBeLessThan(same.pitch)
  })

  it('결함2 고정: 마이크 게인 5배 차이(같은 강세 패턴) → energy 고득점 (구현 전 0점권)', () => {
    const pattern = [0.02, 0.05, 0.09, 0.06, 0.03, 0.07, 0.04, 0.02, 0.05, 0.08, 0.04, 0.02]
    const ref = makeContour(FEMALE_SHAPE, pattern)
    const s = compareContours(ref, makeContour(FEMALE_SHAPE, pattern.map((e) => e * 5)))
    expect(s.energy).toBeGreaterThanOrEqual(90)
  })

  it('결함3 고정: 녹음 앞뒤 무음(머뭇거림+버튼 지연)이 길어도 timing 은 발화 구간만 본다 (구현 전 0점)', () => {
    const ref = makeContour(FEMALE_SHAPE)
    // 발화는 동일, 앞 1.5s + 뒤 3s 무음 — 구 로직은 전체 길이 비율로 0점이었음
    const padded = makeContour(FEMALE_SHAPE, undefined, {
      leadingSilenceMs: 1500,
      trailingSilenceMs: 3000,
    })
    const s = compareContours(ref, padded)
    expect(s.timing).toBeGreaterThanOrEqual(95)
  })

  it('timing 은 발화가 2.5배 이상 느리면 0점 (감점 보존)', () => {
    const ref = makeContour(FEMALE_SHAPE)
    const slow = makeContour(FEMALE_SHAPE.flatMap((f) => [f, f, f]))
    const s = compareContours(ref, slow)
    expect(s.timing).toBeLessThanOrEqual(10)
  })

  it('voiced 프레임 부족(무음 녹음) → 전축 0점', () => {
    const ref = makeContour(FEMALE_SHAPE)
    const silence = makeContour([0, 0, 0, 0, 0, 0])
    expect(compareContours(ref, silence)).toEqual({ pitch: 0, energy: 0, timing: 0, overall: 0 })
  })
})
