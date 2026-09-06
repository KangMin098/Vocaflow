// apps/web/src/app/admin/db/page.tsx
//
// /admin/db — DB 헬스 콘솔.
//
// 이 화면은 세 가지를 한다: **지금을 보여 주고**(라이브), **판정 결과를 줄 세우고**(경보),
// **거기서 바로 조치한다**(허용 목록). 판정 자체는 여전히 DB 밖 `/db-health-audit` 이 하고
// 스냅샷 수집은 pg_cron 이 한다 — 같은 숫자를 두 곳에서 판단하면 두 곳이 갈린다.
//
// 재설계 이전(2026-09-06 오전)에는 이 화면이 설명 문장 위주였다. 실측했더니 열린 발견 16건의
// `detail` 평균이 372자라 카드로 펼치면 한 화면에 두 건이 들어갔고, 「지금 몇 건이 열려 있고
// 무엇이 급한가」에 답하려면 스크롤이 필요했다. 설명은 버리지 않고 **풍선말과 펼침**으로 옮겼다.
//
// 화면이 스스로 판정하는 것은 둘뿐이다:
//   1. 수집이 멈췄는가 (멈추면 아래 추세는 전부 과거의 것이다)
//   2. 라이브 신호가 임계를 넘었는가 — 라이브에는 뒤에 판정층이 없다(그건 하루 한 번 돈다)
// 임계값은 `LIVE_THRESHOLDS` 한 곳에만 있고 전부 이 DB 의 실측 설정에 걸려 있다.

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Database,
  Flag,
  HardDrive,
  HelpCircle,
  History,
  Info,
  ShieldAlert,
} from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  TREND_MIN_POINTS,
  anomalyReadiness,
  countBySeverity,
  delta,
  formatAge,
  formatValue,
  headlineSeries,
  hoursSince,
  isCollectionStale,
  latestAt,
  openByAxis,
  overallStatus,
  pairCheckpoints,
  snapshotCount,
  tableGrowth,
  toNumber,
  toSeries,
} from '@/lib/admin/db-health/derive'
import { STALE_AFTER_HOURS, fetchDbHealth } from '@/lib/admin/db-health/queries'
import {
  ANOMALY_MIN_SAMPLES,
  AXIS_LABEL,
  DAILY_AXES,
  HEALTH_AXES,
  METRIC_LABEL,
  METRIC_UNIT,
} from '@/lib/admin/db-health/types'
import type { MetricSeries, SignalLevel } from '@/lib/admin/db-health/types'

import { ActionButton } from './ActionButton'
import { AlertTriage } from './AlertTriage'
import { CollectButton } from './CollectButtons'
import { InfoTip } from './InfoTip'
import { LivePanel } from './LivePanel'

export const metadata = {
  title: 'DB 헬스 — Admin',
  description: 'DB 라이브 계기판 + 경보 분류 + 허용 목록 조치 (db_health_metrics · findings · action_log)',
}

export const dynamic = 'force-dynamic'

/** 전체 판정 한 줄의 표시. 색만으로 말하지 않는다 — 아이콘과 글자가 함께 간다. */
const STATUS_STYLE: Record<SignalLevel, { Icon: typeof AlertOctagon; ink: string; bg: string }> = {
  ok: { Icon: CheckCircle2, ink: 'var(--success-ink)', bg: 'var(--success-light)' },
  warn: { Icon: AlertTriangle, ink: 'var(--warning-ink)', bg: 'var(--warning-light)' },
  crit: { Icon: AlertOctagon, ink: 'var(--error-ink)', bg: 'var(--error-light)' },
  unknown: { Icon: HelpCircle, ink: 'var(--t2)', bg: 'var(--bg3)' },
}

