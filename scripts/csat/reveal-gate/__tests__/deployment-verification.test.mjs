// scripts/csat/reveal-gate/__tests__/deployment-verification.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { permissionDiff,dbPreflight,permanentPermissionIssues,directSelectDenied } from '../db-preflight.mjs'
import { validateLiveReceipt,securityAdvisor,checkpointIssues } from '../live-verification.mjs'
import pg from 'pg'
import { verifiedDbConfig } from '../tls-config.mjs'
import {EventEmitter} from 'node:events'
import {watchLiveDb} from '../live-db-watch.mjs'
import {graphQLScope,graphQLResponse,graphQLCollection} from '../graphql-probe.mjs'

test('live DB disconnects and heartbeat failures remain captured through cleanup',async()=>{
  const client=new EventEmitter(),failures=[];let tick,stopped=false
  client.query=async()=>{throw Object.assign(new Error('test reset'),{code:'ECONNRESET'})}
  const watch=watchLiveDb(client,x=>failures.push(x),{schedule:fn=>{tick=fn;return{}},cancel:()=>{stopped=true}})
  tick();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(watch.failed(),true);assert.equal(failures.length,1)
  client.emit('error',new Error('late disconnect'));assert.equal(failures.length,1)
  watch.stop();assert.equal(stopped,true)
})

test('GraphQL targets owned fixture keys and never counts invalid transport as zero exposure',async()=>{
  const context={exam:'M2099',itemIds:['M2099#18'],type:'TEST',sessionIds:['fixture'],userIds:['fixture']}
  assert.ok(graphQLScope(['exam_id','answer'],context).args.includes('M2099'))
  assert.ok(graphQLScope(['itemId','answer'],context).args.includes('M2099#18'))
  assert.equal(graphQLScope(['name'],context).targeted,false)
  for(const response of [new Response('<html>upstream unavailable</html>',{status:503}),new Response('{}'),new Response('[]')])assert.ok((await graphQLResponse(async()=>response,'https://example.test',{})).errors)
  assert.ok((await graphQLResponse(async()=>{throw Error('reset')},'https://example.test',{})).errors)
  assert.deepEqual(await graphQLResponse(async()=>new Response('{"data":{"ok":true}}'),'https://example.test',{}),{data:{ok:true}})
  for(const response of [{data:{}},{data:{items:null}},{data:{items:{edges:null}}},{data:{items:{edges:[{node:null}]}}},{data:{items:{edges:[{node:{}}]}}}])assert.ok(graphQLCollection(response,'items',['id']).errors)
  assert.deepEqual(graphQLCollection({data:{items:{edges:[]}}},'items',['id']),{data:{items:{edges:[]}}})
  assert.deepEqual(graphQLCollection({data:{items:{edges:[{node:{id:'owned'}}]}}},'items',['id']),{data:{items:{edges:[{node:{id:'owned'}}]}}})
})

