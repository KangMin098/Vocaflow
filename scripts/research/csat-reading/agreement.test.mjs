// scripts/research/csat-reading/agreement.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { categorical,jaccard,pairRows,assertHash } from './agreement.mjs'
import { createHash } from 'node:crypto'
test('registered originals and keys reject changed bytes or absent hashes',()=>{
 const original=Buffer.from('pinned original'),hash=createHash('sha256').update(original).digest('hex')
 assert.doesNotThrow(()=>assertHash(original,hash,'input'))
 assert.throws(()=>assertHash(Buffer.from('changed key'),hash,'key'),/hash mismatch: key/)
 assert.throws(()=>assertHash(original,undefined,'manifest'),/hash mismatch: manifest/)
})
test('agreement must not treat marginal prevalence as independent agreement',()=>{
 const s=categorical(['a','a','b','b'],['a','a','a','b']);assert.equal(s.raw_agreement,0.75);assert.equal(s.kappa,0.5)
 assert.equal(categorical(['a','a'],['a','a']).kappa,null)
})
test('multi-label agreement counts sets, not duplicated labels',()=>{
 assert.equal(jaccard(['cause','cause','condition'],['cause','example']),1/3);assert.equal(jaccard([],[]),0)
})
test('mutual unresolved labels cannot authorize expansion',()=>{
 const s=categorical(['a','unresolved'],['a','unresolved']);assert.equal(s.raw_agreement,1);assert.equal(s.scorable_agreement_over_all,0.5);assert.equal(s.resolved_pair_n,1)
 assert.equal(categorical(['unresolved'],['unresolved']).scorable_agreement_over_all,0)
})
test('stale input, duplicate IDs and missing items cannot enter agreement',()=>{
 const m=[{id:'x',binding:'current'}],a=[{id:'x',binding:'current'}];assert.equal(pairRows(a,a,m).length,1)
 assert.throws(()=>pairRows(a,[{id:'x',binding:'stale'}],m),/binding/)
 assert.throws(()=>pairRows(a,[],m),/Missing/)
 assert.throws(()=>pairRows([...a,...a],a,m),/Duplicate/)
})
