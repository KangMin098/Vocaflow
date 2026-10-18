// apps/web/scripts/final-independent/probe-authored-feedback7e.mjs
// Frozen actual map functions with qualified synthetic input contracts. No live DB.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),sha='7e638e63d28791dcc4f886431c0205743dc3310a'
const run=fs.mkdtempSync(path.join(root,'.agent-logs/final-independent/feedback7e-')),snapshot=path.join(run,'snapshot');fs.mkdirSync(snapshot)
execFileSync('git',['archive',sha,'--format=tar','--output='+path.join(run,'source.tar'),'apps/web/src','apps/web/package.json','apps/web/vitest.config.ts','apps/web/tsconfig.json','packages','supabase','docs/final','scripts/csat/map/v62','package.json','pnpm-workspace.yaml'],{cwd:root,windowsHide:true})
execFileSync('tar.exe',['-xf',path.join(run,'source.tar'),'-C',snapshot],{windowsHide:true})
for(const dir of ['node_modules','apps/web/node_modules'])fs.symlinkSync(path.join(root,dir),path.join(snapshot,dir),'junction')
for(const file of ['apps/web/src/lib/csat/map/load.ts','apps/web/src/lib/csat/map/v4/compose.ts','apps/web/src/lib/csat/map/v4/to-be.ts','apps/web/src/lib/csat/map/v4/workspace.ts','apps/web/src/lib/csat/map/v4/plan.ts']){
 if(fs.readFileSync(path.join(snapshot,file),'utf8')!==execFileSync('git',['show',sha+':'+file],{cwd:root,encoding:'utf8'}))throw new Error('Frozen source mismatch: '+file)
}
const spec=`
import {describe,it,expect} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {asIsMap} from '../../map/v4/as-is'
import {toBeMap} from '../../map/v4/to-be'
import {planWorkspaces,stagesOf} from '../../map/v4/workspace'
import {templates} from '../../map/v4/definition'
import {AUTHORED_SETS,authoredRef} from '@/lib/knowledge/authored/authored-items'
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
 it('captures expanded TASK Workspace availability without promoting prepared content to release',()=>{
  const rows=AUTHORED_SETS.map(set=>{
   const items=set.items.filter(i=>i.role==='independent_check').map(i=>authoredRef(i.id))
   const local=asIsMap({asOf:NOW,sessions:[],axisProxy:null,checks:[{taskKey:set.taskKey,items}],attempts:[]})
   const confirmLinks={[set.taskKey]:items.map(target=>({target,href:'/csat/learn/'+target.slice(9),label:'qualified synthetic delivery'}))}
   const input={asIs:local,toBe:null,confirmLinks,transferItems:{},transferTargets:{}}
   const plan=planWorkspaces(input),definition=templates().find(t=>t.core[0]===set.taskId)
   const shown=[plan.primary,...plan.others].filter(Boolean).find(w=>w.core[0]===set.taskId)
   return{task:set.taskId,template:definition?.id,readiness:definition?.readiness,relatedTemplates:templates().filter(t=>t.core.includes(set.taskId)||t.support.includes(set.taskId)).map(t=>({id:t.id,relation:t.core.includes(set.taskId)?'core':'support'})),unseen:local.tasks[set.taskId]?.check?.unseen.length??0,directStageReady:definition?stagesOf(definition,local,input).check.ready:null,returnedWorkspace:!!shown,workspaceReady:shown?.stages.check.ready??false,inPreparing:plan.preparing.some(w=>w.id===definition?.id)}
  })
  console.log('AUTHORED_WORKSPACE_MATRIX='+JSON.stringify(rows))
  expect(rows).toHaveLength(17)
  expect(rows.find(r=>r.task===T)).toMatchObject({directStageReady:true,returnedWorkspace:true,workspaceReady:true})
  // This assertion captures the remaining defect, not product acceptance.
  expect(rows.some(r=>r.directStageReady&&!r.returnedWorkspace&&r.inPreparing)).toBe(true)
 })

 it('delivered authored checks now make the Workspace executable',()=>{
  const asIs=base(),toBe=need(asIs)
  const p=planWorkspaces({asIs,toBe,confirmLinks:links,transferItems:{},transferTargets:{}})
  const workspace=[p.primary,...p.others].find(w=>w?.id==='ws.central-meaning')!
  const actual=toBe.needs.find(n=>n.task===T)!
  console.log('AUTHORED_CONFIRM_FEEDBACK='+JSON.stringify({unseen:asIs.tasks[T].check?.unseen,need:actual.type,executable:actual.executable,workspaceCheck:workspace.stages.check,workspaceNext:workspace.next}))
  expect(asIs.tasks[T].check?.unseen).toHaveLength(2)
  expect(actual.type).toBe('CONFIRM');expect(actual.executable?.target).toBe(refs[0]);expect(workspace.stages.check.ready).toBe(true);expect(workspace.next?.target).toBe(refs[0]);const empty=planWorkspaces({asIs,toBe,confirmLinks:{},transferItems:{},transferTargets:{}});expect([empty.primary,...empty.others].find(w=>w?.id==='ws.central-meaning')?.stages.check.ready??false).toBe(false)
 })
 it('authored and legacy transfer keys both reach MAINTAIN',()=>{
  const asIs=base();asIs.tasks[T]={...asIs.tasks[T],status:'resolved',basis:'direct_check'}
  const keys=transferredKeysOf({lifecycleActivity:activity})
  const actual=need(asIs,keys).needs.find(n=>n.task===T)!
  const control=need(asIs,['claim-support']).needs.find(n=>n.task===T)!
  console.log('AUTHORED_TRANSFER_FEEDBACK='+JSON.stringify({keys,actual:actual.type,legacyKeyControl:control.type}))
  expect(keys).toEqual([K]);expect(actual.type).toBe('MAINTAIN');expect(control.type).toBe('MAINTAIN')
 })
 it('authored passage keys count distinct transfers and deduplicate aliases',async()=>{
  const db=new PGlite()
  try{
   await db.exec('create table public.csat_items(exam_id text,no integer,passage text); create table public.authored_item(ref text,passage_group text,body jsonb,passage_key text)')
   for(let i=0;i<activity.length;i++) await db.query('insert into public.authored_item values($1,$2,$3::jsonb,$4)',[activity[i].itemRef,'distinct-group-'+i,JSON.stringify({sentences:['Distinct original passage '+i]}),'fixture-key-'+i])
   await db.query('insert into public.csat_items values($1,1,$2)',['CONTROL','A known legacy source body.'])
   const legacy=await loadPassageKeys(new FakeClient(db,null) as unknown as SupabaseClient,['CONTROL#1'])
   expect(Object.keys(legacy)).toHaveLength(1)
   const keys=await loadPassageKeys(new FakeClient(db,null) as unknown as SupabaseClient,activity.map(a=>a.itemRef))
   const loaded=activity.map(a=>({...a,passageKey:keys[a.itemRef]??null}))
   const actual=transferDoneOf(T,null,loaded)
   console.log('AUTHORED_PASSAGE_FEEDBACK='+JSON.stringify({authoredRowsPresent:2,legacyIdentityCount:Object.keys(legacy).length,keys,loaded,transferDone:actual}))
   expect(Object.keys(keys)).toHaveLength(2);expect(actual).toBe(2);const same=loaded.map(a=>({...a,passageKey:'authored:same-key'}));expect(transferDoneOf(T,null,same)).toBe(1);expect(transferDoneOf(T,null,loaded.map(a=>({...a,passageKey:null})))).toBe(0)
  }finally{await db.close()}
 })
})
`
const test='src/lib/csat/authored/__tests__/codex-feedback7e.test.ts'
fs.writeFileSync(path.join(snapshot,'apps/web',test),spec)
const result=spawnSync(process.execPath,[path.join(root,'apps/web/node_modules/vitest/vitest.mjs'),'run',test],{cwd:path.join(snapshot,'apps/web'),encoding:'utf8',windowsHide:true,env:{...process.env,NODE_OPTIONS:'--require='+path.join(root,'scripts/csat/map/v62/r5-read-only-preload.cjs')},maxBuffer:4*1024*1024})
const output=[result.stdout??'',result.stderr??''].join('\n').replace(/\u001b\[[0-9;]*m/g,'')
fs.writeFileSync(path.join(root,'docs/research/final-independent-20261018/authored-owner7e-feedback.log'),'Frozen source: '+sha+'\nScope: isolated actual map functions + synthetic qualified contract inputs, PGlite for passage loader only; no actual DB.\n'+output)
process.stdout.write(output);process.exitCode=result.status??1
