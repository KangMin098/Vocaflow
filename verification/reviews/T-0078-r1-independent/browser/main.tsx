import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { UnifiedLearningMap } from '@/components/csat/diagnosis/map/UnifiedLearningMap'
import { PlanSection } from '@/components/csat/diagnosis/map/PlanSection'
import { AuthoredSupplyCard } from '@/components/csat/diagnosis/map/AuthoredSupplyCard'
const DEFAULT_MAP_SETTINGS = { default_goal: 100, reference_exams: 6, status: { near: 0.9 }, min_coverage: 0.5, goal_presets: [100, 90, 80, 70, 60], core: { weak: 0.6, watch: 0.8 } }

// Codex T-0078 probe 의 실제 compose 데이터(읽힘) · 같은 데이터의 원장 미확인판
const NOW = '2026-10-21T00:00:00Z', key = 'authored-central-meaning', task = 'r.central_meaning'
const first = (i: number) => ({ attemptId: String(i), sessionId: 's' + i, userId: 'fixture', itemRef: 'authored:probe-ind-' + i, taskKey: key, phase: 'practice', activity: 'theater', isCorrect: false, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: `2026-10-0${i}T00:00:00Z`, contentHash: 'h', expectedContentHash: 'h' })
const f = [first(1), first(2)], guide = { attemptId: '3', itemRef: 'authored:probe-guide', taskKey: key, phase: 'practice', activity: 'practice', isCorrect: true, answeredAt: '2026-10-03T00:00:00Z', receivedAt: '2026-10-03T00:00:01Z', repairRole: 'guided_practice' }
const link = (ref: string) => ({ target: ref, href: '/csat/learn/' + ref.slice(9) + '?d=fixture', label: ref, taskKey: key })
const readable = { now: NOW, records: [], settings: DEFAULT_MAP_SETTINGS, practiceLinks: { [task]: { href: '/', label: 'fixture', itemId: 'probe-ind-1', target: f[0].itemRef, taskKey: key, confirm: f.map((x) => link(x.itemRef)) } }, findAttempts: f, lifecycleActivity: [...f, guide], instrumentHashes: {}, model: { goal: 80, goalSet: true, lineRefItems: {}, nodes: {} }, v4: { sessions: [], proxyCovers: [], refItems: [], transferItems: { [key]: 2 }, transferTargets: { [key]: [link('authored:tr-1'), link('authored:tr-2')] }, repairTargets: { [key]: [{ ...link(guide.itemRef), role: 'guided_practice' }] }, saved: { status: 'installed', goalVersionId: 10, goalHistory: [], byTemplate: {} } } }
const unreadable = { ...readable, lifecycleActivity: undefined }

function MapHost() {
  const [data, setData] = useState<unknown>(unreadable)
  ;(window as unknown as { __refresh: () => void }).__refresh = () => { (window as unknown as { __refreshes: number }).__refreshes = ((window as unknown as { __refreshes?: number }).__refreshes ?? 0) + 1; setData(readable) }
  return <UnifiedLearningMap data={data as never} mode="full" recordHref="/csat/diagnosis" restore={{ mapTask: task, ws: 'ws.central-meaning' } as never} />
}
const planView = { workspace: 'ws.central-meaning', core: [task], tasks: [{ task, name: '중심 의미', goal: 'g', criterion: 'c', basis: 'direct_check', evidence: 'verified_need', need: 'REPAIR', stage: 'repair', quantity: { unit: '문항', available: 2, planned: 2, done: 0, remaining: 2, rule: 'blocked_items' }, achievement: 'need_confirmed', unresolved: [], next: null }], progress: { planned: 2, done: 0 } }
createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 16, display: 'grid', gap: 24 }}>
    <div data-case="map"><MapHost /></div>
    <div data-case="plan" style={{ maxWidth: 760 }}><PlanSection view={planView as never} saved={{ status: 'installed', error: false, goalVersionId: 10, goalHistory: [], byTemplate: {} } as never} viewer="fixture-plan" goal={80} past={false} reason={null} /></div>
    <div data-case="supply" style={{ maxWidth: 760 }}><AuthoredSupplyCard task={task} template="ws.central-meaning" planSaved past={false} /></div>
  </div>,
)
