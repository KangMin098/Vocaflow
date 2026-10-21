import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PlanSection } from '@/components/csat/diagnosis/map/PlanSection'
import { CANON_VERSION } from '@/lib/csat/map/v4/definition'

const task = 'r.central_meaning', ws = 'ws.central-meaning'
const row = { task, name: 'core', goal: 'g', criterion: 'c', basis: 'none', evidence: 'unmeasured', need: 'CONFIRM', stage: 'check', quantity: { unit: '문항', available: 3, planned: 3, done: 0, remaining: 3, rule: 'check' }, achievement: 'not_checked', unresolved: [], next: { href: '/csat/item/E-Q1?check=1', label: 'check' } }
const view = { workspace: ws, core: [task], tasks: [row], progress: { planned: 3, done: 0 } }
const goalHistory = [10, 11, 12].map((id) => ({ id, score: 70 + id, exam: 'kice6', grade: null, date: null, createdAt: '2026-10-20T00:00:00Z' }))
const ver = (version: number, goalVersionId: number, planned = 1) => ({ version, canon: CANON_VERSION, goalVersionId, reason: version === 2 ? 'initial' : 'goal_change', createdAt: '2026-10-20T00:00:00Z', asOf: '2026-10-20T00:00:00Z', note: null, restoredFrom: null, plan: { order: [task], tasks: [{ task, stage: 'check', planned, available: 3, rule: 'check' }] } })
const savedOf = (current: number, latest: ReturnType<typeof ver>) => ({ status: 'installed', goalVersionId: current, goal: goalHistory.find((g) => g.id === current), goalHistory, byTemplate: { [ws]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: ws, latest, history: [latest] } } })
const q = new URLSearchParams(location.search)
const start = Number(q.get('goal') ?? 11)

function App() {
  const [saved, setSaved] = useState(savedOf(start, ver(2, 10)))
  const w = window as unknown as { __refresh?: () => void; __afterRefreshGoal?: number }
  // 서버 재조회 흉내 — 새 버전 3 은 제출 때 본 목표에 결속되고, 그 사이 목표가 또 바뀌었으면 지금 목표는 다른 값
  w.__refresh = () => setSaved((s) => savedOf(w.__afterRefreshGoal ?? s.goalVersionId, ver(3, s.goalVersionId, 3)))
  return <PlanSection view={view as never} saved={saved as never} viewer="synthetic" goal={80} past={q.get('past') === '1'} reason={null} />
}
createRoot(document.getElementById('root')!).render(<App />)
