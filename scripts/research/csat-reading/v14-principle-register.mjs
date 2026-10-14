// scripts/research/csat-reading/v14-principle-register.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const root='docs/research/csat-reading/data/';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out=root+'v14/principle-registration.json';
if(fs.existsSync(out)) throw new Error('Registered selection cannot be overwritten');
const cases=[
 {id:'topic_blank',ids:['2024#23','2015#32'],category:'주제↔빈칸',status:'new_pair_old_development_items'},
 {id:'order_insert',ids:['2020#36','2017#38'],category:'순서↔삽입',status:'new_pair_old_development_items'},
 {id:'fact_notice',ids:['2016#25','2024#28'],category:'사실↔안내',status:'new_pair_old_development_items'},
 {id:'lexical_blank',ids:['2021#30','2024#31'],category:'어휘↔빈칸',status:'new_pair_old_development_items'}
];
const j={version:'v1.4',selection:'purposeful source-complete development cases; all eight previously exposed; item text/stem/options have already been read during selection; this is pre-claim registration, not preregistered fresh blind selection',cases,criteria:{positive:'both originals support explicitly bounded common performance',negative:'stronger identical target/information scope/operation claim fails in one endpoint',defer:'key/source missing or normalized target underdetermined',relation:'distinguish direct observed item demand from support task; no causal/latent independence inference'},preserved_baselines:['v13/principle-current-ledger.json','v13/principle-cross-type.json','v13/principle-key-recovery.json','v12/principle-task-review.json'].map(p=>({path:root+p,sha256:hash(root+p)})),exposure:'source-bound single AI development re-analysis; no human review, student trial, or fully unseen item claim',bounded_110_new_verified_numerator:0,key_recovery_plan:'One new KICE CDN historical-year endpoint approach, after v1.3 EBS service-page failure. Stop if inaccessible; do not substitute stored answer as official key.',registration_sequence:'before new cross-pair claim records and source re-read receipts'};
fs.mkdirSync(root+'v14',{recursive:true}); fs.writeFileSync(out,JSON.stringify(j,null,2)+'\n');
console.log(JSON.stringify({selected_pairs:cases.length,unique_items:new Set(cases.flatMap(c=>c.ids)).size}));
