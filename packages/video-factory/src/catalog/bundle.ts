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
  /** spine = 이 면의 통과가 단계를 정의한다 · cross = 폭을 넓힐 뿐 단계를 정의하지 않는다 */
  kind: 'spine' | 'cross'
  /** 이 면이 보장하는 인출 형식 — 「무엇으로 통과를 재는가」 */
  retrieval: string
}

/** 단어 하나가 거치는 단계. `by` 는 이 단계로 올려 주는 면(met 은 노출뿐이라 없다). */
export interface BundleStage {
  id: string
  code: string
  name: string
  says: string
  by: string | null
}

/**
 * 처방이 쓰는 임계값 — **전부 `lib/framework/flow.ts` 의 상수 그대로**다.
 * 영상용으로 고쳐 적으면 화면과 영상이 다른 말을 하게 되고, 그걸 알아챌 방법이 없다.
 */
export interface BundleFlow {
  accuracyTarget: number
  accuracyHoldBelow: number
  hitsToPass: number
  encountersFloor: number
  newFacetsPerSession: number
  dailyBlocks: { min: number; target: number; max: number }
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
  /** 학습방법 영상의 원료 — 단계 5개 */
  stages: BundleStage[]
  /** 면을 보여 주는 순서 */
  facetOrder: string[]
  /** 단계를 정의하는 면(순서가 곧 깊이). 위 `spine`(교재 계단)과 **다른 것**이다. */
  spineFacets: string[]
  /** 권장안 영상의 원료 — 처방 임계값 */
  flow: BundleFlow
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
