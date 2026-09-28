// apps/web/src/components/csat/workspace/WorkspaceFrame.tsx
'use client'

//
// Workspace 화면들의 틀 — 「내 기록」(`RecordScreen`)과 같은 골격: 레일 · 상단 줄 · 판.
// 판 위의 띠는 두지 않는다(이 화면의 주 행동은 판 안에 있다).

import type { ReactNode } from 'react'
import { CloudOff, FolderKanban } from 'lucide-react'

import { activeSet, dueNow } from '@/lib/csat/continuity'
import { railWorkspaces } from '@/lib/csat/workspace'
import type { RailExam } from '@/lib/csat/rail-data'

import { CsatRail } from '../home/CsatRail'
import type { CsatRecordState } from '../home/useCsatRecord'
import styles from '../space/space.module.css'

export function WorkspaceFrame({
  exams,
  rec,
  title,
  synced,
  current,
  children,
}: {
  exams: RailExam[]
  rec: CsatRecordState | null
  title: string
  synced: boolean
  /** 지금 연 Workspace id — 레일의 그 줄에 aria-current */
  current?: string
  children: ReactNode
}) {
  return (
    <div className={styles.root} data-testid="csat-workspace">
      <CsatRail place="workspace" current={current} exams={exams} dueCount={rec ? dueNow(rec.record, rec.now).length + (activeSet(rec.record) ? 1 : 0) : null} workspaces={railWorkspaces(rec?.record)} />
      <div className="min-w-0">
        <header className={styles.topbar}>
          <span className={styles.topPill}>
            <FolderKanban size={13} aria-hidden="true" />
            {title}
          </span>
          {rec && !synced ? (
            <span className={styles.topLink} role="status">
              <CloudOff size={14} aria-hidden="true" />이 기기에만 저장 중
            </span>
          ) : null}
        </header>
        <div className={styles.canvas}>
          <div className={styles.panel} style={{ marginTop: 0 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
