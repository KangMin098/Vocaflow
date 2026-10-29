// apps/web/src/components/flashcard/FlashcardViewerGate.tsx
'use client'

/**
 * 카드 세션의 계정 경계 — 서버가 쿠키 세션(getUser)으로 확인해 넘긴 단어·평가 세션은 `viewerId` 의 것이다.
 * 브라우저 신원이 그 사람으로 **긍정 확인(same)** 될 때만 세션을 그린다(T-0191 WordVaultViewerGate 와 같은 useStoryAuthGuard).
 * - checking(확인 전 · 기준선 실패): 카드·정답·평가를 그리지 않는다.
 * - changed(다른 계정 · 로그아웃): 세션을 내린다 — 상태·키보드 평가·음성(unmount 때 cancel)이 함께 사라져, 옛 화면의 새 평가가
 *   그 사이 바뀐 전역 대기열 주인(lib/srs/session-storage queueOwner)으로 들어가지 않는다. 이미 쌓인 대기 평가는 그 주인 것으로 남는다.
 *   돌아왔다고 옛 화면을 되살리지 않는다(다시 열기 = 서버가 지금 쿠키로 다시 그림).
 * uid 는 비교에만 쓴다(DOM · URL 없음).
 */
import type { ReactNode } from 'react'

import { useStoryAuthGuard, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { loginUrlWithReturn } from '@/lib/auth/redirect'

export function FlashcardViewerGate({
  viewerId,
  reopenHref,
  authSource,
  children,
}: {
  viewerId: string | null
  /** 같은 범위로 카드를 다시 여는 내부 주소(서버가 검증한 값만) */
  reopenHref: string
  /** 시험 · 하네스 주입(없으면 StoryAuthSourceContext → 실제 브라우저 세션). */
  authSource?: StoryAuthSource
  children: ReactNode
}) {
  const { status } = useStoryAuthGuard(viewerId, authSource)
  if (status === 'same') {
    return (
      <div data-card-private="shown" className="contents">
        {children}
      </div>
    )
  }
  const changed = status === 'changed'
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center" data-card-private={status} role="status" aria-live="polite">
      <h1 className="break-keep font-editorial text-[16px] font-[700] text-[var(--t1)]">
        {changed ? '로그인 상태가 바뀌었어요' : '로그인한 계정을 확인하고 있어요'}
      </h1>
      <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
        {changed ? '이 화면의 카드와 평가를 멈췄어요. 지금 로그인한 계정으로 다시 열어 주세요.' : '확인이 끝나면 카드를 보여 드려요.'}
      </p>
      {/* 서버가 지금 쿠키로 다시 그리도록 전체 이동(<a>) — 낡은 세션 상태를 재사용하지 않는다. */}
      <a
        href={reopenHref}
        data-card-reopen
        className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
      >
        카드 다시 열기
      </a>
      {changed && (
        <a
          href={loginUrlWithReturn(reopenHref)}
          data-card-login
          className="inline-flex min-h-[44px] items-center px-4 font-display text-[13px] font-[700] text-[var(--t2)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
        >
          로그인 화면으로
        </a>
      )}
    </div>
  )
}
