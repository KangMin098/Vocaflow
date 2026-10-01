// apps/web/src/components/csat/diagnosis/DiagnosisShell.tsx
//
// 학습자 진단 화면(/csat/diagnosis/*) 공통 틀 — 기출 홈과 같은 레일(「내 진단」 선택) · 상단 줄 · 흰 판.
// 진입 이벤트(D2)도 여기서 한 번 보낸다.

'use client'

import { Stethoscope } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

import { CsatRail } from '@/components/csat/home/CsatRail'
import { useCsatRecord } from '@/components/csat/home/useCsatRecord'
import styles from '@/components/csat/space/space.module.css'
import { track } from '@/lib/analytics/client'
import { activeSet, dueNow } from '@/lib/csat/continuity'
import type { RailExam } from '@/lib/csat/rail-data'

export type DiagnosisScreen = 'start' | 'attempt' | 'test' | 'report' | 'history'

const TABS: { screen: DiagnosisScreen; href: string; label: string }[] = [
  { screen: 'report', href: '/csat/diagnosis', label: '내 진단 리포트' },
  { screen: 'attempt', href: '/csat/diagnosis/attempts/new', label: '시험 기록 입력' },
  { screen: 'history', href: '/csat/diagnosis/history', label: '진단 이력' },
  { screen: 'start', href: '/csat/diagnosis/start', label: '프로필·목표' },
]

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
          <nav aria-label="진단 화면" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link key={t.screen} className={styles.topLink} href={t.href} aria-current={t.screen === screen ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className={styles.canvas}>
          <div className={`${styles.panel} flex flex-col gap-4 p-4`}>{children}</div>
        </div>
      </div>
    </div>
  )
}
