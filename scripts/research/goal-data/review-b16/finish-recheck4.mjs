// scripts/research/goal-data/review-b16/finish-recheck4.mjs
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const out='scripts/research/goal-data/review-b16/', doc='docs/research/goal-data-batches/review-b16/', control='D:/workspace/Vocaflow-AI-Control'
const raw=JSON.parse(fs.readFileSync(out+'recheck4.local.json')), failed=raw.checks.filter(c=>!c.pass)
if(failed.length)throw Error('Review checks failed')
const acceptance=[
 {index:0,status:'resolved',finding:'Malformed batch input and undefined task: actual runner spawn, stdout/stderr external IDs 0, one masked failure line, stderr empty, exit 1. Both handlers registered before input parsing and task resolution.',locations:['scripts/research/goal-data/d2-run.mjs:17','scripts/research/goal-data/d2-run.mjs:18','scripts/research/goal-data/d2-run.mjs:19','scripts/research/goal-data/d2-run.mjs:20','scripts/research/goal-data/d2-run.mjs:29','scripts/research/goal-data/d2-run.mjs:36']},
 {index:1,status:'resolved',finding:'Shipped regression 32/32. Sixteen captured batches b2-b16 including b9t: full validate and agree stdout/stderr/exit unchanged (32 comparisons); agree generated files byte hashes unchanged. Own defect, own malformed output and other-unreadable plus own-empty retain exit 1.',locations:['scripts/research/goal-data/d2-validate.check.mjs:176','scripts/research/goal-data/d2-run.mjs:17','scripts/research/goal-data/d2-run.mjs:80','scripts/research/goal-data/d2-run.mjs:93','scripts/research/goal-data/d2-run.mjs:101','scripts/research/goal-data/review-b16/recheck4.mjs:1']},
 {index:2,status:'resolved',finding:'Requested JSON/Markdown artifacts, new P0/P1 and b17 decision recorded.',locations:[doc+'recheck4.json:1',doc+'recheck4.md:1']},
]
const report={task_id:'T-0128',owner:'goal-data-independent',input_worktree:'D:/workspace/Vocaflow-goal-data',input_commit:raw.rev,previous_commit:raw.old,observed_at:raw.observed_at,result:'pass',result_meaning:'verification completed',skip_count:0,acceptance,checks:{passed:raw.checks.length,failed:0,shipped_passed:32,shipped_total:32,batches:16,full_mode_comparisons:32,agree_artifacts_unchanged:true},previous_finding:{id:'RECHECK3-P1-01',status:'resolved'},new_findings:{P0:[],P1:[]},b17:'진행 가능 — 이번 초기화 예외 가림 재검 범위에서 차단 P0/P1 없음.',raw_evidence:out+'recheck4.local.json',limits:['Read-only pinned source; all spawn and agree writes confined to temporary copies in reviewer worktree.','32/32 includes shipped structural stubs; independent defect scenarios use actual runner and full validators.','Product build/E2E, DB writes, learner measurement and main/remote integration not run; not required by this narrow review.'],harness_corrections:'Initial harness omitted a source file read by shipped regression, assumed only two changed paths despite the review note, and expected catch text for a normal JSON defect. Corrected before final run; initial output retained in recheck4-initial.local.json.'}
fs.writeFileSync(doc+'recheck4.json',JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(doc+'recheck4.md',`# T-0128 · 초기화 예외 가림 짧은 재검

**RECHECK3-P1-01 resolved · 새 P0 0 / P1 0 · b17 진행 가능.** result=pass는 검증 수행 완료이며 skip_count=0이다.

입력 @${raw.rev}, 이전 @${raw.old}와 비교했다. 변경 3파일(실행기·제공 회귀·검토 기록)을 정독했다. 중앙 development_policy를 읽었고 첫 task show에서 IN_PROGRESS/session t-0128-codex가 일치해 추가 대기는 없었다. PID 조회는 하지 않았다. 입력 worktree에는 쓰지 않았다.

- AC0 **resolved** — 깨진 배치 input.json과 정의 밖 tasks를 임시 복사본의 실제 d2-run spawn으로 재현했다. 각각 stdout/stderr 전체 외부 ID 0, stdout 오류 한 줄·「검사 실패」, stderr 빈 값, exit 1이다. 두 핸들러는 인자 해석 직후 등록되어 input.json 파싱과 tasks 해석보다 앞선다. (scripts/research/goal-data/d2-run.mjs:17; scripts/research/goal-data/d2-run.mjs:18; scripts/research/goal-data/d2-run.mjs:19; scripts/research/goal-data/d2-run.mjs:20; scripts/research/goal-data/d2-run.mjs:29; scripts/research/goal-data/d2-run.mjs:36)
- AC1 **resolved** — 제공 회귀 32/32. 캡처 296파일이 현재 입력 바이트와 일치한다. b2–b16 및 b9t 총 16변형의 전체 validate·agree 32회 비교에서 stdout/stderr·exit가 전부 동일하고 agree 생성물 해시도 동일하다. 실제 전체 검증기로 자기 행 결함·자기 깨진 출력·다른 출력 읽기 불가+자기 빈 출력을 재현해 결함 출력과 exit 1이 유지됨을 확인했다. 핸들러 등록은 청크 validate에만 적용된다. (scripts/research/goal-data/d2-validate.check.mjs:176; scripts/research/goal-data/d2-run.mjs:17; scripts/research/goal-data/d2-run.mjs:80; scripts/research/goal-data/d2-run.mjs:93; scripts/research/goal-data/d2-run.mjs:101; scripts/research/goal-data/review-b16/recheck4.mjs:1)
- AC2 **resolved** — recheck4.json·recheck4.md와 새 P0/P1·b17 가부를 기록했다. (docs/research/goal-data-batches/review-b16/recheck4.json:1; docs/research/goal-data-batches/review-b16/recheck4.md:1)

독립 확인 ${raw.checks.length}/${raw.checks.length}, 제공 회귀 32/32. 초기 검증 스크립트의 의존 파일 누락·변경 파일 수 예상·JSON 결함 문구 예상 오류를 바로잡고 재실행했다. 초기 출력은 recheck4-initial.local.json, 최종 원문·명령 출력·전체 diff는 recheck4.local.json에만 보존했다. 제공 구조 회귀 일부는 stub을 쓰며 별도 결함 반례는 실제 runner와 전체 함수를 사용했다. DB·제품 build/E2E·학습자 측정·main/원격 통합은 미실행이며 이번 범위 밖이다.

재현: node scripts/research/goal-data/review-b16/recheck4.mjs → node scripts/research/goal-data/review-b16/finish-recheck4.mjs. Git·증거·submit 원출력은 recheck4-finish.local.json에 남긴다. Git 실패와 검증 완료는 별도로 기록한다.

**b17 진행 가능 — 이번 초기화 예외 가림 재검 범위에서 차단 P0/P1 없음.**
`)
// Remove only this review's own disposable copies, after saving full raw evidence.
const parent=path.resolve(out)
for(const n of fs.readdirSync(parent).filter(n=>n.startsWith('recheck4-temp.local-'))){const target=path.resolve(parent,n);if(path.dirname(target)!==parent)throw Error('Unsafe cleanup path');fs.rmSync(target,{recursive:true,force:true})}
const files=[out+'recheck4.mjs',out+'finish-recheck4.mjs',doc+'recheck4.json',doc+'recheck4.md'],log=[]
function run(cmd,args,cwd=process.cwd()){
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:10*1024*1024}),record={cmd,args,cwd,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null}
 log.push(record);fs.writeFileSync(out+'recheck4-finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record
}
for(const f of files.filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',f]).status!==0)throw Error('Syntax check failed')
if(run('git',['diff','--check','--',...files]).status!==0)throw Error('Whitespace check failed')
run('git',['add','--',...files])
run('git',['commit','--only','-m','docs: verify b16 initialization error masking','-m','Resolve RECHECK3-P1-01 with actual runner spawn cases.\nVerify shipped 32/32 and unchanged full validate/agree.\nRecord no new P0/P1 and allow b17 within review scope.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...files])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:doc+'recheck4.json',observed_at:new Date().toISOString(),covers:[0,1,2],command_or_protocol:'41 independent checks; shipped 32/32; 16 captured batches full validate/agree unchanged; actual initialization spawn cases masked, exit 1; all acceptance resolved; new P0/P1 0; b17 allowed within scope; pass=verification completed'}
fs.writeFileSync(control+'/runtime/t-0128-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0128','--file','runtime/t-0128-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('Evidence failed')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0128','--by','goal-data-independent'],control).status!==0)throw Error('Submit failed')
