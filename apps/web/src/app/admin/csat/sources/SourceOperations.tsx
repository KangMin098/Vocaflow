// apps/web/src/app/admin/csat/sources/SourceOperations.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { SOURCE_QUEUES, SOURCE_REASON_LABELS, SOURCE_BREAKDOWN_REASONS, buildSourceWorkQueue, sourceNextAction, type SourceQueue, type SourceMetric, type SourceBreakdownReason, type SourceOperationRow, type SourceInspectorData, type SourceNextAction } from '@/lib/textbook/source-operations'
import styles from './source-operations.module.css'

const API = '/api/admin/csat/sources'
async function get<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? '정보를 읽지 못했습니다.')
  return data as T
}
type Summary = { counts: Record<SourceQueue, number>; metrics: Record<SourceQueue, SourceMetric>; measuredAt: string | null; policyVersion: number }
const label = (code: string) => SOURCE_REASON_LABELS[code] ?? code
const number = (value: number) => value.toLocaleString()
function ActionGuidance({ action }: { action: SourceNextAction }) {
  return <section className={styles.guidance} aria-label="이 원문의 다음 작업">
    <span>{action.kind.toUpperCase()} · 다음 작업</span><h4>{action.what}</h4>
    <p><b>이유</b> {action.why}</p><p><b>영향</b> {action.impact}</p>
    <p><b>다음</b> {action.next}</p><p><b>확인</b> {action.verify}</p>
  </section>
}

export function SourceActionQueue({ onSelect }: { onSelect: (queue: SourceQueue, reason?: SourceBreakdownReason) => void }) {
  const { data, error, mutate: retry } = useSWR<Summary>(`${API}?summary=1`, get)
  if (error) return <p className={styles.notice} role="alert">작업 집계를 읽지 못했습니다. <button onClick={() => void retry()}>다시 읽기</button></p>
  if (!data) return <p className={styles.notice} role="status">지금 확인할 작업을 계산하고 있습니다.</p>
  const items = buildSourceWorkQueue(data.counts)
  return <section className={styles.actionQueue} aria-label="지금 해야 할 작업">
    <div className={styles.sectionHead}><div><span>STATUS → ACTION</span><h3>지금 해야 할 작업</h3></div><p>문항 연결과 정책 차단을 먼저 확인합니다. 각 대상은 겹칠 수 있습니다.</p></div>
    {items.length ? <ol>{items.map(item => <li key={item.id}>
      <button onClick={() => onSelect(item.queue, item.reason)}>
        <span className={styles.actionMeta}><b>{item.priority}</b> · {item.kind.toUpperCase()} · {number(item.count)}편</span>
        <strong>{item.title}</strong>
        <span>{item.why}</span>
        <small>다음: {item.next}</small>
        <small>전제: {item.dependency} · 확인: {item.verify}</small>
        <em>대상 원문 보기 →</em>
      </button>
    </li>)}</ol> : <p>현재 정의된 작업 대상이 없습니다. 전체 원문에서 최신 판정을 확인하세요.</p>}
    <p className={styles.caption}>대상 편수는 정책 캐시의 범위별 수치입니다. 작업 가능 편수나 처리 완료 편수로 해석하지 않습니다. 가장 오래된 측정 {data.measuredAt?.slice(0,16).replace('T',' ') ?? '미측정'} UTC · 정책 v{data.policyVersion}</p>
  </section>
}

