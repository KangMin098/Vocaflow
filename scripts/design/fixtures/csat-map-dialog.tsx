// scripts/design/fixtures/csat-map-dialog.tsx — real UI, synthetic view, no DB.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { build } from '../../../apps/web/src/components/csat/diagnosis/map/__tests__/r5-inspector-fixture'
import { MapScreen } from '../../../apps/web/src/components/csat/diagnosis/map/MapScreen'
import { CsatRail, type RailPlace } from '../../../apps/web/src/components/csat/home/CsatRail'
import s from '../../../apps/web/src/components/csat/space/space.module.css'
import m from '../../../apps/web/src/components/csat/diagnosis/map/map.module.css'
import { ItemFinderDialog } from '../../../apps/web/src/components/csat/browse/ItemFinderDialog'
import { EMPTY_SELECTION } from '../../../apps/web/src/lib/csat/item-finder'
import { RecordModal } from '../../../apps/web/src/components/csat/diagnosis/RecordModal'
import { RecordDetailModal } from '../../../apps/web/src/components/csat/diagnosis/RecordDetailModal'
import { GoalPopover, useGoal } from '../../../apps/web/src/components/csat/diagnosis/map/GoalBar'
import { StepSheet } from '../../../apps/web/src/components/csat/diagnosis/map/StepSheet'
import { learnerPath } from '../../../apps/web/src/lib/csat/map/learner-path'
import { HomeLanding } from '../../../apps/web/src/components/csat/home/HomeLanding'

const railPage = new URLSearchParams(location.search).get('rail') as RailPlace | null

const fixture = build({ goalSet: true, attempts: [], activity: [], asOfDay: 30, saved: false, fq: { status: 'installed', eligible: [] } })
;(globalThis as unknown as { fixtureView: typeof fixture.view }).fixtureView = fixture.view
fixture.data.model = { goal: 80, goalSet: true, currentScore: null, nodes: {}, lineRefItems: {}, reference: { exams: [] } } as never
fixture.data.settings = { core: { weak: 0.6, watch: 0.8 }, min_coverage: 0.5, goal_presets: [70, 80, 90] } as never
fixture.data.tasks = []
fixture.data.nodes = []
function Popups() {
  const [popup, setPopup] = useState<string | null>(null)
  const g = useGoal(fixture.data)
  const close = () => setPopup(null)
  const exam = { id: 'synthetic-exam', label: '합성 검증 회차', organizer: 'edu_office' as const, kind: 'mock', grade: 1, year: 2026, month: 3 }
  const record = { sessionId: 'synthetic-session', examId: exam.id, label: exam.label, takenAt: '2026-10-22', raw: 0, grade: 9, mode: 'live' as const, wrong: 45, listening: 0, reading: 0, answers: Array.from({ length: 45 }, (_, i) => ({ no: i + 1, chosen: null, correct: false })), quality: 'complete' as const, qualityReasons: [] }
  return <div className={m.root}>
    <nav aria-label="합성 UI 검증">{['finder', 'record', 'record-detail', 'step'].map(kind => <button key={kind} type="button" data-testid={`fixture-${kind}`} onClick={() => setPopup(kind)}>{kind}</button>)}<GoalPopover data={fixture.data} g={g} trigger={({ toggle, open, id }) => <button type="button" data-testid="fixture-goal" aria-controls={id} aria-expanded={open} onClick={toggle}>goal</button>} /></nav>
    {popup === 'finder' && <ItemFinderDialog origin="home" initial={EMPTY_SELECTION} hrefFor={() => '/csat'} onClose={close} />}
    {popup === 'record' && <RecordModal exams={[exam]} today="2026-10-22" closeHref="/csat" diagnosisBase="/csat/diagnosis" />}
    {popup === 'record-detail' && <RecordDetailModal record={record as never} wrongs={[]} typeNames={{}} closeHref="/csat" diagnosisHref="/csat/diagnosis" deleteEndpoint="/fixture-no-delete" />}
    {popup === 'step' && <StepSheet data={fixture.data} step={learnerPath(fixture.data.model, fixture.data.settings).read[0]} tasks={{ done: new Set(), toggle() {}, err: null } as never} onClose={close} />}
  </div>
}
createRoot(document.getElementById('root')!).render(<div data-design-scope="csat" className={location.search.includes('home') && !railPage ? undefined : s.root}>
  {railPage ? <><CsatRail place={railPage} exams={[]} dueCount={0} /><main style={{ padding: 32 }}>공통 메뉴 검증 · {railPage}</main></> : <>
  {location.search.includes('home') ? <HomeLanding exams={[]} map="ok" mapData={fixture.data} focusKind="record" returned={null} restore={location.search.includes('resume') ? { mapTask: 'r.central_meaning', ws: 'ws.central-meaning' } : null} /> : <>
  <CsatRail place="home" exams={[]} dueCount={0} />
  <div style={{ minWidth: 0 }}><header className={s.topbar}><span className={s.topPill}>내 학습 지도</span></header><main className={s.canvas}><Popups /><MapScreen data={fixture.data} view={location.search.includes('full') ? 'full' : 'core'} base="/csat" /></main></div>
  </>}
  </>}
</div>)
