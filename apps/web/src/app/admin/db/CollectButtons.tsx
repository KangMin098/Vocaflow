// apps/web/src/app/admin/db/CollectButtons.tsx
//
// "지금 수집"(5축 · 몇 초) 과 "정밀 점검"(⑥ integrity · 함수 128개 정적 분석 · 수십 초).
// 둘을 한 버튼으로 합치지 않는다 — 비용이 자릿수로 다르고, 급할 때 누르는 것도 다르다.
//
// dev-bypass(anon 세션)에선 RPC 가 'admin only' 로 거부한다 → 오류 문구 노출(정상 동작).

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { RefreshCw, ScanSearch } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type Status = 'idle' | 'loading' | 'done' | 'error'

interface Props {
  rpc: 'admin_collect_db_health_metrics' | 'admin_collect_db_health_integrity'
  label: string
  loadingLabel: string
  hint: string
  variant: 'primary' | 'ghost'
}

export function CollectButton({ rpc, label, loadingLabel, hint, variant }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [rows, setRows] = useState<number | null>(null)

  const handle = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      // rpc 를 변수로 떼어내면 this 가 소실된다 — 반드시 인스턴스에서 직접 호출.
      //
      // ⚠️ 이름도 **리터럴로 편다**(`client.rpc(rpc)` 가 아니라 두 갈래). 권한 감사
      //    (`lib/auth/__tests__/rpc-call-sites.test.ts`)는 호출 이름을 정적으로 모아
      //    "이 함수가 쓰이고 있는가" 를 판정하는데, 변수로 넘기면 그 목록에서 사라져
      //    **안 쓰는 RPC 로 오해**된다. prop 은 이미 리터럴 두 개의 유니온이라 갈라도 공짜다.
      const client = createClient() as unknown as SupabaseClient
      const { data, error } =
        rpc === 'admin_collect_db_health_metrics'
          ? await client.rpc('admin_collect_db_health_metrics')
          : await client.rpc('admin_collect_db_health_integrity')
      if (error) throw error
      setRows(typeof data === 'number' ? data : null)
      setStatus('done')
      router.refresh()
    } catch (e) {
      console.warn(`[admin/db] ${rpc} failed:`, e instanceof Error ? e.message : e)
      setStatus('error')
    }
  }

  const Icon = rpc === 'admin_collect_db_health_metrics' ? RefreshCw : ScanSearch
  const base =
    'inline-flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50'
  const skin =
    variant === 'primary'
      ? 'border border-[#8B5CF6]/40 bg-[#8B5CF6]/8 text-[#8B5CF6] hover:bg-[#8B5CF6]/15'
      : 'border border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handle} disabled={status === 'loading'} className={`min-h-[44px] ${base} ${skin}`}>
        <Icon
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className={status === 'loading' ? 'animate-spin' : ''}
        />
        {status === 'loading' ? loadingLabel : label}
      </button>
      <p
        role={status === 'error' ? 'alert' : 'status'}
        className="max-w-[220px] break-keep text-right font-body text-[11px] text-[var(--t2)]"
      >
        {status === 'error'
          ? '수집하지 못했어요 — admin 세션인지 확인해 주세요'
          : status === 'done'
            ? `새 스냅샷 ${rows ?? '?'}행을 기록했어요`
            : hint}
      </p>
    </div>
  )
}
