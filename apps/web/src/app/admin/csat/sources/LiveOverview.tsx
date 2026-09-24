// apps/web/src/app/admin/csat/sources/LiveOverview.tsx
//
// **맨 위 요약 — 지금 DB 에서 센 수 + 「지금 다시 세기」 단추.** (2026-09-24 · 사용자 요청 「버튼식 실시간 조회」)
//
// 예전 이 자리는 커밋된 스냅샷(「실시간 집계가 아닌 스캔 결과입니다」)이라, 판정 규격이 바뀌거나 원문을
// 지워도 사람이 스캔을 돌려 커밋하기 전까지 옛 수를 말했다. 지금은 첫 화면이 DB 에서 세고,
// 단추를 누르면 그 자리에서 다시 센다(0.1초). 첫 화면과 단추가 **같은 함수**(`loadSourceLive`)를 쓴다.
//
// ⚠️ 못 셌으면 스냅샷 수를 **스냅샷이라고 밝히고** 보여 주고, 무슨 일인지 · 어떻게 고치는지 적는다.
//   0 으로 뭉개거나 조용히 옛 수로 바꿔치지 않는다.

'use client'

import { ArrowRight, Clock3, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import type { SourceLiveResult } from '@/lib/textbook/source-live'

/** KST 시각 — 로캘 API 없이 만든다(서버·브라우저가 같은 글자를 내야 하이드레이션이 안 깨진다). */
function kst(iso: string | null, withDate = true): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const k = new Date(t + 9 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  const time = `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}:${p(k.getUTCSeconds())}`
  return withDate ? `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${time}` : time
}

const n = (v: number) => v.toLocaleString('ko-KR')

export function LiveOverview({
  initial,
  snapshot,
  onOpen,
  onHowTo,
}: {
  initial: SourceLiveResult
  /** 못 셌을 때만 쓰는 옛 수 — 스냅샷이라고 밝혀서 보인다. */
  snapshot: { usable: number; total: number; measuredAt: string }
  onOpen: () => void
  onHowTo: () => void
}) {
  const [live, setLive] = useState<SourceLiveResult>(initial)
  const [busy, setBusy] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)

  async function recount() {
    setBusy(true)
    setNetError(null)
    try {
      const res = await fetch('/api/admin/csat/sources?live=1', { cache: 'no-store' })
      const body = (await res.json()) as SourceLiveResult
      setLive(body)
    } catch (e) {
      setNetError(`서버에 닿지 못했습니다(${e instanceof Error ? e.message : '알 수 없음'}) — 잠시 뒤 다시 누르세요. 화면의 수는 바로 전에 센 값 그대로입니다.`)
    } finally {
      setBusy(false)
    }
  }

  const ok = live.ok
  const usable = ok ? live.usable : snapshot.usable
  const total = ok ? live.total : snapshot.total
  const mixedPolicy = ok && live.policyMin != null && live.policyMax != null && live.policyMin !== live.policyMax

  return (
    <section
      aria-label="지금 교재에 실을 수 있는 원문"
      className="flex flex-col gap-3 border-b border-[var(--bd)] pb-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[44px] flex-col items-start gap-0.5 rounded-[var(--r-md)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        <span className="font-body text-[13px] text-[var(--t1)]">교재에 실을 수 있는 원문</span>
        <span className="flex items-baseline gap-1.5">
          <strong className="font-mono text-[28px] font-[700] tabular-nums text-[var(--t1)]">{n(usable)}</strong>
          <span className="font-body text-[13px] text-[var(--t2)]">/ {n(total)}편</span>
          <ArrowRight size={16} aria-hidden className="text-[var(--t2)]" />
        </span>
        <small className="font-body text-[12px] text-[var(--t2)]">적격 판정과 제외 이유 보기</small>
      </button>

      <div className="flex flex-col gap-1.5 sm:items-end sm:text-right">
        <button
          type="button"
          onClick={() => void recount()}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[var(--r-md)] border border-[var(--p)] px-3.5 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:opacity-60 sm:self-end"
        >
          <RefreshCw size={15} strokeWidth={2} aria-hidden className={busy ? 'animate-spin motion-reduce:animate-none' : ''} />
          {busy ? '세는 중…' : '지금 다시 세기'}
        </button>
        <div role="status" aria-live="polite" className="flex flex-col gap-0.5 font-body text-[12px] text-[var(--t2)]">
          {ok ? (
            <>
              <span className="inline-flex items-center gap-1 sm:justify-end">
                <Clock3 size={13} aria-hidden /> 지금 DB 기준 · {kst(live.countedAt, false)}에 셈
              </span>
              <span>
                판정 시각 {kst(live.measuredMin)} ~ {kst(live.measuredMax)} KST
              </span>
              <span>
                판정 규격 v{live.policyMax ?? '?'}
                {mixedPolicy ? ` — ⚠️ v${live.policyMin} 판정이 섞여 있습니다. 옛 규격 원문은 재판정이 필요합니다.` : ''}
              </span>
            </>
          ) : (
            <span className="text-[var(--error-ink)]">
              {live.error}. 위 수는 {kst(snapshot.measuredAt)} KST 스냅샷입니다. 「지금 다시 세기」를 눌러 다시 시도하고, 계속되면 DB 함수
              csat_source_live_rollup 이 있는지 확인하세요.
            </span>
          )}
          {netError ? <span className="text-[var(--error-ink)]">{netError}</span> : null}
          <button
            type="button"
            onClick={onHowTo}
            className="inline-flex min-h-[44px] items-center font-display text-[12px] font-[700] text-[var(--p)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] sm:self-end"
          >
            학년별·원천별 표는 스캔 결과 — 갱신 방법
          </button>
        </div>
      </div>
    </section>
  )
}
