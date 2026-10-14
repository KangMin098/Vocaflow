// scripts/research/factory-qualification-v11/research-repairs-v2.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {componentState,run} from './research-repairs-v2.mjs';
test('two observed clause judgments without whole result are partial, never defer',()=>{
 assert.equal(componentState({required:['clause1','clause2','whole'],observed:['clause1','clause2']}),'partial');
 assert.equal(componentState({required:['clause1','clause2','whole'],observed:[]}),'defer');
 assert.equal(componentState({required:['clause1','clause2','whole'],observed:['clause1','clause2','whole']}),'meets');
});
test('annual-hour observations without year are partial and false unit remains defect',()=>{
 const required=['year','annual_metric','hours','distinct_rate'];
 assert.equal(componentState({required,observed:['annual_metric','hours','distinct_rate']}),'partial');
 assert.equal(componentState({required,observed:['annual_metric','hours'],errors:['false_percent_unit']}),'defect');
});
test('entailed boundaries are not automatically observed case classifications',()=>{
 const required=['exact_case','over_case'];
 assert.equal(componentState({required,observed:['general_upper_bound']}),'defer');
 assert.equal(componentState({required,observed:['exact_case']}),'partial');
 assert.equal(componentState({required,observed:['exact_case','over_case'],errors:['same_case_contradiction']}),'defect');
});
test('a risky-object label does not observe the immediate-danger property',()=>{
 assert.equal(componentState({required:['immediate_danger_case'],observed:['risky_object']}),'defer');
 assert.equal(componentState({required:['immediate_danger_case'],observed:['immediate_danger_case'],errors:['condition_reversal']}),'defect');
});
test('new actual packets reproduce without author statuses in blind input',()=>{
 const root=new URL('../../../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');const result=run(root,true);
 assert.equal(result.counts.activities,4);assert.equal(result.counts.prior_independent_HOLD,4);assert.equal(result.counts.novel_synthetic_cases,12);
 const b=JSON.parse(fs.readFileSync(new URL('./local/research-repairs-v2-blind.json',import.meta.url),'utf8'));
 for(const a of b.activities)for(const c of a.cases)assert.ok(!Object.hasOwn(c,'expected'));
 const old=JSON.parse(fs.readFileSync(new URL('./local/research-repairs-packet.json',import.meta.url),'utf8'));
 for(const a of b.activities){const previous=old.activities.find(x=>x.repaired.activity_id===a.activity_id);assert.equal(previous.repaired.task_id,a.repaired.task_id);assert.deepEqual(previous.supplied_source,a.supplied_source);assert.deepEqual(previous.repaired.source,a.repaired.source);}
});
