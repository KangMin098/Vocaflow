// scripts/research/csat-reading/main-agreement.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {validateRater,sourceAdmission} from './main-agreement.mjs'
const input={items:[{id:'x',passage:'A condition limits the result.',stem:'Choose the incorrect claim.',choices:['p','q','r','s','t']}]}
const row=()=>({id:'x',solved_answer:1,discourse:'exposition',complexity:['scope'],proposition:['condition'],decisive_relations:['none'],background_relations:[],relation_edges:[],inference:['explicit'],task:'retrieve',choices:[1,2,3,4,5].map(n=>({n,content:n===1?'contradicted':'entailed',fit:n===1?'fits':'fails',failure:n===1?'scope':'none',why:'Incorrect claim is selected; truth and task fit differ.'})),design:{level:'logical',statement:'Mismatch in scope'},strategies:Object.fromEntries(['contrast','core_sentence','incremental','syntax','selective'].map(k=>[k,{status:'insufficient',units:[],reason:'Need more evidence'}])),evidence:[{anchor:'condition limits',why:'Scope differs'}],source_status:'provisional',unresolved:[]})
test('false statement can fit an incorrect-choice task without collapsing truth and fit',()=>{
 assert.deepEqual(validateRater({rater:'A',protocol:'1.1',answer_blind:true,items:[row()]},input),[])
 const broken=row();broken.choices[0].content='fits';assert.ok(validateRater({rater:'A',protocol:'1.1',answer_blind:true,items:[broken]},input).some(e=>e.includes('truth/fit')))
})
test('decisive none cannot disguise a missing or unbound relationship',()=>{
 const broken=row();broken.decisive_relations=['none','condition'];assert.ok(validateRater({rater:'A',protocol:'1.1',answer_blind:true,items:[broken]},input).some(e=>e.includes('none')))
 broken.decisive_relations=['condition'];broken.relation_edges=[{relation:'condition',from:'invented antecedent',to:'result',why:'Claim'}];assert.ok(validateRater({rater:'A',protocol:'1.1',answer_blind:true,items:[broken]},input).some(e=>e.includes('bound')))
})
test('source admission requires all fields, exact item IDs and source bindings',()=>{
 const manifest=[{id:'x',binding:'pinned'}],item={id:'x',binding:'pinned',...Object.fromEntries(['body','stem','choices','presentation','answer'].map(k=>[k,{status:'complete'}])),admission:{original_artifact_complete:true}};item.answer.matches=true
 assert.deepEqual(sourceAdmission({items:[item]},manifest),['x'])
 item.presentation.status='partial';assert.deepEqual(sourceAdmission({items:[item]},manifest),[])
 assert.throws(()=>sourceAdmission({items:[{...item,binding:'changed'}]},manifest),/binding mismatch/)
 assert.throws(()=>sourceAdmission({items:[item,item]},manifest),/IDs differ/)
})
