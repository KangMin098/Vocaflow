// apps/web/src/components/csat/diagnosis/DiagnosisShell.tsx
//
// 내 진단 화면 공통 틀 — 기출분석공간과 같은 레일(「내 진단」 선택) · 상단 줄 · 판. 진입 이벤트(D2)도 여기서.

'use client'

import { Stethoscope } from 'lucide-react'
import { useEffect } from 'react'

import { CsatRail } from '@/components/csat/home/CsatRail'
import { useCsatRecord } from '@/components/csat/home/useCsatRecord'
import styles from '@/components/csat/space/space.module.css'
import { track } from '@/lib/analytics/client'
import { activeSet, dueNow } from '@/lib/csat/continuity'
import type { RailExam } from '@/lib/csat/rail-data'

export type DiagnosisScreen = 'report' | 'attempt'

export function DiagnosisShell({ exams, screen, children }: { exams: RailExam[]; screen: DiagnosisScreen; children: React.ReactNode }) {
  const rec = useCsatRecord()
  useEffect(() => {
    track({ name: 'csat_dx_viewed', props: { screen } })
  }, [screen])

  return (
    <div className={styles.root} data-testid={`csat-dx-${screen}`}>
      <CsatRail place="diagnosis" exams={exams} dueCount={rec ? dueNow(rec.record, rec.now).length + (activeSet(rec.record) ? 1 : 0) : null} />
      <div className="min-w-0">
        <header className={styles.topbar}>
          <span className={styles.topPill}>
            <Stethoscope size={13} aria-hidden="true" />내 진단
          </span>
        </header>
        <div className={styles.canvas}>{children}</div>
      </div>
    </div>
  )
}
