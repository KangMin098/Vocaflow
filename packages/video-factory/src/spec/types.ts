// packages/video-factory/src/spec/types.ts
//
// **영상 설계도 — 엔진 중립.**
//
// 여기에는 Remotion 이 한 글자도 안 나온다. 그래야 렌더러를 바꿀 때 설계도가 살아남는다
// (사용자 요구: "혹시 remotion 보다 좋은 도구 있으면 그것으로").
// Remotion 은 `src/remotion/` 에서 이 타입을 **읽기만** 하는 어댑터다.
//
// ── 타입이 강제하는 품질 ──────────────────────────────────────────
//  · 모든 컷은 `caption` 을 갖는다 → 자막 없는 영상을 **만들 수가 없다**(접근성).
//  · 모든 수치는 `Evidence.source` 를 갖는다 → 근거 없는 숫자를 넣을 자리가 없다(CLAUDE.md I5).
//  · 색은 토큰 키만 받는다 → 하드코딩 색이 들어올 자리가 없다.

import type { Audience } from './timing'
import type { FormatId } from './format'

/* ───────────────────────── 근거 ───────────────────────── */

/**
 * 화면에 나오는 수치 하나와 **그 수치가 어디서 왔는지.**
 *
 * `source` 가 빈 문자열이면 빌드가 막힌다(`assertSpec`). 광고에 쓰는 영상이므로
 * 근거 없는 수치는 표시광고법 리스크다 — 이 저장소가 공개 화면에 세워 둔 규칙과 같은 줄이다.
 */
export interface Evidence {
  label: string
  value: string
  /** 예: `textbook_shelf_inventory() 2026-09-08 실측` · `Hu & Nation (2000)` */
  source: string
}

/* ───────────────────────── 컷 ───────────────────────── */

export interface SceneBase {
  /** 화면 아래 자막. **모든 컷의 필수 항목** — 소리를 끄고 봐도 내용이 전달돼야 한다. */
  caption: string
  /**
   * 소리로 읽을 문장. 생략하면 `caption` 을 읽는다.
   *
   * 자막과 따로 두는 이유: 자막은 **읽기** 좋아야 하고 나레이션은 **들리기** 좋아야 한다.
   * 예를 들어 `49,244` 는 자막에선 숫자가 낫고 소리로는 "사만 구천이백사십사" 가 낫다.
   */
  narration?: string
  /**
   * 컷 길이(프레임).
   *
   * 우선순위: **음성 실측 > 여기 적은 값 > 자막 길이 계산**.
   * 음성을 구운 뒤에는 `applyVoiceTiming()` 이 이 값을 실측으로 덮는다 —
   * 짐작한 길이로 자르면 문장이 끊긴다.
   */
  frames?: number
}

/** 여는 물음 한 줄. Lora italic — 사람이 말하는 자리(철학 3). */
export interface HookScene extends SceneBase {
  kind: 'hook'
  line: string
  sub?: string
}

/** 지문 한 낱말. `known` 이 채색을 가른다. */
export interface PassageToken {
  text: string
  known: boolean
  /** 공백·문장부호처럼 채색 대상이 아닌 조각. */
  plain?: boolean
}

/**
 * **커버리지 증명** — 이 제품의 주장이 눈에 보이는 유일한 컷.
 * 지문 위로 아는 낱말이 차례로 칠해지고 비율이 올라간다(디자인 렌즈 2 "지문이 곧 인터페이스").
 */
export interface CoverageScene extends SceneBase {
  kind: 'coverage'
  tokens: PassageToken[]
  /** 최종 커버리지 0~1. 토큰에서 계산된 값이어야 한다 — 따로 적지 않는다. */
  label: string
}

/**
 * **망각 곡선** — `R(t) = exp(ln(0.9)·t/S)`. 경쟁사 화면에 없는 곡선(디자인 렌즈 1).
 * 색은 Memory Decay 4색 규칙을 그대로 따른다(stable/shaky/risk).
 */
