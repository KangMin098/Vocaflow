// scripts/research/factory-qualification-v11/role-gates.mjs
import {isDeepStrictEqual} from 'node:util';
import {AXES,ROLES,sourceGuard} from '../factory-qualification/qualification.mjs';
const measured=new Set(['independent_check','transfer','delayed_check']);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const sameSubject=(a,b)=>!!a&&!!b&&a.id===b.id&&a.revision===b.revision&&a.sha256===b.sha256&&hash(a.sha256);
const conjunction=xs=>xs.includes(false)?false:xs.every(x=>x===true)?true:null;
export function axisFlag(x){return x?.state==='pass'?true:x?.state==='fail'?false:null;}
export function productCSummary(spec){
 const axes=spec.axes??{};
 return {producible:typeof spec.producible==='boolean'?spec.producible:null,rights:conjunction([axisFlag(axes.F),spec.rights_verified===true?true:spec.rights_verified===false?false:null]),content:conjunction(['A','B','C'].map(a=>axisFlag(axes[a]))),teaching:axisFlag(axes.D),gold:axisFlag(axes.E),assessment:spec.measurement_validated===true?conjunction(['E','G'].map(a=>axisFlag(axes[a]))):null,runnable:axisFlag(axes.H)};
}
export function approvalGate(record,registry,request,kind){
 // registry is an explicit server-owned snapshot. This pure function does not authenticate its caller.
 if(registry?.boundary!=='product_server_verified_records'||!hash(registry.snapshot_sha256))return {ok:false,reason:'server_approval_registry_unobserved'};
 if(!record||record.kind!==kind||record.status!=='approved'||record.revoked===true)return {ok:false,reason:'approval_record_missing_or_revoked'};
 const authoritative=registry.records?.find(r=>r.id===record.id);
 if(!authoritative||!isDeepStrictEqual(authoritative,record))return {ok:false,reason:'approval_record_not_in_server_snapshot'};
 const actor=registry.actors?.find(a=>a.id===record.actor_id);
 if(!actor||actor.active!==true||!actor.permissions?.includes(kind)||actor.actor_type==='AI')return {ok:false,reason:'approver_authority_unverified'};
 const scope=record.scope;
 if(!sameSubject(scope?.artifact,request.artifact)||scope?.task_id!==request.demand.task_id||!scope?.roles?.includes(request.role))return {ok:false,reason:'approval_artifact_TASK_role_scope_mismatch'};
 for(const name of ['source','analysis','source_policy',...(request.includes_gold||measured.has(request.role)?['gold']:[])])if(!sameSubject(scope?.[name],request[name]))return {ok:false,reason:'approval_'+name+'_scope_mismatch'};
 return {ok:true,record_id:record.id,registry_sha256:registry.snapshot_sha256};
}
export function learnerGate(snapshot,request){
 const fail=[];
 if(snapshot?.boundary!=='product_server_observed_learner'||snapshot.user_id!==request.user_id||snapshot.observed_at!==request.supply_at||!hash(snapshot.snapshot_sha256))fail.push('learner_server_identity_or_freshness_unverified');
 if(!sameSubject(snapshot?.artifact,request.artifact))fail.push('learner_artifact_revision_mismatch');
 if(snapshot?.access_allowed!==true)fail.push('learner_access_unverified');
 if(measured.has(request.role))for(const name of ['source_group_unseen','normalized_body_unseen','no_explanation_before','no_hint_before','first_response_contract_bound'])if(snapshot?.[name]!==true)fail.push(name);
 if(request.role==='transfer')for(const name of ['different_learning_body','same_performance_goal','shared_body_excluded'])if(snapshot?.[name]!==true)fail.push(name);
 if(request.role==='delayed_check')for(const name of ['actual_elapsed_observed','intermediate_exposure_observed','same_item_recognition_separated'])if(snapshot?.[name]!==true)fail.push(name);
 return {ok:fail.length===0,fail};
}
export function supplyGate(request,serverContext){
 const blocked=[];const add=(gate,reason)=>blocked.push({gate,reason});
 const trusted=serverContext?.boundary==='product_server_qualification_context'?serverContext:null;
 if(!trusted)add('server','trusted_supply_context_missing');
 if(!trusted?.review||!isDeepStrictEqual(trusted.review,request.review))add('server','review_not_in_server_snapshot');
 if(!ROLES.includes(request.role)||request.demand?.role!==request.role||!request.demand?.task_id||request.review?.task_id!==request.demand.task_id||request.review?.roles?.includes(request.role)!==true)add('demand','TASK_or_role_mismatch');
 if(!sameSubject(request.review?.artifact,request.artifact))add('review','artifact_revision_or_hash_mismatch');
 for(const name of ['source','analysis','source_policy',...(request.includes_gold||measured.has(request.role)?['gold']:[])])if(!sameSubject(request.review?.[name],request[name]))add('review',name+'_binding_mismatch');
 if(request.review?.rules_version!=='FQ1.1')add('review','rules_version_unbound');
 for(const a of AXES){const x=request.review?.axes?.[a],e=request.review?.evidence?.find(e=>e.id===x?.evidence_ref);if(!x||!['pass','fail','unknown','not_applicable'].includes(x.state)||!x.method||!x.reason||!x.review_revision||x.review_revision!==request.review?.review_revision||!hash(x.evidence_sha256)||!sameSubject(x.subject,request.artifact)||!e||e.sha256!==x.evidence_sha256||e.review_revision!==x.review_revision||!sameSubject(e.subject,request.artifact))add('evidence',a+'_missing_or_unbound');}
 const required=measured.has(request.role)?AXES:['A','B','C','D','F','G','H',...(request.includes_gold?['E']:[])];
 for(const a of required)if(request.review?.axes?.[a]?.state!=='pass')add(a,request.review?.axes?.[a]?.state??'unknown');
 const source=sourceGuard(trusted?.provenance??{});if(source.state!=='pass')add('provenance',source.state);
 const approvals={};for(const kind of ['rights','release',...(measured.has(request.role)?['human_gold','scorer_validation','student_measurement']:[])]){approvals[kind]=approvalGate(request.approvals?.[kind],trusted?.approval_registry,request,kind);if(!approvals[kind].ok)add('approval',approvals[kind].reason);}
 const learner=learnerGate(trusted?.learner,request);for(const reason of learner.fail)add('learner',reason);
 if(request.role==='guided_practice')for(const name of ['hint_log_contract','Gold_after_final_guided_freeze','assisted_label'])if(request.role_context?.[name]!==true)add('guided',name);
 if(trusted?.runtime?.supported_roles?.includes(request.role)!==true||trusted?.runtime?.artifact_sha256!==request.artifact?.sha256)add('runtime','artifact_or_role_support_unverified');
 if(trusted?.delivery?.user_id!==request.user_id||trusted?.delivery?.demand_key!==request.demand?.key||trusted?.delivery?.atomic_unique_claim!==true||trusted?.delivery?.already_delivered!==false)add('delivery','identity_demand_or_atomic_dedupe_unverified');
 return {rules_version:'FQ1.1',role:request.role,research_candidate:request.research_candidate===true,product_supply_allowed:blocked.length===0,assessment_allowed:measured.has(request.role)&&blocked.length===0,blocked,approval_checks:approvals,learner_check:learner,summary:productCSummary({axes:request.review?.axes,producible:request.producible,rights_verified:approvals.rights?.ok===true?true:null,measurement_validated:['human_gold','scorer_validation','student_measurement'].every(k=>approvals[k]?.ok===true)}),scope:'pure boundary check; caller must obtain trusted registry, exposure, runtime and atomic delivery attestations from product server; no actual authorization created'};
}
