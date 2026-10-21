// apps/web/src/lib/design/learning-colors.ts
import type { FacetId } from '../framework/axes'
import type { ModuleKey, Tint } from './tone'

/** PC learner presentation only. These groups do not change scoring, scheduling or difficulty. */
export const ACTIVITY_TINT = {
  read: 'green', encode: 'pink', recall: 'lavender', produce: 'yellow',
  listen: 'teal', reason: 'peach', reflect: 'teal',
} as const satisfies Record<string, Tint>
export type LearningColorActivity = keyof typeof ACTIVITY_TINT

export const MODULE_ACTIVITY: Record<ModuleKey, LearningColorActivity> = {
  read: 'read', wordvault: 'encode', flashcard: 'recall', wordblitz: 'recall',
  pairflip: 'recall', spellforge: 'produce', echo: 'listen', dictation: 'listen',
  scriptquiz: 'reason', dashboard: 'reflect',
}

export function moduleActivityTint(module: ModuleKey): Tint {
  return ACTIVITY_TINT[MODULE_ACTIVITY[module]]
}

/** A facet describes the current task; an old representative module icon does not define it. */
export const FACET_ACTIVITY: Record<FacetId, LearningColorActivity> = {
  recognize: 'recall', spell: 'produce', sound: 'listen', build: 'produce',
  use: 'reason', fluency: 'recall',
}
