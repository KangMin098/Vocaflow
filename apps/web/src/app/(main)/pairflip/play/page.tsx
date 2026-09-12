// apps/web/src/app/(main)/pairflip/play/page.tsx
// 풀스크린 라우트 (*/play) — Sidebar/FlowNav 자동 숨김.
//   · 일반: sessionStorage 의 config(레벨/모드) 필요 — 없으면 /pairflip redirect.
//   · 계획 launch: ?set=/?text= 있으면 그 자료 단어로(default Normal config, scoped-pairs).

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { STORAGE_KEYS } from '@/components/pairflip/constants'
import type { PairFlipMockWord } from '@/components/pairflip/mock-data'
import { PairFlipGameScreen } from '@/components/pairflip/PairFlipGameScreen'
import type { PairFlipConfig } from '@/components/pairflip/types'
import { contentRefFromScope, type ContentRef } from '@/lib/content/content-ref'
import { fetchDuePairs, PAIRFLIP_MAX_PAIRS } from '@/lib/pairflip/due-pairs'
import { fetchScopedPairs } from '@/lib/pairflip/scoped-pairs'
import { createClient } from '@/lib/supabase/client'

/** 계획 launch(scoped) 진입 default — 사전 config 없이 바로 시작. */
const SCOPED_CONFIG: PairFlipConfig = { level: 'normal', mode: 'word_meaning' }

export default function PairFlipPlayPage() {
  const router = useRouter()
  const [config, setConfig] = useState<PairFlipConfig | null>(null)
  // undefined = 로딩 중, PairFlipMockWord[] = 로드 완료(빈/부족이면 hook 이 mock 폴백)
  const [pairs, setPairs] = useState<PairFlipMockWord[] | undefined>(undefined)
  // 무엇으로 학습했나 — scores.content_ref 로 적재된다. 스코프는 이미 이 라우트가
  // 읽고 있었지만 점수 적재에는 전달되지 않아 PairFlip 기록만 자료 미상으로 남았다.
  const [content, setContent] = useState<ContentRef | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const set = params.get('set') ?? undefined
    const text = params.get('text') ?? undefined
    const chapterNum = Number(params.get('chapter'))
    const chapter = Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null
    const scoped = !!(set || text)
    // 스코프가 없으면 어댑터가 '내 복습 큐' 를 돌려준다 — 필드 이름을 여기서 쓰지 않는다.
    setContent(contentRefFromScope({ set, text, chapter }))

    // 계획 launch — 그 자료 단어로(사전 config 불요, default 사용)
    if (scoped) {
      setConfig(SCOPED_CONFIG)
      void (async () => {
        try {
          const client = createClient()
          const {
            data: { user },
          } = await client.auth.getUser()
          setPairs(await fetchScopedPairs(client, { set, text, chapter, userId: user?.id ?? null }))
        } catch {
          setPairs([]) // 실패 시 mock 폴백
        }
      })()
      return
    }

    // 일반 진입 — sessionStorage config 필요
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
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-[var(--t2)]">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        <p className="font-body text-[14px]">세션을 준비하고 있어요</p>
      </div>
    )
  }

  return <PairFlipGameScreen config={config} pairs={pairs} content={content ?? undefined} />
}
