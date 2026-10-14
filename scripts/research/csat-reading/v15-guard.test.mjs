// scripts/research/csat-reading/v15-guard.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import {publicOnly,readable,noPromotion,frozen} from './v15-guard.mjs';
test('nested actual Gold or response cannot enter public ledger',()=>{for(const k of ['gold','passage','student_prompt','response_text'])assert.throws(()=>publicOnly({roles:[{[k]:'restricted'}]}),/Private content/);});
test('opaque references and staged counts remain public metadata',()=>assert.doesNotThrow(()=>publicOnly({private_detail:{path:'local/a.json',sha256:'hash'},students:0,source_verified:'AI_source_bound'})));
test('choice count is metadata but original choice array remains private',()=>{assert.doesNotThrow(()=>publicOnly({field_presence:{choices:5}}));assert.throws(()=>publicOnly({choices:['original candidate']}),/Private content/);});
test('encoding damage is not rescued by matching byte hashes',()=>{assert.throws(()=>readable({criterion:'?? ???'}),/Encoding damaged/);assert.throws(()=>readable({criterion:'범위\uFFFD'}),/Encoding damaged/);assert.doesNotThrow(()=>readable({criterion:'어떤 범위인가?'}));});
test('synthetic agreement cannot promote direct assessment',()=>assert.throws(()=>noPromotion({students:0,assessment_qualified:1}),/cannot authorize/));
test('AI content review cannot promote public eligibility',()=>assert.throws(()=>noPromotion({human_or_rights_approved:false,public_qualified:1}),/public rights/));
test('explicit holds preserve design completion',()=>assert.doesNotThrow(()=>noPromotion({students:0,assessment_qualified:0,human_or_rights_approved:false,public_qualified:0})));
test('unavailable hash-bound artifact cannot be silently ignored',()=>assert.throws(()=>frozen({'scripts/research/csat-reading/local/nonexistent-frozen-fixture.json':'invalid'}),/ENOENT/));
