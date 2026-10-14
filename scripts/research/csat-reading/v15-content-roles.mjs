// scripts/research/csat-reading/v15-content-roles.mjs
// Expand source-bound material roles without editing any prior activity or Gold.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const local='scripts/research/csat-reading/local/v15/',pub='docs/research/csat-reading/data/v15/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=p=>({path:p,sha256:sha(fs.readFileSync(p))});
const first=read(local+'content-packages.json'),publicFirst=read(pub+'content-packages.json'),old=read(first.prior.path);
const roleMaterials=publicFirst.packages.flatMap(p=>p.roles.map(role=>{
 const id=role.activity_ids[0],a=[...first.reused_priority_activities,...first.new_activities].find(a=>a.activity_id===id),pkg=old.packages.find(p=>p.task_id===a.task_id);
 let learnerPrompt=a.student_prompt,reference=a.gold.full,mode='same_prompt_reused_with_role_specific_feedback';
 if(role.role==='original_analysis'){learnerPrompt=pkg.contracts.student_action.find(x=>x.activity_id===id).prompt;reference=a.gold.full;mode='worked_original_passage_example';}
 if(role.role==='principle_explanation'){learnerPrompt=pkg.contracts.educational_definition+' '+a.minimal_TASK_contrast;reference={principle:pkg.contracts.educational_definition,source_instantiation:a.gold.full,limit:a.minimal_TASK_contrast};mode='explicit_principle_plus_actual_source_instantiation';}
 if(role.role==='semantic_contrast'){learnerPrompt=a.student_prompt+' 두 파생 응답을 비교하여 무엇이 같은지, 잘못된 응답은 어느 대상·범위·뜻을 바꾸는지 본문 근거로 설명하세요.';reference={allowed:a.gold.full,incorrect:a.gold.wrong,defer:a.gold.defer,contrast:a.minimal_TASK_contrast};mode='actual_semantic_contrast_not_original_exam_options';}
 return{material_id:id+'--'+role.role,task_id:a.task_id,role:role.role,base_activity_id:id,item_id:a.item_id,source:a.source,prompt:learnerPrompt,reference,analytic_rubric:a.analytic_rubric,delivery:role.delivery,mode,new_scored_activity:false,reference_authorship:'inherited or investigator explanation, not official commentary',learner_exposure:'unknown',public_qualified:false,direct_assessment_qualified:false};
}));
const out={version:'1.5-role-overlay-revision1',first_private:ref(local+'content-packages.json'),prior_activities_preserved:12,prior_facets_preserved:48,role_materials:roleMaterials,role_uses:14,unique_activity_ids:8,policy:'Role reuses are not new passages, scored activities, independent evidence or student transfer observations.'};
const privatePath=local+'content-roles-revision1.json',bytes=JSON.stringify(out,null,2)+'\n';
const publicOut={version:out.version,first_public:ref(pub+'content-packages.json'),private_role_detail:{path:privatePath,sha256:sha(bytes)},role_uses:14,roles:roleMaterials.map(r=>({material_id:r.material_id,task_id:r.task_id,role:r.role,activity_id:r.base_activity_id,item_id:r.item_id,mode:r.mode,new_scored_activity:false,public_qualified:false,direct_assessment_qualified:false})),new_activity_content_review:'investigator_only_pending_independent_QA',new_actual_student_observations:0};
for(const[path,value]of[[privatePath,out],[pub+'content-roles-revision1.json',publicOut]]){const encoded=JSON.stringify(value,null,2)+'\n';if(/\uFFFD/.test(encoded))throw Error('Corrupt Unicode');if(process.argv.includes('--check')){if(fs.readFileSync(path,'utf8')!==encoded)throw Error('Role mismatch '+path);}else{if(fs.existsSync(path))throw Error('Refusing overwrite '+path);fs.writeFileSync(path,encoded,'utf8');}}
console.log(JSON.stringify({check:process.argv.includes('--check'),role_uses:roleMaterials.length,private_detail:process.argv.includes('--check')?ref(privatePath):{path:privatePath,sha256:sha(bytes)}}));
