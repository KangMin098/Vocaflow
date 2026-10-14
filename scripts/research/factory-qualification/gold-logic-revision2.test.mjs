// scripts/research/factory-qualification/gold-logic-revision2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFacetState,uniqueAddress} from './gold-logic-revision2.mjs';
test('explicit independent unit survives unresolved comparison target',()=>{assert.equal(scopedFacetState([{id:'unit',status:'correct'},{id:'indicator',status:'unresolved'},{id:'period',status:'missing'}]),'partial');assert.equal(scopedFacetState([{id:'unit',status:'unresolved'},{id:'indicator',status:'unresolved'}]),'defer');});
test('registered indicator-distinction contradiction defeats partial boundary',()=>{const c=[{id:'synthetic',status:'correct'},{id:'visual',status:'correct'},{id:'indicator_distinction',status:'missing'}];assert.equal(scopedFacetState(c),'partial');assert.equal(scopedFacetState(c.map(x=>x.id==='indicator_distinction'?{...x,status:'contradiction'}:x)),'defect');});
test('second compatible source tuple blocks unique address credit',()=>{assert.deepEqual(uniqueAddress([{id:'row1',compatible:true},{id:'row2',compatible:false}]),{status:'unique',id:'row1'});assert.equal(uniqueAddress([{id:'row1',compatible:true},{id:'row2',compatible:true}]).status,'unresolved');});
test('invented status and unrecorded address evidence reject',()=>{assert.throws(()=>scopedFacetState([{id:'a',status:'probable'}]));assert.throws(()=>uniqueAddress([{id:'a'}]));});
