// apps/web/src/app/admin/csat/sources/SourceProcess.tsx
//
// **지금 해야 할 작업 — 공정 한 줄기.**
//
// 앞선 화면은 작업 6항목을 각각 5줄 산문으로 냈다(이유·다음·전제·확인·영향). 읽히지 않았고,
// 같은 재고 31,220편이 「미판정 내용 검토」와 「미절단 원본」 두 줄에 겹쳐 서로 반대되는
// 처방을 달고 있었다. 여기서는 **관문 한 줄에 한 줄씩** 적는다 — 순서·걸린 수·무엇이 여는가.
//
// 숫자는 전부 **누를 수 있다.** 누르면 아래 조회 콘솔이 그 조건으로 걸린다(`onQuery`).
// 「현황 숫자를 보고 그 원문을 어떻게 보지?」가 이 화면의 가장 잦은 막다른 길이었다.

'use client'

import useSWR from 'swr'
import { ArrowRight } from 'lucide-react'

import {
  SOURCE_QUEUES,
  type SourceQueue,
  type SourceBreakdownReason,
  type SourceMetric,
} from '@/lib/textbook/source-operations'
import { buildSourceProcess, type SourceGate, type SourceGateBy } from '@/lib/textbook/source-process'
import styles from './source-process.module.css'

const API = '/api/admin/csat/sources'
const n = (v: number) => v.toLocaleString()

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? '집계를 읽지 못했습니다.')
  return data as T
}

type Summary = {
  counts: Record<SourceQueue, number>
  metrics: Record<SourceQueue, SourceMetric>
  measuredAt: string | null
  policyVersion: number
}
type Breakdown = { reasons: Record<SourceBreakdownReason, number> }

/** 열리는 방식의 이름. 「지금 돌릴 수 있는 것」과 「정책이 있어야 열리는 것」을 가른다. */
const BY_LABEL: Record<SourceGateBy, string> = {
  drain: '드레인으로 열림',
  investigate: '표본 확인 필요',
  policy: '정책 결정 필요',
  closed: '열리지 않음',
}

/** `opens` 안의 `**강조**` 를 굵게 — 한 줄 안에서 가장 비싼 오해만 굵게 둔다. */
function Emphasised({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>,
      )}
    </>
  )
}

