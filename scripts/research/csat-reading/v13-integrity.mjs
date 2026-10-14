// scripts/research/csat-reading/v13-integrity.mjs
import fs from 'node:fs';import {sha,read} from './v13-analysis.mjs';
const base='docs/research/csat-reading/',dir=base+'data/v13/',local='scripts/research/csat-reading/local/v13/';
const reg=read(dir+'registration.json');let checked=0;
for(const [p,h] of Object.entries(reg.previous_artifact_hashes)){if(sha(fs.readFileSync(p))!==h)throw Error('Previous artifact changed '+p);checked++;}
for(const [p,h] of Object.entries(read(base+'data/v12/registration.json').old_frozen_hashes))if(sha(fs.readFileSync(p))!==h)throw Error('Earlier artifact changed '+p);
for(const [p,h] of Object.entries(reg.asset_hashes))if(sha(fs.readFileSync(p))!==h)throw Error('Asset changed in research worktree '+p);
const task=read(dir+'task-summary.json');if(task.latest_unique!==74||task.unreviewed_combinations!==23580-74||Object.values(task.latest_status_counts).reduce((n,x)=>n+x,0)!==74)throw Error('Task union');
const source=read(local+'development-input.json'),old=read('scripts/research/csat-reading/local/v12/pilot-input.json');
for(const x of source.items){const prev=old.items.find(y=>y.id===x.id);if(!prev||prev.passage!==x.passage)throw Error('Development passage modified '+x.id);for(const u of x.units)if(x.passage.slice(u.start,u.end)!==u.text)throw Error('Development offset '+x.id);}
const input=read(local+'pilot-input.json'),selection=read(dir+'pilot-selection.json');
const oldItems=[...read(base+'data/pilot-manifest.json'),...read(base+'data/main-20261014/manifest.json'),...read(base+'data/v12/pilot-selection.json')];const oldIds=new Set(oldItems.map(x=>x.id)),oldGroups=new Set(oldItems.map(x=>x.passage_group));
if(input.items.length!==11||selection.length!==12)throw Error('Eligibility denominator');
for(const x of input.items){if(oldIds.has(x.id)||oldGroups.has(x.passage_group)||x.id==='2022#26')throw Error('Not new admitted '+x.id);if(x.answer!==undefined)throw Error('Key leaked');for(const u of x.units)if(x.passage.slice(u.start,u.end)!==u.text)throw Error('Fresh offset '+x.id);}
for(const [p,h] of Object.entries(read(dir+'pilot-registration.json').hashes))if(sha(fs.readFileSync(p))!==h)throw Error('Pilot frozen changed '+p);
if(fs.existsSync(dir+'pilot-execution.json'))for(const [p,h] of Object.entries(read(dir+'pilot-execution.json').first_hashes))if(sha(fs.readFileSync(p))!==h)throw Error('First submission modified '+p);
console.log(JSON.stringify({result:'pass',previous_v12_files:checked,earlier_frozen_preserved:true,product_assets_unchanged:true,development_passages_unchanged:16,planned_pilot:12,admitted_fresh:11,actual_task_union:74,remaining_unreviewed:23506}));
