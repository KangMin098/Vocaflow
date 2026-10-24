// apps/web/src/lib/csat/listening/fixtures/index.ts
import { FIXTURE_2023_L07, FIXTURE_2023_L10 } from './csat-2023'
import type { ListeningTraceFixture } from './types'

export * from './types'
export { FIXTURE_2023_L07, FIXTURE_2023_L10 } from './csat-2023'

/** 화면 순서 — 표 거르기 먼저, 이유 소거 다음 */
export const TRACE_FIXTURES: readonly ListeningTraceFixture[] = [FIXTURE_2023_L10, FIXTURE_2023_L07]

export function traceFixtureByKey(key: string | null | undefined): ListeningTraceFixture | null {
  return TRACE_FIXTURES.find((f) => f.key === key) ?? null
}