test('live PostgreSQL parsing cannot replace verified TLS with URL options',()=>{
  const client=new pg.Client(verifiedDbConfig('postgresql://test:test@localhost/test?sslmode=no-verify&sslrootcert=ignored&uselibpqcompat=true','test-only-ca'))
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized,true)
  assert.equal(client.connectionParameters.ssl.ca,'test-only-ca')
  assert.equal(new URL(verifiedDbConfig('postgresql://localhost/test?sslmode=disable').connectionString).searchParams.has('sslmode'),false)
  assert.equal(verifiedDbConfig('postgresql://localhost/test').ssl.rejectUnauthorized,true)
  for(const option of ['no-verify','0']) {
    const parsed=new pg.Client(verifiedDbConfig('postgresql://localhost/test?ssl='+option,'test-only-ca')).connectionParameters.ssl
    assert.equal(parsed.rejectUnauthorized,true)
    assert.equal(parsed.ca,'test-only-ca')
  }
})
test('permission comparison covers policies, function ACL/body, and unordered keys',()=>{
  assert.equal(directSelectDenied('anon',401,{code:'42501'}),true)
  assert.equal(directSelectDenied('authenticated',403,{code:'42501'}),true)
  assert.equal(directSelectDenied('authenticated',401,{code:'42501'}),false)
  assert.equal(directSelectDenied('anon',401,{code:'PGRST301'}),false)
  assert.equal(directSelectDenied('authenticated',403,{code:'PGRST301'}),false)
  assert.equal(directSelectDenied('anon',200,{code:'42501'}),false)
  const before={permissions:[{object:'t',column:'answer',role:'anon',allowed:false}],policies:[{tablename:'t',policyname:'p',qual:'false'}],functions:[{signature:'f()',role:'anon',allowed:false,definition_hash:'a'}]}
  const same={...before,permissions:[{allowed:false,role:'anon',column:'answer',object:'t'}]}
  assert.deepEqual(permissionDiff(before,same).changes,[])
  const after={...before,policies:[{tablename:'t',policyname:'p',qual:'true'}],functions:[{signature:'f()',role:'anon',allowed:true,definition_hash:'b'}]}
  const diff=permissionDiff(before,after)
  assert.equal(diff.unexpected.length,2)
  assert.equal(permissionDiff(before,after,diff.changes).unexpected.length,2)
  assert.equal(permissionDiff(before,after,diff.changes.map(r=>({...r,decision:'test approved migration',reason:'explicit expected changes'}))).unexpected.length,0)
})
test('unsafe grade access cannot pass through identical before/after grants',()=>{
  const permissions=[['csat_dx_session','raw_score'],['csat_dx_session','grade'],['csat_dx_response','is_correct'],['csat_dx_snapshot','id'],['csat_dx_snapshot','forecast'],['csat_learner_state','record']].map(([object,column])=>({object,column,role:'authenticated',allowed:false}))
  assert.deepEqual(permanentPermissionIssues(permissions),[])
  permissions.find(r=>r.column==='grade').allowed=true
  assert.deepEqual(permissionDiff({permissions},{permissions}).changes,[])
  assert.ok(permanentPermissionIssues(permissions).some(r=>r.column==='grade'))
  assert.ok(permanentPermissionIssues([]).some(r=>r.kind==='missing_permanent_revocation_relation'))
})
test('unexecuted, stale, skipped or incomplete live receipts cannot pass',()=>{
  assert.equal(validateLiveReceipt({results:[],pass:0,fail:0},null,'new').ok,false)
  const results=['canary','rpc','oracle','app','bundle','정리'].map(area=>({area,name:'checked',ok:true}))
  for(const actor of ['P','N','anon'])results.push({area:'canary',name:actor+' · checked',ok:true})
  const receipt={results,pass:results.length,fail:0}
  assert.equal(validateLiveReceipt(receipt,'old','new').ok,true)
  assert.equal(validateLiveReceipt(receipt,'same','same').ok,false)
  assert.equal(validateLiveReceipt({...receipt,results:results.filter(r=>r.area!=='app')},'old','new').ok,false)
  assert.equal(validateLiveReceipt({...receipt,pass:0},'old','new').ok,false)
  const skipped=[...results,{area:'app',name:'앱 경로 생략',ok:true}]
  assert.equal(validateLiveReceipt({...receipt,results:skipped,pass:skipped.length},'old','new').ok,false)
})
test('missing deployment credentials/advisor execution are blocked',async()=>{
  assert.equal((await dbPreflight('.',{},{})).status,'BLOCKED')
  assert.equal((await securityAdvisor({})).ok,false)
  const env={SUPABASE_ACCESS_TOKEN:'test-only'}
  assert.equal((await securityAdvisor(env,async()=>({ok:true,json:async()=>({})}))).ok,false)
  assert.equal((await securityAdvisor(env,async()=>({ok:true,json:async()=>({lints:[{name:'bad',level:'ERROR'}]})}))).ok,false)
  assert.equal((await securityAdvisor(env,async()=>({ok:true,json:async()=>({lints:[]})}))).ok,true)
})
test('missing checkpoint axes block; rotating bloat subjects are explicitly distinguished',()=>{
  assert.equal(checkpointIssues([]).length,1)
  assert.equal(checkpointIssues([{metric:'rows',status:'disappeared'}]).length,1)
  assert.deepEqual(checkpointIssues([{metric:'bloat_sampled_pct',subject:'a',status:'disappeared'},{metric:'bloat_sampled_pct',subject:'b',status:'appeared'}]),[])
  assert.equal(checkpointIssues([{metric:'bloat_sampled_pct',subject:'a',status:'disappeared'},{metric:'bloat_sampled_pct',subject:'a',status:'appeared'}]).length,1)
})
