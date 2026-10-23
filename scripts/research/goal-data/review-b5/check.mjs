// scripts/research/goal-data/review-b5/check.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/research/goal-data-batches/review-b5';
const v=JSON.parse(fs.readFileSync(`${dir}/verdict.json`,'utf8'));
const r=JSON.parse(fs.readFileSync(`${dir}/recalculation.json`,'utf8'));
assert.equal(v.item_reviews.length,20);
assert.equal(new Set(v.item_reviews.map(x=>x.item_id)).size,20);
for(const row of [...v.scope_checks,...v.item_reviews]) {
 assert.ok(['confirmed','refuted','unclear'].includes(row.verdict));
 assert.ok(row.note.length>15);
 for(const ref of row.evidence) {
  const [,file,line]=ref.match(/^(.*):(\d+)$/)??[];
  assert.ok(file&&line,ref);
  const absolute=/^[A-Z]:/i.test(file)?file:`${process.cwd()}/${file}`;
  assert.ok(fs.existsSync(absolute),ref);
  assert.ok(Number(line)<=fs.readFileSync(absolute,'utf8').split('\n').length,ref);
 }
}
assert.equal(r.selection.total,38);
assert.equal(r.reported_overall_matches,true);
assert.ok(r.selection.checks.every(x=>x.source_hash_ok&&x.passage_hash_ok&&x.selection_hash_ok&&x.eligible));
assert.ok(Object.values(r.validation).every(x=>x.exit===0));
assert.equal(v.scope_checks.find(x=>x.id==='causal_improvement').verdict,'unclear');
// Committable reports/scripts may describe findings, but contain no full passage.
const samples=JSON.parse(fs.readFileSync('scripts/research/goal-data/review-b5/sample.local.json','utf8'));
for(const folder of [dir,'scripts/research/goal-data/review-b5'])for(const file of fs.readdirSync(folder)) {
 if(file.endsWith('.local.json'))continue;
 const text=fs.readFileSync(`${folder}/${file}`,'utf8');
 for(const s of samples)assert.ok(!text.includes(s.input.source.passage),`${file}: source passage leaked`);
}
console.log('PASS: JSON/schema, 20 unique samples, evidence file:line, hashes/validation, unclear guard, full-passage exclusion');
