// apps/web/src/components/csat/home/CsatShell.tsx
'use client'

//
// **기출분석공간 셸 — 목록 화면이 아닌 화면(문항 해설 · 연습 · 공식 · 해부)도 같은 작업공간에 둔다.** (2026-10-10 1440 통합)
//
// 홈 · 서가 · 기록 · 진단은 각자 `CsatRail` + 상단 바 + 캔버스를 그려 왔다. 문항 해설 · 연습 · 공식 · 해부는 일반 앱 셸
// (상단 Today/Read/… 내비)에 있어서, 같은 기출 학습인데 다른 서비스로 넘어간 것처럼 보였고 레일의 길(이어서 · 서가 ·
// 연습)이 사라졌다. 이 셸이 그 네 화면을 같은 레일 · 상단 바 안에 둔다. URL 은 그대로다.
//
// `(app)` 그룹에는 일반 셸의 「본문으로 건너뛰기」가 없다 — 여기서 같은 링크를 준다(레일 항목이 30개를 넘는다).
// `bare` 는 캔버스 테두리 없이 본문을 그대로 놓는다(해설 극장처럼 스스로 판면을 가진 화면).

import type { ReactNode } from 'react'

import { activeSet, dueNow } from '@/lib/csat/continuity'
import type { RailExam } from '@/lib/csat/rail-data'

import { CsatRail, type RailPlace } from './CsatRail'
import { useCsatRecord } from './useCsatRecord'
import styles from '../space/space.module.css'

export function CsatShell({
  place,
  pill,
  exams,
  bare = false,
  testId,
  children,
}: {
  place: RailPlace
  /** 상단 바 가운데 알약 — 지금 어디인가(아이콘 + 한 줄) */
  pill: ReactNode
  exams: RailExam[]
  bare?: boolean
  testId?: string
  children: ReactNode
}) {
  // 읽기 전용 — 셸 아래 화면이 기록을 쓴다. 셸이 압축본을 늦게 저장하면 그 쓰기를 덮는다
  const rec = useCsatRecord({ readOnly: true })
  return (
    <div className={styles.root} data-testid={testId}>
      <a
        href="#csat-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:flex focus:min-h-11 focus:items-center focus:rounded-[var(--r-md)] focus:bg-[var(--p)] focus:px-4 focus:text-[13px] focus:font-bold focus:text-[var(--on-p)]"
      >
        본문으로 건너뛰기
      </a>
      <CsatRail place={place} exams={exams} dueCount={rec ? dueNow(rec.record, rec.now).length + (activeSet(rec.record) ? 1 : 0) : null} />
      <div className="min-w-0">
        <header className={styles.topbar}>
          <span className={styles.topPill}>{pill}</span>
        </header>
        <main id="csat-main" tabIndex={-1} className={bare ? styles.shellBare : styles.canvas}>
          {children}
        </main>
      </div>
    </div>
  )
}
