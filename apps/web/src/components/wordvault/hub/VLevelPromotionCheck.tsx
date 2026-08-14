// apps/web/src/components/wordvault/hub/VLevelPromotionCheck.tsx
//
// Phase 2E wire-up — 학습 활동 누적 기반 V-Level 자동 상향 체크 UI.
//
// 사용자 명시 클릭 → RPC auto_promote_v_level_for_user → 3가지 결과:
//   1) promoted: V5 → V6 (celebration)
//   2) not yet: mastered/threshold 진행도 표시
//   3) no diagnostic: /diagnostic CTA
//
// 위치: WordVault hub RecommendedSetsSection 아래 (자율적 trigger, automatic spam 회피)

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PromotionResult {
  promoted: boolean
  old_level: number | null
  new_level: number | null
  mastered_count: number
  threshold: number
  reason: string
}

export function VLevelPromotionCheck() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PromotionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCheck() {
    setLoading(true)
    setError(null)
    setResult(null)

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user?.id) {
      setError('로그인이 필요해요')
      setLoading(false)
      return
    }

    const { data, error: rpcErr } = await supabase.rpc(
      'auto_promote_v_level_for_user',
      { p_user_id: userData.user.id },
    )

    if (rpcErr) {
      setError(rpcErr.message)
      setLoading(false)
      return
    }

    const r = Array.isArray(data) ? data[0] : data
    setResult(r as PromotionResult)
    setLoading(false)

    // 상향 시 데이터 새로고침 → 추천 자동 갱신
    if (r?.promoted) {
      setTimeout(() => router.refresh(), 1200)
    }
  }

  // 미진단 분기 UI
  if (result && !result.promoted && result.reason.includes('진단 미완료')) {
    return (
      <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 text-center font-body text-[12px] text-[var(--t2)]">
        {result.reason}
      </div>
    )
  }

  // promoted celebration
  if (result?.promoted) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--active)]/40 bg-[var(--active-light)] p-4">
        <Sparkles size={20} className="text-[var(--active)]" />
        <div className="flex-1">
          <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
            축하해요 — V{result.old_level} → <span className="text-[var(--active)]">V{result.new_level}</span> 상향
          </p>
          <p className="mt-0.5 font-body text-[11px] text-[var(--t2)]">
            {result.reason} · 추천 단어장이 자동 갱신돼요
          </p>
        </div>
      </div>
    )
  }

  // not-yet (mastered/threshold 진행도)
  if (result && !result.promoted && result.mastered_count >= 0 && result.threshold > 0) {
    const pct = Math.min((result.mastered_count / result.threshold) * 100, 100)
    return (
      <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
        <div className="mb-2 flex items-center justify-between font-body text-[11px] text-[var(--t2)]">
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp size={12} className="text-[var(--p)]" />
            다음 V-Level 진행도
          </span>
          <span className="tabular-nums">
            {result.mastered_count} / {result.threshold}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
          <div
            className="h-full rounded-[var(--r-full)] bg-[var(--p)] transition-[width] duration-[var(--dur-slow)] ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 font-body text-[10px] text-[var(--t2)]">
          {result.reason}
        </p>
      </div>
    )
  }

  // 초기 상태 — 버튼만
  return (
    <div className="mt-3 flex items-center justify-between rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
      <div className="flex-1">
        <p className="font-display text-[12px] font-[600] text-[var(--t2)]">
          학습 활동 기반 V-Level 갱신
        </p>
        <p className="mt-0.5 font-body text-[10px] text-[var(--t2)]">
          최근 30일 학습으로 다음 단계 진입 여부 확인
        </p>
      </div>
      <button
        onClick={() => void handleCheck()}
        disabled={loading}
        // 44px 하한 — 실측 94x32 (a11y 스윕 17회차)
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] active:scale-[0.97] disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <RefreshCw size={12} />
        )}
        {loading ? '확인 중…' : '갱신 확인'}
      </button>
      {error && (
        <p role="alert" className="ml-2 font-body text-[11px] text-[var(--error-ink)]">
          {error}
        </p>
      )}
    </div>
  )
}
