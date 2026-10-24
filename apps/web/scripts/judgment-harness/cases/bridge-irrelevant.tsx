// apps/web/scripts/judgment-harness/cases/bridge-irrelevant.tsx
// 제품 연결부 격리 검사 — 공유 화면이 쓸 TypeJudgment + judgmentRouteProvider 를 그대로 쓰고, 판단 라우트만 가짜로 응답한다.
// ?route=401|409|423|503|ok(기본) 로 T-0147 라우트의 상태 코드를 흉내 낸다. 실제 서버 · 노출 원장 · 인증은 없다.
import { createRoot } from 'react-dom/client'
import { TypeJudgment } from '@/components/csat/judgment/TypeJudgment'
import { itemsOf, revealOf } from '@/lib/csat/judgment/fixtures'
import { judgmentRouteProvider } from '@/lib/csat/judgment/provider'

type W = { __REVEAL_CALLS__: number; __ROUTE_BODIES__: unknown[] }
const w = window as unknown as W
w.__REVEAL_CALLS__ = 0
w.__ROUTE_BODIES__ = []
const q = new URLSearchParams(location.search)
const item = itemsOf('R-IRRELEVANT')[Number(q.get('item') ?? 0)] ?? itemsOf('R-IRRELEVANT')[0]

const fakeRoute: typeof fetch = async (input, init) => {
  w.__REVEAL_CALLS__++
  w.__ROUTE_BODIES__.push({ url: String(input), body: JSON.parse(String(init?.body ?? 'null')) })
  await new Promise((r) => setTimeout(r, 120))
  const mode = q.get('route') ?? 'ok'
  if (mode !== 'ok') return new Response(JSON.stringify({ ok: false, error: mode }), { status: Number(mode), headers: { 'content-type': 'application/json' } })
  const judgment = await revealOf('R-IRRELEVANT', item.id)
  return new Response(JSON.stringify({ ok: true, exposureId: 'harness', reveal: {}, judgment }), { headers: { 'content-type': 'application/json' } })
}

const slug = item.id.replace('#', '-')
const root = createRoot(document.getElementById('root')!)
if (q.get('type')) {
  // 도구 없는 유형 — 공유 화면은 아무것도 그리지 않아야 한다
  root.render(
    <div data-judgment-empty>
      <p>도구 없는 유형 검사: {q.get('type')}</p>
      <div data-slot><TypeJudgment item={{ ...item, typeId: q.get('type')! }} reveal={judgmentRouteProvider(slug, { fetch: fakeRoute })} /></div>
    </div>,
  )
} else {
  root.render(<TypeJudgment item={item} reveal={judgmentRouteProvider(slug, { fetch: fakeRoute })} />)
}
