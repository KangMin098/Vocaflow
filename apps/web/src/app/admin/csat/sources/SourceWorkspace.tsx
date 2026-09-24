// apps/web/src/app/admin/csat/sources/SourceWorkspace.tsx
'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Search, ArrowRight, Clock3 } from 'lucide-react'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { StepHeader } from '@/components/admin/factory/StepHeader'
import { stepByKey } from '@/lib/csat/factory-plain'
import type { SourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'
import type { SourceInventoryPanel } from '@/lib/textbook/source-inventory-view'
import {
  DEFAULT_SOURCE_STATE,
  SOURCE_VIEWS,
  SOURCE_ISSUES,
  SOURCE_SORTS,
  filterSources,
  parseSourceWorkspace,
  sourceClues,
  sourceWorkspaceHref,
  type SourceWorkspaceState,
  type SourceView,
  type SourceIssue,
  type SourceSort,
} from '@/lib/textbook/source-workspace'
import type { SourceLiveResult } from '@/lib/textbook/source-live'
import { LiveOverview } from './LiveOverview'
import { SourceInventoryTable, SourceDetail } from './SourceInventoryTable'
import styles from './sources.module.css'
import { SourceOperations } from './SourceOperations'
import { SourceProcess } from './SourceProcess'
import { PipelineBoard } from './PipelineBoard'
import type { PipelineRow, SourceRounds } from '@/lib/textbook/source-pipeline'
import { SourceQueryConsole } from './SourceQueryConsole'

export function SourceWorkspace({
  panel,
  inventory: inventorySnapshot,
  initialState = DEFAULT_SOURCE_STATE,
  eligibility,
  operations,
  live,
  rounds = {},
  nextRound = 1,
}: {
  panel: SourceEligibilityPanel
  inventory: SourceInventoryPanel
  initialState?: SourceWorkspaceState
  eligibility: ReactNode
  operations: ReactNode
  // 지금 DB 에서 센 맨 위 요약. 없으면(테스트 표본 등) 옛 스냅샷 요약을 그린다.
  live?: SourceLiveResult
  // 원문 점검 회차 기록(원천별 κ · 보관 비율) — 진행표 오른쪽 패널이 쓴다.
  rounds?: Record<string, SourceRounds>
  nextRound?: number
}) {
  const [state, setState] = useState(initialState)
  // 원천별 표 — 지금 DB 에서 셌으면 그것, 못 셌으면 스냅샷. 「지금 다시 세기」가 이 값을 바꾼다.
  const [inventory, setInventory] = useState<SourceInventoryPanel>(
    live?.ok && live.inventory ? live.inventory : inventorySnapshot,
  )
  const inventoryLive = inventory !== inventorySnapshot
  // 원천별 작업 진행표 — 「지금 다시 세기」가 함께 바꾼다.
  const [pipeline, setPipeline] = useState<PipelineRow[] | null>(live?.ok ? live.pipeline : null)
  // 「자세히 보기」 — 처음에는 접는다(복잡도 해소 · 2026-09-25). 주소에 탭·조회 조건이 있으면(기존 링크) 펴서 연다.
  const [details, setDetails] = useState(
    // ⚠️ 기본값과 **다른지**로 가른다 — 기본 queue 가 'p0' 라 「값이 있나」로 보면 늘 펴졌다(실측 2026-09-25).
    (Object.keys(DEFAULT_SOURCE_STATE) as (keyof SourceWorkspaceState)[]).some(
      (k) => initialState[k] !== DEFAULT_SOURCE_STATE[k],
    ),
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const consoleRef = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const tabs = useRef<Partial<Record<SourceView, HTMLButtonElement | null>>>({})
  const rows = filterSources(inventory.rows, state)
  const selected = inventory.rows.find((row) => row.source === state.source)
  const attention = inventory.rows.filter((row) => sourceClues(row).length > 0).length
  const unjudged = inventory.rows.filter((row) => row.judged < row.total).length
  useEffect(() => {
    const restore = () =>
      setState(parseSourceWorkspace(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function update(patch: Partial<SourceWorkspaceState>, replace = false) {
    const next = { ...state, ...patch }
    setState(next)
    window.history[replace ? 'replaceState' : 'pushState'](
      window.history.state,
      '',
      sourceWorkspaceHref(next)
    )
    if (patch.view && patch.view !== state.view)
      requestAnimationFrame(() => tabs.current[patch.view!]?.focus())
  }
  function select(source: string, button: HTMLButtonElement) {
    trigger.current = button
    update({ source })
    requestAnimationFrame(() => heading.current?.focus())
  }
  function tabKey(event: KeyboardEvent, view: SourceView) {
    const keys = Object.keys(SOURCE_VIEWS) as SourceView[]
    const index = keys.indexOf(view)
    const next =
      event.key === 'Home'
        ? keys[0]
        : event.key === 'End'
          ? keys[2]
          : event.key === 'ArrowRight'
            ? keys[(index + 1) % 3]
            : event.key === 'ArrowLeft'
              ? keys[(index + 2) % 3]
              : null
    if (next) {
      event.preventDefault()
      update({ view: next })
      tabs.current[next]?.focus()
    }
  }
  const reset = () => update({ q: '', issue: 'all', sort: 'attention' })
  return (
    <div className={styles.root}>
      {/* 한 화면이 두 걸음을 맡는다 — 「원천 관리」 탭은 글감 모으기, 「적격 판정」 탭은 글감 고르기. */}
      <StepHeader
        step={stepByKey(state.view === 'eligibility' ? 'pick' : 'gather')}
        help={<AdminScreenHelp screen="csat-sources" tab={SOURCE_VIEWS[state.view]} />}
      />
      {live ? (
        <LiveOverview
          initial={live}
          snapshot={{ usable: panel.total.composable, total: panel.total.total, measuredAt: panel.measuredAt }}
          onOpen={() => update({ view: 'eligibility' })}
          onHowTo={() => update({ view: 'operations' })}
          onCounted={(next) => {
            if (next.ok && next.inventory) setInventory(next.inventory)
            if (next.ok && next.pipeline) setPipeline(next.pipeline)
          }}
        />
      ) : (
      <section className={styles.overview} aria-label="판정 현황과 측정 시각">
        <button className={styles.verdict} onClick={() => update({ view: 'eligibility' })}>
          <span>교재에 실을 수 있는 원문</span>
          <span>
            <strong>{panel.total.composable.toLocaleString()}</strong> /{' '}
            {panel.total.total.toLocaleString()}편 <ArrowRight size={16} aria-hidden />
          </span>
          <small>적격 판정과 제외 이유 보기</small>
        </button>
        <div className={styles.freshness}>
          <p>
            <Clock3 size={14} aria-hidden /> 실시간 집계가 아닌 스캔 결과입니다.
          </p>
          <p>
            원천 재고 {inventory.measuredAt.slice(0, 16).replace('T', ' ')} UTC ·{' '}
            {inventory.ageDays}일 전
          </p>
          <p>
            적격 판정 {panel.measuredAt.slice(0, 16).replace('T', ' ')} UTC · {panel.ageDays}일 전
          </p>
          <button onClick={() => update({ view: 'operations' })}>집계 갱신 방법</button>
        </div>
      </section>
      )}
      {pipeline ? (
        <PipelineBoard rows={pipeline} rounds={rounds} nextRound={nextRound} />
      ) : live?.ok && live.pipelineError ? (
        <p className={styles.warning} role="alert">
          {live.pipelineError}. 「지금 다시 세기」를 눌러 다시 시도하세요 — 계속되면 DB 함수 csat_source_pipeline_live 가 있는지 확인합니다.
        </p>
      ) : null}
      <details
        open={details}
        onToggle={(e) => setDetails((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]"
      >
        <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 px-4 font-display text-[13.5px] font-[800] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
          자세히 보기
          <span className="font-body text-[12px] font-[400] text-[var(--t2)]">
            — 관문 7개 · 원천 관리 · 적격 판정(7축 · 학년별 · 유형 재고) · 원문 조회 · 처리 안내
          </span>
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
      {inventory.ageDays >= 7 || panel.ageDays >= 7 || panel.specStale ? (
        <p className={styles.warning} role="status">
          {live?.ok
            ? '맨 위 수와 원천별 표는 지금 DB 기준입니다. 적격 판정 탭의 학년별 표만 스캔 결과(옛 판정 규격)라, 그 표로 처리하기 전에 스캔을 다시 돌리세요.'
            : '집계가 오래되었거나 판정 규격이 바뀌었습니다. 처리 전에 집계를 갱신하세요.'}
        </p>
      ) : null}
      <SourceProcess
        onQuery={({ queue: nextQueue, reason: nextReason }) => {
          update({ view: 'eligibility', queue: nextQueue, reason: nextReason ?? null, source: null })
          // 탭이 바뀌면서 목록이 화면 밖에 열린다 — 눌렀는데 아무 일도 안 난 것처럼 보인다.
          requestAnimationFrame(() => consoleRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
        }}
      />
      <div className={styles.tabs} role="tablist" aria-label="원문 관리 보기">
        {(Object.entries(SOURCE_VIEWS) as [SourceView, string][]).map(([view, label]) => (
          <button
            key={view}
            ref={(el) => {
              tabs.current[view] = el
            }}
            role="tab"
            id={`tab-${view}`}
            aria-controls={`panel-${view}`}
            aria-selected={state.view === view}
            tabIndex={state.view === view ? 0 : -1}
            onClick={() => update({ view })}
            onKeyDown={(event) => tabKey(event, view)}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id="panel-sources"
        aria-labelledby="tab-sources"
        hidden={state.view !== 'sources'}
      >
        <div className={styles.listHeading}>
          <h3>어느 원천을 확인할까요?</h3>
          <p>
            {inventory.rows.length}개 원천 · {inventory.scanned.toLocaleString()}편의 재고 기준{inventoryLive ? '(지금 DB)' : '(스캔 결과)'}.
            적격 판정과 집계 대상이 다를 수 있습니다.
          </p>
        </div>
        <div className={styles.quickFilters} aria-label="빠른 필터">
          {(
            [
              { issue: 'all', label: '모든 원천', count: inventory.rows.length },
              { issue: 'attention', label: '확인할 항목 있음', count: attention },
              { issue: 'unjudged', label: '내용 판정 부족', count: unjudged },
            ] as const
          ).map((item) => (
            <button
              key={item.issue}
              aria-pressed={state.issue === item.issue}
              onClick={() => update({ issue: item.issue })}
            >
              {item.label}
              <b>{item.count}</b>
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            원천 검색
            <span>
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={state.q}
                maxLength={100}
                placeholder="원천 이름 또는 ID"
                onChange={(event) => update({ q: event.target.value }, true)}
              />
            </span>
          </label>
          <div className={styles.field}>
            <label htmlFor="source-issue">확인할 항목</label>
            <select
              id="source-issue"
              value={state.issue}
              onChange={(event) => update({ issue: event.target.value as SourceIssue })}
            >
              {Object.entries(SOURCE_ISSUES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="source-sort">정렬</label>
            <select
              id="source-sort"
              value={state.sort}
              onChange={(event) => update({ sort: event.target.value as SourceSort })}
            >
              {Object.entries(SOURCE_SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.resultLine}>
          <p role="status" aria-live="polite">
            {rows.length}개 원천 · {SOURCE_ISSUES[state.issue]}
            {state.q ? ` · “${state.q}”` : ''}
          </p>
          {state.q || state.issue !== 'all' || state.sort !== 'attention' ? (
            <button onClick={reset}>필터 초기화</button>
          ) : null}
        </div>
        <div className={`${styles.workspace} ${selected ? styles.withDetail : ''}`}>
          <div>
            {rows.length ? (
              <SourceInventoryTable rows={rows} selected={state.source} onSelect={select} />
            ) : (
              <div className={styles.empty}>
                <h3>조건에 맞는 원천이 없습니다</h3>
                <p>검색어나 확인할 항목을 바꿔 보세요.</p>
                <button onClick={reset}>전체 원천 보기</button>
              </div>
            )}
          </div>
          {selected ? (
            <SourceDetail
              row={selected}
              headingRef={heading}
              onClose={() => {
                update({ source: null })
                requestAnimationFrame(() =>
                  trigger.current?.isConnected
                    ? trigger.current.focus()
                    : tabs.current.sources?.focus()
                )
              }}
              onCriteria={() => update({ view: 'eligibility', queue: 'all', reason: null })}
            />
          ) : null}
        </div>
        {state.source && !selected ? (
          <p className={styles.empty}>
            이 집계에 없는 원천입니다.{' '}
            <button onClick={() => update({ source: null })}>선택 해제</button>
          </p>
        ) : null}
        <p className={styles.footnote}>
          확인할 항목은 서로 겹칠 수 있습니다. 학령 분석·내용 판정의 기록 유무는 교재 적격 통과를
          뜻하지 않습니다.
        </p>
      </section>
      <section
        className={styles.reference}
        role="tabpanel"
        id="panel-eligibility"
        aria-labelledby="tab-eligibility"
        hidden={state.view !== 'eligibility'}
      >
        <div className={styles.listHeading}>
          <h3>교재에 사용할 수 있는 이유와 제외되는 이유</h3>
          <p>조판은 일곱 축의 판정을 통과한 원문만 받습니다. 수집 상태와는 별개의 기준입니다.</p>
        </div>
        {/* 조건으로 찾는 자리(2026-09-23). 아래 `SourceOperations` 는 사유 분해·재검증 등
            **작업 흐름**을 쥐고 있어 그대로 둔다 — 조회와 처리는 같은 탭의 다른 층이다. */}
        <div ref={consoleRef}>
          <SourceQueryConsole
            queue={state.queue}
            onQueue={queue => update({ queue, reason: null })}
            reason={state.reason}
            onReason={reason => update({ reason })}
          />
        </div>
        <details><summary>사유 분해와 원문 재검증</summary>
          <SourceOperations queue={state.queue} onQueue={queue => update({ queue, reason: null })} reason={state.reason} onReason={reason => update({ reason })} source={state.source} onSourceClear={() => update({ source: null })} />
        </details>
        <details><summary>전체 판정 기준과 집계 상세</summary>{eligibility}</details>
      </section>
      <section
        className={styles.reference}
        role="tabpanel"
        id="panel-operations"
        aria-labelledby="tab-operations"
        hidden={state.view !== 'operations'}
      >
        <div className={styles.listHeading}>
          <h3>확인한 문제에 맞는 처리 절차</h3>
          <p>
            이 화면에서는 데이터가 변경되지 않습니다. 실행 전 각 절차의 대상과 재실행 조건을
            확인하세요.
          </p>
        </div>
        <section className={styles.refresh}>
          <h4>집계 갱신</h4>
          <p>
            두 명령은 DB를 읽고 로컬 스냅샷을 갱신합니다. 재실행할 수 있으며, 완료 후 화면을
            새로고침하세요.
          </p>
          <p>원천 재고</p>
          <code>{inventory.refreshCommand}</code>
          <p>적격 판정</p>
          <code>pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs</code>
        </section>
        {operations}
      </section>
        </div>
      </details>
    </div>
  )
}
