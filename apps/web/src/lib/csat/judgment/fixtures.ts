// apps/web/src/lib/csat/judgment/fixtures.ts
// 실제 기출 픽스처 읽기 — scripts/csat/judgment-fixtures-export.mjs 가 DB(published 분석 · units_version 일치)에서 뽑았다.
// 공개 전 화면은 itemsOf 만 쓴다. revealOf 는 격리 하네스의 RevealProvider 흉내와 테스트만 쓴다.
import type { JudgmentItem, RevealData, RevealProvider } from './types'

import fact from './fixtures/r-fact.items.json'
import grammar from './fixtures/r-grammar.items.json'
import irrelevant from './fixtures/r-irrelevant.items.json'
import mood from './fixtures/r-mood.items.json'
import notice from './fixtures/r-notice.items.json'
import order from './fixtures/r-order.items.json'
import summary from './fixtures/r-summary.items.json'

export const FIXTURE_TYPES = ['R-IRRELEVANT', 'R-ORDER', 'R-NOTICE', 'R-FACT', 'R-GRAMMAR', 'R-SUMMARY', 'R-MOOD'] as const
export type FixtureType = (typeof FIXTURE_TYPES)[number]

const ITEMS: Record<FixtureType, { items: JudgmentItem[] }> = {
  'R-IRRELEVANT': irrelevant,
  'R-ORDER': order,
  'R-NOTICE': notice,
  'R-FACT': fact,
  'R-GRAMMAR': grammar,
  'R-SUMMARY': summary,
  'R-MOOD': mood,
}

export function itemsOf(type: FixtureType): JudgmentItem[] {
  return ITEMS[type].items
}

/** 공개 자료 — 테스트 · 격리 하네스 전용. 하네스(splitting:false)에서는 이 JSON 이 번들에 인라인되므로 공개 제어가 아니다(T-0151). 제품은 서버 판단 라우트(provider.ts)를 쓴다 */
export async function revealOf(type: FixtureType, id: string): Promise<RevealData> {
  const slug = type.toLowerCase()
  const mod = (await import(`./fixtures/${slug}.reveal.json`)) as { default?: { reveal: RevealData[] }; reveal?: RevealData[] }
  const list = mod.default?.reveal ?? mod.reveal ?? []
  const hit = list.find((r) => r.id === id)
  if (!hit) throw new Error(`reveal 없음: ${id}`)
  return hit
}

export function fixtureProvider(type: FixtureType): RevealProvider {
  return (item) => revealOf(type, item.id)
}
