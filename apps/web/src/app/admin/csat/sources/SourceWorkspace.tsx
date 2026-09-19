// apps/web/src/app/admin/csat/sources/SourceWorkspace.tsx
'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Search, ArrowRight, Clock3 } from 'lucide-react'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
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
  sourceViewForKey,
  type SourceWorkspaceState,
  type SourceView,
  type SourceIssue,
  type SourceSort,
} from '@/lib/textbook/source-workspace'
import { CorpusCoverage } from './CorpusCoverage'
import type { CorpusCoverageData, SourceDiscoveryProfiles } from '@/lib/textbook/corpus-coverage'
import { SourceInventoryTable, SourceDetail } from './SourceInventoryTable'
import styles from './sources.module.css'
import { SourceOperations, SourceQueueSummary } from './SourceOperations'
import type { SourceQueue } from '@/lib/textbook/source-operations'

export function SourceWorkspace({
  panel,
  inventory,
  initialState = DEFAULT_SOURCE_STATE,
  eligibility,
  operations,
  coverage,
  discoveryProfiles,
}: {
  panel: SourceEligibilityPanel
  inventory: SourceInventoryPanel
  initialState?: SourceWorkspaceState
  eligibility: ReactNode
  operations: ReactNode
  coverage?: CorpusCoverageData
  discoveryProfiles?: SourceDiscoveryProfiles
}) {
  const usableCount = coverage?.usable.reduce((sum, cell) => sum + cell.count, 0)
  const conditionalCount = coverage?.conditional.reduce((sum, cell) => sum + cell.count, 0)
  const [state, setState] = useState(initialState)
  const [queue, setQueue] = useState<SourceQueue>('p0')
  const heading = useRef<HTMLHeadingElement>(null)
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
    const next = sourceViewForKey(view, event.key)
    if (next) {
      event.preventDefault()
      update({ view: next })
      tabs.current[next]?.focus()
    }
  }
  const reset = () => update({ q: '', issue: 'all', sort: 'attention' })
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>재료 · 원문 관리</p>
          <h2>원문 적격</h2>
          <p className={styles.description}>
            원천의 준비 상태를 확인하고, 검수가 필요한 원문으로 이동하세요.
          </p>
        </div>
        <AdminScreenHelp screen="csat-sources" tab={SOURCE_VIEWS[state.view]} />
      </header>
      <SourceQueueSummary
        onSelect={(q) => {
          setQueue(q)
          update({ view: 'eligibility' })
        }}
      />
      <section className={styles.overview} aria-label="판정 현황과 측정 시각">
        <button className={styles.verdict} onClick={() => update({ view: 'eligibility' })}>
          <span>
            {coverage ? '현재 스냅샷에서 사용 가능 원문' : '이전 스캔의 조판 후보(조건부 포함)'}
          </span>
          <span>
            <strong>{(usableCount ?? panel.total.composable).toLocaleString('ko-KR')}</strong>편
            <ArrowRight size={16} aria-hidden />
          </span>
          {conditionalCount !== undefined ? (
            <small>
              조건부 발췌 {conditionalCount.toLocaleString('ko-KR')}편 · 발췌 조건 확인이 필요하며
              사용 가능 수에 포함하지 않습니다.
            </small>
          ) : (
            <small>이전 스캔 후보는 사용 가능 원문과 조건부 발췌를 합한 수입니다.</small>
          )}
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
          {coverage ? (
            <p>현재 판정 분포 {coverage.measuredAt.slice(0, 19).replace('T', ' ')} UTC</p>
          ) : null}
          <p>
            이전 상세 스캔 {panel.measuredAt.slice(0, 16).replace('T', ' ')} UTC · {panel.ageDays}일
            전
          </p>
          <button onClick={() => update({ view: 'operations' })}>집계 갱신 방법</button>
        </div>
      </section>
      {inventory.ageDays >= 7 || panel.ageDays >= 7 || panel.specStale ? (
        <p className={styles.warning} role="status">
          집계가 오래되었거나 판정 규격이 바뀌었습니다. 처리 전에 집계를 갱신하세요.
        </p>
      ) : null}
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
            {inventory.rows.length}개 원천 · {inventory.scanned.toLocaleString()}편의 재고 기준.
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
                  trigger.current?.isConnected && !trigger.current.closest('[hidden]')
                    ? trigger.current.focus()
                    : tabs.current.sources?.focus()
                )
              }}
              onCriteria={() => update({ view: 'eligibility' })}
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
        <SourceOperations queue={queue} onQueue={setQueue} />
        <details>
          <summary>전체 판정 기준과 집계 상세</summary>
          {eligibility}
        </details>
      </section>
      <section
        role="tabpanel"
        id="panel-coverage"
        aria-labelledby="tab-coverage"
        hidden={state.view !== 'coverage'}
      >
        <CorpusCoverage
          data={coverage}
          profiles={discoveryProfiles}
          onSource={(source, button) => {
            trigger.current = button
            update({ source, view: 'sources', q: '', issue: 'all' })
            requestAnimationFrame(() => heading.current?.focus())
          }}
        />
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
  )
}
