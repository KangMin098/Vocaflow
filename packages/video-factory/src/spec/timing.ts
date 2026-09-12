// packages/video-factory/src/spec/timing.ts
//
// **자막·컷 길이를 짐작으로 정하지 않는다.**
//
// 근거 (Netflix Timed Text Style Guide — General Requirements, 2026-09-12 확인):
//   · 한 자막의 **최소 노출 5/6초(0.833s)** · **최대 7초**
//   · 읽기 속도 상한 **성인 17 CPS · 아동물 13 CPS**
// Vocaflow 의 학습자 영상은 초등(V1 소리·운율)까지 내려가므로 **13 CPS 를 바닥으로 쓴다.**
// 광고/쇼츠는 성인 대상이고 스크롤 경쟁이 있으므로 17 CPS 를 허용한다.
//
// ⚠️ 이 값은 *상한*이지 목표가 아니다. 컷이 이 계산보다 짧으면 읽히지 않는다 —
//   `captionFrames()` 가 항상 바닥을 보장하므로 씬이 임의로 더 짧아질 수 없다.

import { FPS } from './format'

export type Audience = 'learner' | 'ad'

/** 초당 읽을 수 있는 글자 수 상한. 출처는 파일 머리말. */
export const CPS: Record<Audience, number> = { learner: 13, ad: 17 }

/** 자막 한 건의 최소/최대 노출(초). Netflix 규격 그대로. */
export const MIN_CAPTION_SEC = 5 / 6
export const MAX_CAPTION_SEC = 7

/**
 * 이 문장을 읽는 데 필요한 프레임 수.
 *
 * 한글은 한 글자의 정보량이 라틴 문자보다 크지만 Netflix 의 CPS 는 **문자 수** 기준이므로
 * 공백을 포함한 길이를 그대로 쓴다(그 규격이 그렇게 측정한다).
 */
export function captionFrames(text: string, audience: Audience = 'learner'): number {
  const seconds = text.length / CPS[audience]
  const clamped = Math.min(MAX_CAPTION_SEC, Math.max(MIN_CAPTION_SEC, seconds))
  return Math.ceil(clamped * FPS)
}

/**
 * 영상 모션 예산 — **화면(UI) 예산과 다른 표다.**
 *
 * CLAUDE.md §모션 예산은 *학습 중 화면*의 규칙이고 "총 1초 초과 금지"가 거기 있다.
 * 영상은 존재 자체가 모션이므로 그 숫자를 그대로 쓰면 아무것도 못 만든다.
 * 대신 **성질**을 물려받는다 — 이징은 같은 곡선, 폭죽·트로피·콘페티 금지,
 * 정지 구간에서는 완전히 정지(perpetual micro-motion 금지).
 */
export const VIDEO_MOTION = {
  /** 씬 진입 페이드/상승. 화면 토큰 `--dur-slow` 300ms 와 같은 값. */
  enterFrames: Math.round(0.3 * FPS),
  /** 씬 퇴장. 진입보다 짧게 — 다음 컷이 기다리게 하지 않는다. */
  exitFrames: Math.round(0.2 * FPS),
  /** 목록 항목 사이 간격. 화면 스태거 50ms 와 같은 값. */
  staggerFrames: Math.max(1, Math.round(0.05 * FPS)),
  /** 리빌 이동 거리(px, wide 기준). 화면 규칙 20–40px 대역 안. */
  revealPx: 28,
  /** 이징 — `packages/design-tokens/src/motion.ts` 의 `easing.default` 와 같은 곡선. */
  ease: [0.4, 0, 0.2, 1] as const,
} as const

export function sec(n: number): number {
  return Math.round(n * FPS)
}