export function SourceQueueSummary({ onSelect }: { onSelect: (queue: SourceQueue) => void }) {
  const { data, error, mutate: retry } = useSWR<Summary>(`${API}?summary=1`, get)
  if (error) return <p className={styles.notice} role="status">운영 집계 연결 실패. <button onClick={() => void retry()}>다시 읽기</button></p>
  if (!data) return <p className={styles.notice} role="status">원문별 판정 집계를 읽고 있습니다.</p>
  return <div className={styles.root}>
    <nav className={styles.summary} aria-label="원문 운영 현황">
      {(['all', 'eligible', 'conditional', 'review', 'rejected'] as SourceQueue[]).map(key => <button key={key} title={data.metrics[key].definition} onClick={() => onSelect(key)}>
        <span>{SOURCE_QUEUES[key]}</span><b>{data.counts[key].toLocaleString()}</b>
      </button>)}
      <button title={data.metrics.analyzed.definition} onClick={() => onSelect('analyzed')}><span>분석 완료</span><b>{data.counts.analyzed.toLocaleString()}</b></button>
      <button title={data.metrics.unavailable.definition} onClick={() => onSelect('unavailable')}><span>학습·교재 사용 대기</span><b>{data.counts.unavailable.toLocaleString()}</b></button>
      <button title={data.metrics.p0.definition} onClick={() => onSelect('p0')}><span>반려 · 문항 연결</span><b>{data.counts.p0.toLocaleString()}</b></button>
    </nav>
    <p className={styles.caption}>원문 정책 v{data.policyVersion} · {data.measuredAt?.slice(0, 16).replace('T', ' ') ?? '미측정'} UTC 기준. 조건부는 문항별 검증이 필요합니다.</p>
  </div>
}

