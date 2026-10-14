// scripts/research/csat-reading/v12-integrity.mjs
// Final binding, complete matrix and local-link checks; produces no original text.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {assertHash} from './agreement.mjs'
import {assertPreserved} from './v12-analysis.mjs'
const base='docs/research/csat-reading/',dir=base+'data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
assertPreserved(read(dir+'registration.json'))
const ex=read(dir+'pilot-execution.json');for(const [file,h]of Object.entries(ex.hashes))assertHash(fs.readFileSync(file),h,file)
const reviewed=read(dir+'item-task-reviewed.json'),profile=read(dir+'task-relation-review.json'),summary=read(dir+'mapping-summary.json'),tasks=JSON.parse(fs.readFileSync('docs/csat-learner/v4/codebook.json','utf8')).tasks
if(sha(dir+'task-relation-review.json')!==reviewed.source_profile_sha256||sha(dir+'item-task-map.jsonl')!==summary.sha256)throw Error('Profile or complete matrix hash drift')
const rows=fs.readFileSync(dir+'item-task-map.jsonl','utf8').trimEnd().split('\n').map(JSON.parse),unique=new Set(rows.map(r=>r.item_id+'/'+r.task_id))
if(rows.length!==23580||unique.size!==23580||new Set(rows.map(r=>r.item_id)).size!==786||new Set(rows.map(r=>r.task_id)).size!==30)throw Error('Matrix missing/duplicate combinations')
for(const r of rows){if(!tasks.some(t=>t.id===r.task_id)||r.public_learning_use!==false)throw Error('TASK or unauthorized use state');if(r.review_status==='automatic_candidate_not_reviewed'&&r.relevance!=='unknown')throw Error('Candidate promoted without source review')}
if(rows.filter(r=>r.relevance==='direct').length!==18||rows.filter(r=>r.relevance==='indirect').length!==28||rows.filter(r=>r.relevance==='unknown').length!==23534)throw Error('Actual case count drift')
if(profile.tasks.length!==30||profile.relations.length!==34||profile.pair_audits.length!==7||read(dir+'principle-task-review.json').items.length!==110||read(dir+'coverage.json').axes.length!==8)throw Error('Requested ledger incomplete')
const extension=read(dir+'axis-extension.json');if(extension.items.length!==32||extension.axes.join('/')!=='discourse/task'||extension.is_new_confirmation!==false)throw Error('Failed-axis expansion or new-confirmation mislabel')
const docs=fs.readdirSync(base).filter(f=>/^V12-.*\.md$/.test(f)),linkErrors=[]
for(const f of docs){const text=fs.readFileSync(base+f,'utf8');for(const match of text.matchAll(/\]\((\.\/[\w./-]+)(?:#[^)]*)?\)/g)){const target=path.resolve(base,match[1]);if(!fs.existsSync(target))linkErrors.push({file:f,target:match[1]})}}
if(docs.length!==11||linkErrors.length)throw Error('A–J/index document or local link incomplete '+JSON.stringify(linkErrors))
const complete8=new Set(['2014B#42','2022#18','2015#18','2017#25','2022#35','2016#23','2020#37','2024#28'])
const privateInputs=[...read('scripts/research/csat-reading/local/v12/pilot-input.json').items,...read('scripts/research/csat-reading/local/v12/restore-a.json').items,...read('scripts/research/csat-reading/local/v12/restore-b.json').items,...read('scripts/research/csat-reading/local/main-20261014/input.json').items.filter(i=>complete8.has(i.id))]
const published=[...docs.map(f=>base+f),...fs.readdirSync(dir).filter(f=>/\.(json|jsonl)$/.test(f)).map(f=>dir+f)]
let fullOriginalLeaks=0
for(const file of published){const text=fs.readFileSync(file,'utf8');for(const input of privateInputs)if(input.passage.length>=120&&(text.includes(input.passage)||text.includes(JSON.stringify(input.passage).slice(1,-1))))fullOriginalLeaks++}
if(fullOriginalLeaks)throw Error('Full original passage detected in new research artifacts')
const result={version:'1.2',old_frozen_18_preserved:true,first_frozen_input_and_raters_preserved:true,all786x30_combinations_unique:true,actual_source_case_links:46,unknown:23534,task_profiles:30,relations:34,independence_pairs:7,principle_reviews:110,coverage_axes:8,passed_axis_exploratory_items:32,documents:docs.length,local_link_errors:0,new_full_passage_leaks_in_exact_text_probe:fullOriginalLeaks,rights_or_official_download_approval:false,confirmatory_expansion:false,human_or_student_validation:false}
fs.writeFileSync(dir+'integrity.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
