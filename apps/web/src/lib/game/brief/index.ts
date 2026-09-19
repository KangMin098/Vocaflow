// apps/web/src/lib/game/brief/index.ts
//
// 게임 브리핑 SSoT — 계열별 파일을 병합한다.
//
// 이 파일은 병합과 조회만 한다. 브리핑 내용은 계열 파일에 있고, 스키마·작성 원칙은
// ./types.ts 에 있다. 새 게임을 추가하면 `Record<GameSlug, GameBrief>` 타입이
// **컴파일 단계에서** 빠진 브리핑을 잡는다 — 카드의 (?) 버튼이 조용히 사라지지 않게.

import type { GameSlug } from '@/lib/game/catalog'

import { ASSEMBLE_BRIEFS } from './assemble'
import { RECALL_BRIEFS } from './recall'
import { RULE_BRIEFS } from './rule'
import { SPECIAL_BRIEFS } from './special'
import { STAKE_BRIEFS } from './stake'
import type { GameBrief } from './types'

export const GAME_BRIEFS: Record<GameSlug, GameBrief> = {
  ...RECALL_BRIEFS,
  ...STAKE_BRIEFS,
  ...ASSEMBLE_BRIEFS,
  ...RULE_BRIEFS,
  ...SPECIAL_BRIEFS,
}

export function hasBrief(slug: GameSlug): boolean {
  return Boolean(GAME_BRIEFS[slug])
}

export function trialLength(slug: GameSlug): number {
  return GAME_BRIEFS[slug]?.trial.steps.length ?? 0
}

export type {
  BriefBoard,
  BriefChoice,
  BriefFigure,
  BriefGauge,
  BriefGaugeState,
  BriefKind,
  BriefPrompt,
  BriefSurface,
  BriefToken,
  BriefTrialStep,
  GameBrief,
} from './types'

export { gaugesOf, pressablesOf, slotStepOf } from './types'
