// Synthetic raw attempts from owner fixture; actual compose and scorer used.
export function dataOf(unseen=false){
const DEFAULT_MAP_SETTINGS = { default_goal: 100, reference_exams: 6, status: { near: 0.9 }, min_coverage: 0.5, goal_presets: [100, 90, 80, 70, 60], core: { weak: 0.6, watch: 0.8 } }
const NOW = '2026-10-21T00:00:00Z', task = 'r.central_meaning', key = 'authored-central-meaning'
const q = new URLSearchParams(unseen ? 'unseen=1' : '')
const UNSEEN = q.get('unseen') === '1'
const link = (ref: string) => ({ target: ref, href: '/csat/learn/' + ref.slice(9) + '?d=fixture', label: ref, taskKey: key })
const fa = (i: number, ok: boolean, day: string) => ({ attemptId: String(i), sessionId: 's' + i, userId: 'fixture', itemRef: `authored:cm-ind-${i}`, taskKey: key, phase: 'practice', activity: 'theater', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: `2026-10-${day}T00:00:00Z`, contentHash: 'h', expectedContentHash: 'h' })
// 독립 오답 2 → 결속 안내 연습 정답 → 전이 2 → 새 독립 확인 2 정답(해소)
const refs = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const firsts = [fa(1, false, '01'), fa(2, false, '02'), fa(3, true, '06'), fa(4, true, '07')]
const guide = { attemptId: '9', itemRef: 'authored:cm-guide', taskKey: key, phase: 'practice', activity: 'practice', isCorrect: true, answeredAt: '2026-10-03T00:00:00Z', receivedAt: '2026-10-03T00:00:01Z', repairRole: 'guided_practice' }
const tr = (i: number) => ({ attemptId: String(20 + i), itemRef: `authored:cm-tr-${i}`, taskKey: key, phase: 'transfer', activity: 'theater', isCorrect: true, answeredAt: `2026-10-0${3 + i}T00:00:00Z`, receivedAt: `2026-10-0${3 + i}T00:00:01Z`, passageKey: `p-tr-${i}` })
const confirm = [1, 2, 3, 4, ...(UNSEEN ? [5, 6] : [])].map((i) => link(`authored:cm-ind-${i}`))
const data = { now: NOW, records: [], settings: DEFAULT_MAP_SETTINGS, practiceLinks: { [task]: { href: '/', label: 'fixture', itemId: 'cm-ind-1', target: confirm[0].target, taskKey: key, confirm } }, findAttempts: firsts, lifecycleActivity: [...firsts, guide, tr(1), tr(2)], instrumentHashes: {}, model: { goal: 80, goalSet: true, lineRefItems: { B6: refs.slice(17, 24), A5: refs.slice(28, 34) }, nodes: {} }, v4: { sessions: [], proxyCovers: [], refItems: refs, transferItems: { [key]: 2 }, transferTargets: { [key]: [link('authored:cm-tr-1'), link('authored:cm-tr-2')] }, repairTargets: { [key]: [{ ...link(guide.itemRef), role: 'guided_practice' }] }, saved: { status: 'installed', goalVersionId: 10, goalHistory: [], byTemplate: {} as Record<string, unknown> } } }

return structuredClone(data) as any
}
