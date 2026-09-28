// apps/web/src/components/csat/workspace/WorkspaceTable.tsx
'use client'

//
// **메인 판의 Workspace 탭** — 참조 3B 「Workflows」 표 결(2026-09-29).
// 한 줄 = Workspace 하나: 타일 · 이름 · 상태 한 줄(진행 중 · 문항 수 · 마지막 학습) | 출발점 | 담은 것 | 진행 | 만든 날.
// 줄 전체가 Workspace 안으로 가는 링크다. 만들기는 도구 줄의 버튼 → 팝업.

import { useMemo, useState } from 'react'
import { FolderKanban, Plus, Search } from 'lucide-react'

import type { DissectionRecord } from '@/lib/csat/dissect'
import type { WorkspaceIndex } from '@/lib/csat/workspace-index'
import { STARTER_LABEL, liveWorkspaces, poolOf, progressOf, type Workspace } from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import { WorkspaceCreateDialog } from './WorkspaceCreate'
import styles from './workspace.module.css'

const TILE: Record<Workspace['starter'], string> = {
  start: 'tone-lavender',
  killer: 'tone-pink',
  trap: 'tone-peach',
  evidence: 'tone-teal',
  recent: 'tone-yellow',
  weakness: 'tone-green',
}
const DAY = 86_400_000

function lastTouch(ws: Workspace, ids: Set<string>, record: DissectionRecord): number | null {
  let t = 0
  for (const c of record.completed) if (ids.has(c.id)) t = Math.max(t, c.at)
  for (const v of record.views ?? []) if (ids.has(v.id)) t = Math.max(t, v.at)
  for (const p of record.predictions) if (ids.has(p.item)) t = Math.max(t, p.at)
  return t || null
}

function ago(t: number | null, now: number): string {
  if (!t) return '아직 학습 전'
  const d = Math.floor((now - t) / DAY)
  return d <= 0 ? '오늘 학습' : `${d}일 전 학습`
}

export function WorkspaceTable({
  record,
  now,
  index,
  save,
  startOpen = false,
}: {
  record: DissectionRecord | null
  now: number | null
  index: WorkspaceIndex
  save: (ws: Workspace) => Promise<boolean>
  startOpen?: boolean
}) {
  const [creating, setCreating] = useState(startOpen)
  const [q, setQ] = useState('')
  const list = useMemo(() => (record ? liveWorkspaces(record.workspaces, true).filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || b.updatedAt - a.updatedAt) : []), [record, q])

  return (
    <div data-testid="ws-table">
      <div className={styles.wsTools}>
        <label className={home.search} style={{ flex: 1 }}>
          <Search size={14} aria-hidden="true" />
          <span className="sr-only">Workspace 이름으로 찾기</span>
          <input id="ws-search" type="search" value={q} placeholder="Workspace 찾기" onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="button" className={styles.roundAdd} onClick={() => setCreating(true)} aria-label="새 Workspace" data-testid="ws-new">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.wsHead} aria-hidden="true">
        <span>Workspace</span>
        <span>출발점</span>
        <span>담은 것</span>
        <span>연 문항</span>
        <span>만든 날</span>
      </div>
      {!record || now == null ? (
        <p className={styles.wsEmpty} aria-busy="true">
          기록을 읽는 중…
        </p>
      ) : list.length === 0 ? (
        <p className={styles.wsEmpty}>아직 Workspace 가 없습니다. 오른쪽 위 + 로 분석할 유형 · 함정 · 회차를 골라 첫 묶음을 만드세요.</p>
      ) : (
        list.map((ws) => {
          const pool = poolOf(ws.scope, index.items)
          const ids = new Set(pool.map((p) => p.id))
          const prog = progressOf(ws, pool, record, now)
          const last = lastTouch(ws, ids, record)
          const live = !ws.archived && last != null && now - last < 7 * DAY
          return (
            <div key={ws.id} className={styles.wsRow} data-testid="ws-card">
              <div className={styles.wsName}>
                <span className={`${styles.wsTile} ${TILE[ws.starter]}`} aria-hidden="true">
                  <FolderKanban size={15} />
                </span>
                <div className={styles.wsTitle}>
                  <a href={`/csat/workspace/${encodeURIComponent(ws.id)}?from=home`}>{ws.name}</a>
                  <span className={styles.wsStatus}>
                    <span className={styles.wsDot} data-state={live ? 'live' : 'idle'} aria-hidden="true" />
                    {ws.archived ? '보관됨' : live ? '학습 중' : '쉬는 중'} · {pool.length}문항 · {ago(last, now)}
                  </span>
                </div>
              </div>
              <span>
                <span className={styles.wsTag}>{STARTER_LABEL[ws.starter]}</span>
              </span>
              <span className={styles.wsNum}>
                유형 {ws.scope.types.length} · 함정 {ws.scope.traps.length} · 회차 {ws.scope.exams.length}
              </span>
              <span className={styles.wsNum}>
                {prog.touched}/{prog.pool}
              </span>
              <span className={styles.wsNum}>{new Date(ws.createdAt).toLocaleDateString('ko-KR')}</span>
            </div>
          )
        })
      )}
      {creating ? <WorkspaceCreateDialog index={index} record={record} save={save} onClose={() => setCreating(false)} /> : null}
    </div>
  )
}
