// apps/web/src/app/admin/db/page.tsx
//
// /admin/db — DB 헬스. 3층(수집·판정·조치) 중 **조치**.
//
// 이 화면은 계산하지 않는다. 수집은 pg_cron(`collect_db_health_metrics`)이,
// 판정은 DB 밖 `/db-health-audit` 이 이미 끝내 놓았다. 화면은 그 둘을 읽어 **다음에 무엇을
// 할지**만 보여 준다 — 화면이 다시 판정하면 같은 숫자를 두 곳에서 판단하게 되고 두 곳이 갈린다.
//
// 화면이 스스로 말하는 것은 딱 하나, **"수집이 멈췄다"** 이다.
// 수집이 멈추면 아래 숫자가 전부 과거의 것인데 화면은 그것을 최신처럼 그린다.
// 판정층은 DB 밖에 있어서, 판정층 자신이 안 돌면 이것도 못 적는다.
//
// 차트를 쓰지 않는 이유: 스냅샷이 4회 미만이면 선을 그릴 것이 없다. 2점을 이은 선은
// 추세가 아니라 장식이고, 장식은 없는 확신을 준다. 이력이 쌓이면 자동으로 선이 붙는다.

import {
  AlertOctagon,
  AlertTriangle,
  Database,
  HardDrive,
  Info,
  ShieldAlert,
} from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  TREND_MIN_POINTS,
  countBySeverity,
  delta,
  formatAge,
  formatValue,
  headlineSeries,
  hoursSince,
  isCollectionStale,
  latestAt,
  openByAxis,
  snapshotCount,
  sortFindings,
  tableGrowth,
  toSeries,
} from '@/lib/admin/db-health/derive'
import { STALE_AFTER_HOURS, fetchDbHealth } from '@/lib/admin/db-health/queries'
import {
  AXIS_LABEL,
  HEALTH_AXES,
  METRIC_LABEL,
  METRIC_UNIT,
  SEVERITY_LABEL,
  STATUS_LABEL,
} from '@/lib/admin/db-health/types'
import type { FindingRow, FindingSeverity, MetricSeries } from '@/lib/admin/db-health/types'

import { CollectButton } from './CollectButtons'
import { CopySqlButton, StatusButtons } from './FindingActions'

export const metadata = {
  title: 'DB 헬스 — Admin',
  description: 'DB 인프라 6축 스냅샷 + 판정 결과 (db_health_metrics · db_health_findings)',
}

export const dynamic = 'force-dynamic'

/**
 * 심각도 표시 — **색만으로 말하지 않는다**(색맹 대응). 아이콘 + 한글 라벨이 항상 함께 간다.
 * 상태색 토큰은 대비비가 검증된 것만 쓴다(packages/design-tokens/src/tokens.css).
 */
const SEVERITY_STYLE: Record<
  FindingSeverity,
  { Icon: typeof AlertOctagon; bg: string; ink: string }
> = {
  critical: { Icon: AlertOctagon, bg: 'var(--error-light)', ink: 'var(--error-ink)' },
  warning: { Icon: AlertTriangle, bg: 'var(--warning-light)', ink: 'var(--warning-ink)' },
  info: { Icon: Info, bg: 'var(--info-light)', ink: 'var(--info-ink)' },
}

/** 점이 충분할 때만 그린다. 그 전에는 아예 그리지 않고 몇 번 더 모으면 되는지 말한다. */
function Trend({ points }: { points: number[] }) {
  if (points.length < TREND_MIN_POINTS) {
    return (
      <p className="shrink-0 break-keep text-right font-body text-[11px] text-[var(--t2)]">
        {`수집 ${points.length}회`}
        <br />
        {`추세는 ${TREND_MIN_POINTS}회부터`}
      </p>
    )
  }
  const w = 132
  const h = 34
  const pad = 3
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const coords = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} aria-hidden="true" className="shrink-0">
      <polyline
        points={coords}
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

function Kpi({
  label,
  value,
  tone,
  note,
}: {
  label: string
  value: string
  tone?: FindingSeverity
  note: string
}) {
  const style = tone ? SEVERITY_STYLE[tone] : null
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
      <p className="flex items-center gap-1.5 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
        {style && <style.Icon size={12} strokeWidth={2.5} aria-hidden="true" style={{ color: style.ink }} />}
        {label}
      </p>
      <p
        className="mt-1 font-display text-[28px] font-[800] tracking-tight"
        style={{ color: style && value !== '0' ? style.ink : 'var(--t1)' }}
      >
        {value}
      </p>
      <p className="mt-0.5 break-keep font-body text-[11px] text-[var(--t2)]">{note}</p>
    </div>
  )
}

