// scripts/research/csat-reading/v13-principle-extension-audit.mjs
import fs from 'node:fs';
const x=JSON.parse(fs.readFileSync('docs/research/csat-reading/data/v12/principle-task-review.json','utf8'));
const valid=id=>/^20(1[4-9]|2[0-4])[AB]?#/.test(id)||/^M(1[4-9]|2[0-4])(06|09)#/.test(id);
const e=x.items.filter(i=>i.pair_id.split('~').every(valid));
console.log(JSON.stringify({both_endpoint_old_scope:e.length,ids:e.map(i=>i.pair_id)},null,2));
