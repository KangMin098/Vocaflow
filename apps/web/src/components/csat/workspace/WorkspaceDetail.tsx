// apps/web/src/components/csat/workspace/WorkspaceDetail.tsx
'use client'

//
// **Workspace 안** — `/csat/workspace/[id]` (설계 §2 · §5 · §6 · §7).
//   주 행동 하나: 「다음 문항 학습」 — 다음 세 문항의 첫 문항을 출제 사고 화면(`/csat/item/[slug]`)으로 연다.
//   해부 세션(`/csat/dissect`)은 손으로 채운 메타데이터가 있는 소수 문항만 돌려서 쓰지 않는다.
//   진행은 **기존 학습 포함**과 **만든 뒤**를 가르고, 계획(이번 주 · 기한)과 따로 적는다.
//   약점 변화는 예측 적중 — 무엇의 예측인지 · 표본 수 · 비교 기준을 함께 쓰고, 모자라면 판단을 보류한다.

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, ArrowRight, Plus, Trash2 } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { toItemSlug } from '@/lib/csat/item-slug'
import type { RailExam } from '@/lib/csat/rail-data'
import type { WorkspaceIndex } from '@/lib/csat/workspace-index'
import {
  MIN_JUDGE,
  STARTER_LABEL,
  STEP_TARGET,
  TREND_WINDOW,
  deleteWorkspace,
  editWorkspace,
  liveWorkspaces,
  nextSet,
  poolBucket,
  poolOf,
  progressOf,
  weakRows,
  type WeakRow,
  type Workspace,
} from '@/lib/csat/workspace'

import home from '../home/home.module.css'
import { ScopeEditor } from './ScopeEditor'
import { WorkspaceFrame } from './WorkspaceFrame'
import { useWorkspaces } from './useWorkspaces'
import styles from './workspace.module.css'

const VERDICT_LABEL: Record<WeakRow['verdict'], string> = { up: '나아짐', down: '떨어짐', flat: '큰 변화 없음', insufficient: '판단 보류' }
const SUGGEST_MAX = 6
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0)
const dateOf = (t: number) => new Date(t).toLocaleDateString('ko-KR')

