// apps/web/src/app/admin/vrl/automation/page.tsx
//
// /admin/vrl/automation — Phase 2 자동화 모니터링 대시보드
// - pg_cron job status + 최근 실행 history
// - snapshots by reason/scope (audit chain 분포)
// - user_profiles V-Level 분포
// - 5 diagnostics 활용도

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { Activity, Calendar, CheckCircle2, XCircle } from 'lucide-react'

export const metadata = {
  title: 'VRL Automation Dashboard — Admin',
  description: 'Phase 2 자동화 통계: pg_cron, snapshots, V-Level 분포, 진단 활용',
}

export const dynamic = 'force-dynamic'

interface CronJob {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
}

interface CronRun {
  runid: number
  job_name: string | null
  status: string
  return_message: string | null
  start_time: string
  end_time: string | null
}

interface SnapshotCount {
  taken_reason: string
  scope: string | null
  count: number
}

interface VLevelDist {
  v_level: number | null
  count: number
}

interface DiagnosticUse {
  test_id: string
  name_ko: string
  test_type: string
  taken_count: number
}

interface TrackDist {
  track_id: string
  level: number
  user_count: number
}

interface RecentSnapshot {
  id: string
  user_id: string
  v_level: number | null
  previous_v_level: number | null
  v_level_delta: number | null
  taken_reason: string
  snapshot_type: string | null
  taken_at: string
}

interface ProfileLevelRow {
  current_v_level: number | null
  current_v_level_meta: { source?: string } | null
}

