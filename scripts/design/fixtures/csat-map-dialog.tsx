// scripts/design/fixtures/csat-map-dialog.tsx — real UI, synthetic view, no DB.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { build } from '../../../apps/web/src/components/csat/diagnosis/map/__tests__/r5-inspector-fixture'
import { MapScreen } from '../../../apps/web/src/components/csat/diagnosis/map/MapScreen'
import { CsatRail } from '../../../apps/web/src/components/csat/home/CsatRail'
import s from '../../../apps/web/src/components/csat/space/space.module.css'

const fixture = build({ goalSet: true, attempts: [], activity: [], asOfDay: 30, saved: false, fq: { status: 'installed', eligible: [] } })
;(globalThis as unknown as { fixtureView: typeof fixture.view }).fixtureView = fixture.view
fixture.data.model = { goal: 80, goalSet: true, currentScore: null, nodes: {}, lineRefItems: {}, reference: { exams: [] } } as never
fixture.data.settings = { core: { weak: 0.6, watch: 0.8 }, min_coverage: 0.5 } as never
fixture.data.tasks = []
fixture.data.nodes = []
createRoot(document.getElementById('root')!).render(<div data-design-scope="csat" className={s.root}>
  <CsatRail place="home" exams={[]} dueCount={0} />
  <div style={{ minWidth: 0 }}><header className={s.topbar}><span className={s.topPill}>내 학습 지도</span></header><main className={s.canvas}><MapScreen data={fixture.data} view={location.search.includes('full') ? 'full' : 'core'} base="/csat" /></main></div>
</div>)
