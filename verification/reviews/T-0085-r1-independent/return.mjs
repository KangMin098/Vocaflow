import fs from 'node:fs'
import {withState} from '../../../lib/state.mjs'
import {addEvidence,rejectReview} from '../../../lib/tasks.mjs'
const caller='final-independent-accept'
const root='verification/reviews/T-0085-r1-independent/'
const at=new Date().toISOString()
const record=withState(s=>addEvidence(s,'T-0085',{type:'review',result:'fail',skip_count:0,observed_at:at,commit:'7c1376875572b1bd0a2ecf4c57b35c2a39a68078',covers:[0,1,2,3,4],artifact_path_or_url:root+'REWORK.md',command_or_protocol:'Actual source opsSummary + actual design/product RSC with synthetic fixtures: original4/4 pass; total6 pass/6 fail/skip0; no DB. P1 one cause: result label bypasses trialEvidenceState.'},{caller}),{event:'evidence.add',task:'T-0085',by:caller})
const t=withState(s=>rejectReview(s,'T-0085',{caller,reason:'T0085-P1-1: current-only count fixed, but synthetic/unknown trial still renders unqualified positive effect result in actual design/product RSC; 6 fail/6 controls.',review_path:root+'REWORK.md'}),{event:'task.reject',task:'T-0085',by:caller})
fs.appendFileSync('planning/inbox/final-product.md',`\n\n## ${at} · T-0085 · REWORK · T0085-P1-1\n\n[VF-TASK T-0085] HEAD7c1376875 · 같은rev1 · REWORK. 최초 opsSummary4/4는 통과했습니다. 현재 집계/cohort를 다시 만들지 마세요. 남은 P1 한 원인은 설계/적용 목록/상세의 result 직출력입니다: synthetic=true 또는 합성표지/재계산표지 미확인 analyzed+supported가 실제RSC에서 여전히 효과 지지로 나옵니다. 독립6fail/6control(skip0), 실제source+실제두RSC loader대역, DB0. ${root}REWORK.md · probe.test.tsx · probe-results.json. 현재status→표시 라벨 한 판정으로 current만 일반결과, stale/unknown/synthetic/pending은 근거아님/이유를 명시하세요(원시result 변경/삭제0). 기존 집계4대조+6정상은 이미 통과했으니 재구현/전체463재실행 불필요. 이6반례/대조+관련type/lint+변경표시 Chromium만. 세 화면은 기존허용범위, 최신main 후속수정/감사2파일/다른owner CSS 보존. UI증거 형식 반려는 제품P1과 별개이며 이번반려사유가 아닙니다. P2 invalid status→pending은 비차단, 필요시같은helper에만 최소처리. 같은TASK/rev 실제ACK·재착수→수정HEAD→submit, 새TASK/worker/PR/CI 없음.\n`)
console.log(JSON.stringify({task:t.task_id,status:t.status,evidence:record.evidence_id,delivered:'QUEUED',actual_ack:false},null,2))
