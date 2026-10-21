// verification/reviews/FINAL-MAIN-29b428c28/criterion-scope.test.ts
import {describe,it,expect} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {GoalPlanSummary} from '@/components/csat/diagnosis/map/GoalPlanSummary'
import {taskOf} from '@/lib/csat/map/v4/definition'
const task='r.central_meaning'
const row={task,needRank:1,need:'MAINTAIN',evidence:'resolved',basis:'direct_check',independentItems:4,relevance:{items:7,pointsPerExam:15},stage:null,workspace:'ws.central-meaning',quantity:{unit:'문항',planned:null,done:0,remaining:null,source:'none'},criterion:taskOf(task).learner_criterion,achievement:'resolved',action:null,planGate:null,blocked:'material_needed',unresolved:['material_needed']}
const e={task,taskKey:null,currentCheck:{status:'passed',independentItems:4,policy:'existing'},instructionPath:{repair:'succeeded',transferDone:2,transferPlanned:2},newPassageTransfer:{status:'experienced',passages:2},delayedRetention:{status:'NOT_ESTABLISHED',reason:'no_approved_interval_or_instrument'},learningEffect:'NOT_EVALUATED',ledger:'complete',attempts:[],sharedPassageGroups:[],scope:null}
const html=renderToStaticMarkup(createElement(GoalPlanSummary,{data:{rows:[row],required:1,relevanceUnknown:0,examSessions:0,directTasks:1,actionable:0},evidence:{[task]:e},goalSet:true,onSelect(){},onOpenWs(){}} as never))
describe('Current policy check versus full qualitative criterion',()=>{
 it('gap: expose existing delayed uncertainty next to current-policy success',()=>{expect(html).toContain('지금 확인 · 통과(지금 기준)');expect(html).toMatch(/시간 지나 다시 확인|지연 유지/);expect(html).toMatch(/아직 근거 없음|아직 확인.*않|미확립/);})
 it('control: canonical target criterion is preserved',()=>{expect(html).toContain(row.criterion);expect(html).toContain('다른 날');})
 it('control: no fake goal-score or learning-effect success',()=>{expect(html).toContain('목표 점수 달성은 아니에요');expect(html).not.toMatch(/숙달 완료|학습 효과 입증|장기 유지 통과/);})
})
