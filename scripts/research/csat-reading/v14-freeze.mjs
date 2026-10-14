// scripts/research/csat-reading/v14-freeze.mjs
import fs from 'node:fs';import {read,sha} from './v14-analysis.mjs';
const dir='docs/research/csat-reading/data/v14/',local='scripts/research/csat-reading/local/v14/';
if(fs.existsSync(dir+'pilot-registration.json'))throw Error('v1.4 source already frozen');
const input=read(local+'pilot-input.json');if(input.items.length!==8||new Set(input.items.map(x=>x.id)).size!==8)throw Error('Pilot denominator');
for(const it of input.items){if(it.answer!==undefined||it.solved_answer!==undefined)throw Error('Key leak');if(it.choices.length!==5)throw Error('Candidates');for(const u of it.units)if(it.passage.slice(u.start,u.end)!==u.text)throw Error('Source offset '+it.id);}
const paths=['docs/research/csat-reading/PROTOCOL-v1.4.md',dir+'registration.json',dir+'source-availability-v4.json',dir+'source-pilot.json',dir+'source-finalization.json',local+'pilot-input.json',local+'pilot-key.json',local+'rater-instructions.md','scripts/research/csat-reading/v14-analysis.mjs'];
fs.writeFileSync(dir+'pilot-registration.json',JSON.stringify({version:'1.4',task:'T-0028',protocol_commit:'87ea2672d',selected_n:8,source_n:8,first_classification:'not_started',hashes:Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(p))])),private_sources_keys_first_outputs:true,source_binding_recipe:'Remove source_binding and target_scaffold candidate_id derived from binding before hashing; exact file hashes independently seal bytes'},null,2)+'\n');console.log('Frozen8 sources and private key/instructions/code');
