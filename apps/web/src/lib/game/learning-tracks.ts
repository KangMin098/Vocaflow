// apps/web/src/lib/game/learning-tracks.ts
// Shared classification only; importing route colors must not bundle React game artwork.
import type { GameSlug } from './catalog'

export type HubTrack = 'recall' | 'produce' | 'reason'
const TRACK_OF: Record<GameSlug, HubTrack> = {
  wordblitz: 'recall', 'ghost-race': 'recall', 'word-economy': 'recall',
  'daily-blitz': 'recall', cascade: 'recall', 'pirate-quest': 'recall',
  'letter-forge': 'produce', 'wordsmith-vigil': 'produce', morphmerge: 'produce',
  'morpheme-rules': 'produce', 'silent-rule': 'produce', 'wordfall-cadence': 'produce',
  'glyph-tongue': 'reason', 'word-customs': 'reason', connections: 'reason',
  'lexicon-hands': 'reason', 'lexicon-detective': 'reason', 'lexicon-estate': 'reason', 'word-orrery': 'reason',
}
export const trackOf = (slug: GameSlug): HubTrack => TRACK_OF[slug]
export function learningTrackOf(slug: string): HubTrack | null {
  return Object.hasOwn(TRACK_OF, slug) ? TRACK_OF[slug as GameSlug] : null
}
