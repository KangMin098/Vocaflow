// scripts/research/goal-data/review/finalize.mjs
// 재개 시 기존 검증을 재사용하고 모호한 경계는 유보한다. 원문은 출력하지 않는다.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const dir='docs/research/goal-data-batches/review'
execFileSync(process.execPath,[dir+'/build-verdict.mjs'],{stdio:'pipe'})
const v=JSON.parse(fs.readFileSync(dir+'/verdict.json','utf8'))
const held=new Set(['M2609#18','M2609#21','M2609#27','M2609#32','M2609#37','M2609#43','2025#22','2025#32'])
for(const r of v.d2.r1)if(held.has(r.item)){
 r.verdict='unclear'
 r.note+=' 관련성 경로의 존재는 지지되나 후보 등급 전체의 확정은 유보한다. 구체 반사실의 TASK 고유성 또는 direct/indirect 경계를 추가 검증해야 한다.'
}
for(const r of v.d2.disputes)if(['M2609#22/R4','M2609#30/E2','M2609#31/V4','M2609#31/R2'].includes(r.item+'/'+r.task)){
 r.verdict='unclear';r.supported_track=null;r.reviewer_candidate=null;r.contract_boundary_violation=null
 r.note= r.item==='M2609#30'?'근거가 바로 다음 문장에 있다. 계약 v2의 E2 direct 설명(다른 문장)과 indirect 설명(바로 인접 문장)에 동시에 걸려 A/B 단일값과 위반 판정은 유보한다.':'원문 경로는 가능하지만 인접 TASK와의 경계 또는 구체 반사실의 TASK 고유성이 확정되지 않아 단일값 권고를 유보한다.'
}
const count=rs=>Object.fromEntries(['confirmed','refuted','unclear'].map(s=>[s,rs.filter(r=>r.verdict===s).length]))
v.d2.summary.r1=count(v.d2.r1);v.d2.summary.disputes=count(v.d2.disputes)
v.d2.summary.confirmed_boundary_violations=v.d2.disputes.filter(r=>r.contract_boundary_violation).length
v.d2.summary.violation_unit='A/B 개별 TASK 판정 1개: M2609#29 E1 B. E2 인접/다른 문장 경계는 미정.'
const rows=[...v.d1,...v.d2.r1,...v.d2.disputes,v.d2.r3_claim,...v.d3.sample,...v.d3.claims,...v.d4.handoff,...v.d4.tasks,...v.d4.omissions]
const mainClaims={
 'D1-insert-raw-block':'삽입 262문항의 raw_block은 모두 null이다',
 'D1-insert-sentence-missing-262':'삽입 262문항의 주어진 문장이 모두 결손이다',
 'D1-insert-blanket-exclusion':'raw_block null만으로 삽입 전체를 부적격 확정할 수 있다',
 'D1-M2709':'M2709 시험·문항이 미적재다',
 'D1-2023-38':'2023#38 choices=null이며 body_ok=true다',
 'D1-redistribution-record-0':'D1 source_note 기록 기준의 재배포 적격은 0(미정)이다',
 'D1-legal-redistribution-0':'법적 재배포 가능한 문항이 0개다',
 'D2-R3-boundary':'계약 v2에 R3 경계 규정 공백이 있다',
 'D3-grammar-category-absent':'분류표에 어법 범주가 없다',
 'D3-order-granularity-gap':'순서 연결 단절을 구별하는 전용 범주가 부족하다',
 'D3-agreement-is-not-truth':'164/280은 A/B 일치 집계이며 정확도·학습자 원인 판정이 아니다',
 'D4-handoff-1':'공통 판정은 다른 날·지문 다양성·전이/지연 역할을 도달 조건으로 검사하지 않는다',
 'D4-handoff-2-M1':'선행 실패 없는 성공만으로 도달 상태가 되지 않으며 PLAN도 checking을 도달로 바꾸지 않는다',
 'D4-handoff-3-21classes':'D4의 21개 TASK 분류가 전체 도달 계약과 일치한다',
 'D4-handoff-4-M4':'M4는 합성을 포함한 부적격 기록 전체를 직접 판정에서 제외한다',
 'D4-handoff-4-M7':'정본 확인 키는 중심 TASK 한 개에만 부여된다',
 'D4-handoff-5-omissions':'D4 원 감사에서 빠진 평가 계약 충돌이 있다',
 'D4-N1-approval-policy':'저장소 SQL은 조건을 갖춘 AI 결정을 허용한다',
 'D4-N2-same-task-different-score':'같은 R5 TASK의 창작/기출 도구 채점 범위가 다르다',
 'D4-N3-observation-vs-need':'R2/E3 관찰 제한과 공통 약점 확정 규칙이 충돌한다',
 'D4-N4-future-passage-duplication':'세트 validator는 본문 해시 중복 대신 passageGroup을 검사한다',
 'D4-current-release':'현재 승인·권리·자격·납품이 충족되어 있다',
}
for(const r of rows){
 r.claim=mainClaims[r.id]??(r.id.startsWith('D2-R1-')?`${r.item} ${r.task} R1 후보 등급과 근거 전체가 적합하다`:r.id.startsWith('D2-dispute-')?`${r.item} ${r.task} 갈림을 단일 관련성 값으로 권고할 수 있다`:r.id.startsWith('D3-')?`${r.item} 오답 ${r.choice}의 명시된 분류·설명이 원문에 부합한다`:`${r.id.replace('D4-task-','')}의 D4 5분류가 도달 계약·현재 승인 상태에 부합한다`)
}
v.summary={all:count(rows),total:rows.length,d1:count(v.d1),d2_r1:count(v.d2.r1),d2_disputes:count(v.d2.disputes),d3_samples:count(v.d3.sample),d4_tasks:count(v.d4.tasks),unit:'주장·표본·TASK 판정 행. 상위 요약과 하위 판정이 함께 있으므로 독립 문항 수나 정확도가 아니다.'}
v.acceptance_covers=[0,1,2,3,4]
const allowed=new Set(['D1-insert-raw-block','D1-M2709','D1-2023-38','D1-redistribution-record-0','D2-R3-boundary','D3-order-granularity-gap','D4-handoff-1','D4-handoff-2-M1','D4-handoff-4-M7','D4-N1-approval-policy','D4-N2-same-task-different-score','D4-N3-observation-vs-need','D4-N4-future-passage-duplication'])
v.engine_handoff=rows.filter(r=>r.verdict==='confirmed'&&allowed.has(r.id)).map(r=>({id:r.id,claim:r.claim,evidence:r.evidence,scope:r.note}))
v.engine_handoff_exclusions=['개별 AI 링크를 NeedRank·진단·성취 입력으로 승격하지 않는다','R3 11개와 다른 unclear 항목은 보류한다','raw_block null로 삽입 262개 전체를 제외하지 않는다','원천 권리 기록 부재를 법적 불가로 바꾸지 않는다','정본 키 존재를 현재 활성·적격·납품 완료로 바꾸지 않는다']
v.workflow={task_start:'재개 지시에 따라 재실행하지 않음. task show의 pid 932/product_lock_token 63035f0a736d412a가 T-0088 자신의 실행임을 확인.',previous_start_failure:'최초 실행 실패 메시지 원문은 잔존 파일에서 확인하지 못했다. 추정하여 복원하지 않는다.',commit_attempt:'git add docs/research/goal-data-batches/review scripts/research/goal-data/review 및 지정 메시지의 git commit --only',commit_error:"fatal: Unable to create 'D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock': Permission denied",observed_prior_commit:'8456ee69d8ef96058d8cfab4764aea66b3669edb',prior_commit_note:'검증 도중 HEAD가 이전 실행의 검토 커밋으로 진행한 것을 관찰했다. 이 세션의 git 명령 성공으로 주장하지 않는다. 최종 보수 판정 보완과 ev.json은 이 커밋에 포함되지 않았다.',task_status:'REVIEW',evidence_attempt:'node D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs task evidence T-0088 --file D:/workspace/Vocaflow-goal-data-review/scripts/research/goal-data/review/ev.json --by goal-data-independent',evidence_error:'거부 [NOT_REVIEWER] REVIEW 단계 증거는 등록된 다른 owner(리뷰어)만 붙인다',submit_attempt:'node D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs task submit T-0088 --by goal-data-independent',submit_error:'거부 [BAD_TRANSITION] REVIEW → REVIEW 불가',push:false,db_writes:0}
v.verification.git_commit={status:'final_changes_blocked',observed_prior_commit:v.workflow.observed_prior_commit,reason:v.workflow.commit_error,path:'D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock'}
const clean=s=>s.replaceAll('사람 Gold','사람 검수 결과')
fs.writeFileSync(dir+'/verdict.json',clean(JSON.stringify(v,null,2))+'\n')
const body=fs.readFileSync(dir+'/review.md','utf8').split('\n').filter(l=>!l.startsWith('- R1 판정:')&&!l.startsWith('- 갈림 판정:')&&!l.startsWith('- **확인한 v2 의미 경계')).join('\n')
const prefix=`검증 집계: **confirmed ${v.summary.all.confirmed} · refuted ${v.summary.all.refuted} · unclear ${v.summary.all.unclear}**(전체 ${rows.length} 판정 행; 상위 요약·하위 표본 포함).\n\nD2 최종 보수 판정은 R1 ${JSON.stringify(count(v.d2.r1))}, 갈림 ${JSON.stringify(count(v.d2.disputes))}다. R3 11개는 모두 unclear다. 명확한 v2 경계 위반은 부정 발문 E1의 B 판정 1개이며, #30 E2는 인접 문장/다른 문장 규칙이 겹쳐 위반 판정을 유보했다. 반사실 허위 확정 0개와 지지 보류 3개를 구분한다.\n\n`
const footer=`\n## 재개 및 제출 기록\n\n${v.workflow.task_start}\n\n${v.workflow.previous_start_failure}\n\n최종 산출 재생성은 scripts/research/goal-data/review/finalize.mjs, 검증은 review/validate-output.mjs를 사용한다. build-verdict.mjs는 재개 전 초안 생성기로 최종 결과는 finalize.mjs의 유보 판정 보완을 포함한다.\n\n엔진 인계 허용 ${v.engine_handoff.length}개는 verdict.json의 engine_handoff에 범위와 근거를 명시했다. unclear 및 개별 AI 링크는 엔진 입력으로 승인하지 않는다.\n\n기존 커밋 관찰: ${v.workflow.observed_prior_commit}. ${v.workflow.prior_commit_note}\n\n최종 보완분 Git 오류 원문: ${v.workflow.commit_error}\n\n추가 evidence 등록 실패: ${v.workflow.evidence_error}\n\nsubmit 재시도 실패: ${v.workflow.submit_error}. 현재 상태는 이미 REVIEW다. 이 세션의 추가 증거 등록·최종 보완 커밋·재제출 성공으로 보고하지 않는다.\n`
fs.writeFileSync(dir+'/review.md',clean(body.replace('\n\n','\n\n'+prefix)+footer))
console.log(JSON.stringify(v.summary))
