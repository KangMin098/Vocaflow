// apps/web/scripts/build-goal-outcome-harness.mts
// Component browser QA only. The real goal writer and migration run separately in goal-budget.pglite.test.ts.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

const root = path.resolve('.')
const require = createRequire(path.join(root, 'package.json'))
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi
const shims: Record<string, string> = {
  'next/link': `import { createElement } from 'react'; export default function Link({href,children,...props}) { return createElement('a',{href,...props},children) }`,
  'next/navigation': `export const useRouter = () => ({ refresh() { window.__refreshes = (window.__refreshes || 0) + 1 } });`,
  '@/lib/analytics/client': 'export function track() {}',
}
const entry = `
import { createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GoalSchedule } from '@/components/csat/diagnosis/map/GoalSchedule'
import { GoalOutcome } from '@/components/csat/diagnosis/map/GoalOutcome'
import { ReplanPanel } from '@/components/csat/diagnosis/map/ReplanPanel'
import { goalLearning } from '@/lib/csat/map/v62/goal-learning'
import styles from '@/components/csat/diagnosis/map/map.module.css'
const budget = {weeklyMinutes:120,dailyMinutes:null,minutesPerUnit:10,priorities:[]}
const goal = {id:2,score:80,grade:2,exam:'kice9',date:'2026-11-19',createdAt:'2026-09-01T00:00:00Z',budget}
const T='r.central_meaning', WS='ws.central-meaning'
const r = {task:T,needRank:1,need:'REPAIR',evidence:'verified_need',basis:'direct_check',independentItems:2,relevance:{items:2,pointsPerExam:4},stage:'repair',workspace:WS,quantity:{unit:'문항',planned:3,remaining:3,done:0,source:'saved'},criterion:'근거를 들어 설명한다',achievement:'need_confirmed',action:null,planGate:'replan',replanWhy:'content',blocked:null,unresolved:[]}
const plans=[{task:T,need:'REPAIR',achievement:'need_confirmed',next:{href:'/csat/learn/authored-central-meaning?phase=repair',label:'바로잡기'}}]
const ses=(id,examId,takenAt,raw,o={})=>({id,examId,examLabel:examId,takenAt,enteredAt:takenAt+'T12:00:00Z',raw,grade:null,diagnosable:true,examReady:true,mode:'live',firstExposure:'unseen',examScope:'kice9',...o})
const saved=(stage,planned,gv=2,err=false)=>({status:'installed',goal,goalVersionId:2,goalHistory:[goal],error:err||undefined,byTemplate:{[WS]:{workspaceId:'w',template:WS,history:[],latest:{version:1,plan:{order:[T],tasks:[{task:T,stage,planned,available:planned,rule:null}]},reason:'initial',note:null,restoredFrom:null,canon:'x',asOf:'2026-09-02T00:00:00Z',createdAt:'2026-09-02T00:00:00Z',goalVersionId:gv}}}})
const S={
  none:{sessions:[],rows:[{...r,planGate:null,action:{rank:1,href:'/x',label:'바로잡기'}}],saved:saved('repair',3)},
  below:{sessions:[ses('a','k9-2025','2026-08-20',70),ses('b','k9-2026','2026-09-10',72,{grade:4})],rows:[r],saved:saved('check',2)},
  met:{sessions:[ses('b','k9-2026','2026-09-10',90,{grade:2})],rows:[r],saved:saved('repair',3)},
  repeat:{sessions:[ses('a','k9-2025','2026-08-20',70),ses('b','k9-2025','2026-09-10',95)],rows:[r],saved:saved('repair',3)},
  other:{sessions:[ses('b','hp-2026','2026-10-10',95,{examScope:'hakpyeong'})],rows:[r],saved:saved('repair',3)},
  goal:{sessions:[],rows:[{...r,replanWhy:'goal'}],saved:saved('repair',2,1)},
  // T-0110 Codex 반례 — 재확정 대상 TASK 와 이미 배정된 다른 TASK 가 함께 있는 주(소계 ≠ 전체)
  mixed:{sessions:[ses('b','k9-2026','2026-09-10',72,{grade:4})],rows:[r,{...r,task:'v.core_meaning',needRank:2,planGate:null,action:{rank:2,href:'/x',label:'바로잡기'},quantity:{...r.quantity,planned:2,remaining:2}}],saved:saved('check',2)},
  error:{sessions:[],rows:[r],saved:{status:'installed',byTemplate:{},goalVersionId:null,goal:null,error:true}},
}
function Harness() {
  const [k,setK] = useState('none')
  const [opened,setOpened] = useState('')
  const c=S[k]
  const taskPlans=c.rows.map(r=>({...r,name:'중심 의미',goal:'근거 설명',next:plans[0].next,quantity:{...r.quantity,available:r.quantity.planned,rule:null},workspaces:[WS]}))
  const learning=goalLearning({summary:{rows:c.rows,examSessions:c.sessions.length,directTasks:1,required:1,relevanceUnknown:0,actionable:0},saved:c.saved,plans:{[WS]:{workspace:WS,core:[T],tasks:taskPlans,progress:null}},taskPlans,sessions:c.sessions,activity:[],asOf:'2026-10-23T01:00:00Z'})
  return h('div',{className:styles.root},h('main',{},
    h('h1',{},'목표 대비 · 재처방 — 격리 컴포넌트 검증'),
    h('nav',{'aria-label':'합성 상태'},...Object.keys(S).map(s=>h('button',{key:s,onClick:()=>setK(s),style:{minHeight:44,padding:'8px 16px'}},s))),
    h(GoalSchedule,{learning,past:false,onOpenWs:(ws,tab)=>setOpened(ws+':'+tab)}),
    h(GoalOutcome,{outcome:learning.outcome,past:false}),
    h(ReplanPanel,{p:learning.replan,onOpenWs:(ws,tab)=>setOpened(ws+':'+tab)}),
    h('output',{'data-testid':'opened-workspace'},opened)))
}
createRoot(document.getElementById('root')).render(h(Harness))
`
const result = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, outdir: 'harness-out', format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.module.css': 'local-css', '.css': 'empty' },
  plugins: [{ name: 'goal-outcome-harness', setup(b) {
    b.onResolve({ filter: /^(next\/link|next\/navigation|@\/lib\/analytics\/client)$/ }, a => ({ path: a.path, namespace: 'shim' }))
    b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ contents: shims[a.path], loader: 'jsx', resolveDir: root }))
    b.onResolve({ filter: /^@\// }, a => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: root }))
  } }],
})
const js = result.outputFiles.find(f => f.path.endsWith('.js'))!.text
// Match Tailwind's app preflight for sizing; omitting it adds border/padding to the measured modal and day controls.
const css = result.outputFiles.filter(f => f.path.endsWith('.css')).map(f => f.text).join('\n') + '\n*,::before,::after { box-sizing: border-box; }'
const skin = fs.readFileSync(path.resolve('../../packages/design-tokens/src/skins/csat-app.css'), 'utf8')
const out = path.resolve('output/goal-outcome-harness.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `<!doctype html><html lang="ko" data-skin="csat"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goal outcome component QA</title><style>${skin}\n${css}\nbody{margin:0;background:#faf9f7;font-family:Arial,sans-serif}main{padding:24px;max-width:1100px;margin:auto}input,select,button{font:inherit}button,select,input[type=number],input[type=date]{min-height:44px}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid #18181b;outline-offset:3px}</style></head><body><div data-design-scope="csat" id="root"></div><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
console.log('Built output/goal-outcome-harness.html (component-only, synthetic data)')
