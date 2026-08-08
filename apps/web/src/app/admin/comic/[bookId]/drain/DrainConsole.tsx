// apps/web/src/app/admin/comic/[bookId]/drain/DrainConsole.tsx
// CCP 드레인 관측 — 실행/진행/자기발전/평가이력/백엔드/발행차단 사유 전수 노출.

'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CircleCheck, CircleSlash, Clock, Cpu, Loader2, RefreshCw, Wrench } from 'lucide-react'
import type { ComicDetail, DrainRun, PanelEvent } from '@/lib/comic/admin-queries'

const ACCENT = '#8B5CF6'
const STATUS_TONE: Record<string, string> = {
  pass: 'var(--memory-stable)', fail: 'var(--memory-risk)', repairing: 'var(--memory-shaky)',
  pending: 'var(--t4)', skipped: 'var(--t3)',
}
const STATUS_GLYPH: Record<string, string> = { pass: '✓', fail: '✗', repairing: '↻', pending: '·', skipped: '–' }

export function DrainConsole({ detail, runs, events }: { detail: ComicDetail; runs: DrainRun[]; events: PanelEvent[] }) {
  const router = useRouter()
  const run = runs[0] ?? null

  useEffect(() => {
    if (run?.status !== 'running') return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [run?.status, router])

  // 컷별 최신 이벤트(최대 attempt)
  const byPanel = useMemo(() => {
    const m = new Map<string, PanelEvent>()
    for (const e of events) {
      if (e.chapter_idx == null || e.page_order == null) continue // null 좌표 skip(셀 붕괴 방지)
      const k = `${e.chapter_idx}-${e.page_order}`
      const prev = m.get(k)
      if (!prev || e.attempt >= prev.attempt) m.set(k, e)
    }
    return m
  }, [events])

  // stave(chapter)별 그룹
  const chapters = useMemo(() => [...new Set(events.map((e) => e.chapter_idx))].filter((c): c is number => c != null).sort((a, b) => a - b), [events])

  // 발행 차단 사유
  const blockers: string[] = []
  if (!run) blockers.push('드레인 실행 기록이 없습니다 — 아직 생성이 돌지 않았습니다.')
  else {
    if (run.status === 'running') blockers.push(`생성 진행 중 (${run.panels_done}/${run.panels_total}컷)`)
    else if (run.status === 'failed') blockers.push(`생성 실패${run.error ? `: ${run.error}` : ''}`)
    else if (run.status === 'queued' || run.status === 'cancelled') blockers.push(`${run.status === 'queued' ? '대기' : '취소'}된 실행 — 재실행 필요`)
    if (run.panels_fail > 0) blockers.push(`${run.panels_fail}컷 QC 미통과`)
    if (run.verbatim_mismatch > 0) blockers.push(`정본 불일치 ${run.verbatim_mismatch}건`)
    if (run.rule_violations > 0) blockers.push(`규칙 위반 ${run.rule_violations}건`)
    // 발행 게이트는 comic_books.panels_pass 가 권위(검수/발행 콘솔과 단일 소스)
    if (run.status === 'done' && detail.header && detail.header.panels_pass !== true) blockers.push('QC 게이트 미통과(panels_pass=false) — 발행 차단')
  }
  // 발행 가능 = 헤더 권위 게이트(검수/Published 와 동일 소스) + 최신 실행 완료
  const publishable = detail.header?.panels_pass === true && (!run || run.status === 'done')
  const dur = run?.finished_at && run.started_at ? Math.round((+new Date(run.finished_at) - +new Date(run.started_at)) / 1000) : null

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/comic/${detail.bookId}`} className="inline-flex items-center gap-1.5 font-body text-[12px] font-[500] text-[var(--t3)] hover:text-[var(--t1)]"><ArrowLeft size={14} /> 검수</Link>
        <span className="text-[var(--t4)]">/</span>
        <h1 className="inline-flex items-center gap-2 font-display text-[18px] font-[800] text-[var(--t1)]"><Cpu size={17} style={{ color: ACCENT }} /> 드레인 관측</h1>
        <span className="font-body text-[13px] text-[var(--t3)]">{detail.title}</span>
        <div className="flex-1" />
        <button onClick={() => router.refresh()} className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--t2)] hover:border-[var(--active)]"><RefreshCw size={13} /> 새로고침</button>
      </div>

      {/* 작업 범위 설명 */}
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0a` }}>
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          <b className="text-[var(--t1)]">드레인 범위</b> — 이 도서의 생성 작업: <code className="font-mono text-[11px]">plan</code>(컨텍스트) →
          <code className="font-mono text-[11px]"> content</code>(각색+컷 생성 · <b>gen-verified 폐루프 S0→S4</b>: 컷마다 자동 QC·수렴/재생성) →
          <code className="font-mono text-[11px]"> insert</code>(적재+판정 고정). 아래는 그 <b>실행/진행/자기발전(반복)/평가 이력</b>입니다.
        </p>
      </div>

      {!run ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-10 text-center font-body text-[13px] text-[var(--t3)]">
          아직 드레인 실행 기록이 없습니다. Catalog에서 큐 적재 후 <code className="font-mono">generate-comic.mjs</code>로 생성하면 여기에 실시간 기록됩니다.
        </div>
      ) : (
        <>
          {/* 실행 헤더 */}
          <div className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <RunStatus status={run.status} />
              <Badge>{run.backend ?? '—'}</Badge>
              {run.site && <Badge tone="var(--info)">{run.site}</Badge>}
              {run.model && <span className="font-body text-[12px] text-[var(--t3)]">{run.model}</span>}
              {run.style && <span className="font-mono text-[11px] text-[var(--t4)]">{run.style}</span>}
              <div className="flex-1" />
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--t3)]">
                <Clock size={12} /> {new Date(run.started_at).toLocaleString('ko-KR')}{dur != null ? ` · ${dur}s` : ''}
              </span>
            </div>
            {/* 진행 바 */}
            <div>
              <div className="mb-1 flex justify-between font-mono text-[11px] tabular-nums text-[var(--t3)]">
                <span>진행 {run.panels_done}/{run.panels_total}컷</span>
                <span>pass {run.panels_pass} · fail {run.panels_fail}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bd)]/50">
                <div className="h-full rounded-full" style={{ width: `${run.panels_total ? (run.panels_done / run.panels_total) * 100 : 0}%`, background: run.panels_fail > 0 ? 'var(--memory-shaky)' : 'var(--memory-stable)' }} />
              </div>
            </div>
            {/* KPI */}
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
              <Kpi label="자기발전 반복" value={run.iterations} Icon={Wrench} />
              <Kpi label="정본 불일치" value={run.verbatim_mismatch} tone={run.verbatim_mismatch ? 'var(--memory-risk)' : 'var(--t2)'} />
              <Kpi label="규칙 위반" value={run.rule_violations} tone={run.rule_violations ? 'var(--memory-shaky)' : 'var(--t2)'} />
              <Kpi label="비용(USD)" value={run.cost_usd ?? 0} />
              <Kpi label="컷 pass율" value={run.panels_total ? Math.round((run.panels_pass / run.panels_total) * 100) : 0} suffix="%" />
            </div>
            {run.note && <p className="font-body text-[12px] italic text-[var(--t3)]">{run.note}</p>}
          </div>

          {/* 발행 차단 사유 */}
          <div className="rounded-[var(--r-md)] border p-4" style={publishable ? { borderColor: 'color-mix(in srgb, var(--memory-stable) 40%, transparent)', background: 'color-mix(in srgb, var(--memory-stable) 7%, transparent)' } : { borderColor: 'color-mix(in srgb, var(--memory-shaky) 40%, transparent)', background: 'color-mix(in srgb, var(--memory-shaky) 7%, transparent)' }}>
            <p className="mb-1.5 inline-flex items-center gap-1.5 font-display text-[13px] font-[800]" style={{ color: publishable ? 'var(--memory-stable)' : 'var(--memory-shaky)' }}>
              {publishable ? <CircleCheck size={15} /> : <CircleSlash size={15} />}
              {publishable ? '발행 가능 — QC 게이트 통과' : '발행 차단 / 대기'}
            </p>
            {publishable ? (
              <p className="font-body text-[12px] text-[var(--t2)]">{detail.stage === 'published' ? '이미 학습자에게 발행되어 있습니다.' : '검수 화면에서 [게시 →] 하면 학습자에게 노출됩니다.'}</p>
            ) : (
              <ul className="flex flex-col gap-0.5 font-body text-[12px] text-[var(--t2)]">{blockers.map((b, k) => <li key={k}>• {b}</li>)}</ul>
            )}
          </div>

          {/* 컷 상태 그리드 */}
          {chapters.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">컷 상태 (위치·시도·판정)</h2>
              <div className="flex flex-wrap gap-3 font-body text-[11px] text-[var(--t3)]">
                {(['pass', 'fail', 'repairing', 'pending'] as const).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STATUS_TONE[s] }} />{s}</span>
                ))}
              </div>
              {chapters.map((ch) => (
                <div key={ch} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] text-[var(--t3)]">Stave {ch}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[...byPanel.values()].filter((e) => e.chapter_idx === ch).sort((a, b) => (a.page_order ?? 0) - (b.page_order ?? 0)).map((e) => (
                      <div key={`${e.chapter_idx}-${e.page_order}`} role="img" tabIndex={0}
                        aria-label={`컷 ${e.page_order} ${e.status ?? 'pending'}${e.attempt > 1 ? ` ${e.attempt}회 시도` : ''}${e.score != null ? ` ${e.score}점` : ''}`}
                        title={`컷 ${e.page_order} · ${e.phase} · ${e.status}${e.score != null ? ` · ${e.score}점` : ''}${e.attempt > 1 ? ` · ${e.attempt}회 시도` : ''}${e.message ? `\n${e.message}` : ''}`}
                        className="relative grid h-9 w-9 place-items-center rounded-[var(--r-sm)] font-mono text-[10px] font-[700] text-white focus:outline-none focus:ring-2 focus:ring-[var(--active)]"
                        style={{ background: STATUS_TONE[e.status ?? 'pending'] ?? 'var(--t4)' }}>
                        {e.page_order}
                        {/* 상태 글리프(색상만 정보 금지) */}
                        <span aria-hidden className="absolute bottom-0 left-0.5 text-[9px] leading-none opacity-90">{STATUS_GLYPH[e.status ?? 'pending'] ?? ''}</span>
                        {e.attempt > 1 && <span aria-hidden className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--memory-shaky)] text-[8px] text-white">{e.attempt}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 평가 이력 로그 */}
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">평가 이력 (최근 {Math.min(events.length, 40)})</h2>
            <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
              <table className="w-full min-w-[560px] text-left font-body text-[12px]">
                <thead><tr className="border-b border-[var(--bd)] bg-[var(--bg2)] text-[11px] uppercase text-[var(--t3)]"><th className="px-3 py-1.5">컷</th><th className="px-3 py-1.5">phase</th><th className="px-3 py-1.5">상태</th><th className="px-3 py-1.5">점수</th><th className="px-3 py-1.5">메시지</th></tr></thead>
                <tbody>
                  {[...events].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 40).map((e, k) => (
                    <tr key={k} className="border-b border-[var(--bd)]/50 last:border-0">
                      <td className="px-3 py-1.5 font-mono text-[var(--t2)]">S{e.chapter_idx}·{e.page_order}{e.attempt > 1 ? ` (#${e.attempt})` : ''}</td>
                      <td className="px-3 py-1.5 text-[var(--t3)]">{e.phase}</td>
                      <td className="px-3 py-1.5"><span style={{ color: STATUS_TONE[e.status ?? 'pending'] }}>{e.status}</span></td>
                      <td className="px-3 py-1.5 font-mono tabular-nums text-[var(--t2)]">{e.score ?? '—'}</td>
                      <td className="px-3 py-1.5 text-[var(--t3)]">{e.message ?? '—'}</td>
                    </tr>
                  ))}
                  {events.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--t3)]">이벤트 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* 실행 이력 */}
          {runs.length > 1 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">실행 이력 ({runs.length})</h2>
              <div className="flex flex-col gap-1">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-1.5 font-body text-[12px]">
                    <RunStatus status={r.status} small />
                    <span className="text-[var(--t2)]">{r.backend}</span>
                    <span className="text-[var(--t3)]">pass {r.panels_pass}/{r.panels_total} · 반복 {r.iterations}</span>
                    <div className="flex-1" />
                    <span className="font-mono text-[11px] text-[var(--t4)]">{new Date(r.started_at).toLocaleString('ko-KR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RunStatus({ status, small }: { status: string; small?: boolean }) {
  const meta: Record<string, { label: string; tone: string }> = {
    queued: { label: '대기', tone: 'var(--t3)' }, running: { label: '생성 중', tone: ACCENT },
    done: { label: '완료', tone: 'var(--memory-stable)' }, failed: { label: '실패', tone: 'var(--memory-risk)' },
    cancelled: { label: '취소', tone: 'var(--t3)' },
  }
  const m = meta[status] ?? { label: status, tone: 'var(--t3)' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-display font-[700] ${small ? 'text-[11px]' : 'text-[12px]'}`} style={{ color: m.tone, background: `color-mix(in srgb, ${m.tone} 12%, transparent)` }}>
      {status === 'running' && <Loader2 size={11} className="animate-spin" />}{m.label}
    </span>
  )
}
function Badge({ children, tone = 'var(--t2)' }: { children: ReactNode; tone?: string }) {
  return <span className="rounded-[var(--r-full)] px-2 py-0.5 font-display text-[12px] font-[700]" style={{ color: tone, background: 'var(--bg2)' }}>{children}</span>
}
function Kpi({ label, value, tone = 'var(--t1)', Icon, suffix }: { label: string; value: number; tone?: string; Icon?: typeof Wrench; suffix?: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
      <div className="inline-flex items-center gap-1">{Icon && <Icon size={13} style={{ color: tone }} />}<p className="font-display text-[17px] font-[800] tabular-nums" style={{ color: tone }}>{value}{suffix}</p></div>
      <p className="font-body text-[10px] text-[var(--t3)]">{label}</p>
    </div>
  )
}
