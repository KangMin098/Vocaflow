import { useState } from 'react'
import {parseMapReturn,mapReturnQuery}from'@/lib/csat/map-return'
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

function Host(){const[s,setS]=useState({key:0,restore:{} as any});const href=mapReturnQuery({task:'r.central_meaning',ws:'ws.central-meaning'});return <><button id="old" onClick={()=>setS({key:s.key+1,restore:parseMapReturn(Object.fromEntries(new URLSearchParams(href.slice(1))))})}>existing home continuation</button><button id="correct" onClick={()=>setS({key:s.key+1,restore:parseMapReturn({map_task:'r.central_meaning',ws:'ws.central-meaning'})})}>mapTask control</button><UnifiedLearningMap key={s.key} data={readable as never} mode="full" recordHref="/csat/diagnosis" restore={s.restore}/></>};createRoot(document.getElementById('root')!).render(<Host/>);