// docs/csat-learner/skeleton-v4/s1-v6/correction/r2/content-policy.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {projectSamples,projectLectures,displayContext} from './content-policy.mjs'
const proposal=JSON.parse(fs.readFileSync(new URL('../C1_CANDIDATE.json',import.meta.url),'utf8'))
const binding=JSON.parse(fs.readFileSync(new URL('../SOURCE_BINDINGS.json',import.meta.url),'utf8'))
const samples=JSON.parse(fs.readFileSync('D:/workspace/Vocaflow-main-serving/tmp/csat-item-review-20261023/samples.json','utf8'))
const lectures=JSON.parse(fs.readFileSync(new URL('../../../../../../apps/web/src/lib/csat/lecture-data/2026.json',import.meta.url),'utf8'))
test('ordinary projection withholds 38⑤ interpretation and unapproved relationship edges',()=>{const c=projectSamples(samples,'learner',proposal).find(s=>s.itemId==='2026#38').inquiry.v3.choices.find(c=>c.n===5);assert.equal(c.display_state,'HELD_CONTENT_APPROVAL');assert.equal(c.decisive,'');assert.deepEqual(c.meaning_ids,[]);assert.deepEqual(c.sentences,[])})
test('review projection binds candidate to explicit local content status',()=>{const c=projectSamples(samples,'review',proposal).find(s=>s.itemId==='2026#38').inquiry.v3.choices.find(c=>c.n===5);assert.equal(c.display_state,'PROPOSED_NOT_APPROVED');assert.equal(c.decisive,proposal.payload.proposed.decisive);assert.deepEqual(c.sentences,[1,4,5,6,7,8])})
test('34 and22 accepted records remain byte-equivalent for both audiences',()=>{for(const mode of ['learner','review'])for(const id of ['2026#34','2026#22'])assert.deepEqual(projectSamples(samples,mode,proposal).find(s=>s.itemId===id),samples.find(s=>s.itemId===id))})
test('projection never mutates source records, version, hashes or candidate',()=>{const before=JSON.stringify({samples,proposal,lectures});projectSamples(samples,'review',proposal);projectSamples(samples,'learner',proposal);projectLectures(lectures,'learner');assert.equal(JSON.stringify({samples,proposal,lectures}),before)})
test('ordinary lecture payload has no held38 script;34 and22 remain unchanged',()=>{const p=projectLectures(lectures,'learner');assert.equal(p.lectures['2026#38'],undefined);for(const id of ['2026#34','2026#22'])assert.deepEqual(p.lectures[id],lectures.lectures[id])})
test('review keeps original38 lecture without changing its wording',()=>{assert.deepEqual(projectLectures(lectures,'review').lectures['2026#38'],lectures.lectures['2026#38'])})
test('ordinary bootstrap carries status metadata but no proposal or source interpretation',()=>{const c=displayContext('learner',proposal,binding),serialized=JSON.stringify(c);assert.equal(c.review,null);assert.ok(!serialized.includes(proposal.payload.proposed.decisive));assert.ok(!serialized.includes(binding.reading));assert.equal(c.candidateMeta.approvalRequired,true)})
test('review bootstrap preserves candidate version and payload identity without approval',()=>{const c=displayContext('review',proposal,binding);assert.equal(c.review.proposal.version,proposal.version);assert.equal(c.review.proposal.payloadSha256,proposal.payloadSha256);assert.equal(c.review.proposal.approval.status,'NOT_APPROVED')})
test('unknown audience is rejected rather than defaulted to review',()=>{for(const f of [()=>projectSamples(samples,'admin',proposal),()=>projectLectures(lectures,'admin'),()=>displayContext('admin',proposal,binding)])assert.throws(f,/unknown-audience/)})
