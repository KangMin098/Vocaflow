// scripts/csat/v2-holdout/lib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {fiveTargetStem,normalizePassage,chooseSample,sha256} from './lib.mjs';
test('five circled answer rows do not turn an ABC combination item into five underlines',()=>{
 assert.equal(fiveTargetStem('(A), (B), (C)의 각 네모 안에서 문맥에 맞는 낱말로 가장 적절한 것은?'),false);
 assert.equal(fiveTargetStem('다음 글의 밑줄 친 부분 중 문맥상 적절하지 않은 것은?'),true);
});
test('marker and quote differences cannot bypass passage duplicate detection',()=>{
 assert.equal(normalizePassage('A ① learner’s text.  (a) Reused!'),normalizePassage("A learner's text. Reused!"));
});
test('selection is order invariant and does not relax a cell shortage or reuse pilot passages',()=>{
 const rules={ordering:{seed:'fixture',globalCellOrder:['R-VOCAB/csat','X-VOCAB/csat']},strata:{primaryPerCell:2,reservePerCell:1},duplicates:{nearThreshold:0.8}};
 const make=(id,text,cell='R-VOCAB/csat')=>({itemId:id,normalizedText:text,cell,sourceRevision:sha256(text),status:'ELIGIBLE_LOCAL_RESEARCH'});
 const data=[make('a','copied original passage'),make('b','uniquely written specimen one'),make('c','another wholly different example two'),make('d','independent final reserve specimen three'),make('held','unverified case'),make('x','single example in second category','X-VOCAB/csat')];
 data.find(x=>x.itemId==='held').status='HOLD_SOURCE';
 const pilot=[make('pilot','copied original passage')];
 const a=chooseSample(rules,'f'.repeat(64),data,pilot),b=chooseSample(rules,'f'.repeat(64),[...data].reverse(),pilot);
 assert.deepEqual(a,b);
 assert.ok(![...a.primary,...a.reserve].some(x=>['a','held'].includes(x.itemId)));
 assert.equal(a.primary.filter(x=>x.cell==='R-VOCAB/csat').length,2);
 assert.equal(a.reserve.filter(x=>x.cell==='R-VOCAB/csat').length,1);
 assert.ok(a.decisions.some(x=>x.cell==='X-VOCAB/csat'&&x.status==='QUOTA_SHORTFALL'));
});
test('the sealed human-readable threshold rejects a near copy, not only exact hashes',()=>{
 const rules={ordering:{seed:'fixture',globalCellOrder:['R/csat']},strata:{primaryPerCell:1,reservePerCell:0},duplicates:{near:'5-gram Jaccard >= 0.80 triggers hold'}};
 const original='a deliberately distinct paragraph used to verify duplicate safety without containing any exam material';
 const make=(id,text)=>({itemId:id,normalizedText:text,cell:'R/csat',sourceRevision:sha256(text),status:'ELIGIBLE_LOCAL_RESEARCH'});
 const selected=chooseSample(rules,'a'.repeat(64),[make('near',original+'!')],[make('pilot',original)]);
 assert.equal(selected.primary.length,0);
 assert.ok(selected.decisions.some(x=>x.itemId==='near'&&x.status==='HOLD_DUPLICATE_REVIEW'));
});
