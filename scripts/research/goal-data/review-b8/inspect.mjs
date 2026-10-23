// scripts/research/goal-data/review-b8/inspect.mjs
import fs from 'node:fs';
const samples=JSON.parse(fs.readFileSync('scripts/research/goal-data/review-b8/sample.local.json','utf8'));
if(process.argv[2]==='metrics'){
 const m=JSON.parse(fs.readFileSync('scripts/research/goal-data/review-b8/metrics.local.json','utf8'));
 console.log(JSON.stringify({stats:m.stats,per:m.per,outside:m.outside,totals:m.totals,regenerated:m.regenerated},null,2));
 const snap=JSON.parse(fs.readFileSync('scripts/research/goal-data/review-b8/packets.local.json','utf8'));
 const i=JSON.parse(snap.files['scripts/research/goal-data/local/b8-v24/input.json']);
 for(const r of i.rows.filter(r=>[...m.outside.A,...m.outside.B].includes(r.item_id)&&!samples.some(s=>s.id===r.item_id)))console.log(JSON.stringify({id:r.item_id,type:r.type_id,source:r.source}));
 process.exit(0);
}
for(const s of samples)console.log(JSON.stringify({id:s.id,type:s.input.type_id,source:s.input.source,A:{primary:s.judgments.A.primary_task,reason:s.judgments.A.primary_reason,outside:s.judgments.A.main_performance_outside_subset,links:s.judgments.A.links.map(l=>({task:l.task_id,r:l.relevance,why:l.why}))},B:{primary:s.judgments.B.primary_task,reason:s.judgments.B.primary_reason,outside:s.judgments.B.main_performance_outside_subset,links:s.judgments.B.links.map(l=>({task:l.task_id,r:l.relevance,why:l.why}))}}));
