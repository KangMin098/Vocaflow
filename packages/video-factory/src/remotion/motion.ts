// packages/video-factory/src/remotion/motion.ts
//
// **모션 한 벌** — 컷마다 각자 애니메이션을 적으면 영상이 들쭉날쭉해진다.
//
// 값은 전부 `spec/timing.ts` 의 `VIDEO_MOTION` 에서 오고, 그 값은 제품 토큰
// (`design-tokens/motion.ts`)과 같은 곡선·같은 시간이다. 영상만 다른 이징을 쓰면
// 광고에서 본 움직임과 제품에서 겪는 움직임이 다른 물건처럼 느껴진다.
//
// **`transform` 과 `opacity` 만 움직인다.** 레이아웃을 건드리는 속성은 프레임마다
// 리플로를 일으키고, 렌더는 프레임을 한 장씩 스크린샷으로 찍으므로 그 비용이 그대로 시간이 된다.

import { interpolate, Easing } from 'remotion'
import { VIDEO_MOTION } from '../spec/timing'

const EASE = Easing.bezier(...VIDEO_MOTION.ease)

export interface EnterExit {
  opacity: number
  /** px. 아래에서 위로 올라온다. */
  y: number
}

/**
 * 컷의 진입·퇴장.
 *
 * @param frame     컷 안에서의 프레임
 * @param duration  컷 전체 길이
 * @param delay     스태거용 지연 프레임
 */
export function enterExit(frame: number, duration: number, delay = 0): EnterExit {
  const f = frame - delay
  const inN = VIDEO_MOTION.enterFrames
  const outN = VIDEO_MOTION.exitFrames
  const opacityIn = interpolate(f, [0, inN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  })
  const opacityOut = interpolate(frame, [duration - outN, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  })
  const y = interpolate(f, [0, inN], [VIDEO_MOTION.revealPx, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  })
  return { opacity: Math.min(opacityIn, opacityOut), y }
}

/** 목록 n번째 항목의 지연 프레임. 항목이 적고 컷이 길 때만 쓴다. */
export function stagger(index: number): number {
  return index * VIDEO_MOTION.staggerFrames
}

/**
 * 컷 길이에 맞춘 스태거 — **항목이 많으면 간격을 줄인다.**
 *
 * 고정 간격은 조용히 항목을 삼킨다. 실측 2026-09-12: 커리큘럼 계단 7단에서 마지막 단의
 * 지연이 48프레임인데 컷이 107프레임뿐이라, **7단이 컷 절반이 지나도록 화면에 없었다.**
 * 오류는 나지 않고 그냥 한 줄이 사라진다 — 그게 이 함수가 있는 이유다.
 *
 * 마지막 항목의 지연이 컷의 `maxShare`(기본 30%)를 넘지 않도록 간격을 눌러 준다.
 */
export function spread(index: number, count: number, duration: number, maxShare = 0.3): number {
  if (count <= 1) return 0
  const budget = duration * maxShare
  const step = Math.min(VIDEO_MOTION.staggerFrames * 4, budget / (count - 1))
  return Math.round(index * step)
}

/** 0→1 진행. 컷 안에서 무언가가 차오를 때 쓴다. */
export function progress(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  })
}

export function transform({ y }: EnterExit): string {
  return `translateY(${y}px)`
}
