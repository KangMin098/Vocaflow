// apps/web/src/app/admin/csat/evidence/EvidenceConsole.tsx
'use client'

import { ArrowRight, CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { LabHeader } from '@/components/admin/factory/StepHeader'
import { PLAIN_LAB } from '@/lib/csat/factory-plain'
import {
  AXES,
  MEASURES,
  axisContext,
  axisDef,
  labelOf,
  type AxisId,
} from '@/lib/csat/evidence-fold'
import {
  FIELD_GROUPS,
  LEARNER_FIELDS,
  PIPELINE,
  SORTS,
  STATUSES,
  VIEWS,
  WORK_ISSUES,
  filterOperations,
  hasIssue,
  makeWorkPackage,
  operationsHref,
  parseOperationsState,
  pipelineHealth,
  readinessIndex,
  workQueue,
  type OperationsData,
  type OperationsState,
  type WorkIssue,
} from '@/lib/csat/evidence-operations'
import { EvidenceAxisPanel } from './EvidenceAxisPanel'
import { EvidenceMatrix } from './EvidenceMatrix'
import { EvidenceInspector } from './EvidenceInspector'
import s from './evidence.module.css'

const nf = new Intl.NumberFormat('ko-KR')
const date = (value: string) =>
  new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
const PAGE_SIZE = 40

export function downloadWork(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'csat-evidence-work.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function EvidenceConsole({
  data: initialData,
  initialState,
}: {
  data: OperationsData
  initialState: OperationsState
}) {
  const [data, setData] = useState(initialData)
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const request = useRef<AbortController | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const ctx = useMemo(() => axisContext(data.items, data.exams, data.types), [data])
  const index = useMemo(() => readinessIndex(data.readiness), [data.readiness])
  const queue = useMemo(() => workQueue(data.items, index), [data.items, index])
  const shown = useMemo(
    () => filterOperations(data.items, state, ctx, index),
    [data.items, state, ctx, index]
  )
  const pipeline = useMemo(() => pipelineHealth(data.items, index), [data.items, index])
  const quality = data.items.filter((i) => i.defects.length).length
  const selected = data.items.find((i) => i.id === state.item)
  const page = Math.min(state.page, Math.max(1, Math.ceil(shown.length / PAGE_SIZE)))
  const scopeIssue = WORK_ISSUES.find((i) => i.id === state.issue)
  const healthy = !data.loadError && !data.readinessError && Boolean(data.readiness) && !verifyError

  const change = useCallback((patch: Partial<OperationsState>, replace = false) => {
    setState((previous) => {
      const next = { ...previous, page: 1, ...patch }
      const href = operationsHref(next)
      if (href !== window.location.pathname + window.location.search) {
        window.history[replace ? 'replaceState' : 'pushState'](null, '', href)
      }
      return next
    })
  }, [])
  useEffect(() => {
    const pop = () => setState(parseOperationsState(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('popstate', pop)
      request.current?.abort()
    }
  }, [])
  const close = useCallback(() => {
    change({ item: '', page: state.page })
    requestAnimationFrame(() =>
      (returnFocus.current?.isConnected ? returnFocus.current : heading.current)?.focus()
    )
  }, [change, state.page])
  const navigate = (patch: Partial<OperationsState>) => {
    change({ ...patch, item: '' })
    requestAnimationFrame(() => heading.current?.focus())
  }
  const drill = (patch: Partial<OperationsState>) =>
    navigate({ ...parseOperationsState(), view: 'questions', ...patch })
  const toggle = (axis: AxisId, key: string) => {
    const values = state.filter[axis] ?? []
    change({
      filter: {
        ...state.filter,
        [axis]: values.includes(key) ? values.filter((v) => v !== key) : [...values, key],
      },
    })
  }
  async function verify() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setVerifyError('')
    setMessage('최신 데이터와 배포 기준을 다시 확인하고 있습니다.')
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const response = await fetch('/api/admin/csat/evidence', {
        cache: 'no-store',
        signal: controller.signal,
      })
      const next = (await response.json()) as OperationsData
      if (!response.ok || next.loadError || next.readinessError || !next.readiness)
        throw new Error(next.loadError ?? next.readinessError ?? '재검증하지 못했습니다.')
      const previous = data.readiness?.readyIds.length
      const delta = previous === undefined ? null : next.readiness.readyIds.length - previous
      setData(next)
      setMessage(
        `재검증 완료 · 학습 준비 ${next.readiness.readyIds.length}문항${delta === null ? '' : ` · 이전 대비 ${delta > 0 ? '+' : ''}${delta}문항`} · ${date(next.generatedAt)} KST`
      )
    } catch (e) {
      setVerifyError(
        e instanceof Error && e.name !== 'AbortError'
          ? e.message
          : '검증 응답이 지연되었습니다. 다시 시도해 주세요.'
      )
      setMessage('재검증 실패. 아래 수치는 이전 검사 결과입니다.')
    } finally {
      clearTimeout(timeout)
      request.current = null
      setBusy(false)
    }
  }
  function exportShown() {
    downloadWork(makeWorkPackage(shown, state, data.generatedAt, index))
    setMessage(
      `${shown.length}문항의 작업 대상을 내려받았습니다. 재분석은 아직 실행되지 않았습니다.`
    )
  }
  const top = queue[0]
  const causes = [...queue].sort((a, b) => b.count - a.count).slice(0, 4)
  const blockedTypes = data.types
    .map((t) => ({
      ...t,
      blocked: data.items.filter((i) => i.typeId === t.id && index.missing.has(i.id)).length,
    }))
    .filter((t) => t.blocked)
    .sort((a, b) => b.blocked - a.blocked)
    .slice(0, 4)

  return (
    <div className={s.console} data-testid="evidence-operations">
      <div
        aria-hidden={selected ? true : undefined}
        ref={(node) => {
          if (selected) node?.setAttribute('inert', '')
          else node?.removeAttribute('inert')
        }}
      >
        <LabHeader
          lab={PLAIN_LAB.find((l) => l.key === 'evidence')!}
          help={<AdminScreenHelp screen="csat-evidence" tab={VIEWS[state.view]} />}
        />
        <header className={s.header}>
          <div>
            <p className={s.muted}>배포 상태를 확인하고, 근거가 필요한 문제부터 처리해요.</p>
          </div>
          <div className={s.actions}>
            <button className={s.button} onClick={verify} disabled={busy}>
              <RefreshCw size={16} aria-hidden />
              {busy ? '재검증 중…' : '지금 재검증'}
            </button>
          </div>
        </header>
        <p className={s.muted}>
          검사 시각 {date(data.generatedAt)} KST · DB 최신 공개 분석 + 현재 배포된 앵커·메타데이터
        </p>
        <p role="status" aria-live="polite" className={s.muted}>
          {message}
        </p>
        {data.loadError || data.readinessError || verifyError ? (
          <div role="alert" className={s.alert}>
            <strong>판정 보류 · 데이터를 확인하지 못했습니다</strong>
            <p>{data.loadError ?? data.readinessError ?? verifyError}</p>
            <p className={s.muted}>
              조회 실패를 문항 결함이나 정상 0건으로 처리하지 않습니다. 지금 재검증으로 다시
              확인하세요.
            </p>
          </div>
        ) : null}
        <nav className={s.nav} aria-label="Evidence 작업 화면">
          {Object.entries(VIEWS).map(([key, label]) => (
            <button
              key={key}
              aria-current={state.view === key ? 'page' : undefined}
              onClick={() => navigate({ view: key as OperationsState['view'] })}
            >
              {label}
            </button>
          ))}
        </nav>
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          {VIEWS[state.view]}
        </h2>
        {state.view === 'overview' ? (
          <>
            <section
              className={s.hero}
              aria-labelledby="dissection-readiness-title"
              data-testid="dissection-readiness"
              data-total={data.readiness?.total}
              data-ready={data.readiness?.readyIds.length}
            >
              <div>
                <h3 id="dissection-readiness-title">학습자 해부 배포 준비도</h3>
                <div className={s.number}>
                  {healthy ? nf.format(index.ready.size) : '—'}{' '}
                  <span>/ {nf.format(data.items.length)}문항</span>
                </div>
                <p className={s.muted}>
                  {healthy
                    ? `${nf.format(index.missing.size)}문항이 학습 후보 기준을 충족하지 못했습니다.`
                    : '최신 판정을 확인한 뒤 배포를 판단하세요.'}
                </p>
                <div className={s.distribution} aria-hidden>
                  <span
                    style={{
                      width: `${healthy && data.items.length ? (index.ready.size / data.items.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className={s.actions}>
                  <button
                    className={s.button}
                    disabled={!healthy}
                    onClick={() => drill({ status: 'ready' })}
                  >
                    <CheckCircle2 size={15} aria-hidden />
                    학습 준비 {healthy ? index.ready.size : '—'}
                  </button>
                  <button
                    className={`${s.button} ${s.primary}`}
                    disabled={!healthy}
                    onClick={() => drill({ status: 'blocked' })}
                  >
                    제외 문항 검토 <ArrowRight size={15} aria-hidden />
                  </button>
                </div>
                <p className={`${s.muted} mt-3`}>
                  원천 품질은 별도 점검입니다.{' '}
                  <button
                    className="underline"
                    onClick={() => drill({ status: 'quality' })}
                    disabled={Boolean(data.loadError)}
                  >
                    검토 필요 {quality}문항
                  </button>
                </p>
              </div>
              <div className={s.recommend}>
                <p className={s.eyebrow}>먼저 확인할 작업</p>
                {top ? (
                  <>
                    <h4>{top.label}</h4>
                    <p className={s.muted}>
                      P{top.priority} · {top.stage} · {top.count}문항
                    </p>
                    <p className="my-3 text-sm leading-7">{top.why}</p>
                    <p className={s.muted}>{top.action}</p>
                    <button
                      className={`${s.button} mt-4`}
                      onClick={() => navigate({ view: 'issues', issue: top.id })}
                    >
                      처리 방법과 대상 보기 <ArrowRight size={15} aria-hidden />
                    </button>
                  </>
                ) : (
                  <p className={s.muted}>
                    {healthy
                      ? '현재 확인된 작업이 없습니다. 준비 문항을 검토하세요.'
                      : '검증이 완료되면 우선 작업이 표시됩니다.'}
                  </p>
                )}
              </div>
            </section>
            <section className={`${s.section} ${s.split}`}>
              <div>
                <h3>영향이 큰 문제</h3>
                <p className={s.muted}>
                  문항은 중복될 수 있습니다. 영향 규모와 처리 순위는 다릅니다.
                </p>
                {causes.map((i) => (
                  <button key={i.id} className={s.rowButton} onClick={() => drill({ issue: i.id })}>
                    <span>
                      {i.label} <small className={s.muted}>P{i.priority}</small>
                    </span>
                    <strong>
                      {i.count} <span aria-hidden>→</span>
                    </strong>
                  </button>
                ))}
              </div>
              <div>
                <h3>학습 후보가 많이 제외된 유형</h3>
                <p className={s.muted}>유형을 선택하면 같은 조건의 문항을 확인합니다.</p>
                {blockedTypes.map((t) => (
                  <button
                    key={t.id}
                    className={s.rowButton}
                    onClick={() => drill({ filter: { type: [t.id] }, status: 'blocked' })}
                  >
                    <span>{t.name}</span>
                    <strong>
                      {t.blocked} / {t.items} <span aria-hidden>→</span>
                    </strong>
                  </button>
                ))}
              </div>
            </section>
            <section className={s.section}>
              <h3>학습 후보 검증 흐름</h3>
              <p className={s.muted}>
                앞 단계를 통과한 문항만 다음 단계로 이어집니다. ‘제외’는 그 단계에서 처음 막힌
                문항입니다. 원문 상태는 별도로 검토합니다.
              </p>
              {data.readiness ? (
                <div className={s.pipeline}>
                  {pipeline.map((p, n) => (
                    <button
                      key={p.id}
                      onClick={() => drill({ stage: p.id })}
                      aria-label={`${p.label}에서 제외 ${p.blocked}문항`}
                    >
                      <span>
                        0{n + 1} · {p.label}
                      </span>
                      <strong>
                        {p.passed}
                        <small className={s.muted}> 통과</small>
                      </strong>
                      <span>제외 {p.blocked} →</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={s.muted}>학습자 판정 데이터를 다시 읽어 주세요.</p>
              )}
            </section>
            <details className={s.technical}>
              <summary>필수 필드 충족 상태</summary>
              <div className={s.coverage}>
                {FIELD_GROUPS.map((group) => (
                  <section key={group.label}>
                    <h3 className="my-3 font-semibold">{group.label}</h3>
                    {group.fields.map((field) => {
                      const good = data.readiness?.fields[field]
                      const bad = good === undefined ? null : (data.readiness?.total ?? 0) - good
                      return (
                        <button
                          key={field}
                          data-field={field}
                          data-count={good}
                          className={s.rowButton}
                          disabled={good === undefined}
                          onClick={() => drill({ issue: `field:${field}` })}
                        >
                          <span>{LEARNER_FIELDS[field]}</span>
                          <span>
                            {bad === null ? '미확인' : bad ? `제외 ${bad}` : '✓ 충족'}{' '}
                            <progress
                              value={good ?? 0}
                              max={data.readiness?.total || 1}
                              aria-label={`${LEARNER_FIELDS[field]} 충족`}
                            />{' '}
                            <small>
                              {good}/{data.readiness?.total}
                            </small>
                          </span>
                        </button>
                      )
                    })}
                  </section>
                ))}
              </div>
            </details>
          </>
        ) : state.view === 'issues' ? (
          <>
            <div className={s.line}>
              <h3 className="text-xl font-semibold">{scopeIssue ? `${scopeIssue.label} 처리` : `처리할 작업 ${queue.length}종`}</h3>
              <button className={s.button} onClick={() => change({ issue: '' })}>
                전체 작업 보기
              </button>
            </div>
            <p className={s.muted}>
              P1 원문·채점 → P2 분석·연결 → P3 학습 메타 → P4 보고서. 같은 우선순위에서는 영향
              문항이 많은 순서입니다.
            </p>
            <ol className={s.queue}>
              {queue
                .filter((i) => !state.issue || i.id === state.issue)
                .map((issue) => (
                  <li className={s.issue} key={issue.id}>
                    <div className={s.priority}>P{issue.priority}</div>
                    <div>
                      <h3>{issue.label}</h3>
                      <div className={s.line}>
                        <span
                          className={`${s.badge} ${issue.severity === '학습 후보 제외' ? s.bad : s.warn}`}
                        >
                          <TriangleAlert size={14} aria-hidden />
                          {issue.severity}
                        </span>
                        <span className={s.muted}>
                          {issue.stage} · {issue.count}문항
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7">{issue.why}</p>
                      <p className={s.muted}>권장 조치 · {issue.action}</p>
                      <details open={state.issue === issue.id}>
                        <summary>처리 방법 · 수정 위치</summary>
                        <p>{issue.technical}</p>
                        <p className={`${s.code} mt-2`}>{issue.location}</p>
                        <p className={s.muted}>
                          작업 대상 내보내기는 실행 예약이 아닙니다. 변경을 반영한 뒤 ‘지금
                          재검증’으로 결과를 확인하세요.
                        </p>
                      </details>
                    </div>
                    <div className={s.actions}>
                      <button className={s.button} onClick={() => drill({ issue: issue.id })}>
                        {issue.count}문항 보기 <ArrowRight size={15} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
            </ol>
            {!queue.length || (state.issue && !queue.some((i) => i.id === state.issue)) ? (
              <div className={s.empty}>
                현재 조건에 처리할 작업이 없습니다.{' '}
                <button className={s.button} onClick={() => change({ issue: '' })}>
                  전체 작업 확인
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className={`${s.line} mb-4`}>
              <h3 className="text-xl font-semibold">
                {scopeIssue?.label ?? '문항 탐색'} · {nf.format(shown.length)}문항
              </h3>
              <button
                className={s.button}
                disabled={!shown.length || Boolean(data.loadError)}
                onClick={exportShown}
              >
                작업 대상 내보내기
              </button>
            </div>
            {scopeIssue ? (
              <div className={`${s.alert} ${s.muted}`}>
                <strong>다음 조치</strong> · {scopeIssue.action}
                <button className={`${s.button} ml-3`} onClick={() => navigate({ view: 'issues' })}>
                  처리 방법
                </button>
              </div>
            ) : null}
            <div className={s.filters}>
              <label>
                문항 검색
                <input
                  type="search"
                  value={state.q}
                  placeholder="회차, 문항 번호, 유형"
                  onChange={(e) => change({ q: e.target.value }, true)}
                />
              </label>
              <label>
                운영 상태
                <select
                  value={state.status}
                  onChange={(e) => change({ status: e.target.value as OperationsState['status'] })}
                >
                  {Object.entries(STATUSES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                유형
                <select
                  value={state.filter.type?.length === 1 ? state.filter.type[0] : ''}
                  onChange={(e) =>
                    change({
                      filter: { ...state.filter, type: e.target.value ? [e.target.value] : [] },
                    })
                  }
                >
                  <option value="">전체 유형</option>
                  {data.types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                문제·필드 부족
                <select value={state.issue} onChange={(e) => change({ issue: e.target.value })}>
                  <option value="">모든 문제</option>
                  {queue.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label} ({i.count})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                정렬
                <select
                  value={state.sort}
                  onChange={(e) => change({ sort: e.target.value as OperationsState['sort'] })}
                >
                  {Object.entries(SORTS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={s.chips}>
              {Object.entries(state.filter).flatMap(([axis, values]) =>
                values?.map((key) => (
                  <button
                    key={`${axis}:${key}`}
                    onClick={() => toggle(axis as AxisId, key)}
                    aria-label={`${labelOf(axis as AxisId, key, ctx)} 조건 해제`}
                  >
                    {axisDef(axis as AxisId).label} · {labelOf(axis as AxisId, key, ctx)} ×
                  </button>
                ))
              )}
              {state.stage ? (
                <button onClick={() => change({ stage: '' })}>
                  {PIPELINE.find((p) => p.id === state.stage)?.label} 최초 제외 ×
                </button>
              ) : null}
              {state.issue ? (
                <button onClick={() => change({ issue: '' })}>{scopeIssue?.label} ×</button>
              ) : null}
              {state.intersection ? (
                <button onClick={() => change({ intersection: null })}>
                  {state.intersection.keys
                    .map((k) => labelOf(state.intersection!.axis, k, ctx))
                    .join(' ∩ ')}{' '}
                  동시 충족 ×
                </button>
              ) : null}
              <button
                onClick={() =>
                  change({
                    filter: {},
                    intersection: null,
                    status: 'all',
                    issue: '',
                    stage: '',
                    q: '',
                  })
                }
              >
                조건 초기화
              </button>
            </div>
            <button
              className={`${s.button} mb-4`}
              aria-expanded={state.matrix}
              onClick={() => change({ matrix: !state.matrix })}
            >
              {state.matrix ? '교차 진단 닫기' : '교차 진단 · 매트릭스'}
            </button>
            {state.matrix ? (
              <section className={`${s.section} mb-6`} aria-label="교차 진단">
                <div className={s.filters}>
                  <label>
                    행
                    <select
                      value={state.row}
                      onChange={(e) => change({ row: e.target.value as AxisId })}
                    >
                      {AXES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    열
                    <select
                      value={state.col}
                      onChange={(e) => change({ col: e.target.value as AxisId })}
                    >
                      {AXES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    값
                    <select
                      value={state.measure}
                      onChange={(e) =>
                        change({ measure: e.target.value as OperationsState['measure'] })
                      }
                    >
                      {MEASURES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <EvidenceMatrix
                  key={`${state.row}:${state.col}:${shown.length}`}
                  items={shown}
                  rowAxis={state.row}
                  colAxis={state.col}
                  measure={state.measure}
                  ctx={ctx}
                  onCell={(r, c) => {
                    const filter = { ...state.filter, [state.row]: [r], [state.col]: [c] }
                    if (state.row === state.col) filter[state.row] = []
                    change({
                      filter,
                      intersection:
                        state.row === state.col ? { axis: state.row, keys: [r, c] } : null,
                      matrix: false,
                    })
                  }}
                  onRow={(r) => change({ filter: { ...state.filter, [state.row]: [r] } })}
                  onCol={(c) => change({ filter: { ...state.filter, [state.col]: [c] } })}
                />
                <details className={s.technical}>
                  <summary>유형 리포트·함정 계열 상세</summary>
                  <EvidenceAxisPanel
                    axis="type"
                    items={shown}
                    ctx={ctx}
                    filter={state.filter}
                    onToggle={toggle}
                  />
                  <EvidenceAxisPanel
                    axis="trap"
                    items={shown}
                    ctx={ctx}
                    filter={state.filter}
                    onToggle={toggle}
                  />
                </details>
              </section>
            ) : null}
            <div className={s.tableWrap}>
              <table className={s.table}>
                <caption className="sr-only">
                  현재 조건의 문항. 문항을 선택하면 상세 패널이 열립니다.
                </caption>
                <thead>
                  <tr>
                    <th>회차 / 문항</th>
                    <th>유형</th>
                    <th>학습 상태</th>
                    <th>확인할 문제</th>
                    <th>최근 분석</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
                    <tr key={item.id} data-selected={state.item === item.id}>
                      <td>
                        <button
                          onClick={(e) => {
                            returnFocus.current = e.currentTarget
                            change({ item: item.id, page })
                          }}
                        >
                          {item.examLabel} {item.no}번
                        </button>
                        <small>{item.id}</small>
                      </td>
                      <td>{item.typeName}</td>
                      <td>
                        {index.ready.has(item.id) ? (
                          <span className={`${s.badge} ${s.good}`}>
                            <CheckCircle2 size={14} aria-hidden />
                            준비
                          </span>
                        ) : index.missing.has(item.id) ? (
                          <span className={`${s.badge} ${s.bad}`}>
                            <TriangleAlert size={14} aria-hidden />
                            제외
                          </span>
                        ) : (
                          '미확인'
                        )}
                        {item.defects.length ? (
                          <small>원천 검토 {item.defects.length}건</small>
                        ) : null}
                      </td>
                      <td>
                        {(() => {
                          const issues = WORK_ISSUES.filter((i) => hasIssue(item, i, index)).sort(
                            (a, b) => a.priority - b.priority
                          )
                          return (
                            <>
                              {issues
                                .slice(0, 2)
                                .map((i) => i.label)
                                .join(' · ') || '확인된 문제 없음'}
                              {issues.length > 2 ? (
                                <small>외 {issues.length - 2}건 · 문항에서 확인</small>
                              ) : null}
                            </>
                          )
                        })()}
                      </td>
                      <td>
                        {item.analysisVersion ? `v${item.analysisVersion}` : '분석 없음'}
                        <small>
                          {item.analysisUpdatedAt ? date(item.analysisUpdatedAt) : '기록 없음'}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!shown.length ? (
              <div className={s.empty}>
                <p>조건에 맞는 문항이 없습니다.</p>
                <button className={s.button} onClick={() => drill({})}>
                  전체 문항 보기
                </button>
              </div>
            ) : (
              <div className={s.pagination}>
                <button
                  className={s.button}
                  disabled={page <= 1}
                  onClick={() => change({ page: page - 1 })}
                >
                  이전
                </button>
                <span>
                  {page} / {Math.ceil(shown.length / PAGE_SIZE)}
                </span>
                <button
                  className={s.button}
                  disabled={page * PAGE_SIZE >= shown.length}
                  onClick={() => change({ page: page + 1 })}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
        {state.item && !selected ? (
          <div className={s.alert}>
            문항을 찾지 못했습니다.{' '}
            <button className={s.button} onClick={close}>
              선택 해제
            </button>
          </div>
        ) : null}
        <details className={s.technical}>
          <summary>기술 상세 · 판정 기준과 전체 산출물</summary>
          <p className={s.muted}>
            학습 준비는 /csat/dissect의 실제 카탈로그 판정입니다. 원천 결함은 추출·인용·채점·유형
            리포트 품질 신호이며, 그 수만으로 학습 준비를 판정하지 않습니다. 검사 결과는 이 화면에
            보관되며 ‘지금 재검증’은 DB를 변경하지 않습니다.
          </p>
          <div className={`${s.actions} mt-3`}>
            <a className={s.button} href="/api/admin/csat/guide?format=md" download>
              전체 교재용 MD
            </a>
            <a className={s.button} href="/api/admin/csat/guide?format=json&download=1" download>
              전체 JSON
            </a>
            <a className={s.button} href="/admin/csat/sources">
              교재 재료 원문 적격
            </a>
          </div>
          <p className={s.muted}>
            전체 산출물은 현재 문항 필터를 적용하지 않습니다. 교재 재료 원문 적격은 평가원 문항의
            추출 상태와 별도입니다.
          </p>
        </details>
      </div>
      {selected ? (
        <>
          <button
            className={s.backdrop}
            tabIndex={-1}
            aria-label="문항 검토 닫기 (배경)"
            onClick={close}
          />
          <EvidenceInspector
            key={`${selected.id}:${data.generatedAt}`}
            item={selected}
            index={index}
            state={state}
            generatedAt={data.generatedAt}
            onClose={close}
            onVerify={verify}
            busy={busy}
            verifyMessage={message}
            verifyError={verifyError}
            onRelated={(issue: WorkIssue) => drill({ issue: issue.id })}
          />
        </>
      ) : null}
    </div>
  )
}
