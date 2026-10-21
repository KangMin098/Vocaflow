import {createRoot} from 'react-dom/client'
import {composeV4} from '@/lib/csat/map/v4/compose'
import {ranksOf} from '@/lib/csat/map/v62/rank'
import {goalPlanRows} from '@/lib/csat/map/v62/goal-plan'
import {GoalRecordBar} from '@/components/csat/diagnosis/map/GoalRecordBar'
import {GoalPlanSummary} from '@/components/csat/diagnosis/map/GoalPlanSummary'
import {WorkspaceList} from '@/components/csat/diagnosis/map/WorkspaceList'
import {workspaceRows} from '@/lib/csat/map/v62/workspace-list'
import {dataOf} from '../fixture'
const task='r.central_meaning',ws='ws.central-meaning'
const data=dataOf(new URLSearchParams(location.search).get('unseen')==='1')
const view=composeV4(data,{score:80,set:true},data.now)!
// Focus one real MAINTAIN need to test the fallback, not other tasks' ranking.
view.toBe={...view.toBe!,needs:view.toBe!.needs.filter(n=>n.task===task),relevanceUnknown:[]}
const saved=data.v4.saved
saved.byTemplate[ws]={latest:{version:1,goalVersionId:10,plan:{order:view.plans[ws].tasks.map(p=>p.task),tasks:view.plans[ws].tasks.map(p=>({task:p.task,stage:p.stage,planned:p.quantity.planned,available:p.quantity.available}))}}}
const ranks=ranksOf(view)
createRoot(document.getElementById('root')!).render(<><GoalRecordBar data={data} g={{goal:80} as never} goalSet asIs={view.asIs} view={view} ranks={ranks} recordHref="/csat/diagnosis" onSelect={()=>{}} onOpenWs={()=>{}}/><GoalPlanSummary data={goalPlanRows(view,ranks,saved)} goalSet saved={saved} evidence={view.evidence} onSelect={()=>{}} onOpenWs={()=>{}}/><WorkspaceList rows={workspaceRows(view)} ranks={ranks} data={data} past={false} selectedTask={task} selectedWs={ws} onSelectWs={()=>{}} onOpenWs={()=>{}} onSelectTask={()=>{}}/></>)