function FindingCard({ finding, actionable = true }: { finding: FindingRow; actionable?: boolean }) {
  const { Icon, bg, ink } = SEVERITY_STYLE[finding.severity]
  const evidence = finding.evidence ?? {}
  const openedHours = hoursSince(finding.first_seen_at, new Date())
  return (
    <article className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4 transition-shadow duration-[var(--dur-normal)] ease-[var(--ease)] hover:shadow-[var(--sh-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[700]"
              style={{ background: bg, color: ink }}
            >
              <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
              {SEVERITY_LABEL[finding.severity]}
            </span>
            <span className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)]">
              {AXIS_LABEL[finding.axis] ?? finding.axis}
            </span>
            {finding.status === 'ack' && (
              <span className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)]">
                {STATUS_LABEL.ack}
              </span>
            )}
          </p>
          <h3 className="mt-2 break-keep font-display text-[14px] font-[700] text-[var(--t1)]">
            {finding.title}
          </h3>
          <p className="mt-1.5 break-keep font-body text-[13px] leading-[1.65] text-[var(--t2)]">
            {finding.detail}
          </p>
        </div>
      </div>

      {Object.keys(evidence).length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--bd)] pt-3">
          {Object.entries(evidence).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-1">
              <dt className="font-mono text-[10px] text-[var(--t2)]">{k}</dt>
              <dd className="font-mono text-[11px] font-[600] text-[var(--t2)]">
                {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {finding.suggested_sql && (
        <details className="mt-3 border-t border-[var(--bd)] pt-3">
          <summary className="cursor-pointer font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:text-[var(--t1)]">
            조치 SQL 보기 — 이 화면은 실행하지 않는다
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-[var(--r-sm)] bg-[var(--bg3)] p-3 font-mono text-[11px] leading-[1.6] text-[var(--t1)]">
            {finding.suggested_sql}
          </pre>
          <div className="mt-2">
            <CopySqlButton sql={finding.suggested_sql} />
          </div>
        </details>
      )}

      {finding.note && (
        <p className="mt-3 break-keep border-t border-[var(--bd)] pt-3 font-editorial text-[12px] italic leading-[1.7] text-[var(--t2)]">
          {finding.note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] pt-3">
        <p className="break-keep font-body text-[11px] text-[var(--t2)]">
          처음 본 것 {openedHours === null ? '기록 없음' : formatAge(openedHours)} · 관측{' '}
          {finding.occurrences}회
        </p>
        {actionable && <StatusButtons id={finding.id} status={finding.status} />}
      </div>
    </article>
  )
}

function MetricCard({ series }: { series: MetricSeries }) {
  const latest = series.points[series.points.length - 1]
  const d = delta(series)
  const unit = METRIC_UNIT[series.metric]
  const dims = latest.dims ?? {}
  return (
    <article className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4 transition-shadow duration-[var(--dur-normal)] ease-[var(--ease)] hover:shadow-[var(--sh-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-keep font-display text-[13px] font-[600] text-[var(--t1)]">
            {METRIC_LABEL[series.metric] ?? series.metric}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
              {formatValue(latest.value, unit)}
            </span>
            {d === null ? (
              <span className="font-body text-[12px] text-[var(--t2)]">비교할 직전 값 없음</span>
            ) : d === 0 ? (
              <span className="font-body text-[12px] text-[var(--t2)]">변동 없음</span>
            ) : (
              <span className="font-body text-[12px] text-[var(--t2)]">
                {d > 0 ? '▲' : '▼'} {formatValue(Math.abs(d), unit)} (전회 대비)
              </span>
            )}
          </p>
        </div>
        <Trend points={series.points.map((p) => p.value)} />
      </div>
      {Object.keys(dims).length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--bd)] pt-3">
          {Object.entries(dims)
            // 목록형 dims 는 길어서 카드를 무너뜨린다 — 개수만 적고 상세는 발견 카드가 말한다.
            .map(([k, v]) => [k, Array.isArray(v) ? `${v.length}건` : v] as const)
            .filter(([, v]) => typeof v !== 'object' || v === null)
            .map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-1">
                <dt className="font-mono text-[10px] text-[var(--t2)]">{k}</dt>
                <dd className="font-mono text-[11px] font-[600] text-[var(--t2)]">
                  {v === null ? '—' : String(v)}
                </dd>
              </div>
            ))}
        </dl>
      )}
    </article>
  )
}

