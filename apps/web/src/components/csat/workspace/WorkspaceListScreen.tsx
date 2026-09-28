// apps/web/src/components/csat/workspace/WorkspaceListScreen.tsx
'use client'

//
// `/csat/workspace` — 내 Workspace 전부(보관한 것은 아래에 따로).

import { useMemo } from 'react'

import type { RailExam } from '@/lib/csat/rail-data'
import type { WorkspaceIndex } from '@/lib/csat/workspace-index'
import { liveWorkspaces } from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import { WorkspaceCards } from './WorkspaceCards'
import { WorkspaceFrame } from './WorkspaceFrame'
import { useWorkspaces } from './useWorkspaces'

export function WorkspaceListScreen({ index, exams }: { index: WorkspaceIndex; exams: RailExam[] }) {
  const { record, rec, now, synced } = useWorkspaces()
  const typeName = useMemo(() => new Map(index.units.types.map((t) => [t.id, t.name])), [index.units.types])
  const all = liveWorkspaces(record?.workspaces, true)
  const active = all.filter((w) => !w.archived)
  const archived = all.filter((w) => w.archived)

  return (
    <WorkspaceFrame exams={exams} rec={rec} title="내 Workspace" synced={synced}>
      <section className={home.section}>
        <h2 className={home.sectionHead}>
          내 Workspace <small>{active.length}</small>
        </h2>
        {record && now != null ? (
          <WorkspaceCards list={active} record={record} now={now} items={index.items} typeName={typeName} from="rail" />
        ) : (
          <p className={home.empty} aria-busy="true">
            기록을 읽는 중…
          </p>
        )}
      </section>
      {record && now != null && archived.length ? (
        <section className={home.section}>
          <h2 className={home.sectionHead}>
            보관함 <small>{archived.length}</small>
          </h2>
          <WorkspaceCards list={archived} record={record} now={now} items={index.items} typeName={typeName} from="rail" showNew={false} />
        </section>
      ) : null}
    </WorkspaceFrame>
  )
}
