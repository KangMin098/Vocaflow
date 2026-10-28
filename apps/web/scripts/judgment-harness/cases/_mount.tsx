// apps/web/scripts/judgment-harness/cases/_mount.tsx
// 사례 공통 마운트 — 쿼리로 공개 자료 상태를 바꿔 오류·판본 불일치·자료 없음을 실제 브라우저에서 본다.
//   ?reveal=fail     provider 가 throw
//   ?reveal=version  다른 analysisVersion 을 돌려줌
//   ?item=1          두 번째 실제 문항
//   ?empty=1         문항 자료 없음
// window.__REVEAL_CALLS__ 는 provider 호출 수 — 마운트만으로 0 이어야 한다.
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { fixtureProvider, itemsOf, type FixtureType } from '@/lib/csat/judgment/fixtures'
import type { JudgmentItem, RevealProvider } from '@/lib/csat/judgment/types'

type W = { __REVEAL_CALLS__: number; __INITIAL_PROPS__: unknown }

export function mount(type: FixtureType, render: (item: JudgmentItem, reveal: RevealProvider) => ReactElement, emptyView?: () => ReactElement) {
  const q = new URLSearchParams(location.search)
  const w = window as unknown as W
  w.__REVEAL_CALLS__ = 0
  const base = fixtureProvider(type)
  const reveal: RevealProvider = async (it) => {
    w.__REVEAL_CALLS__++
    await new Promise((r) => setTimeout(r, 120))
    if (q.get('reveal') === 'fail') throw new Error('harness: fetch failed')
    const d = await base(it)
    return q.get('reveal') === 'version' ? { ...d, analysisVersion: d.analysisVersion + 99 } : d
  }
  const items = itemsOf(type)
  const item = items[Number(q.get('item') ?? 0)] ?? items[0]
  const root = createRoot(document.getElementById('root')!)
  if (q.get('empty') === '1' || !item) {
    root.render(emptyView ? emptyView() : <p data-judgment-empty>자료 없음</p>)
    return
  }
  w.__INITIAL_PROPS__ = item
  root.render(render(item, reveal))
}
