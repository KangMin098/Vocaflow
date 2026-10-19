// apps/web/src/app/admin/knowledge/__tests__/application-trace.test.tsx
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ errors: {} as Record<string, boolean>, item:null as string|null, audience:{} as Record<string,unknown>, heldRefs:[] as string[], heldCount:0, held:false, failed:false, calls:[] as string[] }))
const ID = '00000000-0000-4000-8000-000000000001'
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/components/admin/AdminScreenHelp', () => ({ AdminScreenHelp: () => null }))
vi.mock('@/components/admin/knowledge/KnowledgeFrame', () => ({ KnowledgeFrame: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('@/lib/knowledge/item-tasks', () => ({ currentItemTask: () => null }))
vi.mock('@/lib/knowledge/live-chain', () => ({ resolveChain: () => ({ path: [], breaks: [] }) }))
vi.mock('@/lib/knowledge/product-server', async importOriginal => ({
  findTargetsOf: (await importOriginal<typeof import('@/lib/knowledge/product-server')>()).findTargetsOf,
  anchorGate: vi.fn().mockResolvedValue(true), itemTaskRef: () => '', parseItemTaskRef: () => state.item?{itemId:state.item,taskKey:'key'}:null,
  loadChainGraph: async () => ({ items: [], links: [] }),
  loadLiveApplication: async () => ({ app: { id: '00000000-0000-4000-8000-000000000002', version: 3 } }),
}))
vi.mock('@/lib/csat/embargo-gate',()=>({itemRevealDecision:async(refs:string[])=>({held:new Set(refs.filter(ref=>state.heldRefs.includes(ref)||state.held&&ref===state.item)),failed:state.failed})}))
vi.mock('@/lib/admin/application-attempts', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/admin/application-attempts')>(), loadApplicationAttempts: async () => {state.calls.push('attempts');return {rows:[],heldCount:state.heldCount}} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  state.calls.push(table)
  const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: () => q, then: (resolve: (r: unknown) => unknown) => Promise.resolve({
    data: table === 'knowledge_applications' ? { id: '00000000-0000-4000-8000-000000000001', item_id: 'item', status: 'active', surface: 'other', surface_ref: 'ref', version: 2, audience:state.audience }
      : table === 'knowledge_inquiry_links' ? [{ inquiry_id: 'inq' }] : [],
    error: state.errors[table] ? { message: 'offline' } : null,
  }).then(resolve) }
  return q
} }) }))
import Page from '../product/[id]/page'
beforeEach(() => { state.errors = {};state.item=null;state.audience={};state.heldRefs=[];state.heldCount=0;state.held=false;state.failed=false;state.calls=[] })
describe('적용 추적의 실패·등록·노출 경계', () => {
  it.each([{items:['2025#18','2026#18']},{item:'2025#18',items:['2026#18']}])('수행이 없는 복수 대상의 보류도 사슬·검증 조회 전에 막는다: %j',async audience=>{
    state.audience=audience;state.heldRefs=['2026#18'];state.item='2025#18'
    const html=renderToStaticMarkup(await Page({params:{id:ID}}))
    expect(html).toContain('보류 문항의 적용 사슬·정오·검증 결과는 표시하지 않습니다')
    expect(state.calls).toEqual(['knowledge_applications'])
    expect(html).not.toContain('trace-efficacy')
  })
  it('보류 문항 적용은 수행·사슬 결과 조회 전에 보류 화면을 반환한다',async()=>{
    state.item='2026#18';state.held=true
    const html=renderToStaticMarkup(await Page({params:{id:ID}}))
    expect(html).toContain('보류 문항의 적용 사슬·정오·검증 결과는 표시하지 않습니다')
    expect(state.calls).toEqual(['knowledge_applications'])
    expect(html).not.toContain('trace-attempts')
  })
  it('문항 판정 실패는 수행 기록 없음으로 표시하지 않는다',async()=>{
    state.item='2026#18';state.failed=true
    await expect(Page({params:{id:ID}})).rejects.toThrow('보류 판정 실패')
    expect(state.calls).toEqual(['knowledge_applications'])
  })
  it('적용 조회 실패를 404로 바꾸지 않는다', async () => {
    state.errors.knowledge_applications = true
    await expect(Page({ params: { id: ID } })).rejects.toThrow('적용 조회 실패')
  })
  it('과거 보류 수행이 있으면 검증 결과를 조회하거나 효과로 표시하지 않는다',async()=>{
    state.heldCount=1
    const html=renderToStaticMarkup(await Page({params:{id:ID}}))
    expect(state.calls).not.toContain('knowledge_trials')
    expect(html).not.toContain('전역 효과 상태')
    expect(html).toContain('보류 원장으로 검증 계획·결과 확인을 보류했습니다')
    expect(html).not.toContain('검증 계획(trial)이 없다')
  })
  it('탐구 조회 실패를 탐구 없음으로 바꾸지 않는다', async () => {
    state.errors.knowledge_inquiries = true
    await expect(Page({ params: { id: ID } })).rejects.toThrow('탐구 조회 실패')
  })
  it('이전 active 적용을 현재 노출 성공으로 표시하지 않는다', async () => {
    const html = renderToStaticMarkup(await Page({ params: { id: ID } }))
    expect(html).toContain('현재 제품이 선택하는 적용 ID·버전과 다릅니다')
    expect(html).toContain('다른 적용')
    expect(html).not.toContain('학습자에게 나가 있다')
    expect(html).toContain('버전 미상')
    expect(html).toContain('전역 효과 상태')
  })
})