export interface DecayScene extends SceneBase {
  kind: 'decay'
  /** 안정도 S(일). FSRS 상태에서 온 값. */
  stability: number
  /** 곡선을 몇 일까지 그릴지. */
  days: number
  label: string
}

export interface LadderRung {
  step: number
  schoolBand: string
  title: string
  /** 그 단의 재고(문항 수). 못 쟀으면 null — 0 과 구분한다. */
  items: number | null
}

/** **커리큘럼 계단** — 7단이 아래에서 위로 차오른다(철학 4 Implicit Progress). */
export interface LadderScene extends SceneBase {
  kind: 'ladder'
  rungs: LadderRung[]
  /** 강조할 단. 없으면 전체를 고르게 보여준다. */
  highlightStep?: number
}

export interface ShelfVolume {
  title: string
  /** 'published' | 'ready' | 'pending' — 서가에서 꽂힘/비침을 가른다. */
  state: 'published' | 'ready' | 'pending'
}

/** **서가** — 권이 하나씩 꽂힌다. 브랜드 시리즈 영상의 본론. */
export interface ShelfScene extends SceneBase {
  kind: 'shelf'
  volumes: ShelfVolume[]
}

export interface ItemSample {
  /** 문항 지시문. */
  prompt: string
  /** 보기. 비어 있으면 단답형으로 그린다. */
  choices: string[]
  /** 정답 인덱스(객관식) 또는 정답 문자열(단답). */
  answer: number | string
}

/** **문항 한 개가 풀리는 장면** — 유형별 교재 영상의 본론. */
export interface ItemScene extends SceneBase {
  kind: 'item'
  typeCode: string
  typeLabel: string
  says: string
  sample: ItemSample
}

export interface StatLine {
  value: string
  label: string
  source: string
}

/** 실측 수치 몇 줄. 카운트업은 tabular-nums, 말을 얹지 않는다(§6). */
export interface StatScene extends SceneBase {
  kind: 'stat'
  stats: StatLine[]
}

/** 장점 한 개 — 제목 · 본문 · **근거**. 근거 없는 항목은 만들 수 없다. */
export interface StatementScene extends SceneBase {
  kind: 'statement'
  title: string
  body: string
  basis: string
}

/** 닫는 컷 — 다음 한 걸음(D5). 폭죽·트로피 없음. */
export interface ClosingScene extends SceneBase {
  kind: 'closing'
  line: string
  cta: string
  url: string
}

export type SceneSpec =
  | HookScene
  | CoverageScene
  | DecayScene
  | LadderScene
  | ShelfScene
  | ItemScene
  | StatScene
  | StatementScene
  | ClosingScene

export type SceneKind = SceneSpec['kind']

/* ───────────────────────── 영상 ───────────────────────── */

export type VideoKind =
  /** 플랫폼 소개 */
  | 'intro'
  /** 플랫폼 장점 1개 */
  | 'benefit'
  /** 커리큘럼 */
  | 'curriculum'
  /** 브랜드 시리즈 1개 */
  | 'series'
  /** 문항 유형 1개 */
  | 'type'
  /** 학습 모듈 1개 */
  | 'module'

export interface VideoSpec {
  /** 파일명이자 컴포지션 id. `<kind>-<slug>`. */
  id: string
  kind: VideoKind
  audience: Audience
  title: string
  /** 한 줄 부제 — 90자 이내(CLAUDE.md I4 와 같은 바닥). */
  subtitle: string
  /** 강조색 — `theme/palette.ts` 의 키만 받는다. 원시 hex 금지. */
  accent: AccentKey
  scenes: SceneSpec[]
  evidence: Evidence[]
  formats: FormatId[]
}

/** 쓸 수 있는 강조색 — 디자인 토큰에 실재하는 것만. */
export type AccentKey = 'brand' | 'gold' | 'forest' | 'amber' | 'clay' | 'slate'

export type { Audience, FormatId }
