// scripts/research/csat-reading/v13-source.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {atomicRanges,deriveUnits,informationBudget} from './v13-source-units.mjs';
test('honorifics and decimals do not create artificial sentences',()=>{assert.deepEqual(atomicRanges('Ms. Green met Mr. Doe and Dr. Smith. Value is 3.14.').map(x=>x.text),['Ms. Green met Mr. Doe and Dr. Smith.','Value is 3.14.']);});
test('terminal abbreviation requires an explicit source-checked boundary',()=>{const text='From 305 to 304 B.C. Interestingly, it survived.';assert.equal(atomicRanges(text).length,1);assert.equal(atomicRanges(text,0,{forcedEnds:[text.indexOf('B.C.')+4]}).length,2);});
test('multiple utterances stay separate budget units while quote fragments are not promoted to independent propositions',()=>{const x=deriveUnits({passage:'She said, “Wait! Stay here.”',presentation:{}});assert.equal(x.length,2);assert.equal(x[0].syntactic_completeness,'not_inferred_from_boundary');});
test('printed blocks do not count as single sentences',()=>{const passage='(A) One sentence. Another one.';const units=deriveUnits({passage,presentation:{blocks:[{label:'(A)',start:4,end:passage.length}]}});assert.equal(units.length,2);assert.ok(units.every(u=>u.block_label==='(A)'&&passage.slice(u.start,u.end)===u.text));});
test('summary task stimulus is accounted separately from body',()=>{const units=deriveUnits({passage:'Body. Summary.',presentation:{kind:'summary',body_box:{end:5},summary_sentence:{start:6,end:14}}});assert.deepEqual(units.map(u=>u.role),['body','task_stimulus']);});
test('duplicated candidate evidence contributes to the effective reading union',()=>{const item={units:[{id:'s1',start:0,end:8,sentence_count:1},{id:'s2',start:9,end:18,sentence_count:1}],presentation:{inline_candidates:[{start:0,end:8},{start:9,end:18}]}};assert.equal(informationBudget(item,['s1'],['c1','c2']).effective_sentence_union,2);});
