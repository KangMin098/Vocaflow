// apps/web/src/lib/design/editorial-art.ts
import type { FacetId } from '@/lib/framework/axes'

const ROOT = '/illustrations/tines/'

/** Decorative PC artwork. Content covers, answer illustrations and small icons stay independent. */
export const PRACTICE_EDITORIAL_ART: Record<FacetId, string> = {
  recognize: `${ROOT}scene-recall-v5.png`,
  spell: `${ROOT}scene-produce-v5.png`,
  sound: `${ROOT}scene-listen-v5.png`,
  build: `${ROOT}scene-build-v5.png`,
  use: `${ROOT}scene-reason-v5.png`,
  fluency: `${ROOT}scene-fluency-v5.png`,
}

const REVISIONS: Record<string, string> = {
  'scene-library-v4': 'scene-library-v5.png',
  'scene-vault-v4': 'scene-vault-v5.png',
  'scene-growth-v4': 'scene-growth-v5.png',
  'scene-journey-v4': 'scene-journey-v5.png',
}

const MODULE_SCENES: Record<string, string> = {
  'tile-read': 'scene-library-v5.png',
  'tile-books': 'scene-library-v5.png',
  'tile-textbooks': 'scene-library-v5.png',
  'tile-vault': 'scene-vault-v5.png',
  'tile-decks': 'scene-vault-v5.png',
  'tile-dashboard': 'scene-growth-v5.png',
  'tile-hub': 'scene-journey-v5.png',
  'tile-about': 'scene-journey-v5.png',
  'tile-flashcard': 'scene-recall-v5.png',
  'tile-pairflip': 'scene-recall-v5.png',
  'tile-wordblitz': 'scene-fluency-v5.png',
  'tile-spellforge': 'scene-produce-v5.png',
  'tile-dictation': 'scene-listen-v5.png',
  'tile-echo': 'scene-listen-v5.png',
  'tile-quiz': 'scene-reason-v5.png',
}

/** A known module's decorative role; unknown/3B artwork is deliberately left to its caller. */
export function editorialModuleArtwork(tile: string): string | undefined {
  return Object.hasOwn(MODULE_SCENES, tile) ? ROOT + MODULE_SCENES[tile] : undefined
}

/** Call only in existing PC illustration slots; never rewrite arbitrary content URLs. */
export function editorialScene(scene: string): string {
  return ROOT + (Object.hasOwn(REVISIONS, scene) ? REVISIONS[scene] : `${scene}.webp`)
}

/** A failed video's decorative poster, only after learner/desktop scope has been established. */
export function editorialPoster(src: string): string {
  const stem = src.startsWith(ROOT) && src.endsWith('.webp') ? src.slice(ROOT.length, -5) : null
  return stem && Object.hasOwn(REVISIONS, stem) ? editorialScene(stem) : src
}
