// apps/web/src/app/(main)/pairflip/results/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { STORAGE_KEYS } from '@/components/pairflip/constants'
import { PairFlipResultScreen } from '@/components/pairflip/PairFlipResultScreen'
import type { PairFlipResultData } from '@/components/pairflip/types'

export default function PairFlipResultsPage() {
  const router = useRouter()
  const [result, setResult] = useState<PairFlipResultData | null>(null)

  useEffect(() => {
    let parsed: PairFlipResultData | null = null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.result)
      if (raw) parsed = JSON.parse(raw) as PairFlipResultData
    } catch {
      parsed = null
    }
    if (!parsed) {
      router.replace('/pairflip')
      return
    }
    setResult(parsed)
  }, [router])

  if (!result) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-body text-[14px] text-[var(--t3)]">결과 불러오는 중...</p>
      </div>
    )
  }

  return <PairFlipResultScreen result={result} />
}
