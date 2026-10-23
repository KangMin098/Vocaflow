// scripts/research/goal-data/review-r3/read-packet.mjs
import fs from 'node:fs';
const [name,start,end]=process.argv.slice(2);
const rows=JSON.parse(fs.readFileSync('docs/research/goal-data-batches/review-r3/'+name+'-packet.local.json','utf8'));
for(let i=+start;i<+end;i++){const r=rows[i];console.log('\nINDEX '+i+' '+(r.item??r.id)+' '+(r.display??r.confidence));console.log(JSON.stringify(r.source??{passage:r.passage,answer:r.answer}));if(r.details)console.log(JSON.stringify(r.details));}
