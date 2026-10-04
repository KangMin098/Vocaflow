// scripts/csat/__tests__/review-blind-protocol.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {shareReviewSource,blindProtocolViolation} from '../lib-review-blind-protocol.mjs'
const items=new Map([41,42,43,44,45,18].map(no=>[`H#${no}`,{id:`H#${no}`,exam_id:'H',no,passage:`Text ${no}`}]))
const run={id:'blind',item_id:'H#42',role:'reviewer',agent_run:'actor',created_at:'2026-10-01T10:00:00Z',solve_committed_at:'2026-10-01T10:01:00Z'}
const previous={id:'previous',item_id:'H#41',role:'reviewer',agent_run:'actor',created_at:'2026-10-01T09:00:00Z',revealed_at:'2026-10-01T09:59:00Z'}
test('a shared title analysis exposed before a vocabulary solve disqualifies that blind',()=>{
 assert.equal(blindProtocolViolation(run,[previous],items,new Set(),null).reason,'source-already-revealed')
})
test('all shared question solves may be committed before any analysis is revealed',()=>{
 assert.equal(blindProtocolViolation(run,[{...previous,revealed_at:'2026-10-01T10:02:00Z'}],items,new Set(),null),null)
})
test('a distinct execution and an unrelated source do not contaminate the blind',()=>{
 assert.equal(blindProtocolViolation(run,[{...previous,agent_run:'fresh'},{...previous,item_id:'H#18'}],items,new Set(),null),null)
})
test('an exclusion remains effective after submission or an analysis version change',()=>{
 assert.equal(blindProtocolViolation({...run,id:'replacement',analysis_id:'new'},[{...run,revealed_at:null}],items,new Set(['blind']),null).reason,'replacement-of-excluded')
})
test('an earlier valid solution is not invalidated by a later disqualified run',()=>{
 assert.equal(blindProtocolViolation(run,[{...previous,created_at:'2026-10-01T11:00:00Z',revealed_at:null}],items,new Set(['previous']),null),null)
})
test('story questions stay related despite different underlining, and empty text is not shared',()=>{
 assert.equal(shareReviewSource(items.get('H#43'),items.get('H#45')),true)
 assert.equal(shareReviewSource({...items.get('H#18'),passage:''},{...items.get('H#42'),passage:''}),false)
 assert.equal(shareReviewSource(items.get('H#41'),{...items.get('H#42'),exam_id:'OTHER'}),false)
})
test('duplicate nonempty passages across exams share exposure evidence',()=>{
 assert.equal(shareReviewSource(items.get('H#18'),{id:'OTHER#18',exam_id:'OTHER',no:18,passage:'Text 18'}),true)
})
test('unsolved runs use an explicit injected cutoff instead of reading the clock',()=>{
 assert.equal(blindProtocolViolation({...run,solve_committed_at:null},[previous],items,new Set(),'2026-10-01T09:58:00Z'),null)
 assert.throws(()=>blindProtocolViolation({...run,solve_committed_at:null},[],items,new Set(),null),/cutoff/)
})

// Opt-in, read-only DB regression: these immutable legacy reviews have NULL units
// hashes although current lists exist. Run after the approved gate migration:
// $env:CSAT_LIVE_PROTOCOL_TEST='1'; node --tls-max-v1.2 --test <this file>
test('live publication evidence excludes legacy NULL-unit approvals after a list exists',{
 skip:process.env.CSAT_LIVE_PROTOCOL_TEST!=='1',
},async()=>{
 const env=name=>{
  if(process.env[name])return process.env[name]
  for(const file of ['.env.local','.env','apps/web/.env.local','apps/web/.env']){
   if(!fs.existsSync(file))continue
   const match=fs.readFileSync(file,'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`,'m'))
   if(match)return match[1].trim().replace(/^["']|["']$/g,'')
  }
 }
 const db=createClient(env('NEXT_PUBLIC_SUPABASE_URL')??env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}})
 const ids=['fce44e5a-2191-4e39-a92f-05942182a971','4812ff5f-4d21-4a28-8a04-364da1d8c99c','d5c9783e-1a43-40e6-be69-f123a5ae139e','af93ef7e-d0c4-433c-bc6e-23ca5580fdd4','a19a7ccc-9fc4-4c37-87fd-c535a81f7450','6f82ff94-b6dd-4f2f-8b37-f5e0a8175fbe','6c697bf5-8f7a-45a6-a804-71036bb05276','081fd376-46bf-4c69-8b9c-23a04a4b9462','c6cd3ad2-fdf7-4ad3-963c-18a66d6c19ed','41c706ab-14ca-478b-a387-558dcdb432c0','4aa57250-c4f3-4d9a-8659-00322afe51f2','785b40a1-5254-4eb6-855e-3410c4b8716f','c990b424-2994-4ca5-a8f8-12c016beb43e','0cbd93eb-4879-44e2-ac07-522f7e8fbb64']
 const {data,error}=await db.rpc('csat_valid_review_personas_many',{p_analyses:ids})
 assert.equal(error,null)
 assert.equal(data.length,ids.length)
 assert.deepEqual(new Set(data.map(row=>row.analysis_id)),new Set(ids))
 for(const row of data)assert.deepEqual(row.personas,[],`Unbound approval counted for ${row.analysis_id}`)
})
