import fs from 'node:fs'
import {withState,loadState} from '../../../lib/state.mjs'
import {addTask,setGoalStatus} from '../../../lib/tasks.mjs'
import {goalCheckStep} from '../../../lib/orchestrator.mjs'
import {devConfig} from '../../../lib/devmode.mjs'
const by='final-independent-accept'
const specPath='planning/handoff/FINAL-TRIAL-EVIDENCE-DISPLAY-rev1.json'
const spec=JSON.parse(fs.readFileSync(specPath,'utf8'))
const existing=loadState().state.taskQueue.tasks.find(t=>t.source?.design_id===spec.source.design_id)
const t=existing??withState(s=>addTask(s,spec),{event:'task.add',by})
const at=new Date().toISOString()
const msg=`\n\n## ${at} · T0084-COMPLETED-LOCAL-MAIN + ${t.task_id}-QUEUED\n\n[VF-TASK T-0084] 정식 COMPLETED · ACCEPT_WITH_LIMITS · source e21ff733c93525d0ef9654c5456a1f199955eba2 → 로컬 main db569100c273338449c76087ec66550854f21728. T0084-P1-1 VERIFIED_FIXED; 독립17/17(skip0), 실제 스타일 KPI6/6, 통계 실제script 대역4/4 재사용. main 결합8파일83/83(skip0), tsc/lint0, tested tree=committed tree21c6473d5ccb9805831dbcd9b42412fa1bb08306. main clean·소유잠금release PID19700 완료. 인증DB/원격CI/실제효과/전체지표PASS는 주장하지 않습니다. package 두 명령은 이미984에서tsx였고 제 앞서 node 그대로라는 지적은 잘못이므로 REVIEW-CORRECTION.json으로 철회했습니다(원증거 보존). Node20 실행 자체는 미검증, 추가수정·재실행 요구없음. 감사2파일/source/aux integration 건드리지 않았습니다.\n\n[VF-TASK ${t.task_id}] rev1 · Goal Alignment Gate 통과 · owner final-product · spec ${specPath}. 최신 main의 opsSummary 실제2실패/2정상 증거 verification/reviews/NEXT-TRIAL-EVIDENCE/{probe.test.ts,results.json}. 표본 변경으로 reviewRequiredAt가 있어도 analyzed(false)를 실제학습자 분석완료로 세고, 메타 false만으로 실제라고 표시합니다. 기존 F7/상세의 재계산 근거금지와 불일치. T0084 KPI는 수용범위이며 다시 하지 않습니다. 하나의 효과표시 작업으로 기존 trial metadata/라벨을 연결하세요. 개인진단/G2/PLAN/DB/계정등록/정책/권리/Gold 변경0. 분석건수≠효과지지, 비합성표시≠실제참가자 검증. 자세한 최소수용/경로/대조는 spec에 있습니다.\n\n기존 세션 c513ff5b/worktree/branch 유지·source e21 위 필요한 최소패치만; 최신 main의 design/상세/help 후속변경은 먼저 비교·보존하고 강제main병합/stash/reset/타owner편집 금지. 같은파일 활성writer면 그경로만 반환하고 순수함수부터 진행. 공식 source/main 통합은 Codex 담당. 관련scope 단위/type/lint+현재화면1440/1280만, 전체web/작업별push/PR/CI/새worker 불필요. 실제수신시 ACK+현재PID 후 task start, 같은TASK/rev에 submit. 큐등록은 구현시작이 아닙니다.\n`
if(!existing) fs.appendFileSync('planning/inbox/final-product.md',msg)
withState(s=>setGoalStatus(s,'VG-L3-D1-02',{status:'FAIL',by,note:'T0084 source e21→main db569 독립수용: KPI/교사/영상/통계의 기존혼입 해결. 옛FAIL경로 재발로 해석하지 않는다. 남은 실제반례: knowledge opsSummary가 재계산 필요 analyzed trial도 현재효과검증 수에 포함하고 비합성표지만으로 실제학습자라고 표시(독립2fail/2control); T0085 조회·표시만 수정. 전체 권한/효과평가 범위 검증은 부분이며 PASS 주장 없음.',evidence_paths:['verification/reviews/T-0084-r2-independent/local-main-integration.json','verification/reviews/T-0084-r2-independent/REVIEW-CORRECTION.json','verification/reviews/NEXT-TRIAL-EVIDENCE/results.json']}),{event:'goal.set',by})
const cfg=devConfig()
const gc=goalCheckStep({deps:{productRepo:cfg.main_worktree,devConfig:()=>({...cfg,integration_branch:'main'})},ciEnabled:false,by:'final-independent-accept-main'})
const receipt={task_id:t.task_id,source_design:spec.source.design_id,status:t.status,delivery:'QUEUED',actual_ack:false,implementation_started:false,at,goal_check:{report:gc.report,distribution:gc.distribution,main:gc.check.head??null},db_writes:0,remote_calls:0}
fs.writeFileSync(new URL('./dispatch-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt,null,2))
