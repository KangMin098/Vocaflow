// apps/web/src/lib/design/learner-palette.ts
import { learningTrackOf } from '../game/learning-tracks'
import { isFullScreenRoute } from '../layout/full-screen-routes'
import { MATERIAL_TONE } from './tone'
import { ACTIVITY_TINT, moduleActivityTint } from './learning-colors'

export type LearnerPalette = 'green' | 'peach' | 'pink' | 'teal' | 'yellow' | 'lavender' | 'neutral'
export type LearnerColorGroup = 'material' | 'read' | 'encode' | 'recall' | 'produce' | 'listen' | 'reason' | 'reflect' | 'assess' | 'overview' | 'support'
export interface LearnerColorRole {
  palette: LearnerPalette
  group: LearnerColorGroup
  /** Expected cadence from the learning model, not measured user frequency. */
  cadence: 'frequent' | 'periodic' | 'occasional'
  attention: 'browse' | 'focus' | 'overview' | 'utility'
  priority: 'core' | 'support'
}

const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/')

const any = (pathname: string, prefixes: string[]) => prefixes.some(prefix => within(pathname, prefix))
const role = (palette: LearnerPalette, group: LearnerColorGroup, cadence: LearnerColorRole['cadence'], attention: LearnerColorRole['attention'], priority: LearnerColorRole['priority'] = 'core'): LearnerColorRole => ({ palette, group, cadence, attention, priority })
const practicePalette = ACTIVITY_TINT

/** Display semantics only: no scheduler, recommendation, grading or learning data changes. */
export function getLearnerColorRole(pathname: string | null): LearnerColorRole | null {
  if (pathname === null || /^\/(?:admin|csat|dev|api)(?:\/|$)/.test(pathname)) return null

  const p = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  if (within(p, '/play')) {
    const track = learningTrackOf(p.split('/')[2] ?? '')
    return track ? role(practicePalette[track], track, 'frequent', 'focus') : role('neutral', 'overview', 'occasional', 'browse')
  }
  if (any(p, ['/hub', '/hub-lab'])) return role('neutral', 'overview', 'frequent', 'overview')
  if (any(p, ['/practice', '/arcade']) && !within(p, '/practice/dcp')) return role('neutral', 'overview', 'frequent', 'browse')
  if (any(p, ['/dashboard', '/reports', '/plan'])) return role(ACTIVITY_TINT.reflect, 'reflect', 'periodic', 'overview')
  if (any(p, ['/diagnostic', '/fit'])) return role('teal', 'assess', 'periodic', 'overview')
  if (any(p, ['/wordvault/study', '/wordvault/review'])) return role(practicePalette.recall, 'recall', 'frequent', 'focus')
  if (any(p, ['/wordvault', '/my/words'])) return role(moduleActivityTint('wordvault'), 'encode', 'frequent', isFullScreenRoute(p) ? 'focus' : 'overview')
  if (any(p, ['/flashcard', '/pairflip', '/wordblitz'])) return role(practicePalette.recall, 'recall', 'frequent', isFullScreenRoute(p) ? 'focus' : 'browse')
  if (within(p, '/spellforge')) return role(practicePalette.produce, 'produce', 'frequent', isFullScreenRoute(p) ? 'focus' : 'browse')
  if (within(p, '/dictate') || /^\/text\/[^/]+\/echo(?:\/|$)/.test(p)) return role(moduleActivityTint('echo'), 'listen', 'frequent', isFullScreenRoute(p) || p.includes('/echo') ? 'focus' : 'browse')
  if (any(p, ['/scriptquiz', '/practice/dcp'])) return role(practicePalette.reason, 'reason', 'frequent', isFullScreenRoute(p) ? 'focus' : 'browse')
  if (/^\/library\/textbooks\/[^/]+\/[^/]+\/practice(?:\/|$)/.test(p)) return role(practicePalette.reason, 'reason', 'frequent', 'focus')
  if (within(p, '/library/scripts')) return role(MATERIAL_TONE.article.tint, 'material', 'occasional', 'browse')
  if (within(p, '/library/vocab')) return role(MATERIAL_TONE.word_set.tint, 'material', 'occasional', 'browse')
  if (within(p, '/library/textbooks')) return role(MATERIAL_TONE.textbook.tint, 'material', 'occasional', 'browse')
  if (within(p, '/comics') || /^\/text\/[^/]+\/comic(?:\/|$)/.test(p)) return role(MATERIAL_TONE.comic.tint, 'read', 'frequent', p.includes('/comic') && !within(p, '/comics') ? 'focus' : 'browse')
  if (within(p, '/my/texts')) return role(MATERIAL_TONE.script.tint, 'material', 'frequent', 'browse')
  if (within(p, '/text')) return role(moduleActivityTint('read'), 'read', 'frequent', /^\/text\/(?!new$)[^/]+/.test(p) ? 'focus' : 'browse')
  if (p === '/' || any(p, ['/library', '/my'])) return role(MATERIAL_TONE.book.tint, 'material', 'occasional', 'browse')
  if (any(p, ['/video', '/about', '/pricing'])) return role(p.startsWith('/about') ? 'teal' : 'peach', 'support', 'occasional', 'browse', 'support')
  return role('neutral', 'support', 'occasional', 'utility', 'support')
}

export function getLearnerPalette(pathname: string | null): LearnerPalette | null {
  return getLearnerColorRole(pathname)?.palette ?? null
}
