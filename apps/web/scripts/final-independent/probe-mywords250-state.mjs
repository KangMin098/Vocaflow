// apps/web/scripts/final-independent/probe-mywords250-state.mjs
// Actual frozen PR250 state route + isolated PGlite; synthetic same-learner note writes only.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync,spawnSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),sha='4fdc7ba76ac5f50493da668b85c1735e09a208ff'
const run=fs.mkdtempSync(path.join(root,'.agent-logs/final-independent/pr250-race-')),snapshot=path.join(run,'snapshot');fs.mkdirSync(snapshot)
execFileSync('git',['archive',sha,'--format=tar','--output='+path.join(run,'source.tar'),'apps/web/src','apps/web/package.json','apps/web/vitest.config.ts','apps/web/tsconfig.json','packages','tsconfig.base.json'],{cwd:root,windowsHide:true});execFileSync('tar.exe',['-xf',path.join(run,'source.tar'),'-C',snapshot],{windowsHide:true})
for(const dir of ['node_modules','apps/web/node_modules'])fs.symlinkSync(path.join(root,dir),path.join(snapshot,dir),'junction')
const spec=String.raw`
import {PGlite} from '@electric-sql/pglite'
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
let db:PGlite, reads=0, barrier=false,release:(()=>void)|undefined,ready:Promise<void>,currentUser='synthetic-learner-a'

const admin={from:()=>({select:()=>({eq:(_key:string,user:string)=>({maybeSingle:async()=>{
 const r=await db.query<{record:unknown}>('select record from csat_learner_state where user_id=$1',[user]);const snapshot=r.rows[0]??null
 if(barrier){reads++;if(reads===2)release!();await ready}
 return{data:snapshot,error:null}
}})}),upsert:async(row:{user_id:string,record:unknown,updated_at:string})=>{
 await db.query('insert into csat_learner_state(user_id,record,updated_at) values($1,$2::jsonb,$3) on conflict(user_id) do update set record=excluded.record,updated_at=excluded.updated_at',[row.user_id,JSON.stringify(row.record),row.updated_at]);return{error:null}
}})} as unknown as SupabaseClient
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>admin}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:currentUser}}})}})}))
vi.mock('@/lib/csat/embargo-gate',()=>({itemRevealDecision:async()=>({held:new Set<string>(),failed:false}),revealHeldResponse:()=>new Response(JSON.stringify({held:true}),{status:423})}))
import {GET,PUT} from '@/app/api/csat/state/route'
import {withView} from '@/lib/csat/continuity'
import {writeMeaningNote} from '@/lib/csat/meaning-note'
const NOW=1792317600000,ITEM='SYNTHETIC#1',binding={analysisVersion:1,contentHash:'aaaaaaaaaaaaaaaa'}
const base=(id:string)=>withView({version:1,seed:1,onboarded:true,predictions:[],formulas:[],queue:[],completed:[],meaningNotes:[writeMeaningNote(null,{item:ITEM,unitId:id,text:'Synthetic own-language note '+id,binding},NOW)!],updatedAt:NOW},ITEM,NOW)
const put=(record:unknown)=>PUT(new Request('http://isolated.test/api/csat/state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({record})}))
const saved=async()=>(await db.query<{record:{meaningNotes?:{unitId:string}[]}}>('select record from csat_learner_state where user_id=$1',[currentUser])).rows[0]?.record
beforeAll(async()=>{db=new PGlite();await db.exec('create table csat_learner_state(user_id text primary key,record jsonb,updated_at timestamptz)')})
afterAll(async()=>{await db.close()})
beforeEach(async()=>{await db.exec('delete from csat_learner_state');currentUser='synthetic-learner-a';reads=0;barrier=false;ready=new Promise<void>(r=>release=r);})
describe('Independent PR250 state write concurrency',()=>{
 it('sequential distinct-note saves preserve both notes',async()=>{
  const a=await put(base('unit-one')),b=await put(base('unit-two'));const noteIds=(await saved())?.meaningNotes?.map(x=>x.unitId).sort()
  console.log('MYWORDS_SEQUENTIAL='+JSON.stringify({statuses:[a.status,b.status],noteIds}));expect([a.status,b.status]).toEqual([200,200]);expect(noteIds).toEqual(['unit-one','unit-two'])
 })
 it('two acknowledged concurrent saves overwrite a different note on the server',async()=>{
  barrier=true;const result=await Promise.all([put(base('unit-one')),put(base('unit-two'))]);barrier=false
  const noteIds=(await saved())?.meaningNotes?.map(x=>x.unitId),fetched=await(await GET()).json()
  console.log('MYWORDS_CONCURRENT='+JSON.stringify({statuses:result.map(r=>r.status),bothReadBeforeWrite:reads===2,storedNoteIds:noteIds,freshGetNoteIds:fetched.record.meaningNotes.map((x:{unitId:string})=>x.unitId)}))
  // Observation of the defect; a passing test here is not acceptance.
  expect(result.map(r=>r.status)).toEqual([200,200]);expect(reads).toBe(2);expect(noteIds).toHaveLength(1);expect(fetched.record.meaningNotes).toHaveLength(1)
 })
})

`
const target='src/lib/csat/__tests__/independent-pr250-race.test.ts';fs.writeFileSync(path.join(snapshot,'apps/web',target),spec)
const r=spawnSync(process.execPath,[path.join(root,'apps/web/node_modules/vitest/vitest.mjs'),'run',target],{cwd:path.join(snapshot,'apps/web'),windowsHide:true,encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--require='+path.join(root,'scripts/csat/map/v62/r5-read-only-preload.cjs')},maxBuffer:3*1024*1024})
const out=[r.stdout??'',r.stderr??''].join('\n').replace(/\u001b\[[0-9;]*m/g,'');fs.writeFileSync(path.join(root,'docs/research/final-independent-20261018/pr250-state-race.log'),'Frozen owner '+sha+'; actual route/merge + isolated PGlite; synthetic own-learner records; no remote DB. Passing observation of data-loss defect is not product acceptance.\n'+out);process.stdout.write(out);process.exitCode=r.status??1