export function WorkspaceDetail({ id, index, exams }: { id: string; index: WorkspaceIndex; exams: RailExam[] }) {
  const { record, save, rec, now, synced } = useWorkspaces()
  const params = useSearchParams()
  const ws = useMemo(() => liveWorkspaces(record?.workspaces, true).find((w) => w.id === id) ?? null, [record, id])
  const pool = useMemo(() => (ws ? poolOf(ws.scope, index.items) : []), [ws, index.items])
  const typeName = useMemo(() => new Map(index.units.types.map((t) => [t.id, t.name])), [index.units.types])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const opened = useRef(false)

  useEffect(() => {
    if (!ws || opened.current) return
    opened.current = true
    const from = params.get('from')
    track({ name: 'csat_workspace_opened', props: { from: from === 'created' ? 'created' : from === 'home' ? 'home' : 'rail', pool: poolBucket(pool.length) } })
  }, [ws, pool.length, params])

  if (!rec) return <WorkspaceFrame exams={exams} rec={rec} title="Workspace" synced={synced}><p className={home.section} aria-busy="true">기록을 읽는 중…</p></WorkspaceFrame>
  if (!ws || !record || now == null)
    return (
      <WorkspaceFrame exams={exams} rec={rec} title="Workspace" synced={synced}>
        <section className={home.section}>
          <p className={home.empty}>이 Workspace 를 찾지 못했습니다. 다른 기기에서 지웠거나 아직 동기화되지 않았을 수 있어요.</p>
          <Link className={home.secondary} href="/csat/workspace">
            내 Workspace 목록
          </Link>
        </section>
      </WorkspaceFrame>
    )

  const prog = progressOf(ws, pool, record, now)
  const rows = weakRows(pool, record)
  const next = nextSet(pool, record)
  const seenIds = new Set([...record.completed.map((c) => c.id), ...(record.views ?? []).map((v) => v.id), ...record.predictions.map((p) => p.item)])
  const unseen = next.filter((i) => !seenIds.has(i)).length
  const label = (r: WeakRow) => (r.axis === 'type' ? typeName.get(r.key) ?? r.key : r.key)

  // 추천 — 판단할 만큼 쌓였고 적중이 절반 미만인 곳. **풀 밖의 같은 유형 · 계열 문항을 낱개로 더한다**
  // (조건 칸에 넣으면 「그리고」 라 오히려 좁아진다 — 설계 §3).
  const inPool = new Set(pool.map((p) => p.id))
  const suggestions = rows
    .filter((r) => r.verdict !== 'insufficient' && r.hits / r.n < 0.5)
    .map((r) => ({ r, extra: index.items.filter((it) => !inPool.has(it.id) && (r.axis === 'type' ? it.type_id === r.key : it.families.includes(r.key))).map((it) => it.id) }))
    .filter((s) => s.extra.length > 0)
    .slice(0, 3)

  const update = (patch: Partial<Pick<Workspace, 'name' | 'intent' | 'scope' | 'archived'>>) => void save(editWorkspace(ws, patch, Date.now()))

  return (
    <WorkspaceFrame exams={exams} rec={rec} title="Workspace" synced={synced}>
      <section className={home.section}>
        <p className={styles.wmeta}>
          {STARTER_LABEL[ws.starter]} · {dateOf(ws.createdAt)} 만듦{ws.archived ? ' · 보관됨' : ''}
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '6px 0' }}>{ws.name}</h1>
        {ws.intent.goal ? <p className={styles.wgoal}>목표: {ws.intent.goal}</p> : null}
        <div className={home.cardActions}>
          {next.length ? (
            <Link
              className={home.primary}
              href={`/csat/item/${toItemSlug(next[0])}`}
              data-testid="ws-next"
              onClick={() => track({ name: 'csat_workspace_session_started', props: { size: next.length, unseen } })}
            >
              다음 문항 학습 · {next[0].replace('#', ' ')}번 <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : (
            <span className={home.empty}>포함된 문항이 없습니다. 아래에서 담을 것을 고치세요.</span>
          )}
          {next.length > 1 ? (
            <span className={styles.hint}>
              그다음:{' '}
              {next.slice(1).map((i, k) => (
                <span key={i}>
                  {k ? ' · ' : ''}
                  <Link href={`/csat/item/${toItemSlug(i)}`} style={{ textDecoration: 'underline' }}>
                    {i.replace('#', ' ')}번
                  </Link>
                </span>
              ))}{' '}
              — 세 문항 중 안 본 문항 {unseen}개
            </span>
          ) : null}
        </div>
      </section>

      <section className={home.section}>
        <h2 className={home.sectionHead}>진행</h2>
        <dl className={home.meters}>
          <div className={home.meter}>
            <dt>연 문항 (기존 학습 기록 포함)</dt>
            <dd data-testid="ws-touched">
              {prog.touched} <small>/ {prog.pool}</small>
            </dd>
            <span className={home.bar} aria-hidden="true">
              <span style={{ width: `${pct(prog.touched, prog.pool)}%` }} />
            </span>
          </div>
          <div className={home.meter}>
            <dt>만든 뒤에 연 문항</dt>
            <dd>{prog.touchedSince}</dd>
          </div>
          <div className={home.meter}>
            <dt>이번 주 학습한 문항 (월요일부터 · 만든 뒤)</dt>
            <dd>
              {prog.studiedThisWeek} <small>/ {prog.perWeek ?? '—'}</small>
            </dd>
            {prog.perWeek ? (
              <span className={home.bar} aria-hidden="true">
                <span style={{ width: `${Math.min(100, pct(prog.studiedThisWeek, prog.perWeek))}%` }} />
              </span>
            ) : null}
          </div>
          <div className={home.meter}>
            <dt>기한</dt>
            <dd>{ws.intent.plan?.until ? <>{prog.daysLeft}일 <small>남음 · {ws.intent.plan.until}</small></> : <small>정하지 않음</small>}</dd>
          </div>
        </dl>
        <p className={styles.hint}>「연 문항」은 이 Workspace 를 만들기 전에 본 문항도 셉니다. 계획 달성(이번 주)은 만든 뒤의 학습만 셉니다.</p>
      </section>

      <section className={home.section}>
        <h2 className={home.sectionHead}>
          약점 변화 <small>예측 적중 — 유형은 근거 자리, 함정은 오답 계열 예측</small>
        </h2>
        {rows.length ? (
          <ul className={styles.weak} data-testid="ws-weak">
            {rows.slice(0, 8).map((r) => (
              <li key={`${r.axis}|${r.key}`}>
                <span className={styles.weakName}>
                  {r.axis === 'type' ? '유형' : '함정'} · {label(r)}
                </span>
                <span className={styles.verdict} data-v={r.verdict}>
                  {VERDICT_LABEL[r.verdict]}
                </span>
                <span className={styles.weakBasis}>
                  {STEP_TARGET[r.step]} 예측 {r.n}회 중 적중 {r.hits}
                  {r.recent && r.before
                    ? ` · 최근 ${TREND_WINDOW}회 ${r.recent.hits} vs 그 앞 ${TREND_WINDOW}회 ${r.before.hits}`
                    : r.n < MIN_JUDGE
                      ? ` · 기록 부족 — ${MIN_JUDGE}회부터 판단`
                      : ` · 비교할 앞 기록이 모자람(${TREND_WINDOW * 2}회부터 추세)`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={home.empty}>이 Workspace 문항에서 남긴 예측이 아직 없습니다. 학습을 하면 여기에 유형 · 함정별 적중이 쌓입니다.</p>
        )}
      </section>

      {suggestions.length ? (
        <section className={home.section}>
          <h2 className={home.sectionHead}>보완 제안</h2>
          <ul className={styles.weak}>
            {suggestions.map(({ r, extra }) => (
              <li key={`s|${r.axis}|${r.key}`}>
                <span className={styles.weakName}>
                  {label(r)} — {STEP_TARGET[r.step]} {r.n}회 중 {r.hits}
                </span>
                <button
                  type="button"
                  className={home.secondary}
                  onClick={() => {
                    update({ scope: { ...ws.scope, items: [...new Set([...ws.scope.items, ...extra.slice(0, SUGGEST_MAX)])] } })
                    track({ name: 'csat_workspace_suggestion_applied', props: { axis: r.axis, verdict: r.verdict === 'insufficient' ? 'flat' : r.verdict } })
                  }}
                >
                  <Plus size={14} aria-hidden="true" />
                  같은 {r.axis === 'type' ? '유형' : '함정'} 문항 {Math.min(SUGGEST_MAX, extra.length)}개 더 담기
                </button>
                <span className={styles.weakBasis}>이 Workspace 밖에 있는 같은 {r.axis === 'type' ? '유형' : '함정'}의 문항을 낱개로 더합니다.</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={home.section}>
        <details>
          <summary className={home.sectionHead} style={{ cursor: 'pointer' }}>
            담은 것 고치기 <small>{pool.length}문항</small>
          </summary>
          <div style={{ marginTop: 12 }}>
            <ScopeEditor
              scope={ws.scope}
              index={index.items}
              units={index.units}
              onChange={(scope, change) => {
                update({ scope })
                track({ name: 'csat_workspace_edited', props: { action: change.action, unit: change.unit } })
              }}
            />
          </div>
        </details>
      </section>

      <section className={home.section}>
        <div className={home.cardActions}>
          <button
            type="button"
            className={home.secondary}
            onClick={() => {
              update({ archived: !ws.archived })
              track({ name: 'csat_workspace_edited', props: { action: ws.archived ? 'restore' : 'archive', unit: 'none' } })
            }}
          >
            {ws.archived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
            {ws.archived ? '보관 풀기' : '보관하기'}
          </button>
          {confirmDelete ? (
            <>
              <span className={styles.danger} role="alert">
                지우면 되돌릴 수 없습니다. 학습 기록은 남습니다.
              </span>
              <button
                type="button"
                className={home.secondary}
                data-testid="ws-delete-confirm"
                onClick={async () => {
                  await save(deleteWorkspace(ws, Date.now()))
                  track({ name: 'csat_workspace_edited', props: { action: 'delete', unit: 'none' } })
                  window.location.assign('/csat/workspace')
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                지우기 확인
              </button>
              <button type="button" className={home.quietLink} onClick={() => setConfirmDelete(false)}>
                취소
              </button>
            </>
          ) : (
            <button type="button" className={home.quietLink} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden="true" />
              지우기
            </button>
          )}
        </div>
      </section>
    </WorkspaceFrame>
  )
}
