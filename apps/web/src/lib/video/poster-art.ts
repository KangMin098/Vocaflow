// apps/web/src/lib/video/poster-art.ts
import type { ResolvedVideo, VideoKind } from './catalog'

const ROOT = '/illustrations/tines/'
const BY_ID: Record<string, string> = {
  'benefit-coverage': 'scene-report-analysis-v1.webp',
  'benefit-decay': 'scene-growth-v4.webp',
  'benefit-minimum': 'scene-plan-board-v1.webp',
  'series-reading': 'scene-library-v4.webp',
  'series-vocab': 'scene-vault-v4.webp',
  'series-syntax': 'spot-quiz.webp',
}
const BY_KIND: Record<VideoKind, string> = {
  intro: 'scene-journey-v4.webp',
  benefit: 'scene-growth-v4.webp',
  method: 'scene-vault-v4.webp',
  advice: 'scene-plan-board-v1.webp',
  curriculum: 'scene-library-v4.webp',
  series: 'scene-library-v4.webp',
  type: 'spot-quiz.webp',
  module: 'scene-arcade-lab-v1.webp',
  request: 'scene-video-v1.webp',
}

/** An explanatory illustration, never a claim that this is an actual frame of the video. */
export function videoPosterArt(video: Pick<ResolvedVideo, 'id' | 'kind'>): string {
  return ROOT + (Object.hasOwn(BY_ID, video.id) ? BY_ID[video.id] : BY_KIND[video.kind])
}
