// scripts/research/pm4b-final/original/acceptance.test.tsx
import {describe,it,expect,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {writeFileSync,mkdirSync} from 'node:fs';
import {view,att,ctx,input,historicalAsIs} from './fixture';
import {buildDemand} from '@/lib/csat/map/v62/demand';
import * as supplyModule from '@/lib/csat/map/v62/supply';
import {supplyFor} from '@/lib/csat/map/v62/supply';
import {supplyStep,SUPPLY_STEP_LABEL} from '@/lib/csat/map/v62/supply-ledger';
import {ranksOf} from '@/lib/csat/map/v62/rank';
import {taskInspector} from '@/lib/csat/map/v62/graph';
vi.mock('@/lib/analytics/client',()=>({track:vi.fn()}));
vi.mock('@/lib/csat/map/learner-path',()=>({learnerPath:()=>({read:[],listen:[]})}));
vi.mock('@/components/csat/diagnosis/map/StepSheet',()=>({StepSheet:()=>null}));
vi.mock('@/components/csat/diagnosis/map/useTaskDone',()=>({useTaskDone:()=>({done:new Set(),pending:false,toggle:vi.fn()})}));
vi.mock('@/components/csat/diagnosis/map/GoalBar',()=>({GoalPopover:({trigger}:any)=>trigger({open:false,toggle:()=>{},id:'goal-fixture'})}));
import {FocusStrip} from '@/components/csat/diagnosis/map/FocusStrip';
import {TaskInspector} from '@/components/csat/diagnosis/map/TaskInspector';
import {GoalRecordBar} from '@/components/csat/diagnosis/map/GoalRecordBar';
const TASK='r.central_meaning';
const data:any={practiceLinks:{x:{confirm:['i1','i2','i3','i4','i5','i6'].map(target=>({taskKey:'claim-support',target,href:'/csat/item/'+target,label:target}))}},doneTaskIds:[],model:{goal:80,goalSet:true},settings:{},records:[{label:'Synthetic exam',takenAt:'2026-09-13',raw:70,grade:3}]};
const capture=(name:string,html:string)=>{const p='scripts/research/pm4b-final/local/original';mkdirSync(p,{recursive:true});writeFileSync(p+'/'+name+'.html',html);return html;};
describe('independent PM4 synthetic acceptance',()=>{
 it('E: synthetic guided-role V2 demand cannot promote large stock',()=>{
   const v=view([att('i1',false,10),att('i2',false,11)],12);
   // V2 has no direct check of its own: role substitution is explicit render/DTO boundary fixture, not natural browser state.
   const d=buildDemand(v,'v.contextual_sense',null,ctx);
   const guided={...d,lines:[{...d.lines[0],role:'guided_practice' as const}]};
   expect(guided.lines[0]).toBeTruthy();
   for(const stock of [1,50000,Number.MAX_SAFE_INTEGER]){
    const s=supplyFor(guided,input({factoryStock:{'R-VOCAB':stock}}));
    const l=s.lines[0];expect(l.state).toBe('factory_candidate');expect(l.delivered).toEqual([]);expect(l.qualification.runnable).toBe(false);expect(l.qualification.assessment).toBe(false);expect(s.anyAvailable).toBe(false);
    const step=supplyStep(l,'v.contextual_sense',{status:'not_installed'});
    expect(step).toBe('stock_review_wait');
    const html=render(<li data-role={l.role} data-state={l.state} data-step={step}>{SUPPLY_STEP_LABEL[step]}</li>);
    capture('E-stock-label',html);expect(html).toContain('검수 대기');expect(html).not.toContain('지금 학습할 수 있어요');
   }
 });

 it('E actual Inspector render with injected factory_candidate Supply DTO does not display learn-now',()=>{
  const v=view([],12),r=ranksOf(v),id='v.contextual_sense',ins=taskInspector(id,v,r,null);
  const d=buildDemand(v,id,null,ctx);const guided={...d,lines:[{...d.lines[0],role:'guided_practice' as const}]};
  const s=supplyFor(guided,input({factoryStock:{'R-VOCAB':3}}));
  const spy=vi.spyOn(supplyModule,'supplyFor').mockReturnValue(s);
  try{const h=capture('E-actual-inspector-injected',render(<TaskInspector ins={ins} view={v} data={data} past={false} restoreWs={null} planOpen={false} onTogglePlan={()=>{}}/>));
   expect(h).toContain('data-step="stock_review_wait"');expect(h).toContain('검수 대기');expect(h).not.toContain('data-step="learn_now"');expect(h).not.toContain('data-testid="inspector-next"');
  }finally{spy.mockRestore();}
 });
 it('request specs without ledger cannot display order or delivery',()=>{
  const d=buildDemand(view([],12),'v.contextual_sense',null,ctx);const guided={...d,lines:[{...d.lines[0],role:'guided_practice' as const}]};
  const s=supplyFor(guided,input({factoryStock:{}}));expect(s.lines[0].state).toBe('order_spec_possible');
  for(const status of ['no_workspace','error','not_installed'] as const)expect(supplyStep(s.lines[0],'v.contextual_sense',{status})).toBe('orderable');
 });
 it('Focus distinguishes goal missing, no records, no action, and historical actions',()=>{
  const v=view([],12),r=ranksOf(v);expect(r.actionRank.length).toBeGreaterThan(0);
  const props:any={view:v,ranks:r,data,goalSet:true,past:false,recordHref:'/csat/diagnosis/record',selected:TASK,onSelect:()=>{}};
  const h=capture('focus-ready',render(<FocusStrip {...props}/>));expect(h).toContain('data-state="ready"');expect(h).toContain('약점 확정이 아니에요');
  expect(render(<FocusStrip {...props} goalSet={false}/>)).toContain('data-state="no_goal"');
  const empty={...v,asIs:{...v.asIs,sessions:[]}};expect(render(<FocusStrip {...props} view={empty}/>)).toContain('data-state="no_record"');
  expect(render(<FocusStrip {...props} ranks={{...r,actionRank:[]}}/>)).toContain('data-state="none"');
  const past=render(<FocusStrip {...props} past/>);expect(past).not.toContain('data-testid="focus-next"');expect(past).toContain('과거 기준 보기');
 });
 it('actual Inspector marks missing material separately from need and renders four-stage sequence',()=>{
  const v=view([],12),r=ranksOf(v),ins=taskInspector(TASK,v,r,null);
  const h=capture('inspector-R5',render(<TaskInspector ins={ins} view={v} data={data} past={false} restoreWs={null} planOpen={false} onTogglePlan={()=>{}}/>));
  expect(h).toContain('data-step="learn_now"');expect(h).toContain('실력 점수가 아니에요');
  const order=['check','repair','transfer','recheck'].map(k=>h.indexOf('data-stage="'+k+'"'));expect(order.every(x=>x>=0)).toBe(true);expect(order).toEqual([...order].sort((a,b)=>a-b));
  const past=render(<TaskInspector ins={ins} view={v} data={data} past restoreWs={null} planOpen={false} onTogglePlan={()=>{}}/>);expect(past).not.toContain('data-testid="inspector-next"');
 });
 it('historical header boundary probe preserves original visible future-record and active controls',()=>{
  const old=historicalAsIs(); expect(old.sessions[0].excluded).toBe('after_as_of');
  const h=capture('past-header-boundary',render(<GoalRecordBar data={data} g={{goal:80} as any} goalSet asIs={old} recordHref="/csat/diagnosis/record"/>));
  expect(h).toContain('기준일 뒤 1');expect(h).toContain('2026-09-13');expect(h).toContain('data-testid="map-goal-edit"');expect(h).toContain('data-testid="umap-record-add"');
  // This is a reproduced boundary observation, NOT an assertion that readonly acceptance passes.
 });
});
