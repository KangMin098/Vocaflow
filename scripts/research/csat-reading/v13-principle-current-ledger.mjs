// scripts/research/csat-reading/v13-principle-current-ledger.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const d='docs/research/csat-reading/data/v13/',r=p=>JSON.parse(fs.readFileSync(d+p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(d+p)).digest('hex');
const initial=r('principle-ledger.json'),control=r('principle-control-review.json');
const current={version:'v1.3-revision2',previous_ledger_sha256:sha('principle-ledger.json'),control_review_sha256:sha('principle-control-review.json'),items:initial.items.map(i=>i.pair_id===control.pair_id?{...i,status:'mock_boundary_control_partial_defer_key',review_attempted:true,both_original_and_key_checked:false}:({...i,review_attempted:i.reviewed,both_original_and_key_checked:i.reviewed})),summary:{denominator:110,review_attempted_pairs:2,both_original_and_key_checked_pairs:1,partial_defer_key_pairs:1,unattempted_pairs:108,original_unmodified_principle_fully_confirmed:0,conditional_narrowed_main_support:1,student_transfer_trials:0}};
const p=d+'principle-current-ledger.json';if(fs.existsSync(p))throw Error('No overwrite');fs.writeFileSync(p,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(current.summary));
