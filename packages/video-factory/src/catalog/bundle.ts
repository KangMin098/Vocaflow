// packages/video-factory/src/catalog/bundle.ts
//
// **원료의 모양** — `apps/web/scripts/video-source.mts` 가 쓴 JSON 을 읽는 타입.
//
// 두 파일이 같은 모양을 각자 적고 있으므로 갈릴 수 있다. 그래서 회귀
// (`__tests__/bundle.test.ts`)가 **실제 파일을 이 타입으로 파싱**해 맞는지 본다 —
// 타입만 고치고 스크립트를 안 고치면 그 테스트가 깨진다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BundlePlatform {
  dictionary: number | null
  booksPublished: number | null
  articles: number | null
  items: number | null
  chapterQuiz: number | null
}

export interface BundleHeroToken {
  t: string
  v?: number | null
}

export interface BundleHeroReading {
  level: number
  label: string
  coverage: number
  band: string
  unknownWords: number
}

export interface BundleHero {
  passage: string
  tokens: BundleHeroToken[]
  readings: BundleHeroReading[]
  fitLevel: number | null
  totalTokens: number
}

export interface BundleDifferentiator {
  title: string
  body: string
  basis: string
}

export interface BundleTypeGuide {
  label: string
  says: string
  items: number
  explained: number
}

export interface BundleSample {
  prompt: string
  choices: string[]
  answer: number | string
  abridged: boolean
}

export interface BundleRung {
  step: number
  schoolBand: string
  volumeTitle: string
  types: string[]
  items: number
  explained: number
}

export interface BundleSeries {
  id: string
  brand: string
  question: string
  status: 'shipping' | 'draft'
  marketSeries: number
  marketExamples: string[]
  rungs: BundleRung[]
}

export interface BundleSpineRung {
  step: number
  schoolBand: string
  vLevels: number[]
  volumeTitle: string
  types: string[]
  items: number
}

export interface BundleActivity {
  id: string
  name: string
  says: string
  facets: string[]
  contentNeed: string
  route: string | null
}

export interface BundleFacet {
  name: string
  says: string
}

export interface SourceBundle {
  measuredAt: string
  platform: BundlePlatform
  hero: BundleHero | null
  differentiators: BundleDifferentiator[]
  typeGuide: Record<string, BundleTypeGuide>
  samples: Record<string, BundleSample>
  sampleSkipped: string[]
  series: BundleSeries[]
  spine: BundleSpineRung[]
  facetLabels: Record<string, BundleFacet>
  activities: BundleActivity[]
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const BUNDLE_PATH = path.resolve(HERE, '../../work/source-bundle.json')

export class MissingBundleError extends Error {
  constructor(p: string) {
    super(
      `원료가 없다: ${p}\n` +
        `  먼저 뽑아야 한다 →  pnpm --filter web video:source\n` +
        `  (DB 실측에서 나오는 파일이므로 저장소에 커밋하지 않는다 — 낡은 수치로 광고를 만들지 않기 위해서다)`,
    )
    this.name = 'MissingBundleError'
  }
}

export function loadBundle(file: string = BUNDLE_PATH): SourceBundle {
  if (!fs.existsSync(file)) throw new MissingBundleError(file)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SourceBundle
}
