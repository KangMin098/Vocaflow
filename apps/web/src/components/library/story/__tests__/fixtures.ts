// apps/web/src/components/library/story/__tests__/fixtures.ts
// 합성 시험 자료(실제 도서 아님) — LCP Story 학습자 화면 시험 공용.

import type {
  StoryCatalogRelease,
  StoryGuidanceState,
  StoryProgressRow,
  StoryReaderContext,
  StoryReaderPageState,
  StoryReleaseGuidance,
  StoryReleaseGuidanceView,
  StoryUnitBody,
} from '@/lib/library/story/learner-types'

export const VIEWER = 'viewer-aaaa'
export const OTHER = 'viewer-bbbb'
export const KEY_A = 'lsr_' + 'a'.repeat(32)
export const KEY_B = 'lsr_' + 'b'.repeat(32)
export const KEY_C = 'lsr_' + 'c'.repeat(32)

export function release(over: Partial<StoryCatalogRelease> = {}): StoryCatalogRelease {
  return {
    releaseKey: KEY_A,
    workKey: 'gull-rock',
    editionKey: 'gull-rock-story',
    kind: 'story_edition',
    coverage: 'complete_work',
    completionLabel: 'adapted_full_work',
    title: 'Gull Rock',
    hookText: 'A gull lands on the only rock the tide has not taken.',
    unitCount: 3,
    targetCefr: 'B1',
    publishedAt: '2026-10-25T00:00:00Z',
    ...over,
  }
}

/** 합성 주의 문장(시험 전용) — 두 번째는 장면을 말하는 문장이다(접힌 영역 안에만 있어야 한다). */
export const CAUTION_A = '거리 시비: 낯선 사람이 문을 세게 두드리는 장면(합성)'
export const CAUTION_B = '범인이 무릎 꿇고 우는 장면(합성)'

export function guidance(over: Partial<StoryReleaseGuidance> = {}): StoryReleaseGuidance {
  return {
    releaseKey: KEY_A,
    targetCefr: 'B1',
    cognitiveDemand: 'high',
    backgroundLoad: 'moderate',
    cautions: [CAUTION_A, CAUTION_B],
    ...over,
  }
}

export function guidanceView(over: Partial<StoryReleaseGuidance> = {}): StoryReleaseGuidanceView {
  return { status: 'ready', guidance: guidance(over) }
}

/** 서가 안내 — A 는 주의 둘, B 는 주의 없음. */
export function catalogGuidance(): StoryGuidanceState {
  return {
    status: 'ready',
    byRelease: { [KEY_A]: guidance(), [KEY_B]: guidance({ releaseKey: KEY_B, targetCefr: 'A2', cognitiveDemand: 'low', backgroundLoad: 'low', cautions: [] }) },
  }
}

export function progressRow(over: Partial<StoryProgressRow> = {}): StoryProgressRow {
  return {
    releaseKey: KEY_A,
    workKey: 'gull-rock',
    editionKey: 'gull-rock-story',
    completionLabel: 'adapted_full_work',
    countsAsWorkCompletion: true,
    countsAsOriginalTextCompletion: false,
    lastUnitIndex: 1,
    furthestUnitIndex: 1,
    completedUnitCount: 1,
    unitCount: 3,
    completedAt: null,
    releaseAvailable: true,
    ...over,
  }
}

export const UNIT_TEXT = 'The tide came in fast.\n\nThe gull did not move. <b>not bold</b>'

export function context(over: Partial<StoryReaderContext> = {}): StoryReaderContext {
  return {
    releaseKey: KEY_A,
    workKey: 'gull-rock',
    editionKey: 'gull-rock-story',
    kind: 'story_edition',
    coverage: 'complete_work',
    completionLabel: 'adapted_full_work',
    countsAsWorkCompletion: true,
    countsAsOriginalTextCompletion: false,
    title: 'Gull Rock',
    unitCount: 3,
    progress: { lastUnitIndex: 1, furthestUnitIndex: 1, completedUnitCount: 1, completed: false },
    toc: [
      { unitIndex: 0, unitTitle: 'Tide', completed: true },
      { unitIndex: 1, unitTitle: 'Gull', completed: false },
      { unitIndex: 2, unitTitle: 'Rock', completed: false },
    ],
    unit: { unitIndex: 1, unitTitle: 'Gull', anchors: [{ paragraph: 2, start: 10, end: 40, quote: 'the gull sat as still as stone' }] },
    source: {
      title: 'Gull Rock (synthetic)',
      author: 'Test Author',
      originalLanguage: 'en',
      textLanguage: 'en',
      translator: null,
      editionLabel: 'Synthetic test edition',
      coverage: 'complete_work',
      sourceUrl: 'https://example.org/gull-rock',
    },
    ...over,
  }
}

export function unitBody(over: Partial<StoryUnitBody> = {}): StoryUnitBody {
  return { releaseKey: KEY_A, unitIndex: 1, unitCount: 3, unitTitle: 'Gull', text: UNIT_TEXT, ...over }
}

export function readyState(
  over: Partial<Extract<StoryReaderPageState, { status: 'ready' }>> = {},
): Extract<StoryReaderPageState, { status: 'ready' }> {
  return {
    status: 'ready',
    viewerId: VIEWER,
    context: context(),
    release: release(),
    unit: unitBody(),
    siblings: [release({ releaseKey: KEY_B, editionKey: 'gull-rock-easy', kind: 'easy_reader', targetCefr: 'A2' })],
    guidance: guidanceView(),
    ...over,
  }
}

/** 손으로 풀 수 있는 약속 — 응답 순서를 시험이 정한다. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}
