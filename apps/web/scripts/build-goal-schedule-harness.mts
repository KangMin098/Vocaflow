// apps/web/scripts/build-goal-schedule-harness.mts
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
import { GoalPopover, useGoal } from '@/components/csat/diagnosis/map/GoalBar'
import styles from '@/components/csat/diagnosis/map/map.module.css'
const budget = {weeklyMinutes:120,dailyMinutes:[20,20,20,20,20,20,0],minutesPerUnit:10,priorities:[]}
const goal = {id:1,score:80,grade:null,exam:'suneung',date:'2026-11-01',createdAt:'2026-10-23T00:00:00Z',budget}
const r = {task:'r.central_meaning',needRank:1,need:'CONFIRM',evidence:'unmeasured',basis:'none',independentItems:null,relevance:{items:2,pointsPerExam:4},stage:'check',workspace:'ws.central-meaning',quantity:{unit:'문항',planned:4,remaining:4,done:0,source:'saved'},criterion:'근거를 들어 설명한다',achievement:'not_checked',action:{rank:1,href:'/csat/learn/authored-central-meaning?phase=check',label:'혼자 확인하기'},planGate:null,replanWhy:null,blocked:null,unresolved:[]}
function Harness() {
  const [scenario,setScenario] = useState('A')
  const [opened,setOpened] = useState('')
  const input = {model:{goal:80,goalSet:true,currentScore:null,reference:{exams:[],wanted:3,shortfall:3}},v4:{target:{goal}},settings:{goal_presets:[80,90]}}
  const g = useGoal(input)
  const rows = scenario === 'C' ? [{...r,action:null,planGate:'replan',replanWhy:'goal'}] : [scenario === 'repair' ? {...r,stage:'repair',evidence:'verified_need'} : r]
  return h('div',{className:styles.root},h('main',{},
    h('h1',{},'목표 계획 — 격리 컴포넌트 검증'),
    h('nav',{'aria-label':'합성 상태'},...['A','B','C','repair'].map(s=>h('button',{key:s,onClick:()=>setScenario(s),style:{minHeight:44,padding:'8px 16px'}},s))),
    h(GoalPopover,{data:input,g,trigger:({toggle,open,id})=>h('button',{onClick:toggle,'aria-controls':id,'aria-expanded':open,style:{minHeight:44,padding:'8px 16px'}},'목표 바꾸기')}),
    h(GoalSchedule,{data:{rows,examSessions:scenario==='B'?0:1,directTasks:scenario==='repair'?1:0,required:1,relevanceUnknown:0,actionable:1},saved:{status:'installed',goal,goalVersionId:1,byTemplate:{},goalHistory:[goal]},now:'2026-10-23T01:00:00Z',past:false,onOpenWs:(ws,tab)=>setOpened(ws+':'+tab)}),
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
console.log('Built output/goal-schedule-harness.html (component-only, synthetic data)')
