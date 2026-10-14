// scripts/research/csat-reading/v13-exposure.mjs
import fs from 'node:fs';import {read,sha} from './v13-analysis.mjs';
const base='docs/research/csat-reading/',dir=base+'data/v13/';
const source=read(dir+'pilot-source.json'),prior=read(base+'data/v12/exposure.json');
const cross=read(dir+'source-critical-review.json');
const result={version:'1.3',prior_exposure_preserved:{path:base+'data/v12/exposure.json',sha256:sha(fs.readFileSync(base+'data/v12/exposure.json')),recent_propagated_n:prior.propagated_n},excluded_before_classification:read(dir+'eligibility-addendum.json').excluded,
 project_admitted_fresh_ids:source.items.filter(x=>x.id!=='2022#26').map(x=>x.id),source_role_all_selected_ids:source.items.map(x=>x.id),source_role_incidental_page_exposure:source.items.map(x=>({source_item:x.id,...x.incidental_page_exposure})),root_new_incidental_page_exposure:cross.root_adjacent_exposure,
 principle_role:{main_pages:['2014A#36–40','2014B#35–38'],key_page_exposure:'whole2014A/Bkeypages potentially visible to source reviewer only',mock_pages:['M2206#37–40','M2306#33–36'],full_text_layers_programmatically_loaded:true,question_regions_directly_read:4,answer_key_missing_for_mock:true},
 rater_A_B:{fork_turns:'none',inputs_only:['PROTOCOL-v1.3.md','local/v13/rater-instructions.md','local/v13/pilot-input.json'],source_input_n:11,prior_semantic_inputs_delivered:false,key_delivered_before_first_complete:false,model_pretraining_unexposed_guaranteed:false,source_role_context_reused_as_rater:false},
 learner_exposure:{collected:false,student_n:0,research_exposure_is_not_student_exposure:true,content_phase_eligible_for_real_unseen_assessment:'not_audited'},
 recent_2025_2026_originals_newly_opened_in_this_run:false,limits:'Full-page images/answer sheets can incidentally expose neighbouring material. Do not interpret recorded fresh AI contexts as globally unseen model knowledge or future student-unexposed stock.'};
fs.writeFileSync(dir+'exposure.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({fresh_ids:result.project_admitted_fresh_ids.length,prior_recent_preserved:70,student_n:0}));
