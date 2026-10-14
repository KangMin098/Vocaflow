// scripts/research/csat-reading/v14-principle-validate.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='docs/research/csat-reading/data/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),obj=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const reg=read(root+'v14/principle-registration.json'),publicReview=read(root+'v14/principle-cross-review.json'),availability=read(root+'v14/principle-availability.json'),redaction=read(root+'v14/principle-redaction.json');
for(const r of redaction.private_first_receipts)assert.equal(hash(r.private_path),r.first_sha256);
const review=read(redaction.private_first_receipts[0].private_path);
assert.equal(hash(root+'v14/principle-cross-review.json'),redaction.redacted_public_sha256);
assert.equal(publicReview.first_sha256,redaction.private_first_receipts[0].first_sha256);
assert.equal(publicReview.cases.length,review.cases.length);
for(const c of publicReview.cases){assert(!('option_analysis' in c));for(const s of c.source_refs){assert(!('official_answer_observed' in s));assert(!('information_scope' in s));assert(!('render' in s.pdf));}}
assert(!/[①②③④⑤]/u.test(JSON.stringify(publicReview)));
for(const b of reg.preserved_baselines)assert.equal(hash(b.path),b.sha256);
assert.equal(review.registration_sha256,hash(root+'v14/principle-registration.json'));
const old=read(root+'v12/principle-task-review.json').items;
const historical=id=>/^201[4-9][AB]?#/.test(id)||/^202[0-4]#/.test(id)||/^M(?:1[4-9]|2[0-4])(?:06|09)#/.test(id);
const main=id=>/^(?:201[4-9][AB]?|202[0-4])#/.test(id);
assert.equal(old.length,110);
assert.equal(old.filter(p=>p.original_endpoints.every(historical)).length,availability.scope_counts.both_2014_2024_main_or_mock);
assert.equal(old.filter(p=>p.original_endpoints.every(main)).length,availability.scope_counts.both_2014_2024_main);
const prior=read(root+'v13/principle-cross-type.json').cases;
const identity=c=>(c.ids??c.items.map(x=>x.id)).slice().sort().join('~');
assert.equal(review.cases.length,4);const seen=new Set();
for(const c of review.cases){
 assert(!prior.some(p=>identity(p)===identity(c)));assert.equal(c.source_refs.length,2);
 for(const s of c.source_refs){seen.add(s.id);assert.equal(hash(s.input_path),s.input_file_sha256);assert.equal(hash(s.source_audit),s.source_audit_file_sha256);const i=read(s.input_path).items.find(i=>i.id===s.id);assert.equal(obj(i),s.input_object_sha256);assert.equal(i.passage.length,s.information_scope.passage.end);assert.equal(hash(s.pdf.render),s.question_image_sha256);assert.equal(hash(s.key_pdf.render??s.key_pdf.visual_render),s.key_image_sha256);assert.equal(s.read_fields.length,5);assert(s.new_v14_key_image_reread);}
 assert.equal(c.public_learning_use,false);assert.equal(c.student_transfer,'not_observed');assert(c.counter&&c.when&&c.when_not&&c.operation_difference);
}
assert.equal(seen.size,8);assert.equal(availability.new_bounded_pairs_verified,0);assert.equal(review.summary.independent_new_item_confirmations,0);
console.log(JSON.stringify({status:'pass',old_bounded_records:old.length,scope_eligible:2,cross_pairs:4,source_refs:8,historical_hashes_preserved:true,scientific_effect_validation:false}));