export function SourceOperations({ queue, onQueue, reason, onReason, source, onSourceClear }: { queue: SourceQueue; onQueue: (queue: SourceQueue) => void; reason: SourceBreakdownReason | null; onReason: (reason: SourceBreakdownReason | null) => void; source: string | null; onSourceClear: () => void }) {
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const selectedHeading = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [showReasons, setShowReasons] = useState(false)
  const { data: summary } = useSWR<Summary>(`${API}?summary=1`, get)
  useEffect(() => { setPage(0); setSelected(null) }, [queue, term, reason, source])
  const key = `${API}?queue=${queue}&page=${page}&q=${encodeURIComponent(term)}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}${source ? `&source=${encodeURIComponent(source)}` : ''}`
  const { data, error, isLoading, mutate: reload } = useSWR<{ rows: SourceOperationRow[]; count: number }>(key, get)
  const { data: breakdown, error: breakdownError } = useSWR<{ reasons: Record<SourceBreakdownReason, number>; overlap: true }>(showReasons ? `${API}?breakdown=${queue}` : null, get)
  const { data: inspector, error: inspectorError, mutate: reloadInspector } = useSWR<SourceInspectorData>(selected ? `${API}?id=${selected}` : null, get)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { if (inspector) selectedHeading.current?.focus() }, [inspector])
  async function revalidate() {
    if (!selected || busy) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected, action: 'revalidate' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      await Promise.all([reload(), reloadInspector(), mutate(`${API}?summary=1`)])
      setMessage('최신 원문으로 다시 판정했습니다. 원문과 문항은 보존했습니다.')
    } catch (e) { setMessage(e instanceof Error ? e.message : '재검증에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return <div className={styles.root}>
    <div className={styles.queues} aria-label="원문 검토 큐">
      {(Object.entries(SOURCE_QUEUES) as [SourceQueue, string][]).map(([key, name]) => <button key={key} aria-pressed={queue === key} onClick={() => { onQueue(key); onReason(null) }}>{name}</button>)}
    </div>
    <div className={styles.context}>
      <p><b>{SOURCE_QUEUES[queue]}</b> · {queue === 'eligible' ? '원문 정책을 통과했습니다. 문항별 검증은 별도입니다.' : queue === 'conditional' ? '원문은 조건부로 통과했지만 연결 문항의 지문·위치·검수가 필요합니다.' : queue === 'p0' ? '내용 반려 원문에 문항이 연결되어 있습니다. 실제 노출은 검사 기록으로 확인하세요.' : queue === 'rejected' ? '현재 정책에서 사용할 수 없습니다. 법적·내용·학령 사유가 섞일 수 있습니다.' : '사유와 실제 원문을 함께 확인한 뒤 다음 작업을 결정하세요.'}</p>
      {summary ? <p>{summary.metrics[queue].definition} · 분모 {number(summary.metrics[queue].denominator)}편 · 정본 {summary.metrics[queue].sourceOfTruth}</p> : null}
      {source ? <button onClick={onSourceClear}>원천 {source} 필터 해제 ×</button> : null}
      {reason ? <button onClick={() => onReason(null)}>사유 {label(reason)} 필터 해제 ×</button> : null}
      <button aria-expanded={showReasons} onClick={() => setShowReasons(value => !value)}>왜 이 수치인가? 사유별 보기 {showReasons ? '접기' : '펼치기'}</button>
    </div>
    {showReasons ? <div className={styles.breakdown} aria-label="판정 사유별 원문">
      <p>아래는 <b>{SOURCE_QUEUES[queue]} 범위 안의 사유별 편수</b>입니다. 한 원문에 여러 사유가 있어 합산할 수 없습니다.</p>
      {breakdownError ? <p role="alert">사유 집계를 읽지 못했습니다.</p> : breakdown ? <ul>{SOURCE_BREAKDOWN_REASONS.filter(code => breakdown.reasons[code] > 0).map(code => <li key={code}><button aria-pressed={reason === code} onClick={() => onReason(reason === code ? null : code)}><span>{label(code)}</span><b>{number(breakdown.reasons[code])}</b><span>원문 보기 →</span></button></li>)}</ul> : <p role="status">사유별 편수를 읽고 있습니다.</p>}
    </div> : null}
    <form className={styles.search} onSubmit={e => { e.preventDefault(); setTerm(query) }}>
      <label htmlFor="source-title-search">개별 원문 제목</label>
      <input id="source-title-search" value={query} maxLength={160} onChange={e => setQuery(e.target.value)} />
      <button type="submit">찾기</button>
    </form>
    <p className={styles.caption}>문항 연결이 많은 순서입니다. 품질 신호는 오탐을 포함할 수 있으며 자동 반려 사유가 아닙니다.</p>
    {error ? <p role="alert">{error.message} <button onClick={() => void reload()}>다시 읽기</button></p> : null}
    {isLoading ? <p role="status">검토할 원문을 읽고 있습니다.</p> : null}
    <div className={`${styles.workspace} ${selected ? styles.selected : ''}`}>
      <div>
        {data ? <p className={styles.caption}>{SOURCE_QUEUES[queue]}{reason ? ` / ${label(reason)}` : ''}{source ? ` / ${source}` : ''} · {data.count.toLocaleString()}편 · {page + 1}페이지</p> : null}
        <ol className={styles.list} aria-label="개별 원문 목록">
          {data?.rows.map(row => <li key={row.article_id}><button aria-pressed={selected === row.article_id} onClick={e => { trigger.current = e.currentTarget; setSelected(row.article_id); setMessage('') }}>
            <span className={styles.title} lang="en">{row.input.title}</span>
            <span>{row.source} · V{row.input.articleVLevel ?? '?'} · {row.input.cefrLevel ?? 'CEFR 미측정'} · 문항 {row.linked_items.toLocaleString()}개</span>
            <small>{row.result.reasons.slice(0, 2).map(label).join(' · ')}</small>
            <small>다음: {sourceNextAction(row).what}</small>
          </button></li>)}
        </ol>
        {data?.count === 0 ? <p>해당 원문이 없습니다. <button onClick={() => { setQuery(''); setTerm(''); onQueue('all') }}>전체 후보 보기</button></p> : null}
        <div className={styles.pager}>
          <button disabled={page === 0 || isLoading} onClick={() => setPage(n => n - 1)}>이전</button>
          <button disabled={!data || (page + 1) * 30 >= data.count || isLoading} onClick={() => setPage(n => n + 1)}>다음</button>
        </div>
      </div>
      {selected ? <aside className={styles.inspector} aria-label="원문 검사">
        <button onClick={() => { setSelected(null); trigger.current?.focus() }}>원문 검사 닫기</button>
        {inspectorError ? <p role="alert">{inspectorError.message}</p> : null}
        {!inspector && !inspectorError ? <p role="status">원문과 연결 정보를 읽고 있습니다.</p> : null}
        {inspector && inspector.row.article_id === selected ? <>
          <h3 ref={selectedHeading} tabIndex={-1} lang="en" className={styles.title}>{inspector.currentInput.title}</h3>
          <p>{inspector.current.status === 'eligible' ? '적격' : inspector.current.status === 'conditional' ? '조건부 사용' : inspector.current.status === 'review' ? '검토 필요 · 사용 대기' : '학습·교재 사용 불가'}</p>
          <ActionGuidance action={sourceNextAction({ ...inspector.row, result: inspector.current, linked_items: inspector.linkedItems }, inspector.stale)} />
          {inspector.stale ? <p role="status">원문이 캐시보다 새롭습니다. 재검증 전에는 학습에 사용할 수 없습니다.</p> : null}
          <h4>판정 근거</h4>
          <ul>{inspector.current.reasons.map(reason => <li key={reason}>{label(reason)}</li>)}</ul>
          <details><summary>분석과 미측정 항목</summary><p>V{inspector.currentInput.articleVLevel ?? '?'} · {inspector.currentInput.cefrLevel ?? 'CEFR 없음'} · {inspector.currentInput.wordCount ?? '?'}어 · 내용 {inspector.current.contentStatus}</p><ul>{inspector.current.warnings.map(x => <li key={x}>{label(x)}</li>)}</ul></details>
          <details><summary>실제 원문</summary><div lang="en" className={styles.body} tabIndex={0} role="region" aria-label="원문 본문">{inspector.content}</div></details>
          <details><summary>발췌 후보와 범위</summary><p>{inspector.current.excerptStatus} · 창 {inspector.windows.length}개 · 승인된 범위로 간주하지 않습니다.</p><pre tabIndex={0}>{JSON.stringify(inspector.row.excerpt_evidence, null, 2)}</pre><pre tabIndex={0}>{JSON.stringify(inspector.windows.slice(0, 30), null, 2)}</pre></details>
          <details><summary>연결 문항 · 교재 · 학습 기록</summary>
            <p>문항 {inspector.linkedItems.toLocaleString()}개 · 시도 기록 {inspector.attempts == null ? '조회 불가' : inspector.attempts + '건'}</p>
            <p>현재 manifest에서 확인한 교재 {inspector.renders.length}권. {inspector.historicalRendersUnknown ? '과거 기록에는 manifest가 없어 이전 인쇄·노출 여부는 알 수 없습니다.' : '이 수치는 보존된 manifest 범위입니다.'}</p>
            <p>아래는 연결 문항 최대 30개입니다.</p><ul>{inspector.items.map(item => <li key={item.id}>{item.type} · 문단 {item.paragraph_idx} · <code>{item.id}</code></li>)}</ul>
          </details>
          <details><summary>본문 품질 검토 신호</summary><p>{inspector.row.quality_flags.length ? inspector.row.quality_flags.join(' · ') : '자동 규칙 적중 없음 — 품질 승인과는 다릅니다.'}</p></details>
          <details><summary>판정 이력</summary><p>현재 규격 v{inspector.row.policy_version} · {inspector.row.measured_at}</p>{inspector.history.length ? inspector.history.map(h => <details key={h.id}><summary>{h.replaced_at}</summary><pre tabIndex={0}>{JSON.stringify(h.previous, null, 2)}</pre></details>) : <p>이전 캐시 판정 이력이 없습니다. 과거 내용 판정은 원문 메타데이터에 보존됩니다.</p>}</details>
          <button disabled={busy} onClick={() => void revalidate()}>{busy ? '재검증 중' : '최신 원문으로 재검증'}</button>
          <p role="status">{message}</p>
        </> : null}
      </aside> : null}
    </div>
  </div>
}
