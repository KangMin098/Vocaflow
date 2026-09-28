// apps/web/src/components/csat/workspace/WorkspaceCreate.tsx
'use client'

//
// **새 Workspace — 팝업** (설계 §2 · §4 · 2026-09-29 참조 3B 「Recents」 결로 줄임).
// 한 팝업 안에서: 출발점(칩 한 줄) → 목표 · 주당 · 기한(한 줄) → 약점(접힘) → 담을 것(접힘) + 실제 포함 문항 → 이름 · 만들기.
// 출발점은 구성을 **미리 채울 뿐**이다. 「내 약점으로」 는 예측 기록이 약점을 말할 만큼 쌓였을 때만 켜진다.

import { useMemo, useState } from 'react'
import { FolderPlus } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { track } from '@/lib/analytics/client'
import type { DissectionRecord } from '@/lib/csat/dissect'
import { killerTypeIds } from '@/lib/csat/space-model'
import { RECENT_FROM, UNIVERSAL } from '@/lib/csat/trap-atlas'
import type { WorkspaceIndex } from '@/lib/csat/workspace-index'
import {
  EMPTY_SCOPE,
  STARTER_LABEL,
  STEP_TARGET,
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
  const typeName = useMemo(() => new Map(index.units.types.map((t) => [t.id, t.name])), [index.units.types])

  const [starter, setStarter] = useState<WorkspaceStarter | null>(null)
  const [scope, setScope] = useState<WorkspaceScope>(EMPTY_SCOPE)
  const [why, setWhy] = useState('출발점을 고르면 담을 것을 미리 채웁니다.')
  const [edited, setEdited] = useState(false)
  const [goal, setGoal] = useState('')
  const [perWeek, setPerWeek] = useState('3')
  const [until, setUntil] = useState('')
  const [weakPicked, setWeakPicked] = useState<string[]>([])
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
    if (s === 'weakness') setWeakPicked(weak.map((w) => w.key))
    if (!name.trim() || STARTERS.some((x) => STARTER_LABEL[x] === name)) setName(STARTER_LABEL[s])
  }

  async function submit() {
    if (!starter || busy || !pool.length) return
    setBusy(true)
    setError(null)
    const ws = createWorkspace({
      name: name || STARTER_LABEL[starter],
      starter,
      intent: {
        goal,
        plan: { perWeek: Math.max(1, Math.min(14, Number(perWeek) || 3)), ...(until ? { until } : {}) },
        direction: starter,
        weak: weakPicked,
      },
      scope,
      now: Date.now(),
      rand: Math.random(),
    })
    const ok = await save(ws)
    track({
      name: 'csat_workspace_created',
      props: { starter, types: scope.types.length, traps: scope.traps.length, exams: scope.exams.length, items: scope.items.length, pool: poolBucket(pool.length), hasPlan: !!until, edited },
    })
    if (!ok) {
      setError('이 기기에 저장하지 못했습니다(사생활 보호 모드 등). 로그인 상태라면 서버 사본으로는 저장됩니다.')
      setBusy(false)
      return
    }
    // 팝업의 「뒤로가기로 닫기」 가 닫히며 history 를 되돌려 router.push 를 무른다 — 전체 이동으로 간다
    window.location.assign(`/csat/workspace/${encodeURIComponent(ws.id)}?from=created`)
  }

  return (
    <Dialog
      onClose={onClose}
      title="새 Workspace"
      byline="유형 · 함정 · 회차 · 문항을 골라 담은 나만의 학습 묶음"
      size="lg"
      footer={
        <div className={styles.dialogFoot}>
          <label className={styles.inline}>
            <span className="sr-only">Workspace 이름</span>
            <input id="ws-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="이름 — 예: 9월 모평 전 빈칸 잡기" />
          </label>
          {error ? (
            <span className={styles.danger} role="alert">
              {error}
            </span>
          ) : null}
          <button type="button" className={home.primary} disabled={!starter || busy || !pool.length} onClick={() => void submit()} data-testid="ws-create">
            <FolderPlus size={15} aria-hidden="true" />
            {busy ? '만드는 중…' : `만들기 · ${pool.length}문항`}
          </button>
        </div>
      }
    >
      <div className={styles.compact}>
        <div className={styles.group}>
          <p className={styles.groupHead}>출발점</p>
          <div className={styles.chips} role="group" aria-label="출발점">
            {STARTERS.map((s) => {
              const off = s === 'weakness' && weak.length === 0
              return (
                <button
                  key={s}
                  type="button"
                  className={home.chip}
                  aria-pressed={starter === s}
                  disabled={off}
                  title={off ? '예측 기록이 더 쌓이면 켜집니다(한 곳에서 6회 이상)' : undefined}
                  onClick={() => pick(s)}
                  data-starter={s}
                >
                  {STARTER_LABEL[s]}
                </button>
              )
            })}
          </div>
          <p className={styles.why}>{why}</p>
        </div>

        <div className={styles.row3}>
          <label className={styles.field}>
            <span>목표</span>
            <input id="ws-goal" value={goal} maxLength={120} onChange={(e) => setGoal(e.target.value)} placeholder="예: 빈칸에서 근거 문장을 먼저 찾는다" />
          </label>
          <label className={styles.field}>
            <span>주당 학습</span>
            <select id="ws-perweek" value={perWeek} onChange={(e) => setPerWeek(e.target.value)}>
              {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                <option key={n} value={n}>
                  {n}문항
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>기한(선택)</span>
            <input id="ws-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </div>

        <details className={styles.fold}>
          <summary>
            약점 <small>{weakPicked.length ? `${weakPicked.length}개 고름` : '선택'}</small>
          </summary>
          <p className={styles.hint}>
            {weak.length
              ? `예측 기록에서 찾은 후보: ${weak.map((w) => `${w.axis === 'type' ? typeName.get(w.key) ?? w.key : w.key}(${STEP_TARGET[w.step]} ${w.n}회 중 ${w.hits})`).join(' · ')}`
              : '예측 기록이 적어서 약점 후보를 만들지 않았어요. 직접 고를 수 있습니다.'}
          </p>
          <div className={`${styles.chips} ${styles.scroll}`}>
            {index.units.types.map((t) => (
              <button key={t.id} type="button" className={home.chip} aria-pressed={weakPicked.includes(t.id)} onClick={() => setWeakPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))}>
                {t.name}
              </button>
            ))}
          </div>
        </details>

        <ScopeEditor
          scope={scope}
          index={index.items}
          units={index.units}
          folded
          onChange={(next) => {
            setScope(next)
            setEdited(true)
          }}
        />
      </div>
    </Dialog>
  )
}