export default async function AdminDbPage() {
  const { metrics, findings, excepted, metricsError, findingsError, recentlyResolved } =
    await fetchDbHealth()

  const series = toSeries(metrics)
  const now = new Date()
  const dailyRows = metrics.filter((r) => r.axis !== 'integrity')
  const dailyLatest = latestAt(dailyRows)
  const weeklyLatest = latestAt(metrics, 'integrity')
  const stale = isCollectionStale(dailyLatest, now, STALE_AFTER_HOURS)
  const dailyAge = hoursSince(dailyLatest, now)
  const weeklyAge = hoursSince(weeklyLatest, now)

  const sorted = sortFindings(findings)
  const counts = countBySeverity(findings)
  const byAxis = openByAxis(findings)
  const growth = tableGrowth(series, 10)

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="inline-flex items-center gap-3 font-display text-[28px] font-[800] text-[var(--t1)]">
            <Database size={26} className="text-[#8B5CF6]" aria-hidden="true" /> DB 헬스
          </h1>
          <p className="mt-2 max-w-[46ch] break-keep font-body text-[14px] text-[var(--t2)]">
            수집은 pg_cron 이, 판정은 DB 밖 <code className="font-mono text-[13px]">/db-health-audit</code> 가
            한다. 이 화면은 그 결과를 읽고 조치 SQL 을 건네줄 뿐 아무것도 실행하지 않는다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-3">
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-right">
            <p className="font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              최근 수집
            </p>
            <p className="mt-0.5 font-body text-[13px] text-[var(--t1)]">
              {dailyLatest ? new Date(dailyLatest).toLocaleString('ko-KR') : '기록 없음'}
            </p>
            <p className="font-body text-[11px] text-[var(--t2)]">
              5축 {snapshotCount(dailyRows)}회 · 정밀 {snapshotCount(metrics, 'integrity')}회
              {weeklyAge !== null && ` (${formatAge(weeklyAge)})`}
            </p>
          </div>
          <CollectButton
            rpc="admin_collect_db_health_metrics"
            label="지금 수집"
            loadingLabel="수집 중…"
            hint="5축 · 몇 초"
            variant="primary"
          />
          <CollectButton
            rpc="admin_collect_db_health_integrity"
            label="정밀 점검"
            loadingLabel="점검 중…"
            hint="함수 128개 정적 분석 · 수십 초"
            variant="ghost"
          />
        </div>
      </header>

      <AdminScreenHelp screen="db" className="-mt-4" />

      {/* 화면이 스스로 판정하는 유일한 항목 — 수집이 멈추면 아래 숫자가 전부 과거의 것이다. */}
      {stale && (
        <section
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] p-5"
          style={{ background: 'var(--warning-light)' }}
        >
          <ShieldAlert
            size={20}
            strokeWidth={2}
            aria-hidden="true"
            style={{ color: 'var(--warning-ink)' }}
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p
              className="break-keep font-display text-[14px] font-[700]"
              style={{ color: 'var(--warning-ink)' }}
            >
              {dailyLatest
                ? `수집이 ${STALE_AFTER_HOURS}시간 넘게 없었어요 (${dailyAge === null ? '기록 없음' : formatAge(dailyAge)})`
                : '수집 기록이 없어요'}
            </p>
            <p className="mt-1 break-keep font-body text-[13px] leading-[1.65] text-[var(--t2)]">
              아래 숫자는 그 시점의 것이지 지금이 아니다. 야간 잡(db-health-daily · KST 03:40)이
              실패했는지 먼저 본다 — “예약 작업” 축의 <em className="font-editorial">24시간 실패</em>가
              그 답을 갖고 있고, 그것도 낡았다면 “지금 수집”을 눌러 되살린다.
            </p>
          </div>
        </section>
      )}

      {(metricsError || findingsError) && (
        <section role="alert" className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5">
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">
            조회가 실패했어요 — 화면의 “—”는 0 이 아니라 <strong>모른다</strong>는 뜻이다. admin
            세션인지 확인해 주세요.
            {metricsError && <span className="ml-1 font-mono text-[11px]">metrics: {metricsError}</span>}
            {findingsError && <span className="ml-1 font-mono text-[11px]">findings: {findingsError}</span>}
          </p>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="치명" value={String(counts.critical)} tone="critical" note="지금 손대야 하는 것" />
        <Kpi label="주의" value={String(counts.warning)} tone="warning" note="이번 주 안에" />
        <Kpi label="참고" value={String(counts.info)} tone="info" note="알고만 있으면 되는 것" />
        <Kpi
          label="최근 해결"
          value={String(recentlyResolved)}
          note="7일간 닫힌 항목 · 재발하면 다시 열린다"
        />
      </section>

      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 font-display text-[16px] font-[700] text-[var(--t1)]">열린 발견</h2>
        {sorted.length === 0 ? (
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-8 text-center">
            <p className="break-keep font-body text-[14px] text-[var(--t2)]">
              열린 항목이 없어요.
            </p>
            <p className="mt-1.5 break-keep font-body text-[13px] text-[var(--t2)]">
              {metrics.length === 0
                ? '아직 수집도 되지 않았어요 — 위 “지금 수집”을 먼저 누르세요.'
                : '판정이 아직 안 돌았을 수도 있어요 — Claude Code 에서 /db-health-audit 을 실행하면 이 목록이 채워집니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        )}
      </section>

      {/* 면제는 숨기지 않고 **접어 둔다.** 안 보이는 면제 목록은 커버리지가 아니라 구멍이다
          (CLAUDE.md — "면제 목록이 길어지면 커버리지가 아니라 면제 목록이 자란다").
          여기 있는 항목은 판정이 틀린 게 아니라 저장소가 이미 "이대로 둔다" 고 결정한 것이다. */}
      {excepted.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
          <details>
            <summary className="cursor-pointer font-display text-[16px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:text-[#8B5CF6]">
              {`면제 ${excepted.length}건 — 이미 결정된 것`}
            </summary>
            <p className="mt-2 max-w-[62ch] break-keep font-body text-[13px] leading-[1.7] text-[var(--t2)]">
              판정이 틀린 것이 아니라 저장소가 이미 「이대로 둔다」고 결정한 항목이다. 사유와
              그 결정이 적힌 자리가 각 항목에 함께 있다 — 근거 없는 면제는 면제가 아니라 은폐다.
            </p>
            <div className="mt-3 space-y-3">
              {excepted.map((f) => (
                <FindingCard key={f.id} finding={f} actionable={false} />
              ))}
            </div>
          </details>
        </section>
      )}

      {HEALTH_AXES.map((axis) => {
        const axisSeries = headlineSeries(series, axis)
        if (axisSeries.length === 0) return null
        const open = byAxis[axis]
        return (
          <section key={axis} className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
            <h2 className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-[var(--r-sm)] bg-[#8B5CF6]/10 px-2 py-1 font-mono text-[11px] font-[700] uppercase tracking-[0.08em] text-[#8B5CF6]">
                {axis}
              </span>
              <span className="font-display text-[16px] font-[700] text-[var(--t1)]">
                {AXIS_LABEL[axis]}
              </span>
              {open > 0 && (
                <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)]">
                  열린 발견 {open}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {axisSeries.map((s) => (
                <MetricCard key={s.key} series={s} />
              ))}
            </div>
          </section>
        )
      })}

      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-1 inline-flex items-center gap-2 font-display text-[16px] font-[700] text-[var(--t1)]">
          <HardDrive size={16} className="text-[#8B5CF6]" aria-hidden="true" /> 용량 상위 테이블
        </h2>
        <p className="mb-4 max-w-[60ch] break-keep font-body text-[13px] text-[var(--t2)]">
          “DB 가 커졌다”로는 아무 조치도 못 한다. 증가분은 보관 창(최근 수집분) 안에서만 잰다 —
          창 밖은 이 화면이 말하지 않는다.
        </p>
        {growth.length === 0 ? (
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">
            테이블 스냅샷이 없어요 — 위 “지금 수집”을 누르면 상위 25개가 기록됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--bd)] text-left">
                  <th className="py-2 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                    테이블
                  </th>
                  <th className="py-2 text-right font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                    총 용량
                  </th>
                  <th className="py-2 text-right font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                    인덱스
                  </th>
                  <th className="py-2 text-right font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                    행(추정)
                  </th>
                  <th className="py-2 text-right font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                    창 안 증가
                  </th>
                </tr>
              </thead>
              <tbody>
                {growth.map((g) => (
                  <tr key={g.table} className="border-b border-[var(--bd)] last:border-0">
                    <td className="py-2 font-mono text-[12px] text-[var(--t1)]">{g.table}</td>
                    <td className="py-2 text-right font-mono text-[12px] text-[var(--t1)]">
                      {formatValue(g.latestMb, 'MB')}
                    </td>
                    <td className="py-2 text-right font-mono text-[12px] text-[var(--t2)]">
                      {g.indexMb === null ? '—' : formatValue(g.indexMb, 'MB')}
                    </td>
                    <td className="py-2 text-right font-mono text-[12px] text-[var(--t2)]">
                      {g.rowsEst === null ? '—' : g.rowsEst.toLocaleString('ko-KR')}
                    </td>
                    <td className="py-2 text-right font-mono text-[12px] text-[var(--t2)]">
                      {g.deltaMb === null ? '비교 없음' : `+${formatValue(g.deltaMb, 'MB')}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

