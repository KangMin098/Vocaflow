// apps/web/src/components/csat/workspace/WorkspaceCreate.tsx
'use client'

//
// **새 Workspace — 팝업.** 참조 3B 「Skill 설정」 팝업 결(2026-09-29):
//   머리 한 줄(타일 + 이름) · 카드 칸 둘(출발점 · 담을 것) · 바닥 버튼.
// Workspace 는 **분석 묶음**이다 — 목표 · 일정 · 주당 계획 · 약점 입력은 뺐다(사용자 지시: 분석과 무관한 것 삭제).
// 「내 약점으로」 출발점은 남긴다 — 입력이 아니라 **예측 기록에서 센** 분석 범위이고, 기록이 모자라면 꺼진다.

import { useMemo, useState } from 'react'
import { FolderKanban, FolderPlus } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { track } from '@/lib/analytics/client'
import type { DissectionRecord } from '@/lib/csat/dissect'
import { killerTypeIds } from '@/lib/csat/space-model'
import { RECENT_FROM, UNIVERSAL } from '@/lib/csat/trap-atlas'
import type { WorkspaceIndex } from '@/lib/csat/workspace-index'
import {
  EMPTY_SCOPE,
  STARTER_LABEL,
  createWorkspace,
  poolBucket,
  poolOf,
  starterScope,
  weakCandidates,
  type Workspace,
  type WorkspaceScope,
  type WorkspaceStarter,
} from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import { ScopeEditor } from './ScopeEditor'
import styles from './workspace.module.css'

const STARTERS: WorkspaceStarter[] = ['start', 'killer', 'trap', 'evidence', 'recent', 'weakness']

export function WorkspaceCreateDialog({
  index,
  record,
  save,
  onClose,
}: {
  index: WorkspaceIndex
  record: DissectionRecord | null
  save: (ws: Workspace) => Promise<boolean>
  onClose: () => void
}) {
  const weak = useMemo(() => (record ? weakCandidates(index.items, record) : []), [record, index.items])
  const ctx = useMemo(
    () => ({
      typesByRecent: index.units.types.map((t) => t.id),
      killer: killerTypeIds().filter((id) => index.units.types.some((t) => t.id === id)),
      universalTraps: UNIVERSAL.map((t) => t.key).filter((k) => index.units.traps.some((t) => t.key === k)),
      recentFrom: RECENT_FROM,
      exams: index.units.exams.map((e) => ({ id: e.id, year: e.year })),
      weak,
    }),
    [index.units, weak],
  )

  const [starter, setStarter] = useState<WorkspaceStarter | null>(null)
  const [scope, setScope] = useState<WorkspaceScope>(EMPTY_SCOPE)
  const [why, setWhy] = useState('출발점을 고르면 담을 것을 미리 채웁니다. 아래에서 고칠 수 있어요.')
  const [edited, setEdited] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pool = useMemo(() => poolOf(scope, index.items), [scope, index.items])

  function pick(s: WorkspaceStarter) {
    const next = starterScope(s, ctx)
    setStarter(s)
    setScope(next.scope)
    setWhy(next.why)
    setEdited(false)
    if (!name.trim() || STARTERS.some((x) => STARTER_LABEL[x] === name)) setName(STARTER_LABEL[s])
  }

  async function submit() {
    if (!starter || busy || !pool.length) return
    setBusy(true)
    setError(null)
    const ws = createWorkspace({ name: name || STARTER_LABEL[starter], starter, intent: { goal: '' }, scope, now: Date.now(), rand: Math.random() })
    const ok = await save(ws)
    track({
      name: 'csat_workspace_created',
      props: { starter, types: scope.types.length, traps: scope.traps.length, exams: scope.exams.length, items: scope.items.length, pool: poolBucket(pool.length), hasPlan: false, edited },
    })
    if (!ok) {
      setError('이 기기에 저장하지 못했습니다(사생활 보호 모드 등).')
      setBusy(false)
      return
    }
    // 팝업의 「뒤로가기로 닫기」 와 겹치지 않게 전체 이동으로 간다
    window.location.assign(`/csat/workspace/${encodeURIComponent(ws.id)}?from=created`)
  }

  return (
    <Dialog
      onClose={onClose}
      title=""
      ariaLabel="새 Workspace"
      size="md"
      footer={
        <div className={styles.sheetFoot}>
          {error ? (
            <span className={styles.danger} role="alert" style={{ marginRight: 'auto' }}>
              {error}
            </span>
          ) : null}
          <button type="button" className={home.quietLink} onClick={onClose}>
            취소
          </button>
          <button type="button" className={home.primary} disabled={!starter || busy || !pool.length} onClick={() => void submit()} data-testid="ws-create">
            <FolderPlus size={15} aria-hidden="true" />
            {busy ? '만드는 중…' : `만들기 · ${pool.length}문항`}
          </button>
        </div>
      }
    >
      <div className={styles.sheet}>
        <div className={styles.sheetHead}>
          <span className={styles.sheetIcon} aria-hidden="true">
            <FolderKanban size={16} />
          </span>
          <label className="sr-only" htmlFor="ws-name">
            Workspace 이름
          </label>
          <input id="ws-name" className={styles.sheetName} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="새 Workspace" />
        </div>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <b>출발점</b>
              <small>{why}</small>
            </div>
            <label className="sr-only" htmlFor="ws-starter">
              출발점
            </label>
            <select id="ws-starter" className={styles.select} value={starter ?? ''} onChange={(e) => e.target.value && pick(e.target.value as WorkspaceStarter)} data-testid="ws-starter">
              <option value="">고르기</option>
              {STARTERS.map((s) => (
                <option key={s} value={s} disabled={s === 'weakness' && weak.length === 0}>
                  {STARTER_LABEL[s]}
                  {s === 'weakness' && weak.length === 0 ? ' (예측 기록 부족)' : ''}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <b>담을 것</b>
              <small>칸 안은 「또는」, 칸 사이는 「그리고」로 묶습니다.</small>
            </div>
          </div>
          <ScopeEditor
            scope={scope}
            index={index.items}
            units={index.units}
            onChange={(next) => {
              setScope(next)
              setEdited(true)
            }}
          />
        </section>
      </div>
    </Dialog>
  )
}
