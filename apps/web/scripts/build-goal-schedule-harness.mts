// apps/web/scripts/build-goal-schedule-harness.mts
// Component QA with SQL-derived goal/PLAN frames and transport doubles; not shared DB end-to-end.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

const root = path.resolve('.')
const require = createRequire(path.join(root, 'package.json'))
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi
const sqlPath = path.resolve('output/goal-schedule-sql.json')
if (!fs.existsSync(sqlPath)) throw new Error('Run reassess-plan.pglite.test.ts first to produce real SQL/PLAN projection frames')
const sqlEvidence = JSON.parse(fs.readFileSync(sqlPath, 'utf8')) as { schema: string; sourceHashes: Record<string, string>; frames: Record<string, unknown> }
if (sqlEvidence.schema !== 'goal-learning-sql/1') throw new Error('Invalid SQL projection evidence')
for (const [p, hash] of Object.entries(sqlEvidence.sourceHashes)) if (createHash('sha256').update(fs.readFileSync(path.resolve(p))).digest('hex') !== hash) throw new Error(`Stale SQL projection: ${p}. Rerun the SQL integration test`)
const shims: Record<string, string> = {
  'next/link': `import { createElement } from 'react'; export default function Link({href,children,...props}) { return createElement('a',{href,...props},children) }`,
  'next/navigation': `export const useRouter = () => ({ refresh() { window.__refreshes = (window.__refreshes || 0) + 1 } });`,
  '@/lib/analytics/client': 'export function track() {}',
}
const entry = `
import { createElement as h, useState, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { GoalSchedule } from '@/components/csat/diagnosis/map/GoalSchedule'
import { GoalOutcome } from '@/components/csat/diagnosis/map/GoalOutcome'
import { goalLearning } from '@/lib/csat/map/v62/goal-learning'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'
import { GoalPopover, useGoal } from '@/components/csat/diagnosis/map/GoalBar'
import styles from '@/components/csat/diagnosis/map/map.module.css'
const budget = {weeklyMinutes:120,dailyMinutes:[20,20,20,20,20,20,0],minutesPerUnit:10,priorities:[]}
const goal = {id:1,score:80,grade:2,exam:'suneung',date:'2026-11-01',createdAt:'2026-10-01T00:00:00Z',budget}
const r = {task:'r.central_meaning',needRank:1,need:'CONFIRM',evidence:'unmeasured',basis:'none',independentItems:null,relevance:{items:2,pointsPerExam:4},stage:'check',workspace:'ws.central-meaning',quantity:{unit:'문항',planned:4,remaining:4,done:0,source:'saved'},criterion:'근거를 들어 설명한다',achievement:'not_checked',action:{rank:1,href:'/csat/learn/authored-central-meaning?phase=check',label:'혼자 확인하기'},planGate:null,replanWhy:null,blocked:null,unresolved:[]}
const sqlFrames = ${JSON.stringify(sqlEvidence.frames)}
function Harness() {
  const [scenario,setScenario] = useState('A')
  const [opened,setOpened] = useState('')
  const currentGoal = sqlFrames[scenario]?.goal ?? (scenario === 'C' ? {...goal,id:2,date:'2026-11-02',createdAt:'2026-10-23T00:00:00Z'} : goal)
  const input = {model:{goal:80,goalSet:true,currentScore:null,reference:{exams:[],wanted:3,shortfall:3}},v4:{target:{goal:currentGoal}},settings:{goal_presets:[80,90]}}
  const g = useGoal(input)
  const repair = scenario === 'repair' || scenario === 'confirmed'
  const rows = scenario === 'C' ? [{...r,action:null,planGate:'replan',replanWhy:'goal'}] : [repair ? {...r,stage:'repair',evidence:'verified_need',action:scenario==='confirmed'?{...r.action,label:'바로잡기',href:'/csat/learn/repair?d=fixture-repair'}:null,planGate:scenario==='confirmed'?null:'replan',replanWhy:'content'} : r]
  const oldPlan = {version:7,goalVersionId:1,createdAt:'2026-10-20T00:00:00Z',asOf:'2026-10-20T00:00:00Z',canon:CANON_VERSION,reason:'initial',note:null,restoredFrom:null,plan:{order:[r.task],tasks:[{task:r.task,stage:'check',planned:4,available:4,rule:null}]}}
  const latest = scenario === 'confirmed' ? {...oldPlan,version:8,reason:'check_result',plan:{...oldPlan.plan,tasks:[{...oldPlan.plan.tasks[0],stage:'repair'}]}} : oldPlan
  const saved = {status:'installed',goal:currentGoal,goalVersionId:currentGoal.id,byTemplate:{[r.workspace]:{template:r.workspace,workspaceId:'fixture-workspace',latest,history:[latest,...(scenario==='confirmed'?[oldPlan]:[])]}},goalHistory:scenario==='C'?[currentGoal,goal]:[goal]}
  const summary = {rows,examSessions:scenario==='B'?0:2,directTasks:repair?1:0,required:1,relevanceUnknown:0,actionable:rows[0].action?1:0}
  const task = {...rows[0],name:'중심 의미',goal:'근거 설명',need:'CONFIRM',quantity:{...rows[0].quantity,available:4,rule:null},next:rows[0].action,workspaces:[r.workspace]}
  const before = {id:'pre',examId:'old-paper',examLabel:'이전 시험',takenAt:'2026-09-20',enteredAt:'2026-09-21T00:00:00Z',raw:70,grade:3,diagnosable:true,examReady:true,mode:'live',examScope:'suneung',firstExposure:'unseen'}
  const after = {...before,id:'post',examId:'new-paper',examLabel:'새 시험',takenAt:'2026-10-21',enteredAt:'2026-10-22T00:00:00Z',raw:scenario==='met'?90:78,grade:scenario==='met'?1:3,firstExposure:scenario==='exposure-error'?'unknown':'unseen'}
  const previous = useRef(null)
  const learning = sqlFrames[scenario] ?? goalLearning({summary,saved,plans:{[r.workspace]:{workspace:r.workspace,core:[r.task],tasks:[task],progress:null}},taskPlans:[task],sessions:scenario==='B'?[]:[before,after],activity:[],asOf:'2026-10-23T01:00:00Z',previous:previous.current})
  useEffect(()=>{previous.current=learning},[learning])
  return h('div',{className:styles.root},h('main',{},
    h('h1',{},'목표 계획 — 격리 컴포넌트 검증'),
    h('nav',{'aria-label':'합성 상태'},...['A','B','C','repair','confirmed','met','exposure-error',...Object.keys(sqlFrames)].map(s=>h('button',{key:s,onClick:()=>setScenario(s),style:{minHeight:44,padding:'8px 16px'}},s))),
    h(GoalPopover,{data:input,g,trigger:({toggle,open,id})=>h('button',{onClick:toggle,'aria-controls':id,'aria-expanded':open,style:{minHeight:44,padding:'8px 16px'}},'목표 바꾸기')}),
    h(GoalSchedule,{learning,past:false,onOpenWs:(ws,tab)=>setOpened(ws+':'+tab)}),
    h(GoalOutcome,{outcome:learning.outcome,past:false}),
    h('output',{'data-testid':'projection-binding'},JSON.stringify({goal:learning.goal.id,plan:learning.saved.byTemplate[r.workspace].latest.version,history:learning.saved.byTemplate[r.workspace].history.map(p=>p.version)})),
    h('output',{'data-testid':'opened-workspace'},opened)))
}
createRoot(document.getElementById('root')).render(h(Harness))
`
const result = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, outdir: 'harness-out', format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.module.css': 'local-css', '.css': 'empty' },
  plugins: [{ name: 'goal-harness', setup(b) {
    b.onResolve({ filter: /^(next\/link|next\/navigation|@\/lib\/analytics\/client)$/ }, a => ({ path: a.path, namespace: 'shim' }))
    b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ contents: shims[a.path], loader: 'jsx', resolveDir: root }))
    b.onResolve({ filter: /^@\// }, a => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: root }))
  } }],
})
const js = result.outputFiles.find(f => f.path.endsWith('.js'))!.text
// Match Tailwind's app preflight for sizing; omitting it adds border/padding to the measured modal and day controls.
const css = result.outputFiles.filter(f => f.path.endsWith('.css')).map(f => f.text).join('\n') + '\n*,::before,::after { box-sizing: border-box; }'
const skin = fs.readFileSync(path.resolve('../../packages/design-tokens/src/skins/csat-app.css'), 'utf8')
const out = path.resolve('output/goal-schedule-harness.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `<!doctype html><html lang="ko" data-skin="csat"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goal schedule component QA</title><style>${skin}\n${css}\nbody{margin:0;background:#faf9f7;font-family:Arial,sans-serif}main{padding:24px;max-width:1100px;margin:auto}input,select,button{font:inherit}button,select,input[type=number],input[type=date]{min-height:44px}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid #18181b;outline-offset:3px}</style></head><body><div data-design-scope="csat" id="root"></div><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
console.log('Built output/goal-schedule-harness.html (components + hash-bound isolated SQL frames; transport doubles)')
