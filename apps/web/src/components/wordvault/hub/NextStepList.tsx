// apps/web/src/components/wordvault/hub/NextStepList.tsx
//
// WordVault Section 5 (v06.35 iOS) — 다음 한 단계 (단어장 추천).
//
// iOS Settings 인셋 그룹 + 컬러 캡슐 type 배지.
// recommend_word_sets_for_user RPC → 5-tier 추천.

'use client'

import { ChevronRight, Compass } from 'lucide-react'
import Link from 'next/link'

import { Capsule, Frame } from '@/components/ui/ios'
import type { RecommendedSetEntry } from '@/lib/wordvault/hub-query'

type RecommendationType =
  | 'primary'
  | 'stretch'
  | 'review'
  | 'specialty'
  | 'track_csat'
  | 'track_business'
  | 'track_academic'
  | 'fallback'

type CapsuleTone = 'brand' | 'green' | 'orange' | 'purple' | 'yellow' | 'blue' | 'pink' | 'gray'

const TYPE_META: Record<
  RecommendationType,
  { label: string; tone: CapsuleTone }
> = {
  primary: { label: '현재', tone: 'brand' },
  stretch: { label: '다음', tone: 'green' },
  review: { label: '복습', tone: 'orange' },
  specialty: { label: '관심', tone: 'purple' },
  track_csat: { label: '수능', tone: 'yellow' },
  track_business: { label: '비즈', tone: 'blue' },
  track_academic: { label: '학술', tone: 'pink' },
  fallback: { label: '추천', tone: 'gray' },
}

interface NextStepListProps {
  /** 서버가 이미 추린 추천 세트(최대 5). */
  sets: RecommendedSetEntry[]
  /** 왜 비었는가 — 진단 전인지, 조회는 됐는데 결과가 없는지. 둘을 뭉치면 안내가 틀린다. */
  status: 'ok' | 'no-diagnostic' | 'empty'
  vLevel: number | null
}

/**
 * ⚠️ **스스로 조회하지 않는다** — `lib/wordvault/hub-query.ts` 가 서버에서 한 벌로 읽는다.
 *    예전에는 이 컴포넌트만으로 `auth.getUser()` + `user_profiles` + 추천 RPC 를 왕복했고,
 *    허브의 다른 섹션들도 같은 일을 해서 한 화면이 `auth.getUser()` 를 8번 불렀다.
 */
export function NextStepList({ sets, status, vLevel }: NextStepListProps) {
  if (status === 'no-diagnostic') {
    return (
      <Frame title="다음 한 단계">
        <div className="flex items-center justify-between gap-4 rounded-[18px] bg-[var(--bg2)] px-5 py-4">
          <p className="font-body text-[13px] text-[var(--t2)]">
            진단을 받으면 수준에 맞는 단어장을 추천해드려요.
          </p>
          <Link
            href="/diagnostic"
            className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-4 py-2 font-display text-[12.5px] font-[600] text-white shadow-[0_2px_8px_rgba(88,86,214,0.25)] transition-all duration-[var(--dur-fast)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
          >
            <Compass size={13} aria-hidden />
            진단 받기
          </Link>
        </div>
      </Frame>
    )
  }

  if (sets.length === 0) {
    return (
      <Frame title="다음 한 단계">
        <p className="font-body text-[13px] text-[var(--t2)]">
          현재 추천 가능한 단어장이 없어요.
        </p>
      </Frame>
    )
  }

  return (
    <Frame
      title="다음 한 단계"
      meta={vLevel != null ? `V${vLevel} 기준` : undefined}
    >
      <div className="overflow-hidden rounded-[14px] bg-[var(--bg2)]">
        <div className="divide-y divide-[var(--bd)]/60 bg-[var(--bg)]">
          {sets.map((set) => {
            // 방어 — recommend RPC 가 TYPE_META 미등록 tier 를 반환하면 undefined.tone 크래시 (v06.183 /hub 복구)
            const typeMeta = TYPE_META[set.type as RecommendationType] ?? TYPE_META.fallback
            return (
              <Link
                key={set.id}
                href={`/library/vocab#set-${set.slug}`}
                className="group flex items-center gap-3 px-4 py-4 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] active:bg-[var(--bg3)]"
              >
                <Capsule tone={typeMeta.tone}>{typeMeta.label}</Capsule>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-1 font-display text-[14px] font-[600] tracking-[-0.012em] text-[var(--t1)] group-hover:text-[var(--p)]">
                    {set.title}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[var(--t2)]">
                    {set.wordCount != null && set.wordCount > 0 && (
                      <span className="tabular-nums">{set.wordCount}개</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="shrink-0 text-[var(--t2)]/70" aria-hidden />
              </Link>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

