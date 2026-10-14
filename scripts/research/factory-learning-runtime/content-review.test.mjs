// scripts/research/factory-learning-runtime/content-review.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkFirst, publicReview, judgeDeclaredAnswer, aggregateComponents } from './content-review.mjs';

const firstPath='scripts/research/factory-learning-runtime/local/content-review-first.json';
const expected='5f51199624e82b2c09bee50b31bfa7bdb5c85c96ebe0ce7ad13a2fadc8fc6e45';

test('Actual14 first review remains source/input bound and retains bounded coverage',()=>{
 const review=checkFirst(firstPath,expected);
 assert.equal(review.items.length,14);
 assert.equal(review.items.filter(item=>item.coverage.source_body==='all_supplied_local_body').length,2);
 assert.equal(review.items.filter(item=>item.coverage.source_body==='bounded_context').length,12);
});

test('Actual wrong context sense and absent choice are not made scoreable by stored key',()=>{
 const review=checkFirst(firstPath,expected),item=review.items.find(item=>item.id==='FQR1-04');
 assert.equal(item.axes.B.state,'fail'); assert.equal(item.axes.E.state,'fail');
 const raw=item.private_evidence[0].answer_key;
 const result=judgeDeclaredAnswer(String(raw.answer),{semantic_review:item.axes.E.state,accepted:[String(raw.answer)]});
 assert.equal(result.status,'scoring_error');
});

test('Source-matching grammatical key does not validate false explanation',()=>{
 const review=checkFirst(firstPath,expected);
 for(const id of ['FQR1-08','FQR1-09']){
  const item=review.items.find(item=>item.id===id);
  assert.equal(item.axes.E.state,'fail');
  assert.ok(item.findings.some(finding=>finding.code==='COMPLEMENTIZER_MISCLASSIFIED'));
  assert.equal(judgeDeclaredAnswer('answer',{semantic_review:item.axes.E.state,accepted:['answer']}).status,'scoring_error');
 }
});

test('Actual complete-bank cardinality cannot promote a heading or truncated clause',()=>{
 const review=checkFirst(firstPath,expected);
 for(const id of ['FQR1-13','FQR1-14']){
  const item=review.items.find(item=>item.id===id);
  assert.equal(item.structure.actual_bank,7);
  assert.equal(item.axes.E.state,'fail');
  assert.equal(item.runner_support,'requires_content_repair');
 }
});

test('Explicit normalization accepts case/space variants only under declared policy',()=>{
 const review=checkFirst(firstPath,expected),item=review.items.find(item=>item.id==='FQR1-05');
 const answer=item.private_evidence[0].answer_key.text;
 const policy={semantic_review:'pass',accepted:[answer],trim:true,case_insensitive:true};
 assert.equal(judgeDeclaredAnswer(`  ${answer.toUpperCase()} `,policy).status,'correct');
 assert.equal(judgeDeclaredAnswer(answer.toUpperCase(),{...policy,case_insensitive:false}).status,'defer');
 // This fixture validates a proposed normalization contract, not the unknown original E axis.
 assert.equal(item.axes.E.state,'unknown');
});

test('Unlisted paraphrase or full correction is deferred instead of falsely marked wrong',()=>{
 assert.equal(judgeDeclaredAnswer('an explicitly different expression',{semantic_review:'pass',accepted:['declared expression']}).status,'defer');
 assert.equal(judgeDeclaredAnswer('',{semantic_review:'pass',accepted:['declared expression']}).status,'defer');
 assert.equal(judgeDeclaredAnswer(null,{semantic_review:'pass',accepted:['declared expression']}).status,'scoring_error');
});

test('Missing scoring policy and invalid system data never produce learner incorrect',()=>{
 for(const policy of [null,{}, {semantic_review:'unknown',accepted:['x']},{semantic_review:'pass',accepted:[]}]){
  assert.equal(judgeDeclaredAnswer('x',policy).status,'scoring_error');
 }
});

test('Observed subset, contradiction and system error stay distinct',()=>{
 assert.equal(aggregateComponents(['correct','defer']),'partial');
 assert.equal(aggregateComponents(['defer','defer']),'defer');
 assert.equal(aggregateComponents(['correct','incorrect']),'incorrect');
 assert.equal(aggregateComponents(['correct','scoring_error']),'scoring_error');
 assert.equal(aggregateComponents([]),'scoring_error');
});

test('Public derivative omits actual Gold, passage and reviewer raw evidence',()=>{
 const review=checkFirst(firstPath,expected),publicData=publicReview(review,expected);
 const serialized=JSON.stringify(publicData);
 for(const key of ['private_evidence','source_contexts']) assert.ok(!serialized.includes(`"${key}"`));
 for(const item of publicData.items){
  assert.equal(Object.hasOwn(item,'payload'),false); assert.equal(Object.hasOwn(item,'answer_key'),false);
  assert.equal(item.coverage.payload,'all'); assert.equal(item.coverage.answer_key,'all');
 }
 assert.ok(publicData.items.every(item=>item.public_qualified===false&&item.assessment_qualified===false));
 const written=JSON.parse(fs.readFileSync('docs/research/factory-learning-runtime/data/content-review.json','utf8'));
 assert.deepEqual(written,publicData);
});
