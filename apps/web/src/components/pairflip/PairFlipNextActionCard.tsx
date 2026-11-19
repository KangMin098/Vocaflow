// apps/web/src/components/pairflip/PairFlipNextActionCard.tsx
// 결과 카드 하단 추천 액션 3개 — SDT 자율성 (강제 X · 제안만)

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { SealMark } from '@/components/ui/press'

import { PAIRFLIP_PLAY_HREF, storeReplayConfig } from './replay'
import type { PairFlipConfig } from './types'

interface ActionItem {
  label: string
  description: string
  href: string
  emoji: string
  /** 「한 번 더」 — 방금 끝낸 판의 설정으로 시작(링크 대신 저장 뒤 이동) */
  replay?: boolean
}

interface NextActionCardProps {
  accuracy: number
  /** 방금 끝낸 판의 실제 설정(T-0255) — 없으면(알 수 없는 값) 「한 번 더」는 허브로 */
  replay?: PairFlipConfig | null
}

function getActions(accuracy: number): ActionItem[] {
  // accuracy 기반 분기 — cold/warm/hot 추천 정합 (CLAUDE.md §17.5)
  if (accuracy >= 80) {
    return [
      {
        label: '한 번 더',
        description: '같은 난이도로 다시',
        href: '/pairflip/play',
        replay: true,
        emoji: '🔁',
      },
      {
        label: '난이도 올리기',
        description: '더 도전적인 단계로',
        href: '/pairflip',
        emoji: '🚀',
      },
      {
        label: 'WordVault',
        description: '단어 더 추가하기',
        href: '/wordvault',
        emoji: '📚',
      },
    ]
  }
  if (accuracy >= 40) {
    return [
      {
        label: '한 번 더',
        description: '익숙해질 때까지',
        href: '/pairflip/play',
        replay: true,
        emoji: '🔁',
      },
      {
        label: 'Flashcard',
        description: '차분히 익혀보기',
        href: '/flashcard',
        emoji: '🎯',
      },
      {
        label: '난이도 변경',
        description: '다른 단계 시도',
        href: '/pairflip',
        emoji: '🎚️',
      },
    ]
  }
  // cold — 격려 + 가벼운 모드 권장
  return [
    {
      label: 'Flashcard',
      description: '차분히 익혀보기',
      href: '/flashcard',
      emoji: '🎯',
    },
    {
      label: 'Easy 도전',
      description: '4장으로 가볍게',
      href: '/pairflip',
      emoji: '🌱',
    },
    {
      label: 'WordVault',
      description: '단어 살펴보기',
      href: '/wordvault',
      emoji: '📚',
    },
  ]
}

const CARD =
  'group flex min-h-[64px] items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-left transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[#F59E0B]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]'

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function PairFlipNextActionCard({ accuracy, replay = null }: NextActionCardProps) {
  const actions = getActions(accuracy)
  const router = useRouter()
  const [storeFailed, setStoreFailed] = useState(false)

  const startReplay = () => {
    if (!replay) {
      router.push('/pairflip')
      return
    }
    // 기존 시작 계약 그대로 — 결과 설정을 저장한 뒤에만 이동(실패하면 이전 · 없는 설정으로 시작하지 않는다)
    if (!storeReplayConfig(replay, sessionStore())) {
      setStoreFailed(true)
      return
    }
    setStoreFailed(false)
    router.push(PAIRFLIP_PLAY_HREF)
  }

  return (
    <>
      <section
        aria-label="다음 학습 추천"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {actions.map((a) => {
          const body = (
            <>
              <SealMark label={a.label} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[13px] font-[700] text-[var(--t1)]">
                  {a.label}
                </p>
                <p className="truncate font-body text-[11px] text-[var(--t2)]">
                  {a.description}
                </p>
              </div>
              <ArrowRight
                size={14}
                className="shrink-0 text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[#F59E0B]"
                aria-hidden
              />
            </>
          )
          return a.replay ? (
            <button key={a.label} type="button" onClick={startReplay} data-pairflip-replay className={CARD} aria-label={`${a.label} — ${a.description}`}>
              {body}
            </button>
          ) : (
            <Link key={a.label} href={a.href} className={CARD} aria-label={`${a.label} — ${a.description}`}>
              {body}
            </Link>
          )
        })}
      </section>
      {storeFailed ? (
        <p role="status" data-pairflip-replay-failed className="break-keep font-body text-[12px] text-[var(--t2)]">
          이 브라우저에 설정을 저장하지 못해 같은 난이도로 바로 시작할 수 없어요.{' '}
          <Link href="/pairflip" className="inline-flex min-h-[44px] items-center font-display font-[700] text-[var(--t1)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]">
            난이도를 직접 골라 시작하기
          </Link>
        </p>
      ) : null}
    </>
  )
}

