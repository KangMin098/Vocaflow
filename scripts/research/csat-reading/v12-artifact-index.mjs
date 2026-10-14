// scripts/research/csat-reading/v12-artifact-index.mjs
// Bind the final research files without self-hashing or publishing original source content.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const base='docs/research/csat-reading/',dir=base+'data/v12/',script='scripts/research/csat-reading/',sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const files=[base+'PROTOCOL-v1.2.md',...fs.readdirSync(base).filter(f=>/^V12-.*\.md$/.test(f)).map(f=>base+f),...fs.readdirSync(dir).filter(f=>f!=='artifacts.json').map(f=>dir+f),...fs.readdirSync(script).filter(f=>/^v12.*\.mjs$/.test(f)).map(f=>script+f),script+'agreement.mjs']
const result={version:'1.2',task:'T-0026',date:'2026-10-14',branch:'research/csat-reading-20261012',preregistration_commit:'bc4649287',first_research_result_commit:'f91fafbaf',files:Object.fromEntries(files.filter(p=>fs.statSync(p).isFile()).sort().map(p=>[p,{sha256:sha(p),bytes:fs.statSync(p).size}])),private_sources_required_for_reproduction:true,original_full_text_in_index:false,main_merge_authorized:false,student_or_human_effect_evidence:false}
fs.writeFileSync(dir+'artifacts.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({indexed_files:Object.keys(result.files).length,originals_included:false,self_hash_excluded:true}))
