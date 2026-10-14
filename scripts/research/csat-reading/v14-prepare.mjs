// scripts/research/csat-reading/v14-prepare.mjs
import fs from 'node:fs';import {createHash} from 'node:crypto';
const base='docs/research/csat-reading/',dir=base+'data/v14/',sha=x=>createHash('sha256').update(x).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
if(fs.existsSync(dir+'registration.json'))throw Error('v1.4 already registered');
const old=read(base+'data/v13/artifacts.json'),frozen={};for(const [p,v] of Object.entries(old.files)){const h=sha(fs.readFileSync(p));if(h!==v.sha256)throw Error('Old artifact drift '+p);frozen[p]=h;}frozen[base+'data/v13/artifacts.json']=sha(fs.readFileSync(base+'data/v13/artifacts.json'));
const availability=read(dir+'source-availability-v4.json');
const paths=['docs/research/csat-reading/PROTOCOL-v1.4.md','scripts/research/csat-reading/v14-prepare.mjs','scripts/research/csat-reading/v14-source-availability-v2.mjs',dir+'source-availability-v4.json',dir+'map-selection.json'];
const registration={version:'1.4',task:'T-0028',branch:'research/csat-reading-v14',base_commit:'0810d44ef',previous_hashes:frozen,registered_hashes:Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(p))])),selection:availability.selected_metadata,selection_semantics:'metadata-only before unseen body/keys/rater classifications',source_status:'preflight_not_started',classification:'not_started',source_available_pool:97,planned_n:8,selected_n:availability.selected_metadata.length,previous_independent:91,first_results_modified:false,raw_sources_keys_and_gold_public:false};
fs.writeFileSync(dir+'registration.json',JSON.stringify(registration,null,2)+'\n');console.log(JSON.stringify({old_hashes:Object.keys(frozen).length,pool:97,selected:registration.selection.map(x=>x.id)}));
