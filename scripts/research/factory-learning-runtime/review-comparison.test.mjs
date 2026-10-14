// scripts/research/factory-learning-runtime/review-comparison.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';import {compare,buildComparison} from './review-comparison.mjs';
test('actual first judgments and raw mismatches stay in14-case conservative ledger',()=>{const x=buildComparison();assert.equal(x.rows.length,14);assert.equal(x.first_results_overwritten,false);assert.equal(x.counts.qualification_hold,14);assert.equal(x.counts.public_qualified,0);});
test('missing independent item does not silently disappear from denominator',()=>{const a={items:Array.from({length:14},(_,i)=>({id:'i'+i,type:'synthetic_contract_test',axes:{B:{state:'pass'},E:{state:'pass'}}}))},b={author_feedback_read:false,items:[]};assert.throws(()=>compare(a,b),/condition/);});
