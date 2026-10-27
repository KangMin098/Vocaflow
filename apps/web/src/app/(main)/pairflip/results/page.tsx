// apps/web/src/app/(main)/pairflip/results/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { STORAGE_KEYS } from '@/components/pairflip/constants'
import { PairFlipResultsGate, type StoredResult } from '@/components/pairflip/PairFlipResultsGate'

export default function PairFlipResultsPage() {
  const router = useRouter()
  const [result, setResult] = useState<StoredResult | null>(null)

  useEffect(() => {
    let parsed: StoredResult | null = null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.result)
      if (raw) parsed = JSON.parse(raw) as StoredResult
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
        <p className="font-body text-[14px] text-[var(--t2)]">결과 불러오는 중...</p>
      </div>
    )
  }

  return <PairFlipResultsGate stored={result} />
}
