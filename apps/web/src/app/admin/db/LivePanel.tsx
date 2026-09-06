// apps/web/src/app/admin/db/LivePanel.tsx
//
// 라이브 계기판 — 이 화면에서 **지금**을 말하는 유일한 부분.
//
// 왜 폴링인가: 스냅샷은 일 1회다. 이 저장소의 실제 장애 두 건은 스냅샷 사이에서 시작해
// 스냅샷 사이에서 끝났고, 그동안 화면은 어제 숫자를 최신처럼 그리고 있었다.
//
// 왜 15초인가: `admin_db_health_live()` 는 카탈로그 뷰만 읽어 한 번에 수십 ms 다.
// 그보다 잦게 치면 화면이 읽기 부하가 되고(직전 장애 원인이 읽기 포화였다),
// 그보다 뜸하면 취소해야 할 쿼리가 이미 끝나 있다.
//
// 자동 갱신은 **끌 수 있다.** 조치를 하는 동안 표가 발밑에서 바뀌면 엉뚱한 pid 를 누른다.
//
// 실패했을 때 마지막 값을 지우지 않는다 — 대신 "몇 초 전 값" 이라고 말한다.
// 빈 계기판은 관리자에게 "정상" 으로 읽히고, 그게 이 화면이 낼 수 있는 최악의 거짓말이다.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { Activity, Pause, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { formatSeconds, formatValue, gaugeFill, signalLevel } from '@/lib/admin/db-health/derive'
import { LIVE_THRESHOLDS } from '@/lib/admin/db-health/types'
import type { LiveSnapshot, SignalLevel } from '@/lib/admin/db-health/types'

import { ActionButton } from './ActionButton'
import { InfoTip } from './InfoTip'

/** 폴링 주기(ms). 근거는 파일 머리말. */
export const LIVE_POLL_MS = 15_000

const LEVEL_STYLE: Record<SignalLevel, { ink: string; bg: string; text: string }> = {
  ok: { ink: 'var(--success-ink)', bg: 'var(--success-light)', text: '정상' },
  warn: { ink: 'var(--warning-ink)', bg: 'var(--warning-light)', text: '경계' },
  crit: { ink: 'var(--error-ink)', bg: 'var(--error-light)', text: '초과' },
  unknown: { ink: 'var(--t2)', bg: 'var(--bg3)', text: '모름' },
}

function SignalTile({
  metricKey,
  label,
  value,
  display,
  tip,
  sub,
}: {
  metricKey: string
  label: string
  value: number | null
  display: string
  tip: string
  sub?: string
}) {
  const level = signalLevel(metricKey, value)
  const fill = gaugeFill(metricKey, value)
  const t = LIVE_THRESHOLDS[metricKey]
  const style = LEVEL_STYLE[level]
  return (
    <article
      className="rounded-[var(--r-md)] border bg-[var(--bg2)] p-3 transition-shadow duration-[var(--dur-normal)] ease-[var(--ease)]"
      style={{ borderColor: level === 'ok' || level === 'unknown' ? 'var(--bd)' : style.ink }}
    >
      <p className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 whitespace-nowrap font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
          {label}
          <InfoTip label={label}>{tip}</InfoTip>
        </span>
        {/* 색만으로 말하지 않는다 — 글자가 상태를 직접 말한다. */}
        <span
          className="rounded-[var(--r-sm)] px-1.5 py-0.5 font-display text-[9px] font-[700]"
          style={{ background: style.bg, color: style.ink }}
        >
          {style.text}
        </span>
      </p>
      <p
        className="mt-1 font-display text-[24px] font-[800] leading-none tracking-tight"
        style={{ color: level === 'crit' || level === 'warn' ? style.ink : 'var(--t1)' }}
      >
        {display}
      </p>
      {/* 게이지 — 임계값이 있는 신호만. 없는 신호에 막대를 그리면 없는 기준을 지어낸다. */}
      {fill !== null && t ? (
        <span className="mt-2 block h-[5px] w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
          <span
            className="block h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]"
            style={{ width: `${Math.round(fill * 100)}%`, background: style.ink }}
          />
        </span>
      ) : (
        <span className="mt-2 block h-[5px]" />
      )}
      <p className="mt-1 break-keep font-mono text-[10px] text-[var(--t2)]">
        {sub ?? (t ? `경계 ${t.warn} · 치명 ${t.crit}` : '임계값 없음')}
      </p>
    </article>
  )
}

