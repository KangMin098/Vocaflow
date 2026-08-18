// apps/web/src/app/admin/quality/CollectNowButton.tsx
//
// "지금 수집" — admin_collect_quality_metrics RPC(admin 검사 wrapper) 호출 후
// 서버 컴포넌트 재조회(router.refresh). nightly cron 을 기다리지 않고 즉석 스냅샷.
// dev-bypass(anon 세션)에선 RPC 가 'admin only' 로 거부 → 오류 상태 노출(정상).

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function CollectNowButton() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')

  const handleCollect = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      // admin_collect_quality_metrics 는 생성 타입 미반영 — 언타입 클라이언트 경유
      // (client.rpc 를 변수로 떼어내면 this 소실 — 반드시 인스턴스에서 직접 호출)
      const client = createClient() as unknown as SupabaseClient
      const { error } = await client.rpc('admin_collect_quality_metrics')
      if (error) throw error
      setStatus('done')
      router.refresh()
    } catch (e) {
      console.warn('[admin/quality] collect failed:', e instanceof Error ? e.message : e)
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCollect}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[#8B5CF6]/40 bg-[#8B5CF6]/8 px-3 py-1.5 font-display text-[12px] font-[600] text-[#8B5CF6] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#8B5CF6]/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className={status === 'loading' ? 'animate-spin' : ''}
        />
        {status === 'loading' ? '수집 중…' : '지금 수집'}
      </button>
      {status === 'done' && (
        <p role="status" className="font-body text-[11px] text-[var(--t2)]">
          새 스냅샷을 수집했어요
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="font-body text-[11px] text-[var(--t2)]">
          수집하지 못했어요 — admin 세션인지 확인해 주세요
        </p>
      )}
    </div>
  )
}