export function SourceProcess({
  onQuery,
}: {
  onQuery: (target: { queue: SourceQueue; reason?: SourceBreakdownReason }) => void
}) {
  const { data, error, mutate: retry } = useSWR<Summary>(`${API}?summary=1`, get)
  const { data: breakdown } = useSWR<Breakdown>(`${API}?breakdown=all`, get)

  if (error)
    return (
      <p className={styles.notice} role="alert">
        공정 집계를 읽지 못했습니다. <button type="button" onClick={() => void retry()}>다시 읽기</button>
      </p>
    )
  if (!data)
    return (
      <p className={styles.notice} role="status">
        원문이 어느 관문에 걸려 있는지 세고 있습니다.
      </p>
    )

  const r = breakdown?.reasons
  const view = buildSourceProcess({
    intake: data.counts.all,
    analysisIncomplete: data.counts.analysis,
    rawPendingExtraction: data.counts.raw,
    contentUnjudged: data.counts.content,
    contentRejected: r?.content_rejected ?? 0,
    cefrAboveBand: data.counts.cefr,
    qualitySignals: data.counts.quality,
    rejectedWithItems: data.counts.p0,
    eligible: data.counts.eligible,
    ready: data.counts.ready,
  })

  const measured = data.measuredAt?.slice(0, 16).replace('T', ' ') ?? '미측정'

  return (
    <section className={styles.root} aria-label="지금 해야 할 작업">
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>PROCESS</p>
          <h3>지금 해야 할 작업</h3>
        </div>
        <p className={styles.lead}>
          원문 한 편이 교재 재료가 되기까지 관문 {view.totalGates}개를 지납니다. 지금 재고가 걸린 곳은{' '}
          {view.gates.length}개라 번호가 건너뜁니다 — 빠진 번호는 걸린 원문이 없다는 뜻입니다.{' '}
          <b>숫자를 누르면 그 원문 목록이 아래에 열립니다.</b>
        </p>
      </div>

      {/* ── 들어온 것 → 나간 것 ──────────────────────────────────────────── */}
      <div className={styles.ledger}>
        <button type="button" className={styles.ledgerCell} onClick={() => onQuery({ queue: 'all' })}>
          <span>판정 대상</span>
          <b>{n(view.intake)}</b>
          <small>조판 후보 전량</small>
        </button>
        <ArrowRight className={styles.ledgerArrow} size={16} aria-hidden="true" />
        <button type="button" className={styles.ledgerCell} onClick={() => onQuery({ queue: 'eligible' })}>
          <span>관문 통과</span>
          <b>{n(view.eligible)}</b>
          <small>{view.intake ? ((view.eligible / view.intake) * 100).toFixed(1) : '0'}%</small>
        </button>
        <ArrowRight className={styles.ledgerArrow} size={16} aria-hidden="true" />
        <button
          type="button"
          className={styles.ledgerCell}
          data-zero={view.ready === 0 ? 'true' : undefined}
          onClick={() => onQuery({ queue: 'ready' })}
        >
          <span>적격 · 재료 있음</span>
          <b>{n(view.ready)}</b>
          <small>실제로 교재로 넘길 수 있는 몫</small>
        </button>
      </div>

      {view.ready === 0 && view.eligible > 0 ? (
        <p className={styles.alarm} role="status">
          관문을 통과한 {n(view.eligible)}편 중 <b>교재 재료 태그가 실린 것이 하나도 없습니다.</b>{' '}
          재료를 적은 원문은 있지만(
          <button type="button" className={styles.inlineLink} onClick={() => onQuery({ queue: 'tagged' })}>
            {n(data.counts.tagged)}편
          </button>
          ) 전부 아래 관문에서 막혀 있습니다 — 재료 거르개로 찾으면 교재에 못 쓰는 원문만 나옵니다.
        </p>
      ) : null}

      {/* ── 관문 ─────────────────────────────────────────────────────────── */}
      <ol className={styles.gates}>
        {view.gates.map((gate) => (
          <li key={gate.id}>
            <GateRow
              gate={gate}
              intake={view.intake}
              isBottleneck={view.bottleneck?.id === gate.id}
              onQuery={onQuery}
            />
          </li>
        ))}
      </ol>

      <p className={styles.caption}>
        {/* 이 문장을 지우면 화면이 곧 합계를 그리게 된다. */}
        관문은 서로 겹칩니다 — 한 원문이 추출 대기이면서 학령 초과일 수 있습니다.{' '}
        <b>걸린 편수는 합산하지 않습니다.</b> 가장 오래된 측정 {measured} UTC · 정책 v{data.policyVersion}
      </p>
    </section>
  )
}

function GateRow({
  gate,
  intake,
  isBottleneck,
  onQuery,
}: {
  gate: SourceGate
  intake: number
  isBottleneck: boolean
  onQuery: (target: { queue: SourceQueue; reason?: SourceBreakdownReason }) => void
}) {
  const pct = intake ? (gate.stuck / intake) * 100 : 0
  return (
    <button type="button" className={styles.gate} data-by={gate.by} onClick={() => onQuery(gate.target)}>
      <span className={styles.gateStep}>{gate.step}</span>

      <span className={styles.gateBody}>
        <span className={styles.gateTop}>
          <strong>{gate.name}</strong>
          {isBottleneck ? <em className={styles.flag}>지금 가장 큰 병목</em> : null}
          <span className={styles.by}>{BY_LABEL[gate.by]}</span>
        </span>
        <span className={styles.gateOpens}>
          <Emphasised text={gate.opens} />
        </span>
        {/* 막대는 분모가 판정 대상 전량이다 — 관문끼리 비교하라고 그린다. */}
        <span className={styles.bar} aria-hidden="true">
          <span style={{ width: `${Math.min(100, pct)}%` }} />
        </span>
      </span>

      <span className={styles.gateCount}>
        <b>{n(gate.stuck)}</b>
        <small>{pct.toFixed(1)}%</small>
        <em>
          {SOURCE_QUEUES[gate.target.queue]} 보기 <ArrowRight size={12} aria-hidden="true" />
        </em>
      </span>
    </button>
  )
}