/** 점이 충분할 때만 그린다. 그 전에는 몇 번 더 모으면 되는지 말한다. */
function Trend({ points }: { points: number[] }) {
  if (points.length < TREND_MIN_POINTS) {
    return (
      <p className="shrink-0 break-keep text-right font-mono text-[10px] text-[var(--t2)]">
        {`수집 ${points.length}회`}
        <br />
        {`추세는 ${TREND_MIN_POINTS}회부터`}
      </p>
    )
  }
  const w = 104
  const h = 28
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

function MetricCard({ series }: { series: MetricSeries }) {
  const latest = series.points[series.points.length - 1]
  const d = delta(series)
  const unit = METRIC_UNIT[series.metric]
  const dims = latest.dims ?? {}
  return (
    <article className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-keep font-display text-[11px] font-[600] text-[var(--t2)]">
            {METRIC_LABEL[series.metric] ?? series.metric}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
            <span className="font-display text-[20px] font-[800] tracking-tight text-[var(--t1)]">
              {formatValue(latest.value, unit)}
            </span>
            <span className="font-mono text-[10px] text-[var(--t2)]">
              {d === null ? '직전 없음' : d === 0 ? '변동 없음' : `${d > 0 ? '▲' : '▼'} ${formatValue(Math.abs(d), unit)}`}
            </span>
          </p>
        </div>
        <Trend points={series.points.map((p) => p.value)} />
      </div>
      {Object.keys(dims).length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-[var(--bd)] pt-2">
          {Object.entries(dims)
            .map(([k, v]) => [k, Array.isArray(v) ? `${v.length}건` : v] as const)
            .filter(([, v]) => typeof v !== 'object' || v === null)
            .map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-1">
                <dt className="font-mono text-[9px] text-[var(--t2)]">{k}</dt>
                <dd className="font-mono text-[10px] font-[600] text-[var(--t2)]">
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
  const {
    metrics,
    findings,
    excepted,
    metricsError,
    findingsError,
    recentlyResolved,
    anomalies,
    anomaliesError,
    checkpoints,
    checkpointsError,
    live,
    liveError,
    actionLog,
    actionLogError,
  } = await fetchDbHealth()

  const series = toSeries(metrics)
  const now = new Date()
  const dailyRows = metrics.filter((r) => (DAILY_AXES as readonly string[]).includes(r.axis))
  const dailyLatest = latestAt(dailyRows)
  const weeklyLatest = latestAt(metrics, 'integrity')
  const stale = isCollectionStale(dailyLatest, now, STALE_AFTER_HOURS)
  const dailyAge = hoursSince(dailyLatest, now)
  const weeklyAge = hoursSince(weeklyLatest, now)

  const counts = countBySeverity(findings)
  const byAxis = openByAxis(findings)
  const growth = tableGrowth(series, 10)

  const dailySnapshots = snapshotCount(dailyRows)
  const anomalyReady = anomalyReadiness(dailySnapshots, ANOMALY_MIN_SAMPLES)
  const checkpointPairs = pairCheckpoints(checkpoints)

  const status = overallStatus({
    live,
    liveError,
    criticalCount: counts.critical,
    warningCount: counts.warning,
    stale,
  })
  const S = STATUS_STYLE[status.level]

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      {/* ── 상태 한 줄 — 접힌 위 첫 줄에서 "지금 정상인가" 에 답한다 ───────── */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border p-4"
        style={{ borderColor: status.level === 'ok' ? 'var(--bd)' : S.ink, background: S.bg }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <S.Icon size={28} strokeWidth={2} aria-hidden="true" style={{ color: S.ink }} className="shrink-0" />
          <div className="min-w-0">
            {/* 스크린리더로 들어오면 여기가 어디인지 말할 줄이 필요하다 — 큰 글자는 상태이지 화면 이름이 아니다. */}
            <h1 className="font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              DB 헬스
            </h1>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="font-display text-[24px] font-[800] leading-none tracking-tight" style={{ color: S.ink }}>
                {status.headline}
              </span>
              <span className="font-mono text-[11px] text-[var(--t2)]">{status.reason}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--t2)]">
              <span style={{ color: counts.critical > 0 ? 'var(--error-ink)' : undefined }}>
                {`치명 ${counts.critical}`}
              </span>
              <span style={{ color: counts.warning > 0 ? 'var(--warning-ink)' : undefined }}>
                {`주의 ${counts.warning}`}
              </span>
              <span>{`참고 ${counts.info}`}</span>
              <span>{`7일 해결 ${recentlyResolved}`}</span>
              <span>
                {`스냅샷 ${dailyLatest ? formatAge(dailyAge ?? 0) : '없음'} · 5축 ${dailySnapshots}회 · 정밀 ${snapshotCount(metrics, 'integrity')}회${weeklyAge !== null ? ` (${formatAge(weeklyAge)})` : ''}`}
              </span>
              <InfoTip label="이 줄의 판정 근거">
                가장 나쁜 신호 하나가 전체를 정한다 — 평균을 내면 치명 하나가 정상 아홉에 묻힌다.
                라이브를 못 읽었거나 스냅샷이 낡았으면 「정상」이 아니라 「모름」이다. 낡은 숫자로
                정상이라고 말하는 것이 이 화면이 낼 수 있는 최악의 거짓말이다.
              </InfoTip>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
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

      {stale && (
        <section
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3"
          style={{ background: 'var(--warning-light)' }}
        >
          <ShieldAlert size={16} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--warning-ink)' }} className="mt-0.5 shrink-0" />
          <p className="min-w-0 break-keep font-body text-[12px] text-[var(--t2)]">
            <strong style={{ color: 'var(--warning-ink)' }}>
              {dailyLatest
                ? `스냅샷이 ${STALE_AFTER_HOURS}시간 넘게 없었어요 (${dailyAge === null ? '기록 없음' : formatAge(dailyAge)})`
                : '스냅샷 기록이 없어요'}
            </strong>
            {' — 아래 «추세»·«용량» 은 그 시점의 것이다. 위 «지금» 은 영향받지 않는다.'}
          </p>
        </section>
      )}

      {(metricsError || findingsError) && (
        <section role="alert" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">
            조회 실패 — 화면의 “—”는 0 이 아니라 <strong>모른다</strong>는 뜻이다.
            {metricsError && <span className="ml-1 font-mono text-[11px]">metrics: {metricsError}</span>}
            {findingsError && <span className="ml-1 font-mono text-[11px]">findings: {findingsError}</span>}
          </p>
        </section>
      )}

      {/* ── 지금 (라이브) ────────────────────────────────────────────────── */}
      <LivePanel initial={live} initialError={liveError} />

      {/* ── 경보 분류 ────────────────────────────────────────────────────── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <AlertTriangle size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          경보
          <InfoTip label="경보">
            판정은 이 화면이 아니라 Claude Code 의 <code className="font-mono">/db-health-audit</code> 이
            한다. 한 번도 안 돌렸으면 스냅샷이 아무리 쌓여도 여기는 비어 있다 — 문제가 없다는 뜻이 아니다.
            정렬은 치명 → 주의 → 참고, 같은 등급 안에서는 오래 열린 것이 위다.
          </InfoTip>
        </h2>
        {findings.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[13px] text-[var(--t2)]">
            {metrics.length === 0
              ? '열린 항목이 없어요 — 아직 수집도 되지 않았어요. 위 “지금 수집”을 먼저 누르세요.'
              : '열린 항목이 없어요 — 판정이 아직 안 돌았을 수도 있어요. Claude Code 에서 /db-health-audit 을 실행하면 채워집니다.'}
          </p>
        ) : (
          <>
            <AlertTriage findings={findings} />
            {/* 접힌 줄만 봐도 이 화면의 경계가 보여야 한다 — 펼쳐야 나오는 규칙은 규칙이 아니다. */}
            <p className="mt-2 font-mono text-[10px] text-[var(--t2)]">
              SQL 복사만 · 실행은 허용 목록 7종
            </p>
          </>
        )}
      </section>

      {/* ── 조치 기록 ────────────────────────────────────────────────────── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <History size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          조치 기록
          <span className="font-mono text-[11px] font-[500] text-[var(--t2)]">{actionLog.length}건</span>
          <InfoTip label="조치 기록">
            이 화면에서 실행한 조치의 감사 기록이다. 실패도 남는다 — 실패를 예외로 올리면 기록이
            함께 롤백돼서(자율 트랜잭션이 없다) 「그때 무엇을 눌렀나」에 답하지 못한다.
            여기 없는 조치(VACUUM FULL · DROP INDEX)는 화면이 실행하지 않고 SQL 만 건넨다.
          </InfoTip>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <ActionButton action="analyze_stale_tables" />
            <ActionButton action="terminate_idle_in_tx" />
          </span>
        </h2>
        {actionLogError ? (
          <p role="alert" className="break-keep font-body text-[12px] text-[var(--t2)]">
            조치 기록을 읽지 못했어요 <span className="font-mono text-[11px]">{actionLogError}</span>
          </p>
        ) : actionLog.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[12px] text-[var(--t2)]">
            아직 실행한 조치가 없어요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--bd)] text-left">
                  {['시각', '조치', '등급', '대상', '결과', '사유'].map((h) => (
                    <th
                      key={h}
                      className="py-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actionLog.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--bd)] last:border-0">
                    <td className="py-1.5 pr-2 font-mono text-[10px] text-[var(--t2)] whitespace-nowrap">
                      {new Date(a.started_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--t1)]">{a.action}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className="rounded-[var(--r-sm)] px-1.5 py-0.5 font-display text-[9px] font-[700]"
                        style={
                          a.tier === 'guarded'
                            ? { background: 'var(--warning-light)', color: 'var(--warning-ink)' }
                            : { background: 'var(--bg3)', color: 'var(--t2)' }
                        }
                      >
                        {a.tier === 'guarded' ? '사유 필요' : '안전'}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-[10px] text-[var(--t2)]">{a.target ?? '—'}</td>
                    <td
                      className="py-1.5 pr-2 font-mono text-[10px]"
                      style={{ color: a.ok === false ? 'var(--error-ink)' : 'var(--t2)' }}
                    >
                      {a.ok === null ? '진행 중' : a.ok ? (a.result ?? '성공') : `실패: ${a.error ?? ''}`}
                    </td>
                    <td className="py-1.5 font-body text-[10px] text-[var(--t2)]">{a.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 추세 (스냅샷) ────────────────────────────────────────────────── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <Activity size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          추세
          <InfoTip label="추세">
            일 1회 수집한 스냅샷이다 — 지금이 아니라 어제까지의 모양이다. 점 두 개를 이은 선은
            추세가 아니라 장식이라, 4회가 쌓여야 선이 생긴다. “—”는 0 이 아니라 모른다는 뜻이다.
          </InfoTip>
        </h2>
        {series.length === 0 && (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[12px] text-[var(--t2)]">
            스냅샷이 없어요 — 위 “지금 수집”을 누르면 이 자리에 축별 지표가 생깁니다.
          </p>
        )}
        <div className="space-y-3">
          {HEALTH_AXES.map((axis) => {
            const axisSeries = headlineSeries(series, axis)
            if (axisSeries.length === 0) return null
            const open = byAxis[axis]
            return (
              <div key={axis}>
                <h3 className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-[var(--r-sm)] bg-[#8B5CF6]/10 px-1.5 py-0.5 font-mono text-[10px] font-[700] uppercase tracking-[0.06em] text-[#6D28D9]">
                    {axis}
                  </span>
                  <span className="font-display text-[12px] font-[700] text-[var(--t1)]">
                    {AXIS_LABEL[axis]}
                  </span>
                  {open > 0 && (
                    <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[9px] font-[600] text-[var(--t2)]">
                      경보 {open}
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {axisSeries.map((s) => (
                    <MetricCard key={s.key} series={s} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 이상 징후 ────────────────────────────────────────────────────── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <Activity size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          이상 징후
          <InfoTip label="이상 징후">
            규칙이 미리 정해 둔 것이 아니라 <em className="font-editorial">평소와 다른 것</em>을 본다.
            중앙값에서 얼마나 벗어났는지(robust z)와 직전 대비 변화율만 재고, 위험 여부는 판정하지
            않는다 — 같은 편차라도 연결 점유율과 테이블 용량은 뜻이 다르다. 표본이 2회뿐이면
            편차가 수학적으로 항상 0.67 로 고정돼 아무 뜻이 없어서 5회부터 잰다.
          </InfoTip>
        </h2>

        {anomaliesError ? (
          <p role="alert" className="break-keep font-body text-[12px] text-[var(--t2)]">
            이상 징후를 읽지 못했어요 <span className="font-mono text-[11px]">{anomaliesError}</span>
          </p>
        ) : !anomalyReady.ready ? (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[12px] text-[var(--t2)]">
            {`아직 재지 않습니다 — 수집 ${dailySnapshots}회 · ${ANOMALY_MIN_SAMPLES}회부터`}
            {anomalyReady.need > 0 && ` (${anomalyReady.need}회 더)`}
          </p>
        ) : anomalies.length === 0 ? (
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">
            {`수집 ${dailySnapshots}회를 봤고 이력에서 크게 벗어난 지표는 없어요.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--bd)] text-left">
                  {['지표', '지금', '중앙값', '벗어난 정도', '전회 대비', '표본'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)] ${i > 0 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomalies.slice(0, 12).map((a) => {
                  const unit = METRIC_UNIT[a.metric]
                  const latest = toNumber(a.latest)
                  const median = toNumber(a.median_value)
                  const z = toNumber(a.robust_z)
                  const pct = toNumber(a.pct_change)
                  return (
                    <tr key={`${a.metric}@${a.subject ?? ''}`} className="border-b border-[var(--bd)] last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="break-keep font-body text-[11px] text-[var(--t1)]">
                          {METRIC_LABEL[a.metric] ?? a.metric}
                        </span>
                        {a.subject && (
                          <span className="ml-1.5 font-mono text-[10px] text-[var(--t2)]">{a.subject}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t1)]">
                        {latest === null ? '—' : formatValue(latest, unit)}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">
                        {median === null ? '—' : formatValue(median, unit)}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">
                        {z === null ? '재지 못함' : `${z.toLocaleString('ko-KR')}σ`}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">
                        {pct === null
                          ? '비교 없음'
                          : `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${Math.abs(pct).toLocaleString('ko-KR')}%`}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">{a.samples}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 용량 상위 테이블 ─────────────────────────────────────────────── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <HardDrive size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          용량 상위 테이블
          <InfoTip label="용량 상위 테이블">
            증가분은 보관 창(최근 수집분) 안에서만 잰다 — 창 밖은 이 화면이 말하지 않는다.
            「통계 갱신」은 실행계획용 통계를 다시 뜨는 것이고 락이 없다. 죽은 공간 회수(VACUUM FULL)는
            표를 통째로 잠그므로 여기서 실행하지 않는다.
          </InfoTip>
        </h2>
        {growth.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[12px] text-[var(--t2)]">
            테이블 스냅샷이 없어요 — 위 “지금 수집”을 누르면 상위 25개가 기록됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--bd)] text-left">
                  {['테이블', '총 용량', '인덱스', '행(추정)', '창 안 증가', '조치'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)] ${i > 0 && i < 5 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {growth.map((g) => (
                  <tr key={g.table} className="border-b border-[var(--bd)] last:border-0">
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--t1)]">{g.table}</td>
                    <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t1)]">
                      {formatValue(g.latestMb, 'MB')}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">
                      {g.indexMb === null ? '—' : formatValue(g.indexMb, 'MB')}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">
                      {g.rowsEst === null ? '—' : g.rowsEst.toLocaleString('ko-KR')}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[11px] text-[var(--t2)]">
                      {g.deltaMb === null ? '비교 없음' : `+${formatValue(g.deltaMb, 'MB')}`}
                    </td>
                    <td className="py-1.5 pl-3">
                      <ActionButton action="analyze_table" target={g.table} label="통계 갱신" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 체크포인트 ───────────────────────────────────────────────────── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <Flag size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          위험 작업 체크포인트
          <InfoTip label="위험 작업 체크포인트">
            마이그레이션·대량 발행·드레인 앞뒤로 찍어 두면 「이 변경이 무엇을 건드렸나」에 답할 수
            있다. 사후에는 알 수 없다. 거는 것은 Claude Code 에서{' '}
            <code className="font-mono">/db-checkpoint before &lt;라벨&gt;</code>.
            after 가 없는 라벨은 끝나지 않은 작업이라 맨 위로 온다.
          </InfoTip>
        </h2>
        {checkpointsError ? (
          <p role="alert" className="break-keep font-body text-[12px] text-[var(--t2)]">
            체크포인트를 읽지 못했어요 <span className="font-mono text-[11px]">{checkpointsError}</span>
          </p>
        ) : checkpointPairs.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[12px] text-[var(--t2)]">
            찍어 둔 체크포인트가 없어요 — 다음 마이그레이션 전에{' '}
            <code className="font-mono text-[11px]">/db-checkpoint before &lt;라벨&gt;</code> 을 걸어 두세요.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {checkpointPairs.map((p) => {
              const open = p.after === null
              return (
                <li
                  key={p.label}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="break-all font-mono text-[11px] font-[600] text-[var(--t1)]">
                      {p.label}
                    </span>
                    <span
                      className="ml-2 rounded-[var(--r-sm)] px-1.5 py-0.5 font-display text-[9px] font-[700]"
                      style={
                        open
                          ? { background: 'var(--warning-light)', color: 'var(--warning-ink)' }
                          : { background: 'var(--bg3)', color: 'var(--t2)' }
                      }
                    >
                      {open ? '끝나지 않음' : '앞뒤 모두'}
                    </span>
                    {(p.before?.note || p.after?.note) && (
                      <span className="mt-0.5 block break-keep font-body text-[11px] text-[var(--t2)]">
                        {[p.before?.note, p.after?.note].filter(Boolean).join(' → ')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right font-mono text-[10px] text-[var(--t2)]">
                    {new Date(p.touchedAt).toLocaleString('ko-KR')}
                    <br />
                    {open ? `/db-checkpoint after ${p.label}` : `/db-checkpoint diff ${p.label}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── 면제 — 숨기지 않고 접어 둔다 ─────────────────────────────────── */}
      {excepted.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
          <details>
            <summary className="cursor-pointer font-display text-[15px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:text-[#6D28D9]">
              {`면제 ${excepted.length}건 — 이미 결정된 것`}
            </summary>
            <p className="mt-2 max-w-[62ch] break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
              판정이 틀린 것이 아니라 저장소가 이미 「이대로 둔다」고 결정한 항목이다. 근거 없는
              면제는 면제가 아니라 은폐다.
            </p>
            <div className="mt-2">
              <AlertTriage findings={excepted} actionable={false} noteInline />
            </div>
          </details>
        </section>
      )}

      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="mb-2 inline-flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--t2)]">
          <Database size={14} className="text-[#8B5CF6]" aria-hidden="true" />
          이 화면에 대하여
          <Info size={12} aria-hidden="true" className="text-[var(--t2)]" />
        </h2>
        <AdminScreenHelp screen="db" />
      </section>
    </div>
  )
}
