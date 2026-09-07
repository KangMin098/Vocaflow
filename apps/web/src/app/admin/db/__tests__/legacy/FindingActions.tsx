// apps/web/src/app/admin/db/FindingActions.tsx
//
// 발견 1건에 대한 사람의 조치 — **SQL 복사** 와 **상태 표시(확인함 / 해결)**.
//
// ⚠️ 이 컴포넌트에는 SQL 을 실행하는 경로가 없다. 일부러 없다.
//    VACUUM FULL 은 ACCESS EXCLUSIVE 락을 잡고 DROP INDEX 는 되돌리는 데 재생성 시간이 든다.
//    CLAUDE.md — 마이그레이션 자동 적용 금지. 관리자가 SQL 을 보고 자기 도구에서 돌린다.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { Check, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { FindingStatus } from '@/lib/admin/db-health/types'

const BTN =
  'min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50'

export function CopySqlButton({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false)

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopied(true)
      // 200ms 넘는 상태 표시는 모션이 아니라 피드백이다 — 끝나는 상태가 있다.
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // 클립보드 권한이 없으면 알리고 끝낸다. SQL 은 화면에 이미 보이므로 손으로 집을 수 있다.
      setCopied(false)
      window.alert('클립보드를 쓸 수 없어요 — 아래 SQL 을 직접 선택해 복사해 주세요')
    }
  }

  return (
    <button type="button" onClick={handle} className={BTN} aria-live="polite">
      {copied ? (
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <Copy size={12} strokeWidth={2} aria-hidden="true" />
      )}
      {copied ? '복사함' : 'SQL 복사'}
    </button>
  )
}

export function StatusButtons({ id, status }: { id: number; status: FindingStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState<FindingStatus | null>(null)
  const [failed, setFailed] = useState(false)

  const set = async (next: FindingStatus) => {
    if (busy) return
    setBusy(next)
    setFailed(false)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { error } = await client.rpc('admin_set_db_health_finding_status', {
        p_id: id,
        p_status: next,
      })
      if (error) throw error
      router.refresh()
    } catch (e) {
      console.warn('[admin/db] set finding status failed:', e instanceof Error ? e.message : e)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'ack' && (
        <button type="button" onClick={() => set('ack')} disabled={busy !== null} className={BTN}>
          {busy === 'ack' ? '표시 중…' : '확인함'}
        </button>
      )}
      <button
        type="button"
        onClick={() => set('resolved')}
        disabled={busy !== null}
        className={BTN}
      >
        {busy === 'resolved' ? '표시 중…' : '해결했음'}
      </button>
      {failed && (
        <span role="alert" className="break-keep font-body text-[11px] text-[var(--error-ink)]">
          바꾸지 못했어요 — admin 세션인지 확인해 주세요
        </span>
      )}
    </div>
  )
}
