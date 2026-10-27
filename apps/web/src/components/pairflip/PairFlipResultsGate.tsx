// apps/web/src/components/pairflip/PairFlipResultsGate.tsx
'use client'

import { PairFlipResultScreen } from '@/components/pairflip/PairFlipResultScreen'
import type { PairFlipResultData } from '@/components/pairflip/types'
import { GameIdentityNotice } from '@/components/game/GameIdentityNotice'
import { useStoryAuthGuard, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'

/** 저장된 결과 — `owner` 는 그 판의 주인(짝 단어를 읽은 사용자 · 로그인 없음 = null). 없으면 주인 미상(예전 판). */
export type StoredResult = PairFlipResultData & { owner?: string | null }

/**
 * 결과 화면의 계정 경계 — 결과에는 학습한 단어 · 뜻이 들어 있다. 같은 브라우저를 다른 계정이 쓰면(다른 탭 로그인)
 * 직접 주소 · 뒤로가기로 이전 계정의 결과가 보였다(Codex 2026-10-27, 실제 로그인 · 합성 결과로 재현).
 * 저장된 주인과 지금 브라우저 신원이 긍정 확인으로 같을 때만 보인다. 주인 미상 결과는 지우지도 남의 것으로 채택하지도 않고 보류한다.
 * 결과를 다시 읽어도 점수 · 평가를 다시 기록하지 않는다(기록은 판이 끝날 때 한 번).
 */
export function PairFlipResultsGate({ stored, authSource }: { stored: StoredResult; authSource?: StoryAuthSource }) {
  const legacy = !('owner' in stored) || stored.owner === undefined
  const { status } = useStoryAuthGuard(legacy ? null : (stored.owner ?? null), authSource)
  if (legacy) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center" data-game-private="unowned" role="status">
        <h1 className="break-keep font-editorial text-[16px] font-[700] text-[var(--t1)]">이 결과는 누구의 판인지 확인할 수 없어요</h1>
        <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">지금 계정으로 새 판을 시작해 주세요.</p>
        <a
          href="/pairflip"
          data-game-reopen
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
        >
          새 판 시작
        </a>
      </div>
    )
  }
  if (status !== 'same') return <GameIdentityNotice status={status} reopenHref="/pairflip" />
  return <PairFlipResultScreen result={stored} />
}
