// apps/web/src/app/admin/db/ActionButton.tsx
//
// 조치 실행 버튼 — 이 화면이 **실제로 DB 를 건드리는 유일한 자리**.
//
// 세 단계로 갈린 이유는 CLAUDE.md 의 "마이그레이션 자동 적용 금지" 와 장애 대응 속도가
// 정면으로 부딪치기 때문이다. 둘 다 옳아서 조치를 셋으로 갈랐다:
//   safe    — 누르면 바로 돈다. 되돌릴 것이 없다(ANALYZE·쿼리 취소·잡 재개).
//   guarded — 사유를 적어야 버튼이 열린다. 사유 없는 강제 종료는 다음 사람이 해석 못 한다.
//   manual  — 여기 없다. SQL 만 보여 주고 사람이 밖에서 돌린다(VACUUM FULL·DROP INDEX).
//
// 허용 목록은 DB 함수에 박혀 있다. 이 컴포넌트는 이름을 넘길 뿐이라 여기서 임의 SQL 을
// 만들 수 없다 — 목록 밖 이름은 `허용 목록에 없는 조치` 로 되돌아온다.
//
// 실패를 조용히 삼키지 않는다. RPC 는 실패도 `ok:false` 로 돌려주므로(예외로 올리면 감사
// 로그가 함께 롤백된다) 화면은 그 문자열을 그대로 보여 준다.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { ACTION_CATALOG } from '@/lib/admin/db-health/types'
import type { ActionKey, ActionResult } from '@/lib/admin/db-health/types'

const BASE =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border px-2.5 py-1 font-display text-[11px] font-[600] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50'

const SKIN = {
  safe: 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]',
  guarded: 'border-[var(--warning-ink)]/35 bg-[var(--warning-light)] text-[var(--warning-ink)] hover:brightness-[0.97]',
} as const

export function ActionButton({
  action,
  target,
  findingId,
  label,
  onDone,
}: {
  action: ActionKey
  target?: string | null
  findingId?: number | null
  /** 문맥이 이미 대상을 말하고 있을 때 짧게 줄인 라벨. 없으면 카탈로그 라벨. */
  label?: string
  onDone?: () => void
}) {
  const router = useRouter()
  const meta = ACTION_CATALOG[action]
  const [phase, setPhase] = useState<'idle' | 'reason' | 'running' | 'done' | 'failed'>('idle')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const run = async () => {
    setPhase('running')
    setMessage(null)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { data, error } = await client.rpc('admin_run_db_health_action', {
        p_action: action,
        p_target: target ?? null,
        p_reason: reason || null,
        p_finding_id: findingId ?? null,
      })
      if (error) throw error
      const res = (data ?? { ok: false, error: '응답 없음' }) as ActionResult
      if (res.ok) {
        setPhase('done')
        setMessage(res.result ?? '실행함')
        setReason('')
        router.refresh()
        onDone?.()
      } else {
        setPhase('failed')
        setMessage(res.error ?? '알 수 없는 실패')
      }
    } catch (e) {
      setPhase('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  if (phase === 'reason') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={`reason-${action}-${target ?? 'all'}`}>
          {meta.label} 사유
        </label>
        <input
          id={`reason-${action}-${target ?? 'all'}`}
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유 (5자 이상)"
          className="min-h-[44px] w-[180px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[11px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
        />
        <button
          type="button"
          onClick={run}
          disabled={reason.trim().length < 5}
          className={`${BASE} ${SKIN.guarded}`}
        >
          <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" />
          실행
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase('idle')
            setReason('')
          }}
          className={`${BASE} ${SKIN.safe}`}
        >
          <X size={11} strokeWidth={2.5} aria-hidden="true" />
          취소
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        title={meta.effect}
        disabled={phase === 'running'}
        onClick={() => (meta.tier === 'guarded' ? setPhase('reason') : run())}
        className={`${BASE} ${SKIN[meta.tier]}`}
      >
        {phase === 'running' ? (
          <Loader2 size={11} strokeWidth={2.5} aria-hidden="true" className="animate-spin" />
        ) : meta.tier === 'guarded' ? (
          <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" />
        ) : phase === 'done' ? (
          <Check size={11} strokeWidth={2.5} aria-hidden="true" />
        ) : null}
        {phase === 'running' ? '실행 중…' : (label ?? meta.label)}
      </button>
      {message && (
        <span
          role={phase === 'failed' ? 'alert' : 'status'}
          className="break-keep font-mono text-[10px]"
          style={{ color: phase === 'failed' ? 'var(--error-ink)' : 'var(--t2)' }}
        >
          {phase === 'failed' ? '실패: ' : ''}
          {message}
        </span>
      )}
    </span>
  )
}
