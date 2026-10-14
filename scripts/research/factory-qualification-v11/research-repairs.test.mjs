// scripts/research/factory-qualification-v11/research-repairs.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {facetDecision,repairActivity,run} from './research-repairs.mjs';
test('absence is defer, not evidence of explicit error',()=>{
  assert.equal(facetDecision({interpretable:false,distortion:false,required:2,correct:0}),'defer');
  assert.equal(facetDecision({inputAvailable:false,interpretable:true,distortion:true,required:2,correct:1}),'defer');
});
test('within-facet contradiction cannot become omission partial',()=>{
  assert.equal(facetDecision({interpretable:true,distortion:true,required:2,correct:1}),'defect');
  assert.equal(facetDecision({interpretable:true,distortion:true,required:2,correct:2}),'defect');
});
test('observable correct subset and complete outputs remain different',()=>{
  assert.equal(facetDecision({interpretable:true,required:2,correct:1}),'partial');
  assert.equal(facetDecision({interpretable:true,required:2,correct:2}),'meets');
  assert.throws(()=>facetDecision({interpretable:true,required:2,correct:3}));
});
test('repair does not overwrite source goal, untouched facets or old bytes',()=>{
  const a={activity_id:'a',task_id:'goal',source:{binding:'unchanged'},gold:{full:'keep'},analytic_rubric:[{facet:'x',defect:'old'},{facet:'y',defect:'keep'}]};
  const snapshot=JSON.stringify(a);
  const b=repairActivity(a,{activity_id:'a',issue_ids:['test'],edits:[{facet:'x',field:'defect',value:'new'}]});
  assert.equal(JSON.stringify(a),snapshot);assert.equal(b.task_id,a.task_id);assert.deepEqual(b.source,a.source);assert.deepEqual(b.gold,a.gold);assert.deepEqual(b.analytic_rubric[1],a.analytic_rubric[1]);
  assert.throws(()=>repairActivity(a,{activity_id:'other',edits:[]}));
  assert.throws(()=>repairActivity(a,{activity_id:'a',edits:[{facet:'missing',field:'defect',value:'x'}]}));
});
test('sealed actual packet reproduces and blind packet hides author decisions',()=>{
  const root=new URL('../../../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
  const result=run(root,true);
  assert.equal(result.counts.activities,4);assert.equal(result.counts.issues,5);assert.equal(result.counts.novel_cases,13);
  const blind=JSON.parse(fs.readFileSync(new URL('./local/research-repairs-blind.json',import.meta.url),'utf8'));
  assert.equal(blind.activities.length,4);
  for(const a of blind.activities) for(const c of a.cases){assert.ok(!Object.hasOwn(c,'expected'));assert.ok(!Object.hasOwn(c,'components'));}
  const original=JSON.parse(fs.readFileSync(new URL('../csat-reading/local/v15/content-packages-revision2.json',import.meta.url),'utf8'));
  for(const b of blind.activities){const a=original.reused_priority_activities.find(x=>x.activity_id===b.activity_id);assert.equal(a.task_id,b.repaired.task_id);assert.deepEqual(a.source,b.repaired.source);assert.equal(a.analytic_rubric.length,b.repaired.analytic_rubric.length);}
});
