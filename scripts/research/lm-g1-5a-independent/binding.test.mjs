// scripts/research/lm-g1-5a-independent/binding.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertSameManifest,assertRows,productHashes} from './binding.mjs'
test('missing, truncated and changed source bindings fail closed',()=>{
 const expected={product:'a',runner:'b'}
 for(const actual of [null,{}, {product:'a'}, {...expected,runner:'changed'},{...expected,extra:'c'}])assert.throws(()=>assertSameManifest(actual,expected))
 assert.doesNotThrow(()=>assertSameManifest({runner:'b',product:'a'},expected))
})
test('failed, missing, and truthy nonboolean results cannot qualify',()=>{
 for(const rows of [[],[{pass:false}],[{pass:1}],[{}],null])assert.throws(()=>assertRows(rows,1))
 assert.doesNotThrow(()=>assertRows([{pass:true}],1))
})
test('an unavailable Git source baseline cannot yield an empty passing manifest',()=>{
 assert.throws(()=>productHashes(import.meta.dirname+'/local/not-a-repository'))
})
