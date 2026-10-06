// scripts/csat/reveal-gate/__tests__/deployment-verification.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { permissionDiff,dbPreflight } from '../db-preflight.mjs'
import { validateLiveReceipt,securityAdvisor,checkpointIssues } from '../live-verification.mjs'
test('permission comparison covers policies, function ACL/body, and unordered keys',()=>{
  const before={permissions:[{object:'t',column:'answer',role:'anon',allowed:false}],policies:[{tablename:'t',policyname:'p',qual:'false'}],functions:[{signature:'f()',role:'anon',allowed:false,definition_hash:'a'}]}
  const same={...before,permissions:[{allowed:false,role:'anon',column:'answer',object:'t'}]}
  assert.deepEqual(permissionDiff(before,same).changes,[])
  const after={...before,policies:[{tablename:'t',policyname:'p',qual:'true'}],functions:[{signature:'f()',role:'anon',allowed:true,definition_hash:'b'}]}
  const diff=permissionDiff(before,after)
  assert.equal(diff.unexpected.length,2)
  assert.equal(permissionDiff(before,after,diff.changes).unexpected.length,2)
  assert.equal(permissionDiff(before,after,diff.changes.map(r=>({...r,decision:'test approved migration',reason:'explicit expected changes'}))).unexpected.length,0)
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
