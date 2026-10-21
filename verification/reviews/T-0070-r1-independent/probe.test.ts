// verification/reviews/T-0070-r1-independent/probe.test.ts
import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import fs from 'node:fs'
import {goalPlanRows} from '@/lib/csat/map/v62/goal-plan'
import {nextActionOf} from '@/lib/csat/map/v62/next-action'
import {GoalPlanSummary} from '@/components/csat/diagnosis/map/GoalPlanSummary'
import {CANON_VERSION} from '@/lib/csat/map/v4/definition'

const task='r.central_meaning', ws='ws.central-meaning'
function fixture(unknown=false) {
 const row={task,name:'core',goal:'g',criterion:'c',basis:'none',evidence:'unmeasured',stage:'check',quantity:{unit:'문항',available:3,planned:3,done:0,remaining:3},achievement:'not_checked',unresolved:[],next:{href:'/csat/item/E-Q1?check=1',label:'check'}}
 const view={taskPlans:[row],plans:{[ws]:{workspace:ws,core:[task],tasks:[row]}},asIs:{tasks:{[task]:{basis:'none',status:'unmeasured',check:null}},sessions:[]},toBe:{needs:unknown?[]:[{task,type:'CONFIRM',relevance:{items:3,pointsPerExam:6}}],relevanceUnknown:unknown?[task]:[]}}
 const ranks={needRank:[{rank:1,task,need:unknown?'RELEVANCE_UNKNOWN':'CONFIRM',evidence:'unmeasured'}],actionRank:unknown?[]:[{rank:1,task,needRank:1,href:row.next.href,label:'check'}],notActionable:unknown?[{task,reason:'relevance_unknown'}]:[]}
 return {view:view as never,ranks:ranks as never}
}
const saved=(available=3)=>({status:'installed',byTemplate:{[ws]:{workspaceId:'11111111-2222-4333-8444-555555555555',template:ws,latest:{version:1,canon:CANON_VERSION,plan:{order:[task],tasks:[{task,stage:'check',planned:1,available}]}}}},goalVersionId:1}) as never
describe('T0070 independent: summary uses existing plan and truthfulness boundaries',()=>{
 it('P1: no saved plan must not expose a direct learning link when top CTA requires plan confirmation',()=>{
  const {view,ranks}=fixture();const store={status:'installed',byTemplate:{},goalVersionId:1} as never
  expect(nextActionOf(view,ranks,store)?.kind).toBe('plan')
  expect(goalPlanRows(view,ranks,store).rows[0].action).toBeNull()
 })
 it('P1: content drift must not expose direct learning while top CTA requires re-confirmation',()=>{
  const {view,ranks}=fixture();const store=saved(1)
  expect(nextActionOf(view,ranks,store)).toMatchObject({kind:'plan',replan:true})
  expect(goalPlanRows(view,ranks,store).rows[0].action).toBeNull()
 })
 it('control: valid saved current-stage plan can expose the same actual link',()=>{
  const {view,ranks}=fixture();const store=saved()
  expect(nextActionOf(view,ranks,store)?.kind).toBe('start')
  expect(goalPlanRows(view,ranks,store).rows[0].action?.href).toBe('/csat/item/E-Q1?check=1')
  expect(goalPlanRows(view,ranks,store).rows[0].quantity).toMatchObject({planned:1,remaining:1,source:'saved'})
 })
 it('P1: relevance UNKNOWN is not counted as a confirmed goal requirement',()=>{
  const {view,ranks}=fixture(true);const data=goalPlanRows(view,ranks,null)
  expect(data.rows[0].need).toBe('RELEVANCE_UNKNOWN')
  const html=renderToStaticMarkup(GoalPlanSummary({data,goalSet:true,onSelect:()=>{},onOpenWs:()=>{}}))
  expect(html).not.toContain('목표에 필요한 TASK 1개')
 })
 it('P1 integration: historical read-only mode must reach the new summary, as it does existing map controls',()=>{
  const source=fs.readFileSync('D:/workspace/Vocaflow-final-product/apps/web/src/components/csat/diagnosis/map/UnifiedLearningMap.tsx','utf8')
  const old=source.split('\n').find(line=>line.includes('<GoalRecordBar '))??''
  expect(old).toContain('past={past}')
  const summary=source.match(/<GoalPlanSummary\b[^\n]+/)?.[0]??''
  expect(summary).toContain('past={past}')
 })
 it('control: saved-plan read error is unknown, not a made-up proposed amount',()=>{
  const {view,ranks}=fixture()
  expect(goalPlanRows(view,ranks,{status:'installed',error:true,byTemplate:{},goalVersionId:1} as never).rows[0].quantity).toMatchObject({planned:null,remaining:null,source:'unknown'})
 })
})
