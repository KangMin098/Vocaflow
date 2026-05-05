// apps/web/src/app/(main)/pairflip/play/page.tsx
// 풀스크린 라우트 (*/play) — Sidebar/FlowNav 자동 숨김.
// sessionStorage 의 config 가 없으면 /pairflip 로 redirect.

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { STORAGE_KEYS } from '@/components/pairflip/constants'
import { PairFlipGameScreen } from '@/components/pairflip/PairFlipGameScreen'
import type { PairFlipConfig } from '@/components/pairflip/types'

export default function PairFlipPlayPage() {
  const router = useRouter()
  const [config, setConfig] = useState<PairFlipConfig | null>(null)

  useEffect(() => {
    let parsed: PairFlipConfig | null = null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.config)
      if (raw) parsed = JSON.parse(raw) as PairFlipConfig
    } catch {
      parsed = null
    }
    if (!parsed) {
      router.replace('/pairflip')
      return
    }
    setConfig(parsed)
  }, [router])

  if (!config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-body text-[14px] text-[var(--t3)]">세션 준비 중...</p>
      </div>
    )
  }

  return <PairFlipGameScreen config={config} />
}
