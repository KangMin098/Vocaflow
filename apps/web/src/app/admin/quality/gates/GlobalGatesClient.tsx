// apps/web/src/app/admin/quality/gates/GlobalGatesClient.tsx
//
// 전역 불변식 패널 — 버튼을 눌러야 돈다(50초짜리 집계라서. `actions.ts` 머리주석 참조).

'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import { useState, useTransition } from 'react'

import { runGlobalGates, type GateRow } from './actions'

const VERDICT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PASS: { bg: 'bg-[#2E7D5A]/10', fg: 'text-[#2E7D5A]', label: 'PASS' },
  FAIL: { bg: 'bg-[#9C3A30]/12', fg: 'text-[#9C3A30]', label: 'FAIL' },
  WARN: { bg: 'bg-[#B5803A]/12', fg: 'text-[#B5803A]', label: 'WARN' },
}

export function GlobalGatesClient() {
  const [rows, setRows] = useState<GateRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tookMs, setTookMs] = useState<number | null>(null)
  const [pending, start] = useTransition()

  const run = () => {
    setError(null)
    start(async () => {
      const r = await runGlobalGates()
      if (r.ok) {
        setRows(r.rows)
        setTookMs(r.tookMs)
      } else {
        setRows(null)
        setError(r.error)
      }
    })
  }

  const byPipeline = new Map<string, GateRow[]>()
  for (const r of rows ?? []) {
    const list = byPipeline.get(r.pipeline) ?? []
    list.push(r)
    byPipeline.set(r.pipeline, list)
  }
  const criticalFails = (rows ?? []).filter(
    (r) => r.severity === 'critical' && r.verdict === 'FAIL',
  )
  const warns = (rows ?? []).filter((r) => r.verdict === 'WARN')
  const allGreen = (rows?.length ?? 0) > 0 && criticalFails.length === 0

  return (
    <>
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[16px] font-[800] text-[var(--t1)]">전역 불변식</h2>
            <p className="mt-1 max-w-xl font-body text-[13px] leading-[1.6] text-[var(--t2)]">
              콘텐츠 전량을 훑는 집계라 <strong className="text-[var(--t1)]">50초쯤</strong>{' '}
              걸립니다(실측 49.7초). 그래서 화면을 열 때 자동으로 돌지 않습니다 — 아래 「콘텐츠별
              게시 전 체크」만 하러 왔다면 이 비용을 치를 필요가 없습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 font-display text-[13px] font-[700] text-white transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#7C3AED] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={14} aria-hidden />
            )}
            {pending ? '재는 중… (약 50초)' : rows ? '다시 재기' : '지금 재기'}
          </button>
        </div>

        {pending && (
          <p className="mt-3 font-body text-[12.5px] text-[var(--t2)]" aria-live="polite">
            끝날 때까지 새로고침하지 마세요 — 같은 집계가 한 번 더 돌 뿐이고, 앞선 것도 끝까지
            돕니다.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-[var(--r-md)] border border-[#9C3A30]/40 bg-[#9C3A30]/6 p-3 font-body text-[13px] text-[var(--t1)]"
          >
            못 쟀습니다 — {error}
          </p>
        )}

        {rows && rows.length === 0 && !error && (
          <p className="mt-3 font-body text-[13px] text-[var(--t2)]">
            불변식이 하나도 오지 않았습니다 — admin 권한을 확인해 주세요.
          </p>
        )}

        {rows && rows.length > 0 && (
          <div
            className={`mt-4 rounded-[var(--r-md)] border p-4 ${
              allGreen ? 'border-[#2E7D5A]/40 bg-[#2E7D5A]/6' : 'border-[#9C3A30]/40 bg-[#9C3A30]/6'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-[18px] font-[800] text-[var(--t1)]">
                  {allGreen
                    ? '전역 게이트 통과 — 게시 신뢰 가능'
                    : `critical FAIL ${criticalFails.length}건 — 수정 필요`}
                </p>
                <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
                  불변식 {rows.length}개 검사 · critical FAIL {criticalFails.length} · warning{' '}
                  {warns.length}
                  {tookMs != null && ` · ${(tookMs / 1000).toFixed(1)}초 걸림`}
                </p>
              </div>
              <div
                className={`grid h-14 w-14 place-items-center rounded-full text-[22px] font-[800] ${
                  allGreen ? 'bg-[#2E7D5A] text-white' : 'bg-[#9C3A30] text-white'
                }`}
              >
                {allGreen ? '✓' : criticalFails.length}
              </div>
            </div>
          </div>
        )}
      </section>

      {[...byPipeline.entries()].map(([pipeline, list]) => (
        <section
          key={pipeline}
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6"
        >
          <h2 className="mb-4 flex items-center gap-3">
            <span className="rounded-[var(--r-sm)] bg-[#8B5CF6]/10 px-2 py-1 font-mono text-[11px] font-[700] uppercase tracking-[0.08em] text-[#8B5CF6]">
              {pipeline}
            </span>
          </h2>
          <ul className="space-y-2">
            {[...list]
              .sort((a, b) => (a.verdict === 'PASS' ? 1 : 0) - (b.verdict === 'PASS' ? 1 : 0))
              .map((r) => {
                const st = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.WARN
                return (
                  <li
                    key={r.invariant}
                    className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[700] ${st?.bg} ${st?.fg}`}
                      >
                        {st?.label}
                      </span>
                      <span className="font-body text-[13px] text-[var(--t1)]">{r.invariant}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--t2)]">
                      {r.verdict === 'PASS' ? '0' : `${r.fail_count}건`}
                    </span>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </>
  )
}
