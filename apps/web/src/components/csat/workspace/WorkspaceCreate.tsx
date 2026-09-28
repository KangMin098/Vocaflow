// apps/web/src/components/csat/workspace/WorkspaceCreate.tsx
'use client'

//
// **새 Workspace** — `/csat/workspace/new` (설계 §2 · §4).
// 한 화면에서 위에서 아래로: ① 출발점(가이드) ② 목표 · 계획 · 방향 · 약점 ③ 담을 것(+ 실제 포함 문항) ④ 이름 → 저장.
// 출발점은 구성을 **미리 채울 뿐**이다 — 학습자가 칩으로 고쳐서 저장한다. 「내 약점으로」 는 예측 기록이
// 약점을 말할 만큼 쌓였을 때만 켜진다(표본 6회 이상 · 적중 절반 미만 — 단정하지 않는다).

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { FolderPlus } from 'lucide-react'

import { track } from '@/lib/analytics/client'
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
  type WorkspaceScope,
  type WorkspaceStarter,
} from '@/lib/csat/workspace'
import type { RailExam } from '@/lib/csat/rail-data'

import home from '../home/home.module.css'
import { WorkspaceFrame } from './WorkspaceFrame'
import { ScopeEditor } from './ScopeEditor'
import { useWorkspaces } from './useWorkspaces'
import styles from './workspace.module.css'

const STARTERS: WorkspaceStarter[] = ['start', 'killer', 'trap', 'evidence', 'recent', 'weakness']
const STARTER_HINT: Record<WorkspaceStarter, string> = {
  start: '무엇부터 할지 모를 때 — 자주 나오는 유형부터',
  killer: '3점 · 고난도 유형을 집중해서',
  trap: '오답이 어떻게 만들어지는지부터',
  evidence: '정답 근거가 놓인 문장을 찾는 연습',
  recent: '요즘 기출의 흐름으로',
  weakness: '내 예측 기록에서 자주 빗나간 곳',
}

export function WorkspaceCreate({ index, exams }: { index: WorkspaceIndex; exams: RailExam[] }) {
  const router = useRouter()
  const { record, save, synced, rec } = useWorkspaces()
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
  const [why, setWhy] = useState('')
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
    if (!name.trim()) setName(STARTER_LABEL[s])
  }

  async function submit() {
    if (!starter || busy) return
    if (!pool.length) {
      setError('포함되는 문항이 없어 만들 수 없습니다. 담을 것을 넓혀 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    const now = Date.now()
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
      now,
      rand: Math.random(),
    })
    const ok = await save(ws)
    track({
      name: 'csat_workspace_created',
      props: {
        starter,
        types: scope.types.length,
        traps: scope.traps.length,
        exams: scope.exams.length,
        items: scope.items.length,
        pool: poolBucket(pool.length),
        hasPlan: !!until,
        edited,
      },
    })
    if (!ok) setError('이 기기에 저장하지 못했습니다(사생활 보호 모드 등). 로그인 상태라면 서버 사본으로는 저장됩니다.')
    router.push(`/csat/workspace/${encodeURIComponent(ws.id)}?from=created`)
  }

  return (
    <WorkspaceFrame exams={exams} rec={rec} title="새 Workspace" synced={synced}>
      <section className={home.section}>
        <h2 className={home.sectionHead}>
          1. 어디서 출발할까요 <small>가이드가 담을 것을 미리 채웁니다 — 뒤에서 고칠 수 있어요</small>
        </h2>
        <div className={styles.starters} role="group" aria-label="출발점">
          {STARTERS.map((s) => {
            const off = s === 'weakness' && weak.length === 0
            return (
              <button key={s} type="button" className={styles.starter} aria-pressed={starter === s} disabled={off} onClick={() => pick(s)} data-starter={s}>
                <b>{STARTER_LABEL[s]}</b>
                <span>{off ? (record ? '예측 기록이 더 쌓이면 켜집니다(한 곳에서 6회 이상).' : '기록을 읽는 중…') : STARTER_HINT[s]}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={home.section}>
        <h2 className={home.sectionHead}>2. 목표와 계획</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            <span>목표</span>
            <input id="ws-goal" value={goal} maxLength={120} onChange={(e) => setGoal(e.target.value)} placeholder="예: 빈칸 추론에서 근거 문장을 먼저 찾는다" />
          </label>
          <div className={styles.row2}>
            <label className={styles.field}>
              <span>주당 학습 문항</span>
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
          <div className={styles.field}>
            <span>약점이라고 생각하는 곳(선택)</span>
            {weak.length ? (
              <p className={styles.hint}>
                예측 기록에서 찾은 후보를 미리 골라 뒀어요:{' '}
                {weak.map((w) => `${w.axis === 'type' ? typeName.get(w.key) ?? w.key : w.key}(${STEP_TARGET[w.step]} ${w.n}회 중 ${w.hits})`).join(' · ')}
              </p>
            ) : (
              <p className={styles.hint}>예측 기록이 적어서 약점 후보를 만들지 않았어요. 직접 고를 수 있습니다.</p>
            )}
            <div className={`${styles.chips} ${styles.scroll}`}>
              {index.units.types.map((t) => (
                <button key={t.id} type="button" className={home.chip} aria-pressed={weakPicked.includes(t.id)} onClick={() => setWeakPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={home.section}>
        <h2 className={home.sectionHead}>
          3. 담을 것 {starter ? <small>{STARTER_LABEL[starter]}</small> : null}
        </h2>
        {starter ? (
          <>
            <p className={styles.why}>{why}</p>
            <ScopeEditor
              scope={scope}
              index={index.items}
              units={index.units}
              onChange={(next) => {
                setScope(next)
                setEdited(true)
              }}
            />
          </>
        ) : (
          <p className={home.empty}>위에서 출발점을 고르면 여기에 구성이 채워집니다.</p>
        )}
      </section>

      <section className={home.section}>
        <h2 className={home.sectionHead}>4. 이름</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            <span>Workspace 이름</span>
            <input id="ws-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="예: 9월 모평 전 빈칸 잡기" />
          </label>
          {error ? (
            <p className={styles.danger} role="alert">
              {error}
            </p>
          ) : null}
          <div className={home.cardActions}>
            <button type="button" className={home.primary} disabled={!starter || busy || !pool.length} onClick={() => void submit()} data-testid="ws-create">
              <FolderPlus size={15} aria-hidden="true" />
              {busy ? '만드는 중…' : `만들기 · ${pool.length}문항`}
            </button>
          </div>
        </div>
      </section>
    </WorkspaceFrame>
  )
}
