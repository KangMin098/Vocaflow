// verification/reviews/T-0069-r1-independent/probe.test.ts
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {execFileSync} from 'node:child_process'

const m=vi.hoisted(()=>({rows:vi.fn(),user:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:m.user}})}))
vi.mock('@/lib/wordvault/study-queries',()=>({fetchStudyVocabularies:m.rows}))
vi.mock('@/lib/wordvault/browse-queries',()=>({vocabRowToWord:(r:unknown)=>r}))
vi.mock('@/components/wordvault/WordVaultStudyClient',()=>({WordVaultStudyClient:()=>null}))

import Page from '@/app/(main)/wordvault/review/page'
import {vocabMapReturnHref,withMapReturn} from '@/lib/csat/map-return'

const task='v.core_meaning',ws='ws.vocab-context',head='a14ab5ecdc86baeec84d076f789386985ee0c36f'
const ctx={mapTask:task,ws,mapWs:'11111111-2222-4333-8444-555555555555',mapPlan:'2',mapGoal:'3'}
const query={from:'map',map_task:task,ws,map_plan:'2',map_goal:'3'}
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({data:{user:{id:'own-user'}}});m.rows.mockResolvedValue([{id:'word1',word:'vivid',meaning:'clear'}])})

describe('T0069 independent exact-scope preacceptance',()=>{
 it('nine paths; no changes to API,SQL,canon,grade,CSAT evidence engines',()=>{
  const changed=execFileSync('git',['diff','--name-only','25566801020cc40ed6cd5d3b2bf45615b023989d',head],{cwd:'D:/workspace/Vocaflow-final-product',encoding:'utf8'}).trim().split('\n')
  expect(changed).toHaveLength(9)
  expect(changed.filter(p=>/supabase|\.sql$|src\/app\/api|map\/v4|map\/v62|knowledge\/authored|docs\/csat-learner/.test(p))).toEqual([])
 })
 it('vocabulary return strips any incoming old authored item and attempt receipt',()=>{
  const back=vocabMapReturnHref({...query,map_item:'r5-cm-ind-1',map_attempt:'42',task:'B6-FIND-1'})!
  const p=new URL(back,'https://local.invalid').searchParams
  expect(p.get('map_task')).toBe(task);expect(p.get('ws')).toBe(ws)
  expect(p.has('map_item')).toBe(false);expect(p.has('map_attempt')).toBe(false)
 })
 for(const hostile of ['https://external.invalid','//external.invalid','/\\external.invalid','javascript:alert(1)'])it(`arbitrary address never becomes a vocabulary return destination: ${hostile}`,()=>{
  const back=vocabMapReturnHref({...query,ws:hostile,map_ws:hostile,map_plan:hostile,next:hostile,returnTo:hostile})!
  const p=new URL(back,'https://local.invalid')
  expect(p.origin).toBe('https://local.invalid');expect(p.pathname).toBe('/csat/diagnosis')
  expect(p.searchParams.has('ws')).toBe(false);expect(p.searchParams.has('next')).toBe(false)
 })
 it('ordinary source flag cannot silently add map return chrome',()=>{
  expect(vocabMapReturnHref({})).toBeNull();expect(vocabMapReturnHref({from:'browse'})).toBeNull()
 })
 it('normal CSAT item/learn routes still preserve actual submission context',()=>{
  for(const path of ['/csat/item/sample#principle','/csat/learn/r5-cm-ind-1?d=delivery']){
   const url=new URL(withMapReturn(path,{...ctx,mapItem:'r5-cm-ind-1',mapAttempt:'42'}),'http://local.invalid')
   expect(url.searchParams.get('map_item')).toBe('r5-cm-ind-1');expect(url.searchParams.get('map_attempt')).toBe('42')
  }
 })
 it('review page uses real successful rows and safe same-map return props',async()=>{
  const el=await Page({searchParams:query})
  expect(el.props.words).toHaveLength(1);expect(el.props.mapBack).toContain('map_task=v.core_meaning')
  expect(el.props.backHref).toBe(el.props.mapBack);expect(el.props.loadFailed).toBeUndefined()
  expect(m.rows).toHaveBeenCalledWith(expect.anything(),'own-user')
 })
 it('actual server-page query failure is surfaced separately from empty success for map source',async()=>{
  m.rows.mockRejectedValue(new Error('read failed'))
  const el=await Page({searchParams:query})
  expect(el.props.loadFailed).toBe(true);expect(el.props.mapBack).toContain('ws=ws.vocab-context')
 })
 it('ordinary page query failure still propagates rather than becoming empty learning',async()=>{
  m.rows.mockRejectedValue(new Error('read failed'))
  await expect(Page({})).rejects.toThrow('read failed')
 })
 it('successful empty result preserves map return without inventing count or activity',async()=>{
  m.rows.mockResolvedValue([])
  const el=await Page({searchParams:query})
  expect(el.props.words).toEqual([]);expect(el.props.loadFailed).toBeUndefined();expect(el.props.mapBack).toBeTruthy()
 })
 it('ordinary page success retains original props with no map return',async()=>{
  const el=await Page({})
  expect(el.props.mapBack).toBeUndefined();expect(el.props.backHref).toBeUndefined()
 })
 it('missing signed-in user is still redirected before any vocabulary query',async()=>{
  m.user.mockResolvedValue({data:{user:null}})
  const error=await Page({searchParams:query}).then(()=>null,e=>e)
  expect(error?.message).toBe('NEXT_REDIRECT')
  expect(error?.digest).toContain('/login?next=/wordvault/review')
  expect(m.rows).not.toHaveBeenCalled()
 })
})
