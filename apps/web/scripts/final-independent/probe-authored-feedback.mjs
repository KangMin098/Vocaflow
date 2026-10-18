// apps/web/scripts/final-independent/probe-authored-feedback.mjs
// Frozen actual map functions with qualified synthetic input contracts. No live DB.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),snapshot=path.join(root,'.agent-logs/final-independent/owner52'),sha='52a31d988'
for(const file of ['apps/web/src/lib/csat/map/load.ts','apps/web/src/lib/csat/map/v4/compose.ts','apps/web/src/lib/csat/map/v4/to-be.ts','apps/web/src/lib/csat/map/v4/workspace.ts','apps/web/src/lib/csat/map/v4/plan.ts']){
 if(fs.readFileSync(path.join(snapshot,file),'utf8')!==execFileSync('git',['show',sha+':'+file],{cwd:root,encoding:'utf8'}))throw new Error('Frozen source mismatch: '+file)
}
const spec=`
import {describe,it,expect} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {asIsMap} from '../../map/v4/as-is'
import {toBeMap} from '../../map/v4/to-be'
import {planWorkspaces} from '../../map/v4/workspace'
import {transferredKeysOf} from '../../map/v4/compose'
import {transferDoneOf} from '../../map/v4/plan'
import {loadPassageKeys} from '../../map/load'
import {FakeClient} from './pglite-supabase'
import type {SupabaseClient} from '@supabase/supabase-js'
const T='r.central_meaning',K='authored-central-meaning',NOW='2026-10-18T08:00:00Z'
const refs=['authored:independent-one','authored:independent-two']
const links={[K]:refs.map(target=>({target,href:'/csat/learn/'+target.slice(9),label:'qualified fixture'}))}
const base=()=>asIsMap({asOf:NOW,sessions:[],axisProxy:null,checks:[{taskKey:K,items:refs}],attempts:[]})
const reference=Array.from({length:45},(_,i)=>({examId:'REF',no:i+1,points:i<10?3:2,errorRate:0.1+i/100}))
const need=(asIs:ReturnType<typeof base>,transferredKeys:string[]=[],confirmLinks=links)=>toBeMap({asIs,goal:{score:80,set:true},refItems:reference,lineRefItems:{B6:reference.slice(17,24),A5:reference.slice(28,34)},confirmLinks,transferredKeys})!
const activity=['authored:transfer-one','authored:transfer-two'].map(itemRef=>({itemRef,taskKey:K,phase:'transfer',answeredAt:'2026-10-18T07:00:00Z'}))
describe('Independent authored map feedback',()=>{
 it('delivered authored checks do not make the Workspace check stage executable',()=>{
  const asIs=base(),toBe=need(asIs)
  const p=planWorkspaces({asIs,toBe,confirmLinks:links,transferItems:{},transferTargets:{}})
  const workspace=[p.primary,...p.others].find(w=>w?.id==='ws.central-meaning')!
  const actual=toBe.needs.find(n=>n.task===T)!
  console.log('AUTHORED_CONFIRM_FEEDBACK='+JSON.stringify({unseen:asIs.tasks[T].check?.unseen,need:actual.type,executable:actual.executable,workspaceCheck:workspace.stages.check,workspaceNext:workspace.next}))
  expect(asIs.tasks[T].check?.unseen).toHaveLength(2)
  expect(actual.type).toBe('CONFIRM');expect(actual.executable).toBeNull();expect(workspace.stages.check.ready).toBe(false)
 })
 it('authored transfer key leaves the next need at TRANSFER; legacy key reaches MAINTAIN',()=>{
  const asIs=base();asIs.tasks[T]={...asIs.tasks[T],status:'resolved',basis:'direct_check'}
  const keys=transferredKeysOf({lifecycleActivity:activity})
  const actual=need(asIs,keys).needs.find(n=>n.task===T)!
  const control=need(asIs,['claim-support']).needs.find(n=>n.task===T)!
  console.log('AUTHORED_TRANSFER_FEEDBACK='+JSON.stringify({keys,actual:actual.type,legacyKeyControl:control.type}))
  expect(keys).toEqual([K]);expect(actual.type).toBe('TRANSFER');expect(control.type).toBe('MAINTAIN')
 })
 it('actual passage loader supplies no identity for authored transfers; operational progress becomes zero',async()=>{
  const db=new PGlite()
  try{
   await db.exec('create table public.csat_items(exam_id text,no integer,passage text); create table public.authored_item(ref text,passage_group text,body jsonb)')
   for(let i=0;i<activity.length;i++) await db.query('insert into public.authored_item values($1,$2,$3::jsonb)',[activity[i].itemRef,'distinct-group-'+i,JSON.stringify({sentences:['Distinct original passage '+i]})])
   await db.query('insert into public.csat_items values($1,1,$2)',['CONTROL','A known legacy source body.'])
   const legacy=await loadPassageKeys(new FakeClient(db,null) as unknown as SupabaseClient,['CONTROL#1'])
   expect(Object.keys(legacy)).toHaveLength(1)
   const keys=await loadPassageKeys(new FakeClient(db,null) as unknown as SupabaseClient,activity.map(a=>a.itemRef))
   const loaded=activity.map(a=>({...a,passageKey:keys[a.itemRef]??null}))
   const actual=transferDoneOf(T,null,loaded)
   console.log('AUTHORED_PASSAGE_FEEDBACK='+JSON.stringify({authoredRowsPresent:2,legacyIdentityCount:Object.keys(legacy).length,keys,loaded,transferDone:actual}))
   expect(keys).toEqual({});expect(actual).toBe(0)
  }finally{await db.close()}
 })
})
`
const test='src/lib/csat/authored/__tests__/codex-feedback.test.ts'
fs.writeFileSync(path.join(snapshot,'apps/web',test),spec)
const result=spawnSync(process.execPath,[path.join(root,'apps/web/node_modules/vitest/vitest.mjs'),'run',test],{cwd:path.join(snapshot,'apps/web'),encoding:'utf8',windowsHide:true,env:{...process.env,NODE_OPTIONS:'--require='+path.join(root,'scripts/csat/map/v62/r5-read-only-preload.cjs')},maxBuffer:4*1024*1024})
const output=[result.stdout??'',result.stderr??''].join('\n').replace(/\u001b\[[0-9;]*m/g,'')
fs.writeFileSync(path.join(root,'docs/research/final-independent-20261018/authored-feedback.log'),'Frozen source: '+sha+'\nScope: isolated actual map functions + synthetic qualified contract inputs, PGlite for passage loader only; no actual DB.\n'+output)
process.stdout.write(output);process.exitCode=result.status??1
