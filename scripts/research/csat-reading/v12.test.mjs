// scripts/research/csat-reading/v12.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {sufficientGate,assertPreserved,validateRater} from './v12-analysis.mjs'
import {mappingRow} from './v12-map.mjs'
test('unanimous negatives are not evidence of positive sufficiency',()=>{
 const x=sufficientGate(Array(16).fill('insufficient'),Array(16).fill('insufficient'),Array(16).fill('grammar'))
 assert.equal(x.raw_agreement,1);assert.equal(x.positive_agreement,null);assert.equal(x.numeric_pass,false)
})
test('positive agreement and type breadth constrain the gate',()=>{
 const x=sufficientGate(['sufficient','sufficient','sufficient','insufficient'],['sufficient','sufficient','insufficient','insufficient'],['a','a','a','b'])
 assert.equal(x.positive_agreement,.8);assert.equal(x.numeric_pass,false)
})
test('defer agreements cannot raise resolved agreement',()=>{
 const x=sufficientGate(['sufficient','defer'],['sufficient','defer'],['a','b'])
 assert.equal(x.exact_excluding_defer_over_all,.5);assert.equal(x.defer_rate,.5)
})
test('missing tag is unknown, automatic direct candidate is not promoted',()=>{
 const item={id:'sample#1',exam:'sample',type:'R-TITLE'},analysis={analysis_version:3,v3:{requirement:{},choices:Array(5).fill({})}}
 const noTag=mappingRow(item,{id:'s.attachment',axis:'S',kind:'atomic'},analysis)
 assert.equal(noTag.relevance,'unknown');assert.equal(noTag.candidate_relevance,'unknown')
 const candidate=mappingRow(item,{id:'e.option_correspondence',axis:'E',kind:'atomic'},analysis)
 assert.equal(candidate.candidate_relevance,'direct');assert.equal(candidate.relevance,'unknown');assert.equal(candidate.public_learning_use,false)
})
test('actual task links cannot be populated from a label without source evidence',()=>{
 assert.throws(()=>mappingRow({id:'x',type:'R-TITLE'},{id:'e.task_demand',axis:'E'},{v3:{}},{relevance:'direct',why:'type label'}),/source-checked/)
})
test('old ledger byte drift fails before recalculation',()=>{
 assert.throws(()=>assertPreserved({old_frozen_hashes:{old:'bad'}},()=>Buffer.from('changed')),/hash mismatch/)
})
test('five option verification and window containment are guarded',()=>{
 const input={items:[{id:'x',source_binding:'bound',passage:'abc def',units:[{id:'u1',text:'abc',start:0,end:3,kind:'sentence'},{id:'u2',text:'def',start:4,end:7,kind:'sentence'}],glosses:[]}]}
 const r={protocol:'1.2',answer_blind:true,rater:'A',items:[{id:'x',binding:'bound',solved_answer:1,discourse:'exposition',task:'retrieve',complexity:[],proposition:[],decisive_relations:['none'],background_relations:[],inference:['explicit'],choices:[],paths:[{id:'p',used_units:['u1'],ranges:[{start:0,end:7}],gloss_ids:[],cells:[],assumptions:['unique_correct_option'],why:'proof',option_verification:[{n:1,units:['u2'],fit:'fits',why:'outside'}]}],methods:{core_sentence:{AI:'sufficient',FOV:'sufficient',path_id:'p',why:'candidate',educational_effect:'not_tested'}},design:{level:'logical',statement:'hypothesis'}}]}
 const errors=validateRater(r,input);assert.ok(errors.some(x=>x.includes('ranges not contained')));assert.ok(errors.some(x=>x.includes('outside window')));assert.ok(errors.some(x=>x.includes('five resolved proofs')));assert.ok(errors.some(x=>x.includes('requires conditional')))
})
