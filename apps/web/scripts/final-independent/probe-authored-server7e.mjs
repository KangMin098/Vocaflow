// apps/web/scripts/final-independent/probe-authored-server7e.mjs
// Frozen owner RSC/server + synthetic PGlite. Session RPC transport is a named fixture, never a live DB.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync,spawnSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),sha='7e638e63d28791dcc4f886431c0205743dc3310a'
const run=fs.mkdtempSync(path.join(root,'.agent-logs/final-independent/server7e-')),snapshot=path.join(run,'snapshot')
fs.mkdirSync(snapshot)
execFileSync('git',['archive',sha,'--format=tar','--output='+path.join(run,'source.tar'),'apps/web/src','apps/web/package.json','apps/web/vitest.config.ts','apps/web/tsconfig.json','packages','supabase','docs/final','scripts/csat/map/v62','package.json','pnpm-workspace.yaml'],{cwd:root,windowsHide:true})
execFileSync('tar.exe',['-xf',path.join(run,'source.tar'),'-C',snapshot],{windowsHide:true})
for(const dir of ['node_modules','apps/web/node_modules'])fs.symlinkSync(path.join(root,dir),path.join(snapshot,dir),'junction')
const file='src/lib/csat/authored/__tests__/authored-flow.pglite.test.ts'
let source=fs.readFileSync(path.join(snapshot,'apps/web',file),'utf8')
source=source.replace("import { beforeAll, describe, expect, it } from 'vitest'","import { beforeAll, describe, expect, it, vi } from 'vitest'")
const extra=String.raw`
// Independent RSC dependency boundaries: session RPC transport below is synthetic;
// actual page.tsx, recordOpen, openDelivered, supply, list and binding SQL stay frozen.
let pageLearner: SupabaseClient
let pageAdmin: SupabaseClient
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>pageLearner}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>pageAdmin}))
vi.mock('@/lib/csat/rail-data',()=>({railExams:async()=>[]}))
vi.mock('@/components/csat/home/CsatShell',()=>({CsatShell:()=>null}))
vi.mock('@/components/csat/authored/AuthoredRunner',()=>({AuthoredRunner:()=>null}))
import LearnPage from '@/app/(app)/csat/learn/[id]/page'
const NOW=Date.parse('2026-10-18T10:00:00Z')
function pageContext(uid:string, failOpen:boolean){
 const l=learner(uid)
 pageLearner={auth:{getUser:async()=>({data:{user:{id:uid,email:'fixture@test.local'}}})},from:l.from.bind(l),rpc:l.rpc.bind(l)} as unknown as SupabaseClient
 pageAdmin={from:admin.from.bind(admin),rpc:async(name:string,args:Record<string,unknown>)=>{
  if(name!=='learning_session_apply')return admin.rpc(name,args)
  if(failOpen)return{data:null,error:{message:'independent synthetic session transport failure'}}
  const row=await q1<{id:string}>(` + '`insert into learning_sessions(user_id,client_session_id,activity,phase,item_ref,task_key,help_level,stage) values($1,$2,$3,$4,$5,$6,null,$7) returning id`' + String.raw`,[args.p_user,args.p_client_session_id,args.p_activity,args.p_phase,args.p_item_ref,args.p_task_key,args.p_stage])
  return{data:{session_id:row.id,outcome:'applied'},error:null}
 }} as unknown as SupabaseClient
}
async function actualPage(uid:string,id:string,deliveryId:string,fail:boolean){
 pageContext(uid,fail)
 const page=await LearnPage({params:{id},searchParams:{d:deliveryId}})
 // Successful page path returns the actual AuthoredRunner React element as its child.
 return page.props.children.props as {sentences:string[],sessionId?:string}
}
describe('Independent owner7e server repairs',()=>{
 it('FI007 revoked supply cannot open or satisfy current demand; historical evidence remains',async()=>{
  await db.exec('begin')
  try{
   await supply(A,'check',2)
   const target=ref('r5-cm-ind-1'),opened=await openDelivered(admin,learner(A),A,target)
   if(opened.status!=='ok')throw Error('positive open')
   await recordAuthoredAttempt(admin,learner(A),{id:A,email:'fixture@test.local'},target,{response:rightAnswer('r5-cm-ind-1'),...meta({answeredAt:new Date(NOW-1000).toISOString()}),deliveryId:opened.view.deliveryId},NOW,writer)
   const decision=await q1<{id:string}>(` + '`select id from content_human_decision where artifact_ref=$1 and kind=\'rights\'`' + String.raw`,[target])
   await (admin as unknown as FakeClient).auth()
   await db.query(` + '`select content_human_decision_revoke($1,\'independent synthetic revocation\')`' + String.raw`,[decision.id])
   const after=await openDelivered(admin,learner(A),A,target,opened.view.deliveryId)
   const supplied=await supply(A,'check',2),listed=await listDelivered(learner(A),A,TASK)
   const row=Array.isArray(listed)?listed.find(x=>x.deliveryId===opened.view.deliveryId):null
   console.log('OWNER7E_CURRENTNESS='+JSON.stringify({opened:after.status,line:supplied.status==='ok'?supplied.lines[0]:supplied,listed:row}))
   expect(after.status).toBe('revoked');expect(row).toMatchObject({current:false,evidence:true})
   if(supplied.status!=='ok')throw Error('supply')
   expect(supplied.lines[0].delivered).not.toContain(target);expect(supplied.lines[0].orderOpened).toBe(true)
  }finally{await db.exec('rollback')}
 })
 for(const failedFirst of [false,true])it('FI010 actual page '+(failedFirst?'failed open log still reveals body before later first evidence':'successful separate opening makes later answer non-first'),async()=>{
  await db.exec('begin')
  try{
   await supply(B,'check',2)
   const target=ref('r5-cm-ind-1'),deliveryId=await dOf(B,target)
   const first=await actualPage(B,'r5-cm-ind-1',deliveryId,failedFirst)
   const n=await q1<{n:number}>(` + '`select count(*)::int n from learning_sessions where user_id=$1 and item_ref=$2`' + String.raw`,[B,target])
   const second=await actualPage(B,'r5-cm-ind-1',deliveryId,false)
   await recordAuthoredAttempt(admin,learner(B),{id:B,email:'fixture@test.local'},target,{response:rightAnswer('r5-cm-ind-1'),...meta({clientSessionId:second.sessionId,answeredAt:new Date(NOW-1000).toISOString()}),deliveryId},NOW,writer)
   const binding=await q1<{first_exposure:boolean,evidence:boolean}>(` + '`select first_exposure,evidence from workspace_delivery_attempt where user_id=$1 and artifact_ref=$2`' + String.raw`,[B,target])
   console.log('OWNER7E_PAGE_EXPOSURE='+JSON.stringify({failedFirst,firstBodySentences:first.sentences.length,firstSessionIdIssued:!!first.sessionId,recordedBeforeClose:n.n,secondSessionIdIssued:!!second.sessionId,binding}))
   expect(first.sentences.length).toBeGreaterThan(0);expect(!!first.sessionId).toBe(!failedFirst);expect(n.n).toBe(failedFirst?0:1)
   // Capture the remaining product defect explicitly; true here is not an acceptance pass.
   expect(binding).toMatchObject({first_exposure:failedFirst,evidence:failedFirst})
  }finally{await db.exec('rollback')}
 })
})
`
source+='\n'+extra
fs.writeFileSync(path.join(snapshot,'apps/web',file),source)
const result=spawnSync(process.execPath,[path.join(root,'apps/web/node_modules/vitest/vitest.mjs'),'run',file,'-t','Independent owner7e server repairs'],{cwd:path.join(snapshot,'apps/web'),encoding:'utf8',windowsHide:true,env:{...process.env,NODE_OPTIONS:'--require='+path.join(root,'scripts/csat/map/v62/r5-read-only-preload.cjs')},maxBuffer:3*1024*1024})
const output=[result.stdout??'',result.stderr??''].join('\n').replace(/\u001b\[[0-9;]*m/g,'')
fs.writeFileSync(path.join(root,'docs/research/final-independent-20261018/authored-owner7e-server.log'),'Frozen owner: '+sha+'\nScope: actual RSC/server/binding SQL; synthetic session RPC transport and G2 writer, no real DB. Negative defect observation is not product acceptance.\n'+output)
process.stdout.write(output);process.exitCode=result.status??1