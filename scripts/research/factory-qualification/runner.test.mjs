// scripts/research/factory-qualification/runner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResults} from './runner.mjs';
import {validateSpecification,qualify,releaseBoundary,AXES} from './qualification.mjs';
test('actual 20 content cases and 14 distinct role uses retain qualification holds',()=>{
 const x=buildResults();assert.equal(x.results.length,20);assert.equal(x.role_results.length,14);
 assert.ok(x.results.every(r=>!r.public_qualified&&!r.assessment_qualified));
 assert.ok(x.specifications.slice(8).every(s=>s.axes.A.state==='unknown'));
 assert.ok(x.first_review_metadata.some(m=>m.raw_first_axes.A.state==='pass'));
});
test('missing axis and mismatched content revision cannot qualify',()=>{
 const s=structuredClone(buildResults().specifications[0]);delete s.axes.B;assert.throws(()=>validateSpecification(s),/Invalid axis B/);
 const t=structuredClone(buildResults().specifications[0]);t.content.revision='replacement';assert.throws(()=>qualify(t),/Unbound axis/);
});
test('passing a recognition key retains unknown full rubric E',()=>{
 const x=buildResults();const i=x.first_review_metadata.find(m=>m.cohort==='dcp_main8'&&m.raw_first_axes.E.state==='pass');
 assert.ok(i);const s=x.specifications.find(s=>s.content.id===i.content_id);assert.equal(s.axes.E.state,'unknown');assert.equal(s.versions.gold.key_quality_subreview.state,'pass');
});
test('AI approvals and correct prose cannot replace actual release or unseen records',()=>{
 const s=structuredClone(buildResults().specifications[0]);s.role='independent_check';s.demand.role=s.role;
 for(const a of AXES)s.axes[a].state='pass';
 for(const k of Object.keys(s.approvals)){s.approvals[k]=true;s.approval_evidence[k]={kind:'actual_approval_record',verified:true,authority:'AI',content_id:s.content.id,content_revision:s.content.revision,revision:'test',sha256:'a'.repeat(64)};}
 const r=qualify(s);assert.equal(r.public_qualified,false);assert.equal(r.assessment_qualified,false);
 assert.ok(r.blocked_roles.find(r=>r.role==='independent_check').blocked.some(b=>b.gate==='source_group_unseen'));
});
test('unauthorized promotion of an actual held result fails release boundary',()=>{
 const s=buildResults().specifications[0],r=qualify(s);r.public_qualified=true;assert.throws(()=>releaseBoundary(s,r),/Unauthorized qualification promotion/);
});
