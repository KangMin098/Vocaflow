// packages/video-factory/src/requests/types.ts
//
// **영상 요청의 모양 — DB(`video_requests*`)와 드레인 청크가 같이 쓰는 타입.**
//
// 이 파일에는 `node:*` 도 Remotion 도 없다. 앱(`/admin/video`)이 import 한다.

import type { SceneKind } from '../spec/types'

/** 목적 — 학습시키려는 영상인가, 사게 하려는 영상인가. */
export type RequestPurpose = 'learn' | 'buy'

/** 수요자 — 이 영상을 보고 행동할 사람. */
export type RequestAudience = 'student' | 'parent' | 'teacher' | 'adult'

export type RequestPhase =
  | 'requested'
  | 'designed'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'applying'
  | 'applied'
  | 'evaluated'
  | 'failed'
  | 'cancelled'

export type ReviewDecision = 'approve' | 'revise' | 'reject'

/**
 * **기획** — 설계보다 먼저 적는다. 니즈를 먼저 못 박지 않으면 스크립트가 제품 자랑이 된다.
 */
export interface RequestPlan {
  /** 이 수요자가 지금 원하는 것 (한 줄) */
  need: string
  /** 첫 몇 초에 짚을 문제 — 수요자의 말로 */
  problem: string
  /** 이 항목이 그 문제를 어떻게 푸는가 */
  promise: string
  /** 영상이 끝났을 때 남길 한 문장 */
  message: string
  /** 다음 행동 — 무엇을 누르게 하나 */
  action: string
}

/** 장면이 이야기 안에서 맡는 자리. 첫 장면은 문제, 끝 장면은 행동이어야 한다. */
export type SceneRole = 'problem' | 'solution' | 'proof' | 'action'

/**
 * 초안이 인용하는 **DB 실측 수치 하나**. 값을 적지 않고 번들 경로만 적는다 —
 * 값은 `to-spec` 이 원료(`work/source-bundle.json`)에서 꺼낸다. 초안에 숫자를 적을 자리가 없다.
 */
export interface FactRef {
  /** 자막·나레이션의 `{{name}}` 과 짝 */
  name: string
  /** 번들 경로 — `platform.items` · `series[id=reading].rungs[step=4].items` */
  path: string
  /** 화면에 붙는 짧은 이름 */
  label: string
}

interface DraftSceneBase {
  role: SceneRole
  caption: string
  narration?: string
}

/** 여는 물음 */
export interface DraftHook extends DraftSceneBase {
  kind: 'hook'
  line: string
  sub?: string
}

/** 주장 한 개 + 근거 */
export interface DraftStatement extends DraftSceneBase {
  kind: 'statement'
  title: string
  body: string
  basis: string
}

/** 실측 수치 몇 줄 — 값은 fact 이름으로만 */
export interface DraftStat extends DraftSceneBase {
  kind: 'stat'
  stats: { fact: string; label: string }[]
}

/** 닫는 컷 — 다음 한 걸음 */
export interface DraftClosing extends DraftSceneBase {
  kind: 'closing'
  line: string
  cta: string
  url: string
}

/**
 * **기존 설계도의 장면을 빌린다** — 서가·계단·문항·커버리지처럼 원료에서 그려지는 컷.
 * 기존 catalog 규칙(플랫폼 PR 73편)이 이 구조의 한 분야로 흡수되는 길이 이것이다.
 */
export interface DraftBorrow extends DraftSceneBase {
  kind: 'borrow'
  /** 빌려 올 편 id (`series-reading`) */
  videoId: string
  /** 그 편의 몇 번째 컷 (0부터) */
  sceneIndex: number
}

export type DraftScene = DraftHook | DraftStatement | DraftStat | DraftClosing | DraftBorrow

export interface RequestDesign {
  title: string
  subtitle: string
  facts: FactRef[]
  scenes: DraftScene[]
}

/** 자동 검사 한 건. error 가 하나라도 있으면 import 가 그 초안을 넣지 않는다. */
export interface DesignCheck {
  rule: string
  level: 'error' | 'warn'
  detail: string
}

/**
 * **원료로 채운 모습** — 검토자가 보는 것. 초안에는 `{{이름}}` 만 있어서 그대로 보여 주면
 * 「중학 3학년 학년에」 같은 겹침이나 어색한 수치 표기를 사람이 볼 수 없다.
 */
export interface ResolvedPreview {
  title: string
  subtitle: string
  scenes: { kind: string; caption: string; narration?: string }[]
  evidence: { label: string; value: string; source: string }[]
}

export interface DesignChecks {
  ok: boolean
  /** 예상 길이(초) — 음성을 굽기 전 자막 길이 계산 */
  seconds: number
  items: DesignCheck[]
  /** 원료가 있을 때만(드레인 import) — 앱 화면은 원료가 없다 */
  preview?: ResolvedPreview
}

/** 빌린 컷이 가져올 수 있는 종류 — 초안이 직접 만들 수 없는 것들 */
export const BORROWABLE_KINDS: readonly SceneKind[] = [
  'coverage',
  'decay',
  'ladder',
  'shelf',
  'item',
  'progression',
  'stat',
  'statement',
  'hook',
]