export function LivePanel({ initial, initialError }: { initial: LiveSnapshot | null; initialError: string | null }) {
  const [live, setLive] = useState<LiveSnapshot | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(initial ? Date.now() : null)
  const [ageS, setAgeS] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const pull = useCallback(async () => {
    setBusy(true)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { data, error: err } = await client.rpc('admin_db_health_live')
      if (err) throw err
      setLive(data as LiveSnapshot)
      setError(null)
      setFetchedAt(Date.now())
    } catch (e) {
      // 값을 지우지 않는다 — 아래는 마지막으로 읽은 것이고, 화면이 그렇게 말한다.
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!auto) {
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      return
    }
    timer.current = setInterval(() => void pull(), LIVE_POLL_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [auto, pull])

  // 값의 나이를 초 단위로 센다 — "언제 읽은 값인가" 가 값 자체만큼 중요하다.
  useEffect(() => {
    const t = setInterval(() => {
      setAgeS(fetchedAt ? Math.round((Date.now() - fetchedAt) / 1000) : 0)
    }, 1000)
    return () => clearInterval(t)
  }, [fetchedAt])

  const conn = live?.conn ?? null

  // 볼 것이 있는가 — 도는 세션·잠금 대기·예약 실패 중 하나라도 있으면.
  const hasDetail =
    (live?.sessions.length ?? 0) > 0 ||
    (live?.blockers.length ?? 0) > 0 ||
    (live?.cron_recent.length ?? 0) > 0
  const [openDetail, setOpenDetail] = useState(hasDetail)
  const wasDetail = useRef(hasDetail)
  useEffect(() => {
    // 없다가 생기면 펼친다. 사람이 접어 둔 것을 다시 열지는 않는다 —
    // 15초마다 발밑에서 열리는 패널은 조치를 방해한다.
    if (hasDetail && !wasDetail.current) setOpenDetail(true)
    wasDetail.current = hasDetail
  }, [hasDetail])

  // 다른 탭에 있어도 상태가 보이게 한다 — 장애는 이 화면을 보고 있을 때만 나지 않는다.
  useEffect(() => {
    if (!live) return
    const worst = [
      signalLevel('conn_used_pct', live.conn.used_pct),
      signalLevel('cache_hit_pct', live.cache_hit_pct),
      signalLevel('longest_query_s', live.longest_query_s),
      signalLevel('oldest_idle_in_tx_s', live.oldest_idle_in_tx_s),
      signalLevel('blocked_locks', live.blocked_locks),
      signalLevel('cron_fail_24h', live.cron_fail_24h),
    ]
    const mark = worst.includes('crit') ? '[장애] ' : worst.includes('warn') ? '[주의] ' : ''
    document.title = `${mark}DB 헬스 — Admin`
  }, [live])

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <Activity size={15} className="text-[#8B5CF6]" aria-hidden="true" />
          지금
          <span className="font-mono text-[11px] font-[500] text-[var(--t2)]">
            {live ? `${ageS}초 전 값` : '값 없음'}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            aria-pressed={auto}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-display text-[11px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            {auto ? (
              <Pause size={11} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Play size={11} strokeWidth={2.5} aria-hidden="true" />
            )}
            {auto ? `자동 ${LIVE_POLL_MS / 1000}초` : '자동 꺼짐'}
          </button>
          <button
            type="button"
            onClick={() => void pull()}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[#8B5CF6]/40 bg-[#8B5CF6]/8 px-2.5 py-1 font-display text-[11px] font-[600] text-[#6D28D9] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#8B5CF6]/15 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            <RefreshCw
              size={11}
              strokeWidth={2.5}
              aria-hidden="true"
              className={busy ? 'animate-spin' : ''}
            />
            새로 읽기
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 break-keep rounded-[var(--r-sm)] px-3 py-2 font-body text-[12px]"
          style={{ background: 'var(--warning-light)', color: 'var(--warning-ink)' }}
        >
          {live ? '지금 값을 읽지 못했어요 — 아래는 마지막으로 읽은 값이다. ' : '지금 값을 읽지 못했어요. '}
          <span className="font-mono text-[11px]">{error}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <SignalTile
          metricKey="conn_used_pct"
          label="연결"
          value={conn?.used_pct ?? null}
          display={conn ? `${conn.used_pct}%` : '—'}
          sub={conn ? `${conn.total} / ${conn.max} · 활성 ${conn.active} · idle-tx ${conn.idle_in_tx}` : undefined}
          tip="쓰이고 있는 연결 비율. 100% 가 되면 앱이 새 연결을 못 얻어 즉시 장애다. 이 DB 의 max_connections 는 60."
        />
        <SignalTile
          metricKey="cache_hit_pct"
          label="캐시 적중"
          value={live?.cache_hit_pct ?? null}
          display={live?.cache_hit_pct === null || live === null ? '—' : `${live.cache_hit_pct}%`}
          tip="읽기 중 메모리에서 답한 비율. 99% 아래면 읽기가 디스크로 가고 있다는 뜻이고, 그 상태에서는 쓰기가 없어도 DB 가 느려진다."
        />
        <SignalTile
          metricKey="longest_query_s"
          label="최장 쿼리"
          value={live?.longest_query_s ?? null}
          display={formatSeconds(live?.longest_query_s ?? null)}
          tip="지금 도는 쿼리 중 가장 오래된 것. statement_timeout 이 120초라 그 근처면 곧 잘린다. 아래 표에서 취소할 수 있다."
        />
        <SignalTile
          metricKey="oldest_idle_in_tx_s"
          label="IDLE TX"
          value={live?.oldest_idle_in_tx_s ?? null}
          display={formatSeconds(live?.oldest_idle_in_tx_s ?? null)}
          tip="트랜잭션을 열어 둔 채 아무것도 안 하는 세션. 이것이 VACUUM 을 막아 죽은 튜플이 쌓인다. 이 DB 는 자동 종료가 꺼져 있어(=0) 사람이 끊어야 한다."
        />
        <SignalTile
          metricKey="blocked_locks"
          label="잠금 대기"
          value={live?.blocked_locks ?? null}
          display={live ? String(live.blocked_locks) : '—'}
          tip="락을 못 얻어 멈춰 있는 요청 수. 0 이 아니면 이미 누군가는 기다리고 있다."
        />
        <SignalTile
          metricKey="cron_fail_24h"
          label="예약 실패"
          value={live?.cron_fail_24h ?? null}
          display={live ? String(live.cron_fail_24h) : '—'}
          sub={live ? `지금 도는 잡 ${live.cron_running}` : undefined}
          tip="최근 24시간 안에 실패한 예약 작업 실행 수. 같은 잡이 반복 실패하면 아래 목록에서 잡 자체를 정지할 수 있다."
        />
        <SignalTile
          metricKey="db_size_mb"
          label="DB 용량"
          value={live?.db_size_mb ?? null}
          display={live ? formatValue(live.db_size_mb, 'MB') : '—'}
          sub={live ? `롤백 ${live.rollbacks} · 교착 ${live.deadlocks}` : undefined}
          tip="디스크 상한을 모르는 채로 경계선을 그으면 그 선은 짐작이다. 그래서 값과 증가분만 보여 주고 판정하지 않는다 — 증가 추세는 아래 «용량» 에 있다."
        />
      </div>

      {/* 지금 도는 세션 — 장애 대응의 실제 작업면. 여기서 취소·종료가 바로 된다.
          볼 것이 없을 때는 접어 둔다: 정상일 때 이 블록이 접힌 위를 다 먹으면 경보가 밀린다. */}
      <div className="mt-3">
        <button
          type="button"
          aria-expanded={openDetail}
          onClick={() => setOpenDetail((v) => !v)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-display text-[11px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
        >
          {openDetail ? '세부 접기' : '세부 펴기'}
          <span className="font-mono text-[10px]">
            {`세션 ${live?.sessions.length ?? 0} · 잠금 ${live?.blockers.length ?? 0} · 예약 실패 ${live?.cron_recent.length ?? 0}`}
          </span>
        </button>
      </div>

      <div className="mt-3" hidden={!openDetail}>
        <h3 className="mb-2 flex items-center gap-2 font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
          지금 도는 세션
          <span className="font-mono text-[11px] font-[500] normal-case tracking-normal">
            {live ? `${live.sessions.length}건` : '—'}
          </span>
          <InfoTip label="지금 도는 세션">
            idle 이 아닌 클라이언트 세션만, 오래된 것부터. 「취소」는 쿼리만 끊고 연결은 남긴다.
            「종료」는 연결을 끊어 열려 있던 트랜잭션을 롤백한다 — 그래서 사유를 받는다.
          </InfoTip>
        </h3>
        {!live || live.sessions.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[12px] text-[var(--t2)]">
            {live ? '도는 것이 없어요 — 지금은 아무 쿼리도 실행 중이 아닙니다.' : '값을 읽지 못했어요.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--bd)] text-left">
                  {['PID', '상태', '대기', '경과', '쿼리', '조치'].map((h) => (
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
                {live.sessions.map((s) => (
                  <tr key={s.pid} className="border-b border-[var(--bd)] align-top last:border-0">
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--t1)]">{s.pid}</td>
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--t2)]">{s.state}</td>
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--t2)]">
                      {s.wait || '—'}
                    </td>
                    <td
                      className="py-1.5 pr-2 font-mono text-[11px]"
                      style={{
                        color:
                          s.dur_s >= 60 ? 'var(--warning-ink)' : 'var(--t2)',
                      }}
                    >
                      {formatSeconds(s.dur_s)}
                    </td>
                    <td className="max-w-[320px] py-1.5 pr-2">
                      <span className="block truncate font-mono text-[11px] text-[var(--t2)]" title={s.query}>
                        {s.query || '—'}
                      </span>
                      {s.app && (
                        <span className="font-mono text-[10px] text-[var(--t2)]">
                          {s.app}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <span className="flex flex-wrap gap-1.5">
                        <ActionButton action="cancel_query" target={String(s.pid)} label="취소" />
                        <ActionButton action="terminate_backend" target={String(s.pid)} label="종료" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 잠금 대기 — 있을 때만 그린다. 없는 것을 빈 표로 그리면 자리를 먹기만 한다. */}
      {live && live.blockers.length > 0 && (
        <div className="mt-4" hidden={!openDetail}>
          <h3 className="mb-2 font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--error-ink)]">
            {`잠금 대기 ${live.blockers.length}건`}
          </h3>
          <ul className="space-y-1.5">
            {live.blockers.map((b) => (
              <li
                key={`${b.blocked_pid}-${b.blocking_pid}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2"
              >
                <span className="min-w-0 font-mono text-[11px] text-[var(--t2)]">
                  <strong className="text-[var(--t1)]">{b.blocked_pid}</strong>
                  {` ← 막고 있는 것 `}
                  <strong className="text-[var(--t1)]">{b.blocking_pid}</strong>
                  {` · ${formatSeconds(b.dur_s)}`}
                </span>
                <ActionButton
                  action="terminate_backend"
                  target={String(b.blocking_pid)}
                  label={`막는 세션 ${b.blocking_pid} 종료`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 최근 24시간 안에 성공하지 못한 예약 작업 */}
      {live && live.cron_recent.length > 0 && (
        <div className="mt-4" hidden={!openDetail}>
          <h3 className="mb-2 flex items-center gap-2 font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
            예약 작업 실패 (24시간)
            <InfoTip label="예약 작업 실패">
              같은 잡이 계속 실패하면 그 잡을 정지해 두는 것이 낫다 — 실패도 자원을 먹고,
              실패 기록이 쌓이면 진짜 새 실패가 안 보인다. 고친 뒤 다시 켠다.
            </InfoTip>
          </h3>
          <ul className="space-y-1.5">
            {live.cron_recent.map((r, i) => (
              <li
                key={`${r.job}-${r.at}-${i}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[11px] font-[600] text-[var(--t1)]">{r.job}</span>
                  <span className="ml-2 font-mono text-[10px] text-[var(--t2)]">
                    {r.status} · {formatSeconds(r.dur_s)} · {new Date(r.at).toLocaleTimeString('ko-KR')}
                  </span>
                  {r.msg && (
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--t2)]" title={r.msg}>
                      {r.msg}
                    </span>
                  )}
                </span>
                {r.active === false ? (
                  <ActionButton action="cron_enable_job" target={r.job} label="재개" />
                ) : (
                  <ActionButton action="cron_disable_job" target={r.job} label="정지" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
