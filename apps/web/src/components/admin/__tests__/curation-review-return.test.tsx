// apps/web/src/components/admin/__tests__/curation-review-return.test.tsx
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ push:vi.fn(), refresh:vi.fn(), publish:vi.fn(), db:{} }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useState:(initial:unknown)=>[initial,vi.fn()] }))
vi.mock('next/navigation',()=>({useRouter:()=>({push:mock.push,refresh:mock.refresh})}))
vi.mock('@/lib/supabase/client',()=>({createClient:()=>mock.db}))
vi.mock('@/lib/library/admin-queries',async original=>({...await original<typeof import('@/lib/library/admin-queries')>(),forcePublishBook:mock.publish}))
vi.mock('@/components/admin/AdminScreenHelp',()=>({AdminScreenHelp:()=>null}))
vi.mock('@/components/library/reader/BookContentReader',()=>({BookContentReader:()=>null}))
import { AdminReviewClient } from '@/app/admin/curation/preview/[bookId]/AdminReviewClient'
const props={bookId:'book',title:'Book',author:null,cefrLevel:null,cefrConfidence:null,totalWordCount:1,status:'ready',copyrightSafeInKr:true,chapters:[]}
const nodes=(node:ReactNode):ReactElement[]=>isValidElement(node)?[node,...Children.toArray(node.props.children).flatMap(nodes)]:[]
beforeEach(()=>{vi.clearAllMocks();mock.publish.mockResolvedValue(undefined)})
describe('본문 검수의 화면 복귀·작업 성공 복귀',()=>{
  it('화면 링크와 게시 성공이 같은 검증된 목록으로 돌아간다',async()=>{
    const returnTo='/admin/curation?view=review&status=ready&q=alice&page=2'
    const tree=AdminReviewClient({...props,returnTo})
    expect(renderToStaticMarkup(tree)).toContain('href="/admin/curation?view=review&amp;status=ready&amp;q=alice&amp;page=2"')
    const publish=nodes(tree).find(node=>typeof node.props.onPublish==='function')
    expect(publish).toBeDefined()
    await publish!.props.onPublish()
    expect(mock.publish).toHaveBeenCalledWith(mock.db,'book')
    expect(mock.push).toHaveBeenCalledWith(returnTo)
    expect(mock.refresh).toHaveBeenCalledOnce()
  })
  it('외부 복귀 값을 게시 후 이동에 사용하지 않는다',async()=>{
    const tree=AdminReviewClient({...props,returnTo:'https://evil.test'})
    await nodes(tree).find(node=>typeof node.props.onPublish==='function')!.props.onPublish()
    expect(mock.push).toHaveBeenCalledWith('/admin/curation')
  })
  it('게시 실패를 성공 복귀로 처리하지 않는다',async()=>{
    mock.publish.mockRejectedValue(Error('denied'))
    const tree=AdminReviewClient({...props,returnTo:'/admin/curation?view=review&page=2'})
    await nodes(tree).find(node=>typeof node.props.onPublish==='function')!.props.onPublish()
    expect(mock.push).not.toHaveBeenCalled()
    expect(mock.refresh).not.toHaveBeenCalled()
  })
})
