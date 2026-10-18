// apps/web/scripts/final-independent/probe-authored-server7e.mjs
// Frozen owner RSC/server + synthetic PGlite. Session RPC transport is a named fixture, never a live DB.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync,spawnSync} from 'node:child_process'
const ownerRework=process.argv.includes('--owner-rework')
const root=path.resolve(import.meta.dirname,'../../../..'),sha=ownerRework?'4a42b2b65eaaa164cc12a487dfcb806657ef9399':'7e638e63d28791dcc4f886431c0205743dc3310a'
const openCandidate=process.argv.includes('--candidate-open')
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
if(openCandidate){
 const pageFile='apps/web/src/app/(app)/csat/learn/[id]/page.tsx'
 const before=fs.readFileSync(path.join(snapshot,pageFile),'utf8')
 if(before!==execFileSync('git',['show','9647b45e1:'+pageFile],{cwd:root,encoding:'utf8'}))throw Error('Latest page source differs; candidate requires review')
 const marker='  return (\n    <CsatShell place="practice" exams={await railExams()} pill={pill} bare>\n      <AuthoredRunner'
 if(!before.includes(marker))throw Error('Page insertion boundary changed')
 const guard=`  if (!v.done && !opened2) {
    return (
      <CsatShell place="practice" exams={await railExams()} pill={pill} bare>
        <div className={styles.page} data-testid="authored-open-unavailable">
          <header className={styles.head}>
            <h1>자료를 열지 못했어요</h1>
            <p className={styles.why}>잠시 뒤 학습 지도에서 다시 열어 주세요.</p>
          </header>
          <Link className={styles.link} href={MAP_HREF}>학습 지도로 가기</Link>
        </div>
      </CsatShell>
    )
  }
`
 const after=before.replace(marker,guard+marker)
 fs.writeFileSync(path.join(snapshot,pageFile),after)
 const beforeFile=path.join(run,'page.before.tsx');fs.writeFileSync(beforeFile,before)
 const diff=spawnSync('git',['diff','--no-index','--',beforeFile,path.join(snapshot,pageFile)],{cwd:root,encoding:'utf8',windowsHide:true})
 if(diff.status!==1)throw Error('Candidate diff missing')
 const canonical=diff.stdout.split('\n').map(line=>line.startsWith('diff --git ')?'diff --git a/'+pageFile+' b/'+pageFile:line.startsWith('--- ')?'--- a/'+pageFile:line.startsWith('+++ ')?'+++ b/'+pageFile:line).join('\n')
 fs.writeFileSync(path.join(root,'docs/research/final-independent-20261018/fi010-open-candidate.patch'),canonical)
 source=source.replace('failed open log still reveals body before later first evidence','failed open log withholds body before later first evidence')
 source=source.replace('firstBodySentences:first.sentences.length','firstBodySentences:first.sentences?.length??0')
 source=source.replace("const NOW=Date.parse('2026-10-18T10:00:00Z')",`const visibleText=(value:unknown):string=>typeof value==='string'?value:Array.isArray(value)?value.map(visibleText).join(''):value&&typeof value==='object'?visibleText((value as {props?:{children?:unknown}}).props?.children):''\nconst NOW=Date.parse('2026-10-18T10:00:00Z')`)
 source=source.replace('expect(first.sentences.length).toBeGreaterThan(0);',`expect(first.sentences?.length??0).toBe(failedFirst?0:6);if(failedFirst){expect(first).toMatchObject({'data-testid':'authored-open-unavailable'});expect(visibleText((first as unknown as {children:unknown}).children)).toContain('자료를 열지 못했어요');}`)
 source=source.replace('// Capture the remaining product defect explicitly; true here is not an acceptance pass.','// Withheld body makes the later successful opening genuinely first; successful prior opening stays non-evidence.')
}
if(ownerRework){
 source=source.replace('failOpen:boolean','failOpen:boolean|\'after\'')
 source=source.replace('if(failOpen)return','if(failOpen===true)return')
 source=source.replace("return{data:{session_id:row.id,outcome:'applied'},error:null}","if(failOpen==='after')return{data:null,error:{message:'synthetic response lost after session commit'}};return{data:{session_id:row.id,outcome:'applied'},error:null}")
 source=source.replace('deliveryId:string,fail:boolean','deliveryId:string,fail:boolean|\'after\'')
 source=source.replace('for(const failedFirst of [false,true])','for(const failedFirst of [false,true,\'after\'] as const)')
 source=source.replace('failed open log still reveals body before later first evidence','failed open log withholds body; commit/ack loss remains conservative')
 source=source.replace('firstBodySentences:first.sentences.length','firstBodySentences:first.sentences?.length??0')
 source=source.replace("const NOW=Date.parse('2026-10-18T10:00:00Z')",`const visibleText=(value:unknown):string=>typeof value==='string'?value:Array.isArray(value)?value.map(visibleText).join(''):value&&typeof value==='object'?visibleText((value as {props?:{children?:unknown}}).props?.children):''\nconst NOW=Date.parse('2026-10-18T10:00:00Z')`)
 source=source.replace('expect(first.sentences.length).toBeGreaterThan(0);expect(!!first.sessionId).toBe(!failedFirst);expect(n.n).toBe(failedFirst?0:1)',`expect(first.sentences?.length??0).toBe(failedFirst?0:6);if(failedFirst){expect(first).toMatchObject({'data-testid':'authored-open-unavailable'});expect(visibleText((first as unknown as {children:unknown}).children)).toContain('자료를 열지 못했어요');}expect(!!first.sessionId).toBe(!failedFirst);expect(n.n).toBe(failedFirst===true?0:1)`)
 source=source.replace('expect(binding).toMatchObject({first_exposure:failedFirst,evidence:failedFirst})','expect(binding).toMatchObject({first_exposure:failedFirst===true,evidence:failedFirst===true})')
 source+=String.raw`
describe('FI010 first answer and completed revisit',()=>{
 it('first exposed body can be evidence; completed revisit never manufactures another first attempt',async()=>{
  await db.exec('begin')
  try{
   await supply(B,'check',2)
   const target=ref('r5-cm-ind-1'),deliveryId=await dOf(B,target)
   const first=await actualPage(B,'r5-cm-ind-1',deliveryId,false)
   expect(first.sentences.length).toBe(6)
   await recordAuthoredAttempt(admin,learner(B),{id:B,email:'fixture@test.local'},target,{response:rightAnswer('r5-cm-ind-1'),...meta({clientSessionId:first.sessionId,answeredAt:new Date(NOW-1000).toISOString()}),deliveryId},NOW,writer)
   const before=await q1<{first_exposure:boolean,evidence:boolean}>(` + '`select first_exposure,evidence from workspace_delivery_attempt where user_id=$1 and artifact_ref=$2`' + String.raw`,[B,target])
   expect(before).toMatchObject({first_exposure:true,evidence:true})
   const complete=await actualPage(B,'r5-cm-ind-1',deliveryId,true)
   expect(complete.sentences.length).toBe(6);expect(complete.sessionId).toBeUndefined()
   expect((complete as unknown as {done:unknown}).done).toBeTruthy()
   const after=await q1<{n:number}>(` + '`select count(*)::int n from workspace_delivery_attempt where user_id=$1 and artifact_ref=$2`' + String.raw`,[B,target])
   expect(after.n).toBe(1)
   console.log('REWORK_PAGE_FIRST_AND_DONE='+JSON.stringify({firstEvidence:before.evidence,completedBodySentences:complete.sentences.length,attemptRows:after.n}))
  }finally{await db.exec('rollback')}
 })
})
`
}
fs.writeFileSync(path.join(snapshot,'apps/web',file),source)
const result=spawnSync(process.execPath,[path.join(root,'apps/web/node_modules/vitest/vitest.mjs'),'run',file,'-t',ownerRework?'FI010':openCandidate?'FI010 actual page':'Independent owner7e server repairs',...(ownerRework?['--pool=forks','--maxWorkers=1','--minWorkers=1']:[])],{cwd:path.join(snapshot,'apps/web'),encoding:'utf8',windowsHide:true,env:{...process.env,NODE_OPTIONS:'--require='+path.join(root,'scripts/csat/map/v62/r5-read-only-preload.cjs')},maxBuffer:3*1024*1024})
const output=[result.stdout??'',result.stderr??''].join('\n').replace(/\u001b\[[0-9;]*m/g,'')
fs.writeFileSync(path.join(root,'docs/research/final-independent-20261018/'+(ownerRework?'authored-rework-open.log':openCandidate?'authored-open-guard-candidate.log':'authored-owner7e-server.log')),'Frozen owner: '+sha+'\nScope: actual RSC/server/binding SQL; synthetic session RPC transport and G2 writer, no real DB. '+(ownerRework?'Actual product guard; normal/failure/commit-ack loss/reopen/first answer/completed history checked.':openCandidate?'Candidate guard changes ignored snapshot only; unchanged tests skipped.':'Negative defect observation is not product acceptance.')+'\n'+output)
process.stdout.write(output);process.exitCode=result.status??1
