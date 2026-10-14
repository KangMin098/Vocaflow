// scripts/research/factory-learning-runtime/code-audit.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const own = path.resolve('scripts/research/factory-learning-runtime');
const out = path.resolve('docs/research/factory-learning-runtime/data/code-audit.json');
const source = 'D:/workspace/Vocaflow-map-v62';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const files = [
 'apps/web/src/lib/learner/dcp-types.ts','apps/web/src/lib/learner/dcp.ts','apps/web/src/lib/learner/dcp-actions.ts',
 'apps/web/src/lib/textbook/practice-rpc.ts','apps/web/src/lib/textbook/publish-gate.ts',
 'apps/web/src/components/practice/DcpPlayer.tsx','apps/web/src/components/practice/DcpItems.tsx',
 'apps/web/src/components/wordvault/StudyMode.tsx','apps/web/src/components/wordvault/WordVaultStudyClient.tsx',
 'apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx','apps/web/src/components/game/scriptquiz/types.ts',
 'apps/web/src/lib/scriptquiz/grade-actions.ts','apps/web/src/lib/scores/record-score.ts','apps/web/src/lib/layout/session-return.ts',
 'apps/web/src/app/(main)/library/textbooks/[series]/[step]/practice/page.tsx',
 'apps/web/src/lib/admin/help/textbook.ts','apps/web/src/lib/csat/map/v4/definition.data.ts',
 'packages/library-pipeline/src/dcp/generate-items.ts','packages/library-pipeline/src/textbook/series-catalog.ts',
 'packages/library-pipeline/src/textbook/compose-unit.ts','packages/library-pipeline/src/textbook/school-types.ts',
 'packages/library-pipeline/src/textbook/vocab-choice.ts','packages/library-pipeline/src/textbook/grammar-choice.ts',
 'packages/library-pipeline/src/textbook/middle-choice.ts','packages/library-pipeline/src/textbook/middle-short.ts',
 'packages/library-pipeline/src/textbook/word-order.ts','packages/library-pipeline/src/textbook/elementary.ts',
 'packages/library-pipeline/src/textbook/explain-items.ts','packages/library-pipeline/src/textbook/explain.ts',
 'scripts/textbook/store-new-types.mjs', 'supabase/migrations/_pending_textbook_practice_publish_gate.sql',
 'apps/web/src/lib/csat/map/v62/supply.ts','apps/web/src/lib/csat/map/v62/production-pilot.ts',
];
const types = [
 ['vocab_choice',['sentences','underlines'],['position','original'],'select_marked_span','reject_contextual_word'],
 ['unit_vocab',['sentences','choices','prompt_ko','target'],['answer'],'select_choice','recognize_word_meaning'],
 ['blank_word',['stem','hint','context','prompt_ko','sentence_idx'],['text'],'short_text','retrieve_constrained_word'],
 ['grammar_choice',['sentences','underlines'],['position','original','rule'],'select_marked_span','recognize_form_error'],
 ['grammar_fix',['stem','hint','context','prompt_ko','sentence_idx'],['text','rule'],'short_text','repair_sentence_form'],
 ['unit_grammar',['sentences','choices','prompt_ko','underlines'],['answer','original'],'select_choice','recognize_form_error'],
 ['word_order',['bank','context','sentence_idx'],['sentence'],'token_order','reconstruct_sentence'],
].map(([type,payload,answer_key,input,observable]) => ({type,payload_fields:payload,answer_key_fields:answer_key, proposed_input:input, observable,
 current_runner_supported:false,current_db_scorer_supported:false,
 task_direct_evidence:'item-specific performance review required',runtime_status:'requires_runner_adapter',scoring_status:'requires_scoring_contract'}));
if (process.argv.includes('--check')) {
 const data=JSON.parse(fs.readFileSync(out,'utf8'));
 for(const f of data.code_files) {
   if(sha(fs.readFileSync(path.join(own,'local/code-audit-snapshots',f.path)))!==f.sha256) throw Error('Snapshot drift '+f.path);
 }
 if(sha(fs.readFileSync(path.join(own,'local/code-audit-rpc.json')))!==data.rpc_snapshot.sha256) throw Error('RPC snapshot drift');
 if(sha(fs.readFileSync(path.join(own,'local/code-audit-schema.json')))!==data.storage.schema_snapshot_sha256) throw Error('Schema snapshot drift');
 if(data.types.length!==7 || data.types.some(t=>t.current_runner_supported||t.current_db_scorer_supported)) throw Error('Unsupported types inflated');
 console.log(JSON.stringify({check:'pass',code_files:data.code_files.length,types:data.types.length,rpc_execution_count:0}));
} else if(process.argv.includes('--write')) {
 if(fs.existsSync(out)) throw Error('Registered audit exists: do not overwrite');
 const code_files=files.map(p=>{
  const b=fs.readFileSync(path.join(source,p));const dst=path.join(own,'local/code-audit-snapshots',p);
  fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,b);return {path:p,sha256:sha(b),bytes:b.length};
 });
 const rpcfile=path.join(own,'local/code-audit-rpc.json');const rpc=JSON.parse(fs.readFileSync(rpcfile,'utf8'));
 const scorer=rpc.rows.find(x=>x.proname==='grade_dcp_item');
 if(!scorer || !scorer.definition.includes("ELSE RAISE EXCEPTION 'Unknown type'")) throw Error('Actual RPC snapshot incomplete');
 const data={version:'FQR1-code-audit1',observed_date:'2026-10-15',product_worktree:source,
 product_head:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),
 product_branch:execFileSync('git',['branch','--show-current'],{cwd:source,encoding:'utf8'}).trim(),
 product_dirty_paths:execFileSync('git',['status','--short'],{cwd:source,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean),
 code_files,types,rpc_snapshot:{sha256:sha(fs.readFileSync(rpcfile)),read_only:true,executed_grading_calls:0,
 observed_functions:rpc.rows.map(r=>({name:r.proname,args:r.args,definition_sha256:sha(r.definition)})),
 textbook_practice_items_for_present:rpc.rows.some(r=>r.proname==='textbook_practice_items_for'),
 requested_seven_supported:0,current_grade_types_count:17},
 canonical_tasks:{S3:'s.attachment',S4:'s.structural_relation',S5:'s.form_scope',V2:'v.contextual_sense'},
 storage:{table:'csat_item_attempts',schema_snapshot_sha256:sha(fs.readFileSync(path.join(own,'local/code-audit-schema.json'))),observed_columns:['id','user_id','question_id','text_id','is_correct','error_cause','item_role','responded_at','dcp_item_id'],raw_response:false,revision:false,hint_exposure:false,feedback_text:false},
 boundaries:{inventory_counts_from_comments_used:false,supported_by_existing_runner_not_qualified:true,source_rights_not_inferred:true,actual_product_changes:0,actual_student_tests:0,human_validation:0}};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({written:out,types:types.length,files:code_files.length}));
} else throw Error('Use --write once, or --check immutable private snapshots');
