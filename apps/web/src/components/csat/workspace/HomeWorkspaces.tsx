// apps/web/src/components/csat/workspace/HomeWorkspaces.tsx
'use client'

//
// `/csat` 메인 판의 머리 — 「내 Workspace」 줄. 기존 유형 · 함정 표는 바로 아래에 그대로 있다.
// 기록을 아직 못 읽었으면 줄을 비워 둔다(자리를 흔들지 않게 머리만 그린다).

import Link from 'next/link'
import { useMemo } from 'react'

import type { WorkspaceIndex } from '@/lib/csat/workspace-index'
import { liveWorkspaces } from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import type { CsatRecordState } from '../home/useCsatRecord'
import { WorkspaceCards } from './WorkspaceCards'

const HOME_MAX = 3

export function HomeWorkspaces({ rec, index }: { rec: CsatRecordState | null; index: WorkspaceIndex }) {
  const typeName = useMemo(() => new Map(index.units.types.map((t) => [t.id, t.name])), [index.units.types])
  const list = rec ? liveWorkspaces(rec.record.workspaces).sort((a, b) => b.updatedAt - a.updatedAt) : []
  return (
    <section className={home.section} data-testid="home-workspaces" aria-labelledby="home-ws-head">
      <h2 className={home.sectionHead} id="home-ws-head">
        내 Workspace <small>{rec ? list.length : ''}</small>
        {list.length > HOME_MAX ? (
          <Link className={home.quietLink} href="/csat/workspace" style={{ marginLeft: 'auto', minHeight: 0 }}>
            전부 보기
          </Link>
        ) : null}
      </h2>
      {rec ? <WorkspaceCards list={list.slice(0, HOME_MAX)} record={rec.record} now={rec.now} items={index.items} typeName={typeName} from="home" /> : null}
    </section>
  )
}
