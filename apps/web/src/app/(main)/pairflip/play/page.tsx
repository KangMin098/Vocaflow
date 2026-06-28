// apps/web/src/app/(main)/pairflip/play/page.tsx
// 풀스크린 라우트 (*/play) — Sidebar/FlowNav 자동 숨김.
// sessionStorage 의 config 가 없으면 /pairflip 로 redirect.

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { STORAGE_KEYS } from '@/components/pairflip/constants'
import type { PairFlipMockWord } from '@/components/pairflip/mock-data'
import { PairFlipGameScreen } from '@/components/pairflip/PairFlipGameScreen'
import type { PairFlipConfig } from '@/components/pairflip/types'
import { fetchDuePairs, PAIRFLIP_MAX_PAIRS } from '@/lib/pairflip/due-pairs'
import { createClient } from '@/lib/supabase/client'

export default function PairFlipPlayPage() {
  const router = useRouter()
  const [config, setConfig] = useState<PairFlipConfig | null>(null)
  // undefined = 로딩 중, PairFlipMockWord[] = 로드 완료(빈/부족이면 hook 이 mock 폴백)
  const [pairs, setPairs] = useState<PairFlipMockWord[] | undefined>(undefined)

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

    // 사용자 SRS 큐 due 단어 fetch — 부족하면 빈 배열(→ hook mock 폴백 + 영속화 skip)
    void (async () => {
      try {
        const client = createClient()
        const {
          data: { user },
        } = await client.auth.getUser()
        if (!user) {
          setPairs([])
          return
        }
        setPairs(await fetchDuePairs(client, user.id, PAIRFLIP_MAX_PAIRS))
      } catch {
        setPairs([]) // 실패 시 mock 폴백
      }
    })()
  }, [router])

  // config + pairs 둘 다 준비될 때까지 게임(=hook) 마운트 보류 — 실 페어를 mount 시점에 주입.
  if (!config || pairs === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-[var(--t3)]">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        <p className="font-body text-[14px]">세션을 준비하고 있어요</p>
      </div>
    )
  }

  return <PairFlipGameScreen config={config} pairs={pairs} />
}
