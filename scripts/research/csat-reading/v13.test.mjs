// scripts/research/csat-reading/v13.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import {setAgreement,limitedBudget} from './v13-analysis.mjs';
import {atomicRanges,deriveUnits} from './v13-source-units.mjs';
test('empty sets are unassessed, never perfect agreement',()=>assert.deepEqual(setAgreement([],[]),{score:null,both_empty:true}));
test('multilabel Jaccard preserves disagreement',()=>assert.equal(setAgreement(['local_bridge','syntax_semantics'],['local_bridge']).score,.5));
test('honorific and decimal boundaries preserve the original',()=>{const t='Ms. Smith used 1.5 hours. She left.';const u=atomicRanges(t);assert.equal(u.length,2);assert.equal(u[0].text,'Ms. Smith used 1.5 hours.');assert.ok(u.every(x=>t.slice(x.start,x.end)===x.text));});
test('two blocks containing four sentences exceed narrow selective budget',()=>{const item={units:[{id:'a',sentence_count:2},{id:'b',sentence_count:2}]};assert.equal(limitedBudget(item,{used_units:['a','b'],complete_sentences:['a','b']},'selective').budget_ok,false);});
test('summary semantic stimulus is not free outside the reading budget',()=>{const item={units:[{id:'a',sentence_count:1},{id:'z',sentence_count:1}]};assert.equal(limitedBudget(item,{used_units:['a'],stimulus_units:['z'],complete_sentences:['a']},'core_sentence').budget_ok,false);});
test('nonadjacent two sentences do not satisfy consecutive selective method',()=>{const item={units:[{id:'a',sentence_count:1},{id:'b',sentence_count:1},{id:'c',sentence_count:1}]};assert.equal(limitedBudget(item,{used_units:['a','c'],complete_sentences:['a','c']},'selective').budget_ok,false);});
test('unknown sentence IDs are blocked',()=>assert.equal(limitedBudget({units:[]},{used_units:['a'],complete_sentences:['a']},'core_sentence').budget_ok,false));
test('units retain exact text instead of rewriting passage',()=>{const it={passage:'Ms. Kim spoke. We listened.',presentation:{kind:'prose'}};const u=deriveUnits(it);assert.equal(u.length,2);assert.ok(u.every(x=>it.passage.slice(x.start,x.end)===x.text));});