export default async function VrlAutomationPage() {
  // 형제 VRL admin 페이지와 동일하게 RSC 가드 재검(3층 가드 규약) — 기존 누락(v06.219).
  await requireAdmin('/admin/vrl/automation')
  const supabase = await createClient()

  const [cronJobs, cronRuns, snapshotsByReason, vlevelDist, diagnosticUse, trackDist, recentSnapshots, profileLevels] = await Promise.all([
    supabase.rpc('admin_vrl_cron_jobs').then((r) => (r.error ? [] : r.data ?? []) as unknown as CronJob[]),
    supabase.rpc('admin_vrl_cron_runs').then((r) => (r.error ? [] : r.data ?? []) as unknown as CronRun[]),
    supabase.rpc('admin_vrl_snapshot_counts').then((r) => (r.error ? [] : r.data ?? []) as unknown as SnapshotCount[]),
    supabase.rpc('admin_vrl_v_level_distribution').then((r) => (r.error ? [] : r.data ?? []) as unknown as VLevelDist[]),
    supabase.rpc('admin_vrl_diagnostic_use').then((r) => (r.error ? [] : r.data ?? []) as unknown as DiagnosticUse[]),
    supabase.rpc('admin_vrl_track_distribution').then((r) => (r.error ? [] : r.data ?? []) as unknown as TrackDist[]),
    // 직접 read — user_level_snapshots admin read RLS 필요 (미적용 시 빈 배열 → 안내문)
    supabase
      .from('user_level_snapshots')
      .select('id, user_id, v_level, previous_v_level, v_level_delta, taken_reason, snapshot_type, taken_at')
      .order('taken_at', { ascending: false })
      .limit(10)
      .then((r) => (r.error ? [] : r.data ?? []) as unknown as RecentSnapshot[]),
    // 직접 read — 분포의 source 분리(진단/학습 vs 기본값). user_profiles admin read RLS 필요.
    supabase
      .from('user_profiles')
      .select('current_v_level, current_v_level_meta')
      .then((r) => (r.error ? [] : r.data ?? []) as unknown as ProfileLevelRow[]),
  ])

  // v_level source 분리 집계 — 기본값(미진단)과 근거 있는 레벨(진단/학습/수동)을 구분
  const EVIDENCE_SOURCES = ['diagnostic', 'learning_data', 'manual_override', 'self_declared']
  const sourceSplit = profileLevels.reduce(
    (acc, p) => {
      const src = p.current_v_level_meta?.source
      if (src && EVIDENCE_SOURCES.includes(src)) acc.evidenced += 1
      else acc.defaulted += 1
      return acc
    },
    { evidenced: 0, defaulted: 0 },
  )

  // group track distribution by track_id
  const trackGroups = trackDist.reduce<Record<string, TrackDist[]>>((acc, t) => {
    if (!acc[t.track_id]) acc[t.track_id] = []
    acc[t.track_id].push(t)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header>
        <h1 className="font-display text-[28px] font-[800] text-[var(--t1)]">
          VRL Automation Dashboard
        </h1>
        <p className="mt-2 font-body text-[14px] text-[var(--t2)]">
          Phase 2 자동화 통계 — pg_cron · snapshots · V-Level 분포 · 진단 활용도
        </p>
        <AdminScreenHelp screen="vrl-automation" className="mt-3" />
      </header>

      {/* Cron jobs */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 inline-flex items-center gap-2 font-display text-[16px] font-[700] text-[var(--t1)]">
          <Calendar size={16} /> pg_cron jobs
        </h2>
        {cronJobs.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">활성 job 없음 (admin_vrl_cron_jobs RPC 권한 필요)</p>
        ) : (
          <table className="w-full font-body text-[13px]">
            <thead>
              <tr className="text-left text-[var(--t2)]"><th className="py-2">jobid</th><th>이름</th><th>schedule</th><th>active</th></tr>
            </thead>
            <tbody>
              {cronJobs.map((j) => (
                <tr key={j.jobid} className="border-t border-[var(--bd)]">
                  <td className="py-2 font-mono">{j.jobid}</td>
                  <td>{j.jobname}</td>
                  <td className="font-mono text-[12px]">{j.schedule}</td>
                  <td>{j.active ? <CheckCircle2 size={14} className="text-[var(--success)]" /> : <XCircle size={14} className="text-[var(--error-ink)]" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Cron runs (최근 10) */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 inline-flex items-center gap-2 font-display text-[16px] font-[700] text-[var(--t1)]">
          <Activity size={16} /> 최근 cron 실행 (10건)
        </h2>
        {cronRuns.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">실행 history 없음 (첫 실행 대기)</p>
        ) : (
          <ul className="space-y-2">
            {cronRuns.map((r) => (
              <li key={r.runid} className="flex items-center justify-between rounded-[var(--r-sm)] bg-[var(--bg2)] p-3 font-body text-[12px]">
                <span className={r.status === 'succeeded' ? 'text-[var(--success)]' : 'text-[var(--error-ink)]'}>● {r.status}</span>
                <span className="text-[var(--t2)]">{new Date(r.start_time).toLocaleString('ko-KR')}</span>
                <span className="font-mono text-[11px] text-[var(--t2)] truncate max-w-[40%]">{r.return_message ?? '-'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Snapshots by reason */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 font-display text-[16px] font-[700] text-[var(--t1)]">snapshots by reason/scope</h2>
        {snapshotsByReason.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">snapshot 없음</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {snapshotsByReason.map((s, i) => (
              <div key={i} className="rounded-[var(--r-md)] bg-[var(--bg2)] p-3">
                <p className="font-display text-[11px] font-[700] uppercase tracking-wide text-[var(--t2)]">
                  {s.taken_reason}{s.scope ? ` · ${s.scope}` : ''}
                </p>
                <p className="mt-1 font-display text-[24px] font-[800] text-[var(--t1)]">{s.count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 최근 레벨 변경 (audit chain) — cron "1 row" 메시지 대신 실제 승급/변경 내역 */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 font-display text-[16px] font-[700] text-[var(--t1)]">최근 레벨 변경 (user_level_snapshots 10건)</h2>
        {recentSnapshots.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">
            표시할 스냅샷 없음 — 변경 이력이 없거나 admin read 정책(user_level_snapshots) 미적용
          </p>
        ) : (
          <table className="w-full font-body text-[12px]">
            <thead>
              <tr className="text-left text-[var(--t2)]">
                <th className="py-2">시각</th><th>사용자</th><th>변경</th><th>사유</th>
              </tr>
            </thead>
            <tbody>
              {recentSnapshots.map((s) => (
                <tr key={s.id} className="border-t border-[var(--bd)]">
                  <td className="py-2 text-[var(--t2)]">{new Date(s.taken_at).toLocaleString('ko-KR')}</td>
                  <td className="font-mono text-[11px] text-[var(--t2)]">{s.user_id.slice(0, 8)}…</td>
                  <td className="font-display font-[600] text-[var(--t1)]">
                    {s.previous_v_level !== null ? `V${s.previous_v_level} → ` : ''}V{s.v_level ?? '-'}
                    {typeof s.v_level_delta === 'number' && s.v_level_delta !== 0 && (
                      <span className={s.v_level_delta > 0 ? 'ml-1 text-[var(--success)]' : 'ml-1 text-[var(--error-ink)]'}>
                        ({s.v_level_delta > 0 ? '+' : ''}{s.v_level_delta})
                      </span>
                    )}
                  </td>
                  <td className="font-mono text-[11px] text-[var(--t2)]">{s.taken_reason}{s.snapshot_type ? ` · ${s.snapshot_type}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* V-Level distribution */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 font-display text-[16px] font-[700] text-[var(--t1)]">user_profiles current_v_level 분포</h2>
        {profileLevels.length > 0 && (
          <p className="mb-3 font-body text-[12px] text-[var(--t2)]">
            근거 있는 레벨(진단·학습·수동) <strong className="text-[var(--t1)]">{sourceSplit.evidenced}</strong>명
            · 기본값(미진단) <strong className="text-[var(--t1)]">{sourceSplit.defaulted}</strong>명
            — 아래 분포에는 기본값 사용자가 포함되어 하위 레벨이 부풀 수 있음
          </p>
        )}
        {vlevelDist.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">데이터 없음</p>
        ) : (
          <div className="flex items-end gap-2">
            {vlevelDist.map((v) => {
              const max = Math.max(...vlevelDist.map((x) => x.count))
              const pct = max > 0 ? (v.count / max) * 100 : 0
              return (
                <div key={v.v_level ?? -1} className="flex flex-1 flex-col items-center">
                  <span className="font-display text-[10px] text-[var(--t2)]">{v.count}</span>
                  <div className="w-full rounded-t bg-[var(--p)]" style={{ height: `${Math.max(pct, 4)}px` }} />
                  <span className="mt-1 font-display text-[10px] text-[var(--t2)]">{v.v_level === null ? '-' : `V${v.v_level}`}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Diagnostic use */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 font-display text-[16px] font-[700] text-[var(--t1)]">진단 활용도</h2>
        {diagnosticUse.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">사용 기록 없음</p>
        ) : (
          <table className="w-full font-body text-[13px]">
            <thead><tr className="text-left text-[var(--t2)]"><th className="py-2">진단</th><th>type</th><th className="text-right">응시</th></tr></thead>
            <tbody>
              {diagnosticUse.map((d) => (
                <tr key={d.test_id} className="border-t border-[var(--bd)]">
                  <td className="py-2">{d.name_ko}</td>
                  <td className="font-mono text-[11px] text-[var(--t2)]">{d.test_type}</td>
                  <td className="text-right font-display font-[700]">{d.taken_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Track distribution */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <h2 className="mb-4 font-display text-[16px] font-[700] text-[var(--t1)]">track_levels 분포 (진단 완료자)</h2>
        {Object.keys(trackGroups).length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">track 진단 응시자 없음</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(trackGroups).map(([trackId, levels]) => {
              const max = Math.max(...levels.map((l) => l.user_count))
              return (
                <div key={trackId}>
                  <p className="mb-2 font-display text-[12px] font-[600] uppercase tracking-wide text-[var(--t2)]">{trackId}</p>
                  <div className="flex items-end gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => {
                      const entry = levels.find((e) => e.level === lvl)
                      const count = entry?.user_count ?? 0
                      const pct = max > 0 ? (count / max) * 100 : 0
                      return (
                        <div key={lvl} className="flex flex-1 flex-col items-center">
                          <span className="font-display text-[9px] text-[var(--t2)]">{count}</span>
                          <div className="w-full rounded-t bg-[var(--info)]" style={{ height: `${Math.max(pct, 2)}px` }} />
                          <span className="mt-1 font-display text-[9px] text-[var(--t2)]">L{lvl}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <p className="text-center font-body text-[11px] text-[var(--t2)]">
        Phase 2 자동화 — pg_cron 매일 KST 03:00 (jobid=8 vrl-auto-promote-daily) · 실패 시 pg_notify &apos;vrl_cron_alert&apos; · 모든 변경 user_level_snapshots audit chain 기록
      </p>
    </div>
  )
}
