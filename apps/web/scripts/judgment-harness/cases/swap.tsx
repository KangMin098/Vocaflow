// apps/web/scripts/judgment-harness/cases/swap.tsx
// T-0151 P1-01 재현 사례 — 같은 React 인스턴스에 다른 문항을 넘긴다(재마운트 없음). 공개 뒤 교체 · 요청 중 교체를 모두 본다.
// ?tool=info(기본, R-FACT 두 문항) | irrelevant | order | grammar | mood · ?delay=ms(provider 지연)
import { createRoot } from 'react-dom/client'
import { useState, type ComponentType } from 'react'
import { GrammarTool } from '@/components/csat/judgment/GrammarTool'
import { InfoMatchTool } from '@/components/csat/judgment/InfoMatchTool'
import { IrrelevantTool } from '@/components/csat/judgment/IrrelevantTool'
import { MoodTool } from '@/components/csat/judgment/MoodTool'
import { OrderTool } from '@/components/csat/judgment/OrderTool'
import { fixtureProvider, itemsOf, type FixtureType } from '@/lib/csat/judgment/fixtures'
import type { JudgmentToolProps, RevealProvider } from '@/lib/csat/judgment/types'

const TOOLS: Record<string, [FixtureType, ComponentType<JudgmentToolProps>]> = {
  info: ['R-FACT', InfoMatchTool],
  irrelevant: ['R-IRRELEVANT', IrrelevantTool],
  order: ['R-ORDER', OrderTool],
  grammar: ['R-GRAMMAR', GrammarTool],
  mood: ['R-MOOD', MoodTool],
}
type W = { __REVEAL_CALLS__: number; __REVEAL_IDS__: string[]; __SWAP__: () => void }
const w = window as unknown as W
w.__REVEAL_CALLS__ = 0
w.__REVEAL_IDS__ = []
const q = new URLSearchParams(location.search)
const [type, Tool] = TOOLS[q.get('tool') ?? 'info'] ?? TOOLS.info
const delay = Number(q.get('delay') ?? 120)
const base = fixtureProvider(type)
// provider 는 문항이 바뀌어도 같은 함수(제품 provider 와 같은 조건)
const reveal: RevealProvider = async (it) => {
  w.__REVEAL_CALLS__++
  w.__REVEAL_IDS__.push(it.id)
  await new Promise((r) => setTimeout(r, delay))
  return base(it)
}
const items = itemsOf(type)

function App() {
  const [i, setI] = useState(0)
  w.__SWAP__ = () => setI((x) => (x + 1) % items.length)
  return (
    <div data-swap-root data-current={items[i].id}>
      <Tool item={items[i]} reveal={reveal} />
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
