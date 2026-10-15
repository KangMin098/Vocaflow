// scripts/research/pm4b-final/closure.test.tsx
// Synthetic SSR/source probes; no browser, API, account or DB mutation.
import { expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { view, historicalAsIs } from './original/fixture';
import { domainTaskGraph, taskInspector } from '@/lib/csat/map/v62/graph';
import { ranksOf } from '@/lib/csat/map/v62/rank';
vi.mock('@/lib/csat/map/learner-path',()=>({learnerPath:()=>({read:[],listen:[]})}));
vi.mock('@/lib/analytics/client',()=>({track:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('@/components/csat/diagnosis/map/GoalBar',()=>({GoalPopover:({trigger}:any)=>trigger({open:false,toggle:()=>{},id:'test-goal'})}));
import { GoalRecordBar } from '@/components/csat/diagnosis/map/GoalRecordBar';
import { PlanSection } from '@/components/csat/diagnosis/map/PlanSection';
import { TaskInspector, NEED_V62_LABEL } from '@/components/csat/diagnosis/map/TaskInspector';
const data:any={records:[{label:'Synthetic exam',takenAt:'2026-09-13',raw:70,grade:3}]};
const base:any={data,g:{goal:80},goalSet:true,asIs:historicalAsIs(),recordHref:'/csat/diagnosis?tab=records'};

it('past header excludes future record from analysis and labels current overall score separately',()=>{
  const h=render(<GoalRecordBar {...base} past currentHref="/csat/diagnosis?tab=map"/>);
  expect(h).toContain('읽기 전용');expect(h).toContain('2026-09-01 기준');expect(h).toContain('기록 0개');expect(h).toContain('기준일 뒤 1');
  expect(h).toContain('최근 시험 · 지금 전체 기록 기준');expect(h).toContain('2026-09-13');
  expect(h).not.toContain('data-testid="map-goal-edit"');expect(h).not.toContain('data-testid="umap-record-add"');
  expect((h.match(/href="\/csat\/diagnosis\?tab=map"/g)||[]).length).toBe(3);
});
it('current header retains edit and record actions; full-mode return preserves view and strips asof',()=>{
  const h=render(<GoalRecordBar {...base}/>);expect(h).toContain('data-testid="map-goal-edit"');expect(h).toContain('data-testid="umap-record-add"');
  const p=render(<GoalRecordBar {...base} past currentHref="/csat/diagnosis?tab=map&view=full"/>);
  expect((p.match(/href="\/csat\/diagnosis\?tab=map&amp;view=full"/g)||[]).length).toBe(3);expect(p).not.toContain('asof=');
});
it('past PLAN has no activity or save/adjust controls even with installed empty store',()=>{
  const v=view([],12),w=Object.values(v.plans)[0];expect(w).toBeTruthy();
  for(const saved of [null,{status:'not_installed'},{status:'installed',byTemplate:{},goalVersionId:'g'}]){
    const h=render(<PlanSection view={w} reason={null} past saved={saved as any} viewer="synthetic" goal={80}/>);
    expect(h).not.toContain('data-testid="plan-save"');expect(h).not.toContain('data-testid="plan-save-box"');
    expect(h).not.toContain('활동 시작');
  }
});
it('all actual Node accessible names carry full TASK names and preserve distinct identifiers',()=>{
  // Isolate the actual private Node function by TS transpilation. This checks rendered semantics, not layout/hydration.
  const req=createRequire(process.env.VF_REVIEW_DEP_ROOT+'/apps/web/package.json');
  const ts=req('typescript');
  const source=readFileSync('apps/web/src/components/csat/diagnosis/map/UnifiedLearningMap.tsx','utf8');
  const node=source.slice(source.indexOf('\nfunction Node('));expect(node.startsWith('\nfunction Node(')).toBe(true);
  const js=ts.transpileModule('export '+node.trimStart(),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:any={};new Function('require','exports','u','NEED_V62_LABEL',js)(req,exports,new Proxy({}, {get:(_,p)=>String(p)}),NEED_V62_LABEL);
  const rows=domainTaskGraph().tasks.map(t=>{const html=render(React.createElement(exports.Node,{t,wide:false,selected:false,priority:false,dim:false,need:null,evidence:'아직 확인 전',onClick:()=>{}}));
    expect(html).toContain('data-node="'+t.id+'"');expect(html).toContain('aria-label="'+t.display+' '+t.name+' — 아직 확인 전"');return {id:t.id,display:t.display,name:t.name};});
  expect(rows.length).toBe(30);expect(new Set(rows.map(x=>x.display)).size).toBe(30);
  writeFileSync('docs/research/pm4b-final/data/task-names.json',JSON.stringify(rows,null,2)+'\n');
});
it('V4 selected Inspector provides full name and purpose without needing a start action',()=>{
  const v=view([],12),r=ranksOf(v),t=domainTaskGraph().tasks.find(x=>x.display==='V4')!;
  const ins=taskInspector(t.id,v,r,null);expect(ins.task.name).toBe(t.name);expect(ins.task.name).toContain('표현 사이');expect(ins.task.name).toContain('의미');
  const h=render(<TaskInspector ins={ins} view={v} data={{...data,doneTaskIds:[],model:{},settings:{},practiceLinks:{}} as any} past={false} restoreWs={null} planOpen={false} onTogglePlan={()=>{}}/>);expect(h).toContain(t.name);expect(h).toContain('다 했다고 보는 기준');
});
it('readonly prop and current route are connected through real parent; semantic engines unchanged by PR268 is audited separately',()=>{
  const s=readFileSync('apps/web/src/components/csat/diagnosis/map/UnifiedLearningMap.tsx','utf8');
  expect(s).toMatch(/<GoalRecordBar[^>]+past=\{past\}/);expect(s).toContain("recordHref.split('?')[0]");
  expect(s).toContain("mode === 'full' ? '&view=full' : ''");
});
