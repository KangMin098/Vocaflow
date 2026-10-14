// scripts/research/csat-reading/v15-assessment.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';import {validate} from './v15-assessment.mjs';
const names=['target','scope','boundary','limit'];
function fixture(){const packet={tasks:[{activity_id:'a',analytic_rubric:names.map(facet=>({facet}))}],responses:Array.from({length:16},(_,i)=>({response_id:'r'+i,activity_id:'a'}))};const result={rows:packet.responses.map(x=>({response_id:x.response_id,facets:names.map(facet=>({facet,state:'defer',reason:'synthetic missing response'})),procedural_eligibility:'defer'}))};return {packet,result};}
test('missing facet cannot be hidden by four duplicated entries',()=>{const {packet,result}=fixture();result.rows[0].facets[1].facet='target';assert.throws(()=>validate(packet,result),/unique facets/);});
test('unprovided response ID cannot enter scoring denominator',()=>{const {packet,result}=fixture();result.rows[0].response_id='external';assert.throws(()=>validate(packet,result),/Unknown response/);});
test('meaning success does not supply independent procedural qualification',()=>{const {packet,result}=fixture();result.rows[0].facets.forEach(x=>x.state='meets');assert.equal(validate(packet,result),true);assert.equal(result.rows[0].procedural_eligibility,'defer');});
test('uncertainty stays a valid first outcome',()=>{const {packet,result}=fixture();assert.equal(validate(packet,result),true);});
