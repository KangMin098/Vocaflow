// scripts/research/factory-qualification-v11/research-repairs-v3.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateCoverage,run} from './research-repairs-v3.mjs';
import {componentState} from './research-repairs-v2.mjs';
test('a learner instruction omission cannot silently narrow fixed required outputs',()=>{
 const a={student_prompt:'Explain meaning. Compare both alternatives.',analytic_rubric:[{facet:'sense'}]};
 const c={output_crosswalk:[{request:'meaning and alternatives',facets:['sense'],required_components:{sense:['economic','electric','traffic']}}]};
 assert.equal(validateCoverage(a,c,a.student_prompt),true);
 assert.throws(()=>validateCoverage({...a,student_prompt:'Explain meaning.'},c,a.student_prompt));
 assert.throws(()=>validateCoverage({...a,student_prompt:''},c));
});
test('facet or component omission in output crosswalk is rejected',()=>{
 const a={student_prompt:'Perform both requests.',analytic_rubric:[{facet:'one'},{facet:'two'}]};
 const c={output_crosswalk:[{request:'one',facets:['one'],required_components:{one:['a']}},{request:'two',facets:['two'],required_components:{two:['b']}}]};
 assert.equal(validateCoverage(a,c),true);
 const omitted=structuredClone(c);omitted.output_crosswalk.pop();assert.throws(()=>validateCoverage(a,omitted));
 const absent=structuredClone(c);absent.output_crosswalk[0].required_components.one=[];assert.throws(()=>validateCoverage(a,absent));
});
test('economic meaning without two required alternative comparisons is partial',()=>{
 const required=['economic','electric','traffic'];
 assert.equal(componentState({required,observed:['economic']}),'partial');
 assert.equal(componentState({required,observed:['economic','electric']}),'partial');
 assert.equal(componentState({required,observed:required}),'meets');
 assert.equal(componentState({required,observed:required,errors:['physical_device_claim']}),'defect');
});
test('four mapped source values cannot be inferred from correct relations alone',()=>{
 const required=['year','metric','mapping1','mapping2','mapping3','mapping4'];
 assert.equal(componentState({required,observed:['year','metric']}),'partial');
 assert.equal(componentState({required,observed:required}),'meets');
 assert.equal(componentState({required,observed:required,errors:['swapped_groups']}),'defect');
});
test('sealed two artifacts reproduce with complete output crosswalk and no blind expectations',()=>{
 const root=new URL('../../../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');const result=run(root,true);
 assert.equal(result.counts.new_artifacts,2);assert.equal(result.counts.unchanged_supported_prior_artifacts,2);
 const blind=JSON.parse(fs.readFileSync(new URL('./local/research-repairs-v3-blind.json',import.meta.url),'utf8'));
 const previous=JSON.parse(fs.readFileSync(new URL('./local/research-repairs-v2-packet.json',import.meta.url),'utf8'));
 for(const a of blind.activities){const old=previous.activities.find(p=>p.activity_id===a.activity_id);assert.equal(a.repaired.student_prompt,old.repaired.student_prompt);assert.equal(a.repaired.task_id,old.repaired.task_id);assert.deepEqual(a.supplied_source,old.supplied_source);for(const c of a.cases)assert.ok(!Object.hasOwn(c,'expected'));assert.equal(validateCoverage(a.repaired,{output_crosswalk:a.repaired.required_output_crosswalk},old.repaired.student_prompt),true);}
});